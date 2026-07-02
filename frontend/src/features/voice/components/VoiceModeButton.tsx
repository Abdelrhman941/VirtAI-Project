import { useMemo } from 'react';
import { PiMicrophone, PiPauseFill, PiWarningCircleFill, PiArrowCounterClockwise } from 'react-icons/pi';
import { useRealtimeASR } from '../hooks/useRealtimeASR';

import { VoiceIndicator } from '@/shared/components/VoiceIndicator';
import { Button } from '@/shared/components/ui/button';

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
  const { isListening, isPaused, isProcessing, interimText, error, canRetry, clearError, startListening, stopListening } =
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
    if (error && canRetry) {
      return PiArrowCounterClockwise;
    }
    if (error) {
      return PiWarningCircleFill;
    }
    if (isPaused) {
      return PiPauseFill;
    }
    return PiMicrophone;
  }, [error, canRetry, isPaused]);

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
    <div className={`relative flex flex-col items-center gap-3 ${className}`}>
      {/* Main voice mode button (Requirement 1.1, 1.4) */}
      <Button
        variant="ghost"
        size="icon-xl"
        className={`group relative flex items-center justify-center rounded-full transition-all duration-200 overflow-visible
          ${buttonState === 'listening' ? 'bg-green-500/15 border-green-500/30 text-green-500 shadow-md hover:bg-green-500/25' : ''}
          ${buttonState === 'paused' ? 'bg-orange-500/15 border-orange-500/30 text-orange-500 shadow-md' : ''}
          ${buttonState === 'error' && canRetry ? 'bg-red-500/15 border-red-500/30 text-red-500 shadow-md hover:bg-red-500/25' : ''}
          ${buttonState === 'error' && !canRetry ? 'bg-red-500/15 border-red-500/30 text-red-500 shadow-md opacity-50 cursor-not-allowed' : ''}
          ${buttonState === 'idle' ? 'bg-[#1e1e1e] hover:bg-[#2a2a2a] text-white/70 hover:text-white border border-[#333]' : ''}
          ${buttonState === 'processing' ? 'bg-blue-500/15 border-blue-500/30 text-blue-500 shadow-md animate-pulse' : ''}
        `}
        onClick={async () => {
          if (error && canRetry) {
            clearError();
            stopListening();
            const canStart = onBeforeStart ? await onBeforeStart() : true;
            if (canStart) {
              startListening();
            }
            return;
          }
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
        aria-label={error && canRetry ? 'Retry voice mode' : ariaLabel}
        disabled={!!error && !canRetry}
        type="button"
      >
        <ButtonIcon className="shrink-0 size-[22px] relative z-10" />
          
        {/* Custom Hover Tooltip */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-gray-800 text-gray-100 text-xs font-medium rounded-md shadow-lg opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 whitespace-nowrap pointer-events-none z-50 border border-gray-700">
          {error && canRetry ? 'Try again' : buttonTitle}
        </div>

        {/* Listening animation (Requirement 8.3) */}
        <VoiceIndicator isListening={isListening} isPaused={isPaused} />
      </Button>

      {/* Interim transcript display (Step 4.2: visual feedback) */}
      {interimText && (
        <div className="absolute bottom-[calc(100%+0.5rem)] left-1/2 -translate-x-1/2 bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-1.5 max-w-[280px] min-w-[60px] z-[1001] shadow-[0_4px_20px_rgba(0,0,0,0.4)] animate-in slide-in-from-bottom-2" role="status" aria-live="polite">
          <span className="text-[0.8125rem] leading-relaxed text-[#b0b0b0] italic break-words block max-w-[75ch]">{interimText}</span>
        </div>
      )}

      {/* Listening prompt when microphone is active but no speech is detected yet */}
      {isListening && !isPaused && !interimText && (
        <div className="absolute bottom-[calc(100%+0.5rem)] left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1.5 z-[1001] shadow-[0_4px_20px_rgba(0,0,0,0.4)] animate-in slide-in-from-bottom-2" role="status" aria-live="polite">
          <span className="shimmer shimmer-color-crimson-glow text-[0.8125rem] leading-relaxed italic block">Listening…</span>
        </div>
      )}

      {/* Paused indicator (Requirement 7.2, 8.4) */}
      {isPaused && (
        <div className="absolute bottom-[calc(100%+0.75rem)] -right-2 flex items-start gap-2 px-4 py-3 rounded-xl text-sm min-w-[240px] max-w-[380px] w-max leading-relaxed break-words shadow-[0_4px_20px_rgba(0,0,0,0.4)] animate-in slide-in-from-bottom-2 bg-orange-500/10 border border-orange-500/30 text-orange-500 z-[1000]" role="status" aria-live="polite">
          <PiPauseFill className="text-base shrink-0 mt-0.5" />
          <span className="text-sm">Paused (assistant speaking)</span>
        </div>
      )}
    </div>
  );
}
