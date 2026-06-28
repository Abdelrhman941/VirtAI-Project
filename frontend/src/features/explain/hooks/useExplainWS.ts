import { useState, useEffect, useCallback, useRef } from 'react';
import useWSClient from '@/core/realtime/useWSClient';

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

  const { connectionState, isConnected, send, onMessage, disconnect } = useWSClient(wsUrl);

  const [currentState, setCurrentState] = useState<PresentationState>('EXPLAINING');
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const unsubs = [
      onMessage('SlideStartEvent', (data: any) => {
        setCurrentSlide(data.slide_index);
        onSlideChangeRef.current(data.slide_index, data.total_slides || 0);
        setCurrentState('EXPLAINING');
        onStateChangeRef.current('EXPLAINING');
      }),
      onMessage('SlideContentTokens', (data: any) => {
        onTokensRef.current(data.tokens);
      }),
      onMessage('AwaitInputEvent', () => {
        setCurrentState('AWAITING');
        onStateChangeRef.current('AWAITING');
      }),
      onMessage('SlideEndEvent', (data: any) => {
        if (data.slide_index === -1) {
          onEndRef.current();
        }
      }),
      onMessage('error', (data: any) => {
        console.error('Explain WS Error:', data.message);
        onTokensRef.current(`\n\n**Error:** ${data.message || 'An unexpected error occurred during analysis.'}\n\n`);
        setCurrentState('AWAITING');
        onStateChangeRef.current('AWAITING');
      }),
      onMessage('done', () => {
        setCurrentState('AWAITING');
        onStateChangeRef.current('AWAITING');
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
