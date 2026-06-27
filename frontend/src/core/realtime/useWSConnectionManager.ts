import { clearBrowserAuthState } from '@/features/auth/services/authStateCleanup';
import { refreshAccessTokenSingleFlight } from '@/features/auth/services/refreshService';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ConnectionState, RECONNECT_PAUSE_MESSAGE, WS_CLOSE_NORMAL, WS_CLOSE_SESSION_INVALID, WS_CLOSE_TOKEN_EXPIRED, WS_CLOSE_UNAUTHORIZED } from './wsConstants';
import { EventRouter } from './wsEventRouter';
import { createReconnectPolicy, ReconnectPolicy } from './wsReconnectPolicy';
import { buildResumeUrl, SessionResumeState } from './wsSessionResume';

// Typed WebSocket extension — avoids `any` casts on custom props.
interface ManagedWebSocket extends WebSocket {
  _mountId: number;
  _instanceId: string;
  _sourceUrl: string;
}

export interface ConnectionManagerDeps {
  wsRef: React.MutableRefObject<WebSocket | null>;
  urlRef: React.MutableRefObject<string | null>;
  accessTokenRef: React.MutableRefObject<string | null>;
  sessionStateRef: React.MutableRefObject<SessionResumeState>;
  eventRouterRef: React.MutableRefObject<EventRouter>;
  scheduleAck: (wsRef: React.MutableRefObject<WebSocket | null>) => void;
  flushQueue: (wsRef: React.MutableRefObject<WebSocket | null>, sessionStateRef: React.MutableRefObject<SessionResumeState>) => void;
  resetSession: () => void;
  clearAckTimer: () => void;
  logBackendOffline: () => void;
}

export function useWSConnectionManager(deps: ConnectionManagerDeps) {
  const {
    wsRef, urlRef, accessTokenRef, sessionStateRef, eventRouterRef,
    scheduleAck, flushQueue, resetSession, clearAckTimer, logBackendOffline
  } = deps;

  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.OFFLINE);
  const [reconnectError, setReconnectError] = useState<string | null>(null);

  const reconnectPolicyRef = useRef<ReconnectPolicy>(createReconnectPolicy());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIntentionalCloseRef = useRef(false);
  const isConnectingRef = useRef(false);
  const mountIdRef = useRef(0);
  const initTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectedAtRef = useRef(0);
  const authRefreshAttemptsRef = useRef(0);

  // Stable ref to the connect function so reconnect timers can call the
  // latest version without being part of any dependency array.
  const connectRef = useRef<(overrideUrl?: string | null, overrideToken?: string | null) => void>(() => {});

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const cleanupTimers = useCallback(() => {
    clearReconnectTimer();
    clearAckTimer();
    if (initTimerRef.current) {
      clearTimeout(initTimerRef.current);
      initTimerRef.current = null;
    }
  }, [clearReconnectTimer, clearAckTimer]);

  const clearReconnectState = useCallback(() => {
    reconnectPolicyRef.current.reset();
    setReconnectError(null);
  }, []);

  const pauseReconnect = useCallback(() => {
    clearReconnectTimer();
    reconnectPolicyRef.current.pause();
    setReconnectError(RECONNECT_PAUSE_MESSAGE);
    setConnectionState(ConnectionState.OFFLINE);
  }, [clearReconnectTimer]);

  const scheduleReconnect = useCallback(
    (reason?: string, expectedUrl: string | null = urlRef.current) => {
      const latestUrl = urlRef.current;
      if (!latestUrl || (expectedUrl && latestUrl !== expectedUrl)) {
        clearReconnectTimer();
        setConnectionState(ConnectionState.OFFLINE);
        return;
      }

      if (reconnectPolicyRef.current.isPaused) return;

      if (reconnectPolicyRef.current.shouldPause()) {
        if (import.meta.env.DEV) {
          console.error('[WS] Maximum reconnect attempts reached (5). Pausing retries.');
          if (reason) console.warn('[WS] Last reconnect reason:', reason);
        }
        pauseReconnect();
        return;
      }

      const rawDelay = reconnectPolicyRef.current.nextDelay();
      // Add +/- 15% jitter to prevent thundering herd problems
      const jitterFactor = 0.85 + Math.random() * 0.3;
      const delay = Math.max(1000, Math.floor(rawDelay * jitterFactor));
      if (import.meta.env.DEV) {
        console.debug(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectPolicyRef.current.attempt}/5)`);
      }

      setReconnectError(null);
      setConnectionState(ConnectionState.RECONNECTING);
      clearReconnectTimer();

      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        if (!urlRef.current || urlRef.current !== expectedUrl) return;
        connectRef.current(expectedUrl, null);
      }, delay);
    },
    [clearReconnectTimer, pauseReconnect, urlRef]
  );

  const connect = useCallback(
    (overrideUrl: string | null = null, overrideToken: string | null = null) => {
      const currentUrl = overrideUrl || urlRef.current;

      if (!currentUrl) {
        clearReconnectTimer();
        setConnectionState(ConnectionState.OFFLINE);
        return;
      }

      if (reconnectPolicyRef.current.isPaused || reconnectPolicyRef.current.shouldPause()) {
        if (reconnectPolicyRef.current.shouldPause()) pauseReconnect();
        return;
      }

      // Prefer an explicitly supplied token (e.g. freshly refreshed) so we
      // never reconnect with the stale value still sitting in the React Ref.
      const currentAccessToken = overrideToken ?? accessTokenRef.current;
      if (!currentAccessToken) {
        clearReconnectTimer();
        setConnectionState(ConnectionState.OFFLINE);
        return;
      }

      if (wsRef.current) {
        const state = wsRef.current.readyState;
        if (state === WebSocket.CONNECTING || state === WebSocket.OPEN) return;
      }

      if (isConnectingRef.current) return;

      isConnectingRef.current = true;
      const currentMountId = mountIdRef.current;
      const instanceId = Math.random().toString(36).substring(7);

      // The UI state is strictly derived from the native action of instantiating the socket.
      // We do not mutate this manually inside UI event handlers.
      setConnectionState(ConnectionState.RECONNECTING);

      try {
        const socketUrl = buildResumeUrl(currentUrl, sessionStateRef.current) || currentUrl;
        const protocols = currentAccessToken ? ['access_token', currentAccessToken] : [];
        const socket = new WebSocket(socketUrl, protocols) as ManagedWebSocket;

        wsRef.current = socket;
        socket._mountId = currentMountId;
        socket._instanceId = instanceId;
        socket._sourceUrl = currentUrl;
        isIntentionalCloseRef.current = false;

        socket.onopen = () => {
          if (socket._instanceId !== instanceId || socket._mountId !== mountIdRef.current) {
            socket.close();
            return;
          }

          isConnectingRef.current = false;
          connectedAtRef.current = Date.now();
          setConnectionState(ConnectionState.INITIALIZING);

          initTimerRef.current = setTimeout(() => {
            initTimerRef.current = null;
            setConnectionState((prev) => (prev === ConnectionState.INITIALIZING ? ConnectionState.ONLINE : prev));
          }, 800);

          reconnectPolicyRef.current.reset();
          authRefreshAttemptsRef.current = 0;
          flushQueue(wsRef, sessionStateRef);
        };

        socket.onmessage = (event: MessageEvent) => {
          eventRouterRef.current.route(event, {
            onSeq: (seq) => {
              if (seq > sessionStateRef.current.lastSeq) sessionStateRef.current.lastSeq = seq;
              scheduleAck(wsRef);
            },
            onSessionId: (id) => {
              if (!sessionStateRef.current.sessionId) sessionStateRef.current.sessionId = id;
            },
            onReady: (message) => {
              const readyData = message.data ?? {};
              if (typeof readyData.session_id === 'string' && readyData.session_id.length > 0) {
                sessionStateRef.current.sessionId = readyData.session_id;
              }
              if (readyData.resumed === false) {
                sessionStateRef.current.lastSeq = Number.isFinite(readyData.last_seq) ? Number(readyData.last_seq) : 0;
              } else if (Number.isFinite(readyData.last_seq)) {
                sessionStateRef.current.lastSeq = Math.max(
                  sessionStateRef.current.lastSeq,
                  Number(readyData.last_seq)
                );
              }

              if (initTimerRef.current) {
                clearTimeout(initTimerRef.current);
                initTimerRef.current = null;
              }
              setConnectionState(ConnectionState.ONLINE);
              scheduleAck(wsRef);
              clearReconnectState();
            }
          });
        };

        socket.onerror = () => {
          if (isIntentionalCloseRef.current) return;
          logBackendOffline();
        };

        socket.onclose = (event: CloseEvent) => {
          if (socket._instanceId !== instanceId || socket._mountId !== mountIdRef.current) return;

          const wasIntentional = isIntentionalCloseRef.current;
          isConnectingRef.current = false;
          wsRef.current = null;

          if (initTimerRef.current) {
            clearTimeout(initTimerRef.current);
            initTimerRef.current = null;
          }

          if (wasIntentional) {
            setConnectionState(ConnectionState.OFFLINE);
            return;
          }

          const latestUrl = urlRef.current;
          if (!latestUrl || latestUrl !== socket._sourceUrl) {
            clearReconnectTimer();
            setConnectionState(ConnectionState.OFFLINE);
            return;
          }

          if (event.code === WS_CLOSE_TOKEN_EXPIRED) {
            clearReconnectTimer();
            if (authRefreshAttemptsRef.current >= 1) {
              clearBrowserAuthState();
              useAuthStore.getState().logout();
              setConnectionState(ConnectionState.OFFLINE);
              setReconnectError('Session expired. Please log in again.');
              return;
            }

            authRefreshAttemptsRef.current += 1;
            setConnectionState(ConnectionState.RECONNECTING);
            refreshAccessTokenSingleFlight()
              .then((data) => {
                if (isIntentionalCloseRef.current) return;
                const freshToken: string = data.access_token;
                // Update the store so the rest of the app has the new token.
                useAuthStore.setState({ accessToken: freshToken });
                isIntentionalCloseRef.current = false;
                // Pass the fresh token *directly* — do not rely on the React
                // Ref (accessTokenRef) which may not have updated yet because
                // the useEffect that syncs it has not yet committed.
                connectRef.current(socket._sourceUrl, freshToken);
              })
              .catch(() => {
                clearBrowserAuthState();
                useAuthStore.getState().logout();
                setConnectionState(ConnectionState.OFFLINE);
                setReconnectError('Session expired. Please log in again.');
              });
            return;
          }

          if (event.code === WS_CLOSE_UNAUTHORIZED) {
            clearReconnectTimer();
            setConnectionState(ConnectionState.OFFLINE);
            setReconnectError('Session authorization failed. Please log in again.');
            return;
          }

          if (event.code === WS_CLOSE_SESSION_INVALID) {
            resetSession();
          }

          const openDuration = Date.now() - connectedAtRef.current;
          if (openDuration < 2000 && sessionStateRef.current.sessionId && connectedAtRef.current > 0) {
            resetSession();
          }

          if (event.code === WS_CLOSE_NORMAL || event.code === 1001 || event.code === 1012) {
            clearReconnectTimer();
            clearReconnectState();
            setConnectionState(ConnectionState.OFFLINE);
            if (event.code === 1012) {
              setReconnectError('Session connected in another tab.');
            }
            return;
          }

          scheduleReconnect(`Socket closed with code ${event.code}`, socket._sourceUrl);
        };
      } catch (err: unknown) {
        isConnectingRef.current = false;
        logBackendOffline();
        scheduleReconnect(
          err instanceof Error ? err.message : 'Failed to create WebSocket connection',
          currentUrl
        );
      }
    },
    [urlRef, accessTokenRef, sessionStateRef, wsRef, clearReconnectTimer, pauseReconnect, flushQueue, scheduleAck, clearReconnectState, logBackendOffline, scheduleReconnect, resetSession, eventRouterRef]
  );

  // Keep the stable ref pointing at the latest connect so reconnect timers
  // and the token-refresh callback always call the current closure.
  // This is an intentional pattern — assigning to a ref in render is safe
  // because the assignment itself has no observable side-effects.
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    isIntentionalCloseRef.current = true;
    reconnectPolicyRef.current.reset();
    cleanupTimers();

    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close(WS_CLOSE_NORMAL);
      wsRef.current = null;
    }

    setConnectionState(ConnectionState.OFFLINE);
    resetSession();
    reconnectPolicyRef.current.reset();
    authRefreshAttemptsRef.current = 0;
    setReconnectError(null);
  }, [cleanupTimers, resetSession, wsRef]);

  const reconnect = useCallback(() => {
    reconnectPolicyRef.current.reset();
    authRefreshAttemptsRef.current = 0;
    clearReconnectTimer();
    setReconnectError(null);
    
    // TRUE TEARDOWN: Explicitly destroy the existing WebSocket
    isIntentionalCloseRef.current = true;
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close(WS_CLOSE_NORMAL, 'Explicit reconnect requested');
      wsRef.current = null;
    }
    
    // Reset connection locks to allow immediate rebuild
    isConnectingRef.current = false;
    isIntentionalCloseRef.current = false;
    
    connect();
  }, [clearReconnectTimer, connect, wsRef]);

  const mount = useCallback(() => {
    mountIdRef.current = Math.random();
  }, []);

  const unmount = useCallback(() => {
    isIntentionalCloseRef.current = true;
    isConnectingRef.current = false;
    reconnectPolicyRef.current.reset();
    resetSession();
    connectedAtRef.current = 0;
    authRefreshAttemptsRef.current = 0;
    cleanupTimers();
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close(WS_CLOSE_NORMAL);
      wsRef.current = null;
    }
    setConnectionState(ConnectionState.OFFLINE);
    setReconnectError(null);
  }, [resetSession, cleanupTimers, wsRef]);

  return {
    connectionState,
    reconnectError,
    setConnectionState,
    connect,
    disconnect,
    reconnect,
    mount,
    unmount,
    clearReconnectTimer,
  };
}
