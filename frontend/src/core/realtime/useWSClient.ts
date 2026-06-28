import { useCallback, useEffect, useState } from 'react';
import type { WSOutgoingMessage, EventRouterPayload } from './types';
import wsManager from '@/services/wsManager';
import { ConnectionState } from './wsConstants';
import { useAuthStore } from '@/features/auth/store/authStore';

export { ConnectionState } from './wsConstants';

export default function useWSClient(url: string | null) {
  const [connectionState, setConnectionState] = useState<ConnectionState>(wsManager.getStatus().connectionState);
  const [reconnectError, setReconnectError] = useState<string | null>(wsManager.getStatus().reconnectError);
  const accessToken = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    const unsubscribe = wsManager.onStatusChange((state, error) => {
      setConnectionState(state);
      setReconnectError(error);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (url) {
      wsManager.connect(url);
    } else {
      wsManager.disconnect();
    }
  }, [url]);

  useEffect(() => {
    const currentState = wsManager.getStatus().connectionState;
    if (accessToken && (currentState === ConnectionState.DISCONNECTED || currentState === ConnectionState.FAILED || currentState === ConnectionState.RECONNECTING)) {
      // Re-trigger connection if we just logged in or if we were waiting for the token
      wsManager.connect(url);
    }
  }, [accessToken, url]);

  const send = useCallback((message: WSOutgoingMessage) => {
    wsManager.send(message);
  }, []);

  const onMessage = useCallback((type: string, handler: (data: EventRouterPayload) => void) => {
    return wsManager.on(type, handler);
  }, []);

  const disconnect = useCallback(() => {
    wsManager.disconnect();
  }, []);

  const reconnect = useCallback(() => {
    if (!url) return;
    wsManager.reconnectTo(url);
  }, [url]);

  return {
    connectionState,
    isConnected: connectionState === ConnectionState.CONNECTED,
    send,
    onMessage,
    disconnect,
    reconnect,
    reconnectError,
  };
}
