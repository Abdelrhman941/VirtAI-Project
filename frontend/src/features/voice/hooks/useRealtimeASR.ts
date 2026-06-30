import { useCallback, useEffect, useRef, useState } from 'react';

import { useVoiceMode } from './useVoiceMode';

/**
 * WebSocket client interface (subset needed for ASR)
 */
interface WSClient {
  isConnected: boolean;
  // Reason: WebSocket client interface lacks generated type
  // bindings from the Python/FastAPI backend schema
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  send: (message: any) => void;
  // Reason: Pipeline state shape is defined by backend ASGI
  // messages without a shared TypeScript contract
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onMessage: (type: string, handler: (data: any) => void) => () => void;
}

/**
 * Transcript message from backend
 */
interface TranscriptMessage {
  type: 'transcript';
  session_id: string;
  text: string;
  confidence: number;
  language?: string;
  is_final: boolean;
}

/**
 * Return type for useRealtimeASR hook
 */
export interface RealtimeASRHook {
  /** Whether voice mode is currently active and listening */
  isListening: boolean;
  /** Whether listening is paused (e.g. assistant speaking) */
  isPaused: boolean;
  /** Whether we are waiting for the backend to finish processing */
  isProcessing: boolean;
  /** Current interim (non-final) transcript text */
  interimText: string;
  /** Last finalized transcript text */
  finalText: string;
  /** Error message if voice mode or ASR fails */
  error: string | null;
  /** Backend error code for UI-specific messaging */
  errorCode: string | null;
  /** Whether the error is retryable */
  canRetry: boolean;
  /** Clear the current error */
  clearError: () => void;
  /** Start listening (toggles voice mode on) */
  startListening: () => void;
  /** Stop listening (toggles voice mode off) */
  stopListening: () => void;
  /** Clear transcript state */
  resetTranscript: () => void;
}

/**
 * Hook that wraps useVoiceMode with real-time ASR transcript state.
 *
 * Listens for `transcript` WebSocket messages from the backend,
 * maintains interim/final text state, and exposes a clean API for
 * components that need both voice control and transcript display.
 *
 * @param wsClient  - WebSocket client instance
 * @param pipelineState - Current conversation pipeline state
 * @param onFinalTranscript - Optional callback fired when a final transcript arrives
 */
export function useRealtimeASR(
  wsClient: WSClient,
  pipelineState: 'idle' | 'thinking' | 'speaking' | 'error',
  onFinalTranscript?: (text: string) => void
): RealtimeASRHook {
  const [interimText, setInterimText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Ref for onFinalTranscript to avoid re-subscriptions
  const onFinalRef = useRef(onFinalTranscript);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    onFinalRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  // Delegate to useVoiceMode for mic/VAD/WS orchestration
  const voiceMode = useVoiceMode(wsClient, pipelineState);

  /**
   * Subscribe to transcript WebSocket messages.
   * useWSClient supports multiple handlers per message type via Set-based
   * registration, so this subscription is safe alongside ClassroomShell's.
   */
  useEffect(() => {
    if (!wsClient) {
      return;
    }

    const unsubscribe = wsClient.onMessage('transcript', (message: TranscriptMessage) => {
      if (!isMountedRef.current) return;
      if (message.is_final) {
        // Strict blocklist for ASR silence hallucinations
        const normalized = message.text.trim().toLowerCase().replace(/[.,!?;:]/g, '');
        const hallucinations = ['thank you', 'thanks for watching', '...', ''];
        
        if (hallucinations.includes(normalized)) {
          setInterimText('');
          setIsProcessing(false);
          return;
        }

        setFinalText(message.text);
        setInterimText('');
        setIsProcessing(false);
        onFinalRef.current?.(message.text);

      } else {
        setInterimText(message.text);
        setIsProcessing(false);
      }
    });

    return unsubscribe;
  }, [wsClient]);

  /**
   * When user starts listening, mark processing = true so the UI
   * can show a "listening…" indicator before any transcript arrives.
   * When listening stops, clear the processing flag.
   */
  useEffect(() => {
    if (voiceMode.isListening) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsProcessing(true);
    } else {
      setIsProcessing(false);
    }
  }, [voiceMode.isListening]);

  const startListening = useCallback(() => {
    if (!voiceMode.isListening) {
      voiceMode.toggleListening();
    }
  }, [voiceMode]);

  const stopListening = useCallback(() => {
    if (voiceMode.isListening) {
      voiceMode.toggleListening();
    }
  }, [voiceMode]);

  const resetTranscript = useCallback(() => {
    setInterimText('');
    setFinalText('');
  }, []);

  return {
    isListening: voiceMode.isListening,
    isPaused: false,
    isProcessing,
    interimText,
    finalText,
    error: voiceMode.error,
    errorCode: voiceMode.errorCode ?? null,
    canRetry: voiceMode.canRetry ?? false,
    clearError: voiceMode.clearError ?? (() => { }),
    startListening,
    stopListening,
    resetTranscript,
  };
}

export default useRealtimeASR;
