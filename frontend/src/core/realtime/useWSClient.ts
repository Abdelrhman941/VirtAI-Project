import defaultWsManager, { WSManager } from '@/core/realtime/wsManager';
import { useCallback, useEffect, useState } from 'react';
import type { EventRouterPayload, WSOutgoingMessage } from './types';
import { ConnectionState } from './wsConstants';

export { ConnectionState } from './wsConstants';

export default function useWSClient(url: string | null, customManager?: WSManager) {
  const manager = customManager || defaultWsManager;
  const [connectionState, setConnectionState] = useState<ConnectionState>(manager.getStatus().connectionState);
  const [reconnectError, setReconnectError] = useState<string | null>(manager.getStatus().reconnectError);

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
