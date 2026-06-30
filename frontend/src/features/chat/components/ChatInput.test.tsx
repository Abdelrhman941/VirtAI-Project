import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ChatInput from './ChatInput';
import { useChatUIStore } from '../store/useChatUIStore';
import useWSClient from '@/core/realtime/useWSClient';

// Mock dependencies
vi.mock('../store/useChatUIStore');
vi.mock('@/core/realtime/useWSClient');
vi.mock('../../voice/components/VoiceModeButton', () => ({
  default: () => <button data-testid="voice-mode-btn">Voice</button>
}));
vi.mock('./VisualizeButton', () => ({
  default: () => <button data-testid="visualize-btn">Visualize</button>
}));

describe('ChatInput', () => {
  const mockOnSend = vi.fn();
  const mockClearError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useWSClient as any).mockReturnValue({
      wsClient: { isConnected: true }
    });
    (useChatUIStore as any).mockReturnValue({
      pipelineState: 'idle'
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('submits on Enter key press without shift', () => {
    render(
      <ChatInput 
        onSend={mockOnSend} 
        disabled={false} 
        placeholder="Type here..." 
        clearError={mockClearError} 
      />
    );

    const textarea = screen.getByPlaceholderText(/Ask a question or input a curricular topic/i);
    
    // Type something
    fireEvent.change(textarea, { target: { value: 'Hello world' } });
    
    // Press Enter
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    // Should call onSend
    expect(mockOnSend).toHaveBeenCalledWith('Hello world');
    // Should clear the input
    expect((textarea as HTMLTextAreaElement).value).toBe('');
  });

  it('does not submit on Shift+Enter', () => {
    render(
      <ChatInput 
        onSend={mockOnSend} 
        disabled={false} 
        placeholder="Type here..." 
        clearError={mockClearError} 
      />
    );

    const textarea = screen.getByPlaceholderText(/Ask a question or input a curricular topic/i);
    
    // Type something
    fireEvent.change(textarea, { target: { value: 'Hello world' } });
    
    // Press Shift+Enter
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    // Should not call onSend
    expect(mockOnSend).not.toHaveBeenCalled();
    // Input should still have value
    expect((textarea as HTMLTextAreaElement).value).toBe('Hello world');
  });

  it('submits on send button click', () => {
    render(
      <ChatInput 
        onSend={mockOnSend} 
        disabled={false} 
        placeholder="Type here..." 
        clearError={mockClearError} 
      />
    );

    const textarea = screen.getByPlaceholderText(/Ask a question or input a curricular topic/i);
    const sendButton = screen.getByRole('button', { name: /submit inquiry/i });
    
    // Type something
    fireEvent.change(textarea, { target: { value: 'Hello world' } });
    
    // Click send
    fireEvent.click(sendButton);

    // Should call onSend
    expect(mockOnSend).toHaveBeenCalledWith('Hello world');
  });
});
