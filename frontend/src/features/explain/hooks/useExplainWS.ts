import { useState, useEffect, useCallback, useRef } from 'react';
import useWSClient from '@/core/realtime/useWSClient';
import { WSManager } from '@/services/wsManager';

export type PresentationState = 'EXPLAINING' | 'AWAITING' | 'ANSWERING';

interface ExplainWSProps {
  documentId: string | null;
  onTokens: (tokens: string) => void;
  onStateChange: (state: PresentationState) => void;
  onSlideChange: (index: number, total: number) => void;
  onEnd: () => void;
}

import { useAuthStore } from '@/features/auth/store/authStore';

export function useExplainWS({ documentId, onTokens, onStateChange, onSlideChange, onEnd }: ExplainWSProps) {
  const onTokensRef = useRef(onTokens);
  const onStateChangeRef = useRef(onStateChange);
  const onSlideChangeRef = useRef(onSlideChange);
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onTokensRef.current = onTokens;
    onStateChangeRef.current = onStateChange;
    onSlideChangeRef.current = onSlideChange;
    onEndRef.current = onEnd;
  }, [onTokens, onStateChange, onSlideChange, onEnd]);
  const token = useAuthStore(state => state.accessToken);
  const wsUrl = documentId && token
    ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/v1/rag/explain/${documentId}?token=${token}`
    : null;

  const managerRef = useRef<WSManager | null>(null);
  if (!managerRef.current) {
    managerRef.current = new WSManager();
  }

  const { connectionState, isConnected, send, onMessage, disconnect } = useWSClient(wsUrl, managerRef.current);

  const [currentState, setCurrentState] = useState<PresentationState>('EXPLAINING');
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const unsubs = [
      onMessage('ready', (data: any) => {
        try {
          setCurrentState('EXPLAINING');
          onStateChangeRef.current('EXPLAINING');
        } catch (e) {
          console.error('Error in Explain WS ready handler:', e);
        }
      }),
      onMessage('SlideStartEvent', (data: any) => {
        try {
          const payload = typeof data === 'string' ? JSON.parse(data) : data;
          setCurrentSlide(payload.slide_index);
          onSlideChangeRef.current(payload.slide_index, payload.total_slides || 0);
          setCurrentState('EXPLAINING');
          onStateChangeRef.current('EXPLAINING');
        } catch (e) {
          console.error('Error in Explain WS SlideStartEvent:', e);
        }
      }),
      onMessage('SlideContentTokens', (data: any) => {
        try {
          const payload = typeof data === 'string' ? JSON.parse(data) : data;
          if (payload && payload.tokens) {
            onTokensRef.current(payload.tokens);
          }
        } catch (e) {
          console.error('Error in Explain WS SlideContentTokens:', e);
        }
      }),
      onMessage('AwaitInputEvent', () => {
        try {
          setCurrentState('AWAITING');
          onStateChangeRef.current('AWAITING');
        } catch (e) {
          console.error('Error in Explain WS AwaitInputEvent:', e);
        }
      }),
      onMessage('SlideEndEvent', (data: any) => {
        try {
          const payload = typeof data === 'string' ? JSON.parse(data) : data;
          if (payload && payload.slide_index === -1) {
            onEndRef.current();
          }
        } catch (e) {
          console.error('Error in Explain WS SlideEndEvent:', e);
        }
      }),
      onMessage('error', (data: any) => {
        try {
          const payload = typeof data === 'string' ? JSON.parse(data) : data;
          console.error('Explain WS Error:', payload.message);
          onTokensRef.current(`\n\n**Error:** ${payload.message || 'An unexpected error occurred during analysis.'}\n\n`);
          setCurrentState('AWAITING');
          onStateChangeRef.current('AWAITING');
        } catch (e) {
          console.error('Error in Explain WS error handler:', e);
        }
      }),
      onMessage('done', () => {
        try {
          setCurrentState('AWAITING');
          onStateChangeRef.current('AWAITING');
        } catch (e) {
          console.error('Error in Explain WS done handler:', e);
        }
      })
    ];

    return () => unsubs.forEach(unsub => unsub?.());
  }, [onMessage]);

  const sendQuestion = useCallback((text: string) => {
    setCurrentState('ANSWERING');
    onStateChangeRef.current('ANSWERING');
    const message_id = crypto.randomUUID();
    send({ type: 'chat.user_message', data: { message_id, text } });
  }, [send]);

  const sendContinue = useCallback(() => {
    setCurrentState('EXPLAINING');
    onStateChangeRef.current('EXPLAINING');
    const message_id = crypto.randomUUID();
    send({ type: 'chat.user_message', data: { message_id, text: 'continue' } });
  }, [send]);

  const sendPauseOrStop = useCallback(() => {
    // We send client.speech_stopped to interrupt the backend
    send({ type: 'client.speech_stopped', data: {} });
  }, [send]);

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
