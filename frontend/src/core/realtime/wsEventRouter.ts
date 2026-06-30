import { logger } from '@/shared/utils/logger';
import type { EventRouterPayload, RealtimeLogger, WSIncomingMessage } from './types';

export interface EventRouterCallbacks {
  onSeq: (seq: number) => void;
  onSessionId: (id: string) => void;
  onReady: (message: WSIncomingMessage) => void;
}

export interface EventRouter {
  onMessage: (type: string, handler: (data: EventRouterPayload) => void) => () => void;
  route: (event: MessageEvent, callbacks: EventRouterCallbacks) => void;
}

export function createEventRouter(): EventRouter {
  const handlers: Record<string, Set<(data: EventRouterPayload) => void>> = {};

  return {
    onMessage(type, handler) {
      if (!handlers[type]) {
        handlers[type] = new Set();
      }
      handlers[type].add(handler);

      return () => {
        const set = handlers[type];
        if (set) {
          set.delete(handler);
          if (set.size === 0) {
            delete handlers[type];
          }
        }
      };
    },

    route(event, callbacks) {
      try {
        if ((typeof Blob !== 'undefined' && event.data instanceof Blob) || event.data instanceof ArrayBuffer) {
          window.dispatchEvent(new CustomEvent('audio_chunk', { detail: event.data }));
          return;
        }

        const message: WSIncomingMessage =
          typeof event.data === 'string' ? (JSON.parse(event.data) as WSIncomingMessage) : (event.data as WSIncomingMessage);

        console.log(`[WS IN] ${message.type}`, message.data);

        if (Number.isFinite(message.seq_id)) {
          callbacks.onSeq(Number(message.seq_id));
        }

        if (!message.type) {
          if (import.meta.env.DEV) {
            console.warn('[WS] Invalid message: missing type field', message);
          }
          return;
        }

        const messageData = message.data ?? {};
        if (
          typeof messageData.session_id === 'string' &&
          messageData.session_id.length > 0
        ) {
          callbacks.onSessionId(messageData.session_id);
        }

        if (message.type === 'ready') {
          callbacks.onReady(message);
        }

        if (message.type === 'pong') {
          if (import.meta.env.DEV) {
            console.debug('[WS] Received pong');
          }
          return;
        }

        const typeHandlers = handlers[message.type];
        const ignoredTypes = ['chat.abort', 'ready'];

        if (typeHandlers && typeHandlers.size > 0) {
          const payloadData: EventRouterPayload = (message.data !== undefined && message.data !== null)
            ? message.data 
            : ('data' in message && message.data === null ? {} : message) as unknown as EventRouterPayload;
          typeHandlers.forEach((handler) => handler(payloadData));
        } else if (import.meta.env.DEV && !ignoredTypes.includes(message.type)) {
          console.warn('[WS] Unknown message type:', message.type);
        }
      } catch (err: unknown) {
        (logger as RealtimeLogger).error('[WS] Failed to parse message:', err);
      }
    }
  };
}
