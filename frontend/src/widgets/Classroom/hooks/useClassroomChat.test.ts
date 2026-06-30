import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useClassroomChat } from './useClassroomChat';
import useWSClient, { ConnectionState } from '@/core/realtime/useWSClient';

vi.mock('@/core/realtime/useWSClient');

const mockResetStream = vi.fn();
const mockSetPipelineState = vi.fn();
const mockPushDelta = vi.fn();
const mockCommitFinal = vi.fn();
const mockSetInterimTranscript = vi.fn();

vi.mock('@/features/chat/store/useChatUIStore', () => ({
  useChatUIStore: {
    getState: () => ({
      resetStream: mockResetStream,
      setPipelineState: mockSetPipelineState,
      pushDelta: mockPushDelta,
      commitFinal: mockCommitFinal,
      setInterimTranscript: mockSetInterimTranscript,
    })
  }
}));

describe('useClassroomChat', () => {
  const mockSend = vi.fn();
  let wsHandlers: Record<string, Function> = {};
  const mockOnMessage = vi.fn((type: string, handler: Function) => {
    wsHandlers[type] = handler;
    return vi.fn();
  });
  const mockHandleFirstMessage = vi.fn();
  const mockAddUserMessage = vi.fn();
  const mockAddAssistantMessage = vi.fn();
  const mockGenerateTitleForSession = vi.fn();
  const mockResetAvatarAudio = vi.fn();
  const mockGetAudioContext = vi.fn(() => ({ state: 'running' } as any));
  const mockForceAdvanceSequence = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    wsHandlers = {};
    (useWSClient as any).mockReturnValue({
      connectionState: ConnectionState.CONNECTED,
      isConnected: true,
      send: mockSend,
      onMessage: mockOnMessage,
    });
  });

  const setupMockSession = () => ({
    currentSessionId: 'test-session',
    status: 'success',
    handleFirstMessage: mockHandleFirstMessage,
    addUserMessage: mockAddUserMessage,
    addAssistantMessage: mockAddAssistantMessage,
    generateTitleForSession: mockGenerateTitleForSession,
  });

  const renderChatHook = (connectionState: ConnectionState = ConnectionState.CONNECTED) => {
    (useWSClient as any).mockReturnValue({
      connectionState,
      isConnected: connectionState === ConnectionState.CONNECTED,
      send: mockSend,
      onMessage: mockOnMessage,
    });

    return renderHook(() => useClassroomChat({
      wsAvatarId: 'avatar1',
      activeVoiceId: 'voice1',
      session: setupMockSession(),
      onTtsReady: vi.fn(),
      onVisemesReady: vi.fn(),
      forceAdvanceSequence: mockForceAdvanceSequence,
      resetAvatarAudio: mockResetAvatarAudio,
      getAudioContext: mockGetAudioContext
    }));
  };

  it('handles first conversation cold start gracefully', async () => {
    mockHandleFirstMessage.mockResolvedValue('new-session-id');

    const mockSession = {
      ...setupMockSession(),
      currentSessionId: null, // No session yet
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

    await act(async () => {
      result.current.commitAndSend('Hello first message');
    });

    expect(mockHandleFirstMessage).toHaveBeenCalledWith('Hello first message');
    
    await vi.waitFor(() => {
      expect(mockAddUserMessage).toHaveBeenCalled();
    });

    expect(mockSend).toHaveBeenCalledWith({
      type: 'chat.user_message',
      data: expect.objectContaining({ text: 'Hello first message' })
    });
  });

  describe('synchronization and regressions', () => {
    it('synchronizes useChatUIStore when connection drops during generating', () => {
      const { result, rerender } = renderChatHook(ConnectionState.CONNECTED);
      
      // Simulate user sending message to enter thinking state
      act(() => {
        result.current.commitAndSend('Hello');
      });
      
      expect(result.current.conversationState.pipelineState).toBe('thinking');
      expect(mockSetPipelineState).toHaveBeenCalledWith('thinking');
      
      // Simulate disconnect
      (useWSClient as any).mockReturnValue({
        connectionState: ConnectionState.DISCONNECTED,
        isConnected: false,
        send: mockSend,
        onMessage: mockOnMessage,
      });
      
      act(() => {
        rerender();
      });
      
      // Verification: Reducer and Store must both be error
      expect(result.current.conversationState.pipelineState).toBe('error');
      expect(mockSetPipelineState).toHaveBeenCalledWith('error');
    });

    it('synchronizes useChatUIStore when connection reconnects', () => {
      // Start in disconnected state while thinking
      const { result, rerender } = renderChatHook(ConnectionState.CONNECTED);
      act(() => { result.current.commitAndSend('Hello'); });
      
      (useWSClient as any).mockReturnValue({
        connectionState: ConnectionState.DISCONNECTED,
        isConnected: false,
        send: mockSend,
        onMessage: mockOnMessage,
      });
      act(() => { rerender(); });
      
      // Should be error now
      expect(result.current.conversationState.pipelineState).toBe('error');
      mockSetPipelineState.mockClear();

      // Simulate reconnect
      (useWSClient as any).mockReturnValue({
        connectionState: ConnectionState.CONNECTED,
        isConnected: true,
        send: mockSend,
        onMessage: mockOnMessage,
      });
      act(() => { rerender(); });

      // Verification: Reducer and Store must both return to idle
      expect(result.current.conversationState.pipelineState).toBe('idle');
      expect(mockSetPipelineState).toHaveBeenCalledWith('idle');
    });

    it('handles repeated reconnects without stale UI state', () => {
      const { result, rerender } = renderChatHook(ConnectionState.CONNECTED);
      act(() => { result.current.commitAndSend('Hello'); });
      
      // First drop
      (useWSClient as any).mockReturnValue({ connectionState: ConnectionState.DISCONNECTED });
      act(() => { rerender(); });
      expect(result.current.conversationState.pipelineState).toBe('error');
      
      // First reconnect
      (useWSClient as any).mockReturnValue({ connectionState: ConnectionState.CONNECTED });
      act(() => { rerender(); });
      expect(result.current.conversationState.pipelineState).toBe('idle');
      expect(mockSetPipelineState).toHaveBeenCalledWith('idle');

      // Drop again while idle should NOT trigger error in UI store because it's not generating
      mockSetPipelineState.mockClear();
      (useWSClient as any).mockReturnValue({ connectionState: ConnectionState.DISCONNECTED });
      act(() => { rerender(); });
      expect(result.current.conversationState.pipelineState).toBe('idle');
      expect(mockSetPipelineState).not.toHaveBeenCalledWith('error');
    });

    it('guards against late pipeline.state events', () => {
      const { result } = renderChatHook(ConnectionState.CONNECTED);
      
      act(() => { result.current.commitAndSend('Hello'); });
      const activeMsgId = result.current.conversationState.activeMessageId;
      
      mockSetPipelineState.mockClear();

      // Simulate late event with DIFFERENT message id
      act(() => {
        wsHandlers['pipeline.state']({
          session_id: 'test-session',
          message_id: 'old-stale-id',
          state: 'speaking'
        });
      });

      // Reducer should ignore it
      expect(result.current.conversationState.pipelineState).toBe('thinking');
      // Zustand store should ignore it (Verification for the late event race condition fix)
      expect(mockSetPipelineState).not.toHaveBeenCalledWith('speaking');

      // Now send the correct one
      act(() => {
        wsHandlers['pipeline.state']({
          session_id: 'test-session',
          message_id: activeMsgId,
          state: 'speaking'
        });
      });

      expect(result.current.conversationState.pipelineState).toBe('speaking');
      expect(mockSetPipelineState).toHaveBeenCalledWith('speaking');
    });

    it('synchronizes useChatUIStore on explicit error events', () => {
      const { result } = renderChatHook(ConnectionState.CONNECTED);
      
      act(() => {
        wsHandlers['error']({
          session_id: 'test-session',
          message: 'Test error message'
        });
      });

      expect(result.current.conversationState.pipelineState).toBe('error');
      expect(mockSetPipelineState).toHaveBeenCalledWith('error');
    });
  });
});
