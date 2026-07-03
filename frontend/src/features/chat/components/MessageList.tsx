import React, { useRef, useEffect } from 'react';
import { PiLightbulbFilament } from 'react-icons/pi';
import MessageBubble from './MessageBubble';
import { ChatBubble, MessageStatus } from '@/shared/components/chat/ChatPrimitives';
import { IMessage } from '../../session/types';
import { useChatUIStore } from '../store/useChatUIStore';

function StreamingLayer({ avatarName }: { avatarName: string }) {
  const currentMessage = useChatUIStore((s) => s.currentMessage);
  const interimTranscript = useChatUIStore((s) => s.interimTranscript);
  const pipelineState = useChatUIStore((s) => s.pipelineState);

  return (
    <>
      {pipelineState === 'thinking' && !currentMessage && (
        <ChatBubble role="assistant" isTyping ariaLabel="AI is typing">
          <MessageStatus />
        </ChatBubble>
      )}

      {interimTranscript && (
        <ChatBubble role="user" isInterim ariaLabel="Interim transcript">
          {interimTranscript}
        </ChatBubble>
      )}

      {currentMessage && (
        <ChatBubble role="assistant" avatarName={avatarName} ariaLabel="Assistant is typing">
          {currentMessage}
        </ChatBubble>
      )}
    </>
  );
}

interface MessageListProps {
  messages: IMessage[];
  error?: string | null;
  avatarName: string;
}

const MessageList = React.memo(function MessageList({
  messages,
  avatarName,
}: MessageListProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  // Track whether user is near the bottom
  const handleScroll = () => {
    const el = viewportRef.current;
    if (!el) return;
    const threshold = 48;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
  };

  // Scroll to bottom on new messages when pinned to bottom
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    if (isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  });

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      <div
        ref={viewportRef}
        onScroll={handleScroll}
        className="flex-1 w-full overflow-y-auto no-scrollbar"
      >
        <div className="w-full flex flex-col gap-4 p-4 pb-20 min-h-full">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
              <PiLightbulbFilament className="text-4xl text-[#b4ab8b] mb-4 animate-pulse" />
              <h2 className="text-xl font-bold text-white mb-2">Start a conversation</h2>
              <p className="text-sm text-gray-400 max-w-sm">Ask {avatarName} anything to begin your lesson.</p>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => (
                <MessageBubble
                  key={msg.id || index}
                  msg={msg}
                  isLast={index === messages.length - 1}
                  avatarName={avatarName}
                />
              ))}
              <StreamingLayer avatarName={avatarName} />
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default MessageList;
export type { MessageListProps };
