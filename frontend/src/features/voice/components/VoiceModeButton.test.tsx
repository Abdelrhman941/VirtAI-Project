import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import VoiceModeButton from './VoiceModeButton';
import { useRealtimeASR } from '../hooks/useRealtimeASR';

// Mock the hook
vi.mock('../hooks/useRealtimeASR', () => ({
  useRealtimeASR: vi.fn(),
}));

describe('VoiceModeButton', () => {
  const mockWsClient = {
    isConnected: true,
    send: vi.fn(),
    onMessage: vi.fn(() => vi.fn()),
  };

  const defaultHookReturn = {
    isListening: false,
    isPaused: false,
    isProcessing: false,
    interimText: '',
    finalText: '',
    error: null,
    errorCode: null,
    canRetry: false,
    clearError: vi.fn(),
    startListening: vi.fn(),
    stopListening: vi.fn(),
    resetTranscript: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('allows retry when error is present and canRetry is true', async () => {
    const clearErrorMock = vi.fn();
    const startListeningMock = vi.fn();
    const stopListeningMock = vi.fn();

    vi.mocked(useRealtimeASR).mockReturnValue({
      ...defaultHookReturn,
      error: 'Connection lost',
      canRetry: true,
      clearError: clearErrorMock,
      startListening: startListeningMock,
      stopListening: stopListeningMock,
    });

    render(<VoiceModeButton pipelineState="idle" wsClient={mockWsClient} />);

    const button = screen.getByRole('button') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('title')).toBe('Click to Retry');

    await fireEvent.click(button);

    expect(clearErrorMock).toHaveBeenCalledTimes(1);
    expect(stopListeningMock).toHaveBeenCalledTimes(1);
    expect(startListeningMock).toHaveBeenCalledTimes(1);
  });

  it('is disabled when error is present and canRetry is false', () => {
    vi.mocked(useRealtimeASR).mockReturnValue({
      ...defaultHookReturn,
      error: 'Permission denied',
      canRetry: false,
    });

    render(<VoiceModeButton pipelineState="idle" wsClient={mockWsClient} />);

    const button = screen.getByRole('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
