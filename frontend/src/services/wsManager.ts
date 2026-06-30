import { ConnectionState, WS_CLOSE_NORMAL, WS_CLOSE_SESSION_INVALID, WS_CLOSE_TOKEN_EXPIRED, WS_CLOSE_UNAUTHORIZED, RECONNECT_PAUSE_MESSAGE } from '@/core/realtime/wsConstants';
import { createEventRouter, EventRouter } from '@/core/realtime/wsEventRouter';
import { buildResumeUrl, createSessionResumeState, flushAckBatch, flushMessageQueue, pushToMessageQueue, resetSessionState, SessionResumeState } from '@/core/realtime/wsSessionResume';
import { WSOutgoingMessage, EventRouterPayload } from '@/core/realtime/types';
import { useAuthStore } from '@/features/auth/store/authStore';
import { clearBrowserAuthState } from '@/features/auth/services/authStateCleanup';
import { refreshAccessTokenSingleFlight } from '@/features/auth/services/refreshService';
import { createReconnectPolicy, ReconnectPolicy } from '@/core/realtime/wsReconnectPolicy';

export type StatusCallback = (state: ConnectionState, error: string | null, retryCount?: number, nextRetryIn?: number | null) => void;

class WSManager {
  private ws: WebSocket | null = null;
  private url: string | null = null;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private reconnectError: string | null = null;
  
  private eventRouter: EventRouter;
  private sessionState: SessionResumeState;
  private reconnectPolicy: ReconnectPolicy;
  
  private statusListeners: Set<StatusCallback> = new Set();
  
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private ackTimer: ReturnType<typeof setTimeout> | null = null;
  private isIntentionalClose: boolean = false;
  private isConnecting: boolean = false;
  private authRefreshAttempts: number = 0;
  
  private messageUnsubs: Map<string, Map<(data: EventRouterPayload) => void, () => void>> = new Map();

  private pingIntervalTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

  private useLocalStorage: boolean;

  constructor(useLocalStorage = true) {
    this.useLocalStorage = useLocalStorage;
    this.eventRouter = createEventRouter();
    this.sessionState = createSessionResumeState(this.useLocalStorage);
    this.reconnectPolicy = createReconnectPolicy();
    // Startup validation for VITE_WS_URL
    const configuredUrl = import.meta.env.VITE_WS_URL || import.meta.env.VITE_WS_BASE_URL;
    if (!configuredUrl) {
      const msg = '[WS] FATAL: VITE_WS_URL is not set. Add it to your .env file.';
      if (import.meta.env.PROD) throw new Error(msg);
      else console.error(msg);  // DEV: warn without crashing
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.clearHeartbeat();
        } else {
          if (this.connectionState === ConnectionState.DISCONNECTED || this.connectionState === ConnectionState.FAILED || this.connectionState === ConnectionState.RECONNECTING) {
            this.reconnect();
          } else if (this.connectionState === ConnectionState.CONNECTED) {
            this.startHeartbeat();
          }
        }
      });
    }
  }
  
  public onStatusChange(callback: StatusCallback) {
    this.statusListeners.add(callback);
    callback(this.connectionState, this.reconnectError);
    return () => {
      this.statusListeners.delete(callback);
    };
  }
  
  private updateStatus(state: ConnectionState, error: string | null = null, nextRetryIn: number | null = null) {
    this.connectionState = state;
    this.reconnectError = error;
    this.statusListeners.forEach(cb => cb(state, error, this.reconnectPolicy.attempt, nextRetryIn));
  }
  
  public getStatus() {
    return {
      connectionState: this.connectionState,
      isConnected: this.connectionState === ConnectionState.CONNECTED,
      reconnectError: this.reconnectError,
      sessionId: this.sessionState.sessionId
    };
  }

  public connect(url: string | null = this.url, tokenOverride: string | null = null) {
    if (!url) return;
    
    // If connecting to a new URL (e.g. new session), disconnect old and reset state
    const isUrlUpgrade = () => {
      if (!this.url || !url) return false;
      try {
        // Simple string manipulation to check if the only difference is the session_id param
        const urlA = new URL(this.url.replace('ws://', 'http://').replace('wss://', 'https://'));
        const urlB = new URL(url.replace('ws://', 'http://').replace('wss://', 'https://'));
        urlA.searchParams.delete('session_id');
        urlB.searchParams.delete('session_id');
        return urlA.toString() === urlB.toString();
      } catch {
        return false;
      }
    };

    if (this.url !== url) {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) && isUrlUpgrade()) {
        if (import.meta.env.DEV) console.log('[WS] Upgrading session_id without reconnecting');
        this.url = url;
        return;
      }

      // Close old socket but don't reset token state
      if (this.ws) {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null; // prevent reconnect loop
        this.ws.close(1000, 'session-change');
        this.ws = null;
      }
      this.clearTimers();
      this.isConnecting = false;
      this.isIntentionalClose = false; // confirm this exists
      // Reset session state ONLY (not auth state)
      resetSessionState(this.sessionState, this.useLocalStorage);
    }
    
    this.url = url;
    
    // Don't connect if already connecting or open
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    if (this.reconnectPolicy.isPaused || this.reconnectPolicy.shouldPause()) {
      if (this.reconnectPolicy.shouldPause()) this.pauseReconnect();
      return;
    }

    const token = tokenOverride ?? useAuthStore.getState().accessToken;
    if (!token) {
      this.isConnecting = false;
      if (!this.isIntentionalClose) {
        if (import.meta.env.DEV) console.warn('[WS] connect(): token not ready, scheduling retry');
        this.scheduleReconnect('token-not-ready');
      } else {
        this.clearReconnectTimer();
        this.updateStatus(ConnectionState.DISCONNECTED);
      }
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    
    if (this.isConnecting) return;
    this.isConnecting = true;
    
    this.updateStatus(ConnectionState.RECONNECTING);
    this.isIntentionalClose = false;
    
    try {
      const socketUrl = buildResumeUrl(url, this.sessionState) || url;
      const socket = new WebSocket(socketUrl, ["access_token", token]);
      socket.binaryType = 'arraybuffer';
      this.ws = socket;
      
      socket.onopen = () => {
        if (this.ws !== socket) return;

        // Re-evaluate token at the exact moment of connection
        const currentToken = tokenOverride ?? useAuthStore.getState().accessToken;
        if (!currentToken) {
          if (import.meta.env.DEV) console.warn('[WS] onopen: token null, scheduling retry');
          socket.close(WS_CLOSE_NORMAL, 'Token expired during connection handshake');
          this.ws = null;
          this.isConnecting = false;
          this.scheduleReconnect('Token expired during connection handshake');
          return;
        }

        this.isConnecting = false;
        this.updateStatus(ConnectionState.CONNECTING);
        
        this.reconnectPolicy.reset();
        this.authRefreshAttempts = 0;

        // ONLY the auth message - session_id already in URL
        socket.send(JSON.stringify({ type: 'auth', token: currentToken }));
      };
      
      socket.onmessage = (event: MessageEvent) => {
        if (this.ws !== socket) return;
        this.clearPongTimeout();
        this.eventRouter.route(event, {
          onSeq: (seq) => {
            if (seq > this.sessionState.lastSeq) this.sessionState.lastSeq = seq;
            this.scheduleAck();
          },
          onSessionId: (id) => {
            if (!this.sessionState.sessionId) this.sessionState.sessionId = id;
          },
          onReady: (message) => {
            const readyData = message.data ?? {};
            if (typeof readyData.session_id === 'string' && readyData.session_id.length > 0) {
              this.sessionState.sessionId = readyData.session_id;
              if (typeof window !== 'undefined' && this.useLocalStorage) {
                localStorage.setItem('virt_session_id', readyData.session_id);
              }
            }
            if (readyData.resumed === false) {
              this.sessionState.lastSeq = Number.isFinite(readyData.last_seq) ? Number(readyData.last_seq) : 0;
            } else if (Number.isFinite(readyData.last_seq)) {
              this.sessionState.lastSeq = Math.max(this.sessionState.lastSeq, Number(readyData.last_seq));
            }
            this.updateStatus(ConnectionState.CONNECTED);
            this.startHeartbeat();
            flushMessageQueue(this.sessionState, (payload) => this.ws?.send(payload), console as any);
            this.scheduleAck();
            this.reconnectPolicy.reset();
          }
        });
      };
      
      socket.onerror = () => {
        if (this.isIntentionalClose) return;
        if (import.meta.env.DEV) console.warn('[WS] Backend offline/error');
      };
      
      socket.onclose = (event: CloseEvent) => {
        if (this.ws !== socket) return;
        this.isConnecting = false;
        this.clearHeartbeat();
        this.ws = null;
        
        if (this.isIntentionalClose) {
          this.updateStatus(ConnectionState.DISCONNECTED);
          return;
        }
        
        if (event.code === WS_CLOSE_TOKEN_EXPIRED) {
          this.clearReconnectTimer();
          if (this.authRefreshAttempts >= 1) {
            clearBrowserAuthState();
            useAuthStore.getState().logout();
            this.updateStatus(ConnectionState.DISCONNECTED, 'Session expired. Please log in again.');
            return;
          }
          this.authRefreshAttempts++;
          this.updateStatus(ConnectionState.RECONNECTING);
          
          refreshAccessTokenSingleFlight()
            .then((data) => {
              if (this.isIntentionalClose) return;
              useAuthStore.setState({ accessToken: data.access_token });
              this.connect(this.url, data.access_token);
            })
            .catch(() => {
              clearBrowserAuthState();
              useAuthStore.getState().logout();
              this.updateStatus(ConnectionState.DISCONNECTED, 'Session expired. Please log in again.');
            });
          return;
        }
        
        if (event.code === WS_CLOSE_UNAUTHORIZED) {
          this.clearReconnectTimer();
          this.updateStatus(ConnectionState.DISCONNECTED, 'Session authorization failed. Please log in again.');
          return;
        }
        
        if (event.code === WS_CLOSE_SESSION_INVALID) {
          resetSessionState(this.sessionState, this.useLocalStorage);
        }
        
        if (event.code === WS_CLOSE_NORMAL || event.code === 1001 || event.code === 1012) {
          this.clearReconnectTimer();
          this.reconnectPolicy.reset();
          this.updateStatus(ConnectionState.DISCONNECTED, event.code === 1012 ? 'Session connected in another tab.' : null);
          return;
        }
        
        this.scheduleReconnect(`Socket closed with code ${event.code}`);
      };
    } catch (err: unknown) {
      this.isConnecting = false;
      this.scheduleReconnect(err instanceof Error ? err.message : 'Failed to connect');
    }
  }

  private connectionRefs: number = 0;
  private disconnectTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

  public retain() {
    this.connectionRefs++;
    if (this.disconnectTimeoutTimer) {
      clearTimeout(this.disconnectTimeoutTimer);
      this.disconnectTimeoutTimer = null;
    }
  }

  public release() {
    this.connectionRefs = Math.max(0, this.connectionRefs - 1);
    if (this.connectionRefs === 0) {
      // Delay actual disconnection to handle React 18 Strict Mode
      this.disconnectTimeoutTimer = setTimeout(() => {
        this.disconnect(true);
      }, 100);
    }
  }

  public disconnect(intentional = true) {
    if (intentional) {
      this.connectionRefs = 0;
    }
    this.isIntentionalClose = intentional;
    this.isConnecting = false;
    if (intentional) {
      this.reconnectPolicy.reset();
    }
    this.clearTimers();
    
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close(WS_CLOSE_NORMAL);
      this.ws = null;
    }
    
    this.updateStatus(ConnectionState.DISCONNECTED);
    if (intentional) {
      resetSessionState(this.sessionState, this.useLocalStorage);
    }
    this.authRefreshAttempts = 0;
  }
  
  public reconnectTo(url: string) {
    this.isIntentionalClose = false;
    this.isConnecting = false;
    this.reconnectPolicy.reset();
    this.connect(url);
  }
  
  public reconnect() {
    if (this.connectionState === ConnectionState.RECONNECTING || this.connectionState === ConnectionState.CONNECTING) return;
    this.updateStatus(ConnectionState.RECONNECTING);
    this.reconnectPolicy.reset();
    this.authRefreshAttempts = 0;
    this.clearReconnectTimer();
    
    this.disconnect(false);
    this.connect();
  }

  public send(message: WSOutgoingMessage | ArrayBuffer | Blob | ArrayBufferView) {
    const isBinary = message instanceof ArrayBuffer || message instanceof Blob || ArrayBuffer.isView(message);
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.connectionState === ConnectionState.CONNECTED) {
      try {
        this.ws.send(isBinary ? message as any : JSON.stringify(message));
      } catch (err) {
        if (!isBinary) pushToMessageQueue(this.sessionState, message as WSOutgoingMessage);
      }
    } else if (!isBinary) {
      pushToMessageQueue(this.sessionState, message as WSOutgoingMessage);
    }
  }
  
  public on(type: string, handler: (data: EventRouterPayload) => void) {
    const unsub = this.eventRouter.onMessage(type, handler);
    
    if (!this.messageUnsubs.has(type)) {
      this.messageUnsubs.set(type, new Map());
    }
    this.messageUnsubs.get(type)!.set(handler, unsub);
    
    return () => this.off(type, handler);
  }
  
  public off(type: string, handler: (data: EventRouterPayload) => void) {
    const typeMap = this.messageUnsubs.get(type);
    if (typeMap) {
      const unsub = typeMap.get(handler);
      if (unsub) {
        unsub();
        typeMap.delete(handler);
      }
    }
  }

  private scheduleAck() {
    if (this.ackTimer) return;
    this.ackTimer = setTimeout(() => {
      this.ackTimer = null;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        flushAckBatch(this.sessionState, (payload) => this.ws?.send(payload));
      }
    }, 80);
  }

  private clearTimers() {
    this.clearReconnectTimer();
    this.clearHeartbeat();
    if (this.ackTimer) {
      clearTimeout(this.ackTimer);
      this.ackTimer = null;
    }
  }

  private clearHeartbeat() {
    if (this.pingIntervalTimer) {
      clearInterval(this.pingIntervalTimer);
      this.pingIntervalTimer = null;
    }
    this.clearPongTimeout();
  }

  private clearPongTimeout() {
    if (this.pongTimeoutTimer) {
      clearTimeout(this.pongTimeoutTimer);
      this.pongTimeoutTimer = null;
    }
  }

  private startHeartbeat() {
    this.clearHeartbeat();
    if (import.meta.env.DEV) console.debug('[WS] Starting heartbeat');
    this.pingIntervalTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      this.send({ type: 'ping' } as any);
      
      this.clearPongTimeout();
      this.pongTimeoutTimer = setTimeout(() => {
        if (import.meta.env.DEV) console.error('[WS] Pong timeout, disconnecting');
        if (this.ws) {
          this.ws.close(WS_CLOSE_NORMAL, 'Pong timeout');
        } else {
          this.disconnect();
          this.scheduleReconnect('Pong timeout');
        }
      }, 5000);
    }, 25000);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private pauseReconnect() {
    this.clearReconnectTimer();
    this.reconnectPolicy.pause();
    this.updateStatus(ConnectionState.FAILED, RECONNECT_PAUSE_MESSAGE);
  }

  private scheduleReconnect(reason?: string) {
    if (this.reconnectPolicy.isPaused) return;
    if (this.reconnectPolicy.shouldPause()) {
      this.pauseReconnect();
      return;
    }
    
    const rawDelay = this.reconnectPolicy.nextDelay();
    const jitterFactor = 0.85 + Math.random() * 0.3;
    const delay = Math.max(1000, Math.floor(rawDelay * jitterFactor));
    
    this.updateStatus(ConnectionState.RECONNECTING, undefined, delay);
    this.clearReconnectTimer();
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }
}

export { WSManager };
const wsManager = new WSManager();
export default wsManager;
