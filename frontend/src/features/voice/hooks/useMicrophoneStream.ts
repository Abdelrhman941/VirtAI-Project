import { logger } from '@/shared/utils/logger';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PCMRecorder } from '../audio/pcmRecorder';

/**
 * Hook interface for microphone stream management
 */
export interface MicrophoneStreamHook {
  /** Whether microphone is currently listening */
  isListening: boolean;
  /** Start capturing audio from microphone */
  startListening: () => Promise<void>;
  /** Stop capturing audio and cleanup resources */
  stopListening: () => void;
  /** Error message if microphone access fails */
  error: string | null;
}

/**
 * Options for microphone stream configuration
 */
export interface MicrophoneStreamOptions {
  /** Audio sample rate in Hz (default: 16000) */
  sampleRate?: number;
}

/**
 * Custom hook for managing continuous microphone audio capture
 *
 * Handles getUserMedia API, PCMRecorder lifecycle, and audio chunk emission.
 * Configures audio with optimal settings for speech recognition (16kHz mono).
 * Uses raw PCM audio instead of WebM container format for safe concatenation.
 *
 * Requirements: 2.1, 2.3
 *
 * @param onAudioChunk - Callback invoked with each audio chunk (Int16Array PCM data)
 * @param options - Optional configuration for audio capture
 * @returns MicrophoneStreamHook interface
 *
 * @example
 * ```typescript
 * const { isListening, startListening, stopListening, error } = useMicrophoneStream(
 *   (pcmData) => console.log('PCM chunk:', pcmData),
 *   { sampleRate: 16000 }
 * );
 * ```
 */
export function useMicrophoneStream(
  onAudioChunk: (chunk: Int16Array) => void,
  options: MicrophoneStreamOptions = {}
): MicrophoneStreamHook {
  const { sampleRate = 16000 } = options;

  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pcmRecorderRef = useRef<PCMRecorder | null>(null);

  const callbackRef = useRef(onAudioChunk);
  useEffect(() => {
    callbackRef.current = onAudioChunk;
  }, [onAudioChunk]);
  const isMountedRef = useRef(true);

  /**
   * Start capturing audio from user's microphone
   *
   * Creates PCMRecorder instance and starts capturing raw PCM audio.
   * Uses AudioContext + AudioWorklet for low-latency capture without container headers.
   *
   * Requirements:
   * - 2.1: Use AudioContext + AudioWorklet to produce raw PCM audio (16kHz mono, 16-bit)
   * - 2.3: Capture audio without container headers for safe concatenation
   *
   * Preconditions:
   * - Browser supports AudioContext and AudioWorklet APIs
   * - Not already listening
   *
   * Postconditions:
   * - PCMRecorder is active if successful
   * - isListening is true
   * - error is null if successful, otherwise contains error message
   */
  const startListening = useCallback(async (): Promise<void> => {
    try {
      // Clear any previous errors
      setError(null);

      // Create PCMRecorder instance with callback (Requirements 2.1, 2.3)
      const pcmRecorder = new PCMRecorder((chunk) => callbackRef.current(chunk), { sampleRate });
      pcmRecorderRef.current = pcmRecorder;

      // Start recording (initializes AudioContext, loads worklet, connects microphone)
      await pcmRecorder.startRecording();

      if (!isMountedRef.current) {
        pcmRecorder.stopRecording();
        return;
      }

      // Update state
      setIsListening(true);

      if (import.meta.env.DEV) {
        logger.info(`[MicrophoneStream] Started listening with PCM format at ${sampleRate} Hz`);
      }
    } catch (err) {
      // Handle microphone permission and initialization errors
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred while accessing the microphone.');
      }

      logger.error('[MicrophoneStream] Failed to start listening:', err);
      setIsListening(false);

      // Cleanup on error
      if (pcmRecorderRef.current) {
        pcmRecorderRef.current.stopRecording();
        pcmRecorderRef.current = null;
      }
    }
  }, [sampleRate, onAudioChunk]);

  /**
   * Stop capturing audio and cleanup resources
   *
   * Stops PCMRecorder and releases all audio resources.
   *
   * Requirements:
   * - 2.4: Stop capturing audio and release microphone resources
   *
   * Preconditions:
   * - May be called even if not currently listening (safe to call multiple times)
   *
   * Postconditions:
   * - PCMRecorder is stopped
   * - isListening is false
   * - All resources are released
   */
  const stopListening = useCallback((): void => {
    try {
      // Stop PCMRecorder if active
      if (pcmRecorderRef.current) {
        pcmRecorderRef.current.stopRecording();
        pcmRecorderRef.current = null;
      }

      // Update state
      setIsListening(false);

      if (import.meta.env.DEV) {
        logger.info('[MicrophoneStream] Stopped listening');
      }
    } catch (err) {
      logger.error('[MicrophoneStream] Error stopping:', err);
      // Still update state even if cleanup fails
      setIsListening(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    startListening,
    stopListening,
    error,
  };
}

export default useMicrophoneStream;
