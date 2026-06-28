import React, { KeyboardEvent, useCallback, useEffect, useRef, useMemo } from 'react';
import { FiSquare } from 'react-icons/fi';
import { PiPaperclip, PiPaperPlaneTiltFill } from 'react-icons/pi';
import VoiceModeButton from '../../voice/components/VoiceModeButton';
import { ConnectionState } from '@/core/realtime/wsConstants';

const MAX_CHARS = 2000;

interface ChatInputProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  pipelineState: 'idle' | 'thinking' | 'speaking' | 'error';
  onToggleDocuments: () => void;
  onBeforeVoiceStart?: () => Promise<boolean> | boolean;
  onStop?: () => void;
  wsClient?: {
    connectionState: ConnectionState;
    isConnected: boolean;
    send: (data: string) => void;
    onMessage: (handler: (msg: unknown) => void) => () => void;
    currentSessionId: string | null;
  };
}

export default function ChatInput({
  inputValue,
  onInputChange,
  onSend,
  onKeyDown,
  textareaRef,
  pipelineState,
  onToggleDocuments,
  onBeforeVoiceStart,
  onStop,
  wsClient,
}: ChatInputProps) {
  const requestRef = useRef<number>(0);
  const lastActionTime = useRef<number>(0);

  const connectionState = wsClient?.connectionState ?? ConnectionState.DISCONNECTED;
  const currentSessionId = wsClient?.currentSessionId ?? null;

  const isOnline = connectionState === ConnectionState.CONNECTED;
  const isOffline = connectionState === ConnectionState.DISCONNECTED || connectionState === ConnectionState.FAILED;
  const isReconnecting = connectionState === ConnectionState.RECONNECTING;
  const isInitializing = connectionState === ConnectionState.CONNECTING;


  // Derive state group from the Single Source of Truth (SSOT)
  const stateGroup = useMemo(() => {
    if (!currentSessionId || isOnline) {
      return 'ready';
    } else if (isReconnecting || isInitializing) {
      return 'connecting';
    } else {
      return 'offline';
    }
  }, [currentSessionId, isOnline, isReconnecting, isInitializing]);

  // UI status mappings for dynamic reactivity
  const { placeholderText, isInputDisabled } = useMemo(() => {
    if (stateGroup === 'ready') {
      return { placeholderText: 'Ask a question or input a curricular topic...', isInputDisabled: false };
    }
    if (stateGroup === 'connecting') {
      return { placeholderText: 'Connecting to VirtAI teaching assistant...', isInputDisabled: true };
    }
    return { placeholderText: 'Session disconnected (Please reconnect to resume)...', isInputDisabled: true };
  }, [stateGroup]);

  useEffect(() => {
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const el = e.target;
      onInputChange(el.value);

      const hardcodedMaxHeight = 150;

      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      requestRef.current = requestAnimationFrame(() => {
        el.style.height = 'auto';
        const nextHeight = Math.min(el.scrollHeight, hardcodedMaxHeight);

        el.style.height = `${nextHeight}px`;

        const shouldScroll = el.scrollHeight > hardcodedMaxHeight + 1;
        el.classList.toggle('is-scrollable', shouldScroll);
        el.style.overflowY = shouldScroll ? 'auto' : 'hidden';
      });
    },
    [onInputChange]
  );

  const handleKeyDownSafe = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const now = Date.now();
      if (now - lastActionTime.current < 500) {
        e.preventDefault();
        return;
      }
      lastActionTime.current = now;
    }
    onKeyDown(e);
  }, [onKeyDown]);

  const handleSendSafe = useCallback(() => {
    const now = Date.now();
    if (now - lastActionTime.current < 500) return;
    if (isInputDisabled || !inputValue.trim()) return;
    lastActionTime.current = now;
    onSend();
  }, [isInputDisabled, inputValue, onSend]);

  const isGenerating = ['thinking', 'speaking'].includes(pipelineState);

  return (
    <div className="chat-input-container w-full px-4 mb-1" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
      <div className="flex flex-row items-end gap-3 max-w-[800px] mx-auto w-full">
        {/* Left Action Buttons */}
        <div className="flex flex-row items-end gap-2">
          <VoiceModeButton
            className="flex items-center justify-center"
            pipelineState={pipelineState}
            onBeforeStart={onBeforeVoiceStart}
            wsClient={wsClient}
          />
          <button
            className="w-[52px] h-[52px] rounded-full bg-dark-secondary hover:bg-dark-tertiary flex items-center justify-center transition-colors text-white/70 hover:text-white"
            title="Manage Curricular Reference Library"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleDocuments();
            }}
            aria-label="Manage Curricular Reference Library"
          >
            <PiPaperclip size={22} />
          </button>
        </div>

        {/* Input Pill */}
        <div className="chat-input-pill flex-1 flex flex-row items-end gap-2.5 rounded-[26px] bg-dark-tertiary px-4 py-1 transition-colors duration-300 min-h-[52px]">
          <textarea
            ref={textareaRef}
            className="flex-1 bg-transparent border-none outline-none focus:ring-0 focus:border-none focus:outline-none focus:shadow-none resize-none text-[15px] text-white/90 placeholder:text-white/40 py-[11px] min-h-[44px] max-h-[132px]"
            aria-label="Message input"
            disabled={isInputDisabled}
            placeholder={placeholderText}
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDownSafe}
            rows={1}
            maxLength={MAX_CHARS}
            style={{ overflowY: 'auto', outline: 'none', boxShadow: 'none' }}
          />

          {isGenerating ? (
            <button
              type="button"
              className="w-10 h-10 rounded-full flex items-center justify-center bg-red-500/90 text-white self-end mb-0.5 hover:bg-red-500 transition-colors animate-pulse"
              onClick={onStop}
              title="Halt Generation"
              aria-label="Halt generation"
            >
              <FiSquare fill="currentColor" size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="w-10 h-10 rounded-full flex items-center justify-center bg-gold text-white self-end mb-0.5 hover:bg-gold-deep transition-colors disabled:opacity-50 disabled:bg-white/10 disabled:text-white/30"
              onClick={handleSendSafe}
              title="Submit inquiry"
              aria-label="Submit inquiry"
              disabled={isInputDisabled || !inputValue.trim()}
            >
              <PiPaperPlaneTiltFill size={18} />
            </button>
          )}
        </div>
      </div>
      <div
        className={`text-center text-[10px] mt-1 text-white/30 transition-opacity ${inputValue.length >= MAX_CHARS ? 'text-red-400' : ''}`}
        style={{ opacity: inputValue.length > 0 ? 1 : 0 }}
      >
        {inputValue.length}/{MAX_CHARS}
      </div>
    </div>
  );
}
