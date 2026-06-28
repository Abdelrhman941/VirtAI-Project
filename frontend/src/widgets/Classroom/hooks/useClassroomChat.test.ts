import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useClassroomChat } from './useClassroomChat';
import useWSClient, { ConnectionState } from '@/core/realtime/useWSClient';

vi.mock('@/core/realtime/useWSClient');
vi.mock('@/features/chat/store/useChatUIStore', () => ({
  useChatUIStore: {
    getState: () => ({
      resetStream: vi.fn(),
      setPipelineState: vi.fn()
    })
  }
}));

describe('useClassroomChat', () => {
  const mockSend = vi.fn();
  const mockOnMessage = vi.fn();
  const mockHandleFirstMessage = vi.fn();
  const mockAddUserMessage = vi.fn();
  const mockResetAvatarAudio = vi.fn();
  const mockGetAudioContext = vi.fn(() => ({ state: 'running' } as any));

  beforeEach(() => {
    vi.clearAllMocks();
    (useWSClient as any).mockReturnValue({
      connectionState: ConnectionState.CONNECTED,
      isConnected: true,
      send: mockSend,
      onMessage: mockOnMessage,
    });
  });

  it('handles first conversation cold start gracefully', async () => {
    mockHandleFirstMessage.mockResolvedValue('new-session-id');

    const mockSession = {
      currentSessionId: null, // No session yet
      status: 'success',
      handleFirstMessage: mockHandleFirstMessage,
      addUserMessage: mockAddUserMessage
    };

    const { result } = renderHook(() => useClassroomChat({
      wsAvatarId: 'avatar1',
      activeVoiceId: 'voice1',
      session: mockSession,
      onTtsReady: vi.fn(),
      onVisemesReady: vi.fn(),
      forceAdvanceSequence: vi.fn(),
      resetAvatarAudio: mockResetAvatarAudio,
      getAudioContext: mockGetAudioContext
    }));

    // Trigger commitAndSend for the first message
    await act(async () => {
      result.current.commitAndSend('Hello first message');
    });

    // It should call handleFirstMessage
    expect(mockHandleFirstMessage).toHaveBeenCalledWith('Hello first message');
    
    // Wait for the promise to resolve
    await vi.waitFor(() => {
      expect(mockAddUserMessage).toHaveBeenCalled();
    });

    // The message should be sent to websocket once the session id is ready
    expect(mockSend).toHaveBeenCalledWith({
      type: 'chat.user_message',
      data: expect.objectContaining({ text: 'Hello first message' })
    });
  });
});
