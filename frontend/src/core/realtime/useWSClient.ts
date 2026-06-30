import { useCallback, useEffect, useState } from 'react';
import type { WSOutgoingMessage, EventRouterPayload } from './types';
import defaultWsManager, { WSManager } from '@/services/wsManager';
import { ConnectionState } from './wsConstants';
import { useAuthStore } from '@/features/auth/store/authStore';

export { ConnectionState } from './wsConstants';

export default function useWSClient(url: string | null, customManager?: WSManager) {
  const manager = customManager || defaultWsManager;
  const [connectionState, setConnectionState] = useState<ConnectionState>(manager.getStatus().connectionState);
  const [reconnectError, setReconnectError] = useState<string | null>(manager.getStatus().reconnectError);
  const accessToken = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    const unsubscribe = manager.onStatusChange((state, error) => {
      setConnectionState(state);
      setReconnectError(error);
    });
    return unsubscribe;
  }, [manager]);

  useEffect(() => {
    if (url) {
      manager.retain();
      manager.connect(url);
      return () => {
        manager.release();
      };
    }
  }, [url, manager]);



  const send = useCallback((message: WSOutgoingMessage) => {
    manager.send(message);
  }, [manager]);

  const onMessage = useCallback((type: string, handler: (data: EventRouterPayload) => void) => {
    return manager.on(type, handler);
  }, [manager]);

  const disconnect = useCallback(() => {
    manager.disconnect();
  }, [manager]);

  const reconnect = useCallback(() => {
    if (!url) return;
    manager.reconnectTo(url);
  }, [url, manager]);

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
