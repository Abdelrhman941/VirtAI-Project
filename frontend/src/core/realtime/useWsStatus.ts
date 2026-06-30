import { useEffect, useState } from 'react';
import { ConnectionState } from './wsConstants';
import wsManager from '@/services/wsManager';

export interface WsStatus {
  status: ConnectionState;
  retryCount: number;
  nextRetryIn: number | null;
  error: string | null;
}

export function useWsStatus(): WsStatus {
  const [status, setStatus] = useState<WsStatus>({
    status: wsManager.getStatus().connectionState,
    retryCount: 0,
    nextRetryIn: null,
    error: wsManager.getStatus().reconnectError,
  });

  useEffect(() => {
    const unsubscribe = wsManager.onStatusChange((connectionState, error, retryCount = 0, nextRetryIn = null) => {
      setStatus({
        status: connectionState,
        retryCount,
        nextRetryIn,
        error,
      });
    });
    return unsubscribe;
  }, []);

  return status;
}
