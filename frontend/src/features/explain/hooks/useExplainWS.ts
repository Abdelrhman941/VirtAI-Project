import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { WSManager } from '@/services/wsManager';
import { ConnectionState } from '@/core/realtime/wsConstants';
import { useAuthStore } from '@/features/auth/store/authStore';

export type PresentationState = 'EXPLAINING' | 'AWAITING' | 'ANSWERING';

interface ExplainWSProps {
  documentId: string | null;
  onTokens: (tokens: string) => void;
  onStateChange: (state: PresentationState) => void;
  onSlideChange: (index: number, total: number) => void;
  onEnd: () => void;
}

export function useExplainWS({ documentId, onTokens, onStateChange, onSlideChange, onEnd }: ExplainWSProps) {
  // Use ref to hold mutable handlers without triggering effect re-runs
  const callbacksRef = useRef({ onTokens, onStateChange, onSlideChange, onEnd });
  useEffect(() => {
    callbacksRef.current = { onTokens, onStateChange, onSlideChange, onEnd };
  });

  const token = useAuthStore(state => state.accessToken);
  const wsUrl = useMemo(() => {
    return documentId && token
      ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/v1/rag/explain/${documentId}?token=${token}`
      : null;
  }, [documentId, token]);

  const managerRef = useRef<WSManager | null>(null);
  if (!managerRef.current) {
    managerRef.current = new WSManager(false); // Do not persist session to localStorage!
  }
  const manager = managerRef.current;

  const [currentState, setCurrentState] = useState<PresentationState>('EXPLAINING');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  // Strictly decoupled WebSocket initialization
  // Only depends on strictly stable `wsUrl` and `manager`
  useEffect(() => {
    if (!wsUrl) return;

    manager.retain();
    manager.connect(wsUrl);

    const unsubStatus = manager.onStatusChange((state) => {
      setIsConnected(state === ConnectionState.CONNECTED);
    });

    const unsubs = [
      manager.on('ready', () => {
        try {
          setCurrentState('EXPLAINING');
          callbacksRef.current.onStateChange('EXPLAINING');
        } catch (e) {
          console.error('Error in Explain WS ready handler:', e);
        }
      }),
      manager.on('SlideStartEvent', (data: any) => {
        try {
          const payload = typeof data === 'string' ? JSON.parse(data) : data;
          setCurrentSlide(payload.slide_index);
          callbacksRef.current.onSlideChange(payload.slide_index, payload.total_slides || 0);
          setCurrentState('EXPLAINING');
          callbacksRef.current.onStateChange('EXPLAINING');
        } catch (e) {
          console.error('Error in Explain WS SlideStartEvent:', e);
        }
      }),
      manager.on('SlideContentTokens', (data: any) => {
        try {
          const payload = typeof data === 'string' ? JSON.parse(data) : data;
          if (payload && payload.tokens) {
            callbacksRef.current.onTokens(payload.tokens);
          }
        } catch (e) {
          console.error('Error in Explain WS SlideContentTokens:', e);
        }
      }),
      manager.on('AwaitInputEvent', () => {
        try {
          setCurrentState('AWAITING');
          callbacksRef.current.onStateChange('AWAITING');
        } catch (e) {
          console.error('Error in Explain WS AwaitInputEvent:', e);
        }
      }),
      manager.on('SlideEndEvent', (data: any) => {
        try {
          const payload = typeof data === 'string' ? JSON.parse(data) : data;
          if (payload && payload.slide_index === -1) {
            callbacksRef.current.onEnd();
          }
        } catch (e) {
          console.error('Error in Explain WS SlideEndEvent:', e);
        }
      }),
      manager.on('error', (data: any) => {
        try {
          const payload = typeof data === 'string' ? JSON.parse(data) : data;
          console.error('Explain WS Error:', payload.message);
          callbacksRef.current.onTokens(`\n\n**Error:** ${payload.message || 'An unexpected error occurred.'}\n\n`);
          setCurrentState('AWAITING');
          callbacksRef.current.onStateChange('AWAITING');
        } catch (e) {
          console.error('Error in Explain WS error handler:', e);
        }
      }),
      manager.on('done', () => {
        try {
          setCurrentState('AWAITING');
          callbacksRef.current.onStateChange('AWAITING');
        } catch (e) {
          console.error('Error in Explain WS done handler:', e);
        }
      })
    ];

    return () => {
      unsubStatus();
      unsubs.forEach(unsub => unsub?.());
      manager.release();
    };
  }, [wsUrl, manager]); // strictly stable dependency array!

  const sendQuestion = useCallback((text: string) => {
    setCurrentState('ANSWERING');
    callbacksRef.current.onStateChange('ANSWERING');
    manager.send({ type: 'chat.user_message', data: { message_id: crypto.randomUUID(), text } });
  }, [manager]);

  const sendContinue = useCallback(() => {
    setCurrentState('EXPLAINING');
    callbacksRef.current.onStateChange('EXPLAINING');
    manager.send({ type: 'chat.user_message', data: { message_id: crypto.randomUUID(), text: 'continue' } });
  }, [manager]);

  const sendPauseOrStop = useCallback(() => {
    manager.send({ type: 'client.speech_stopped', data: {} });
  }, [manager]);

  const disconnect = useCallback(() => {
    manager.disconnect();
  }, [manager]);

  return {
    isConnected,
    currentState,
    currentSlide,
    sendQuestion,
    sendContinue,
    sendPauseOrStop,
    disconnect
  };
}
