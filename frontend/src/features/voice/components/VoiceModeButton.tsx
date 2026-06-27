import { useMemo } from 'react';
import { PiMicrophone, PiPauseFill, PiWarningCircleFill } from 'react-icons/pi';
import { useRealtimeASR } from '../hooks/useRealtimeASR';

import { VoiceIndicator } from '@/shared/components/VoiceIndicator';
import './VoiceModeButton.css';

/**
 * Props for VoiceModeButton component
 */
interface VoiceModeButtonProps {
  /** Current conversation pipeline state */
  pipelineState: 'idle' | 'thinking' | 'speaking' | 'error';
  /** Optional CSS class name */
  className?: string;
  /** Optional guard used to prepare a session before microphone capture starts */
  onBeforeStart?: () => Promise<boolean> | boolean;
  wsClient?: any;
}

/**
 * VoiceModeButton Component
 *
 * A button component that enables continuous voice mode interaction with the AI avatar.
 * Displays microphone button with listening/idle states, pause indicator when assistant
 * is speaking, error messages, and visual feedback for voice activity.
 *
 * Requirements: 1.1, 1.4, 6.3, 7.2, 8.3, 8.4, 8.5
 *
 * @param props - Component props
 * @returns VoiceModeButton component
 */
export default function VoiceModeButton({
  pipelineState,
  className = '',
  onBeforeStart,
  wsClient,
}: VoiceModeButtonProps) {

  // Use realtime ASR hook for voice + transcript state (Requirement 1.1, 1.4)
  const { isListening, isPaused, isProcessing, interimText, error, startListening, stopListening } =
    useRealtimeASR(wsClient, pipelineState);

  // Determine button state and styling
  const buttonState = useMemo(() => {
    if (error) {
      return 'error';
    }
    if (isPaused) {
      return 'paused';
    }
    if (isProcessing && isListening) {
      return 'processing';
    }
    if (isListening) {
      return 'listening';
    }
    return 'idle';
  }, [isListening, isPaused, isProcessing, error]);

  // Determine button icon
  const ButtonIcon = useMemo(() => {
    if (error) {
      return PiWarningCircleFill;
    }
    if (isPaused) {
      return PiPauseFill;
    }
    return PiMicrophone;
  }, [error, isPaused]);

  // Determine button title/tooltip
  const buttonTitle = useMemo(() => {
    if (error) {
      return `Voice mode error: ${error}`;
    }
    if (isPaused) {
      return 'Voice paused (assistant speaking)';
    }
    if (isListening) {
      return 'Stop voice mode';
    }
    return 'Start voice mode';
  }, [isListening, isPaused, error]);

  // Determine button aria-label
  const ariaLabel = useMemo(() => {
    if (error) {
      return 'Voice mode error';
    }
    if (isPaused) {
      return 'Voice mode paused';
    }
    if (isListening) {
      return 'Stop voice mode';
    }
    return 'Start voice mode';
  }, [isListening, isPaused, error]);

  return (
    <div className={`voice-mode-container ${className}`}>
      {/* Main voice mode button (Requirement 1.1, 1.4) */}
      <button
        className={`w-[52px] h-[52px] rounded-full bg-dark-secondary hover:bg-dark-tertiary flex items-center justify-center transition-colors text-white/70 hover:text-white voice-mode-btn ${buttonState}`}
        onClick={async () => {
          if (!!error) return;
          if (isListening) {
            stopListening();
            return;
          }
          const canStart = onBeforeStart ? await onBeforeStart() : true;
          if (canStart) {
            startListening();
          }
        }}
        title={buttonTitle}
        aria-label={ariaLabel}
        disabled={!!error}
        type="button"
      >
        <ButtonIcon className="voice-mode-icon" size={22} />

        {/* Listening animation (Requirement 8.3) */}
        <VoiceIndicator isListening={isListening} isPaused={isPaused} />
      </button>

      {/* Interim transcript display (Step 4.2: visual feedback) */}
      {interimText && (
        <div className="voice-transcript-bubble" role="status" aria-live="polite">
          <span className="transcript-text">{interimText}</span>
        </div>
      )}

      {/* Paused indicator (Requirement 7.2, 8.4) */}
      {isPaused && (
        <div className="voice-status-indicator paused" role="status" aria-live="polite">
          <PiPauseFill className="status-icon" />
          <span className="status-text">Paused (assistant speaking)</span>
        </div>
      )}
    </div>
  );
}
