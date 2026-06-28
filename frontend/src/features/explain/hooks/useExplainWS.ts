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
        onSlideChange(data.slide_index, data.total_slides || 0);
        setCurrentState('EXPLAINING');
        onStateChange('EXPLAINING');
      }),
      onMessage('SlideContentTokens', (data: any) => {
        onTokens(data.tokens);
      }),
      onMessage('AwaitInputEvent', () => {
        setCurrentState('AWAITING');
        onStateChange('AWAITING');
      }),
      onMessage('SlideEndEvent', (data: any) => {
        if (data.slide_index === -1) {
          onEnd();
        }
      }),
      onMessage('error', (data: any) => {
        console.error('Explain WS Error:', data.message);
        onTokens(`\n\n**Error:** ${data.message || 'An unexpected error occurred during analysis.'}\n\n`);
        setCurrentState('AWAITING');
        onStateChange('AWAITING');
      }),
      onMessage('done', () => {
        setCurrentState('AWAITING');
        onStateChange('AWAITING');
      })
    ];

    return () => unsubs.forEach(unsub => unsub?.());
  }, [onMessage, onTokens, onStateChange, onSlideChange, onEnd]);

  const sendQuestion = useCallback((text: string) => {
    setCurrentState('ANSWERING');
    onStateChange('ANSWERING');
    send({ type: 'chat.user_message', text });
  }, [send, onStateChange]);

  const sendContinue = useCallback(() => {
    setCurrentState('EXPLAINING');
    onStateChange('EXPLAINING');
    send({ type: 'chat.user_message', text: 'continue' });
  }, [send, onStateChange]);

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
