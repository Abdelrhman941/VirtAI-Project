import { ChatBubble, MessageStatus } from '@/shared/components/chat/ChatPrimitives';
import { MessageScrollerItem } from '@/shared/components/chat/MessageScrollerItem';
import { MessageScrollerProvider } from '@/shared/components/chat/MessageScrollerProvider';
import React from 'react';
import { PiLightbulbFilament } from 'react-icons/pi';
import type { IMessage } from '../../session/types';
import { useChatUIStore } from '../store/useChatUIStore';
import MessageBubble from './MessageBubble';

// ─── Streaming overlay ────────────────────────────────────────────────────────

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

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ avatarName }: { avatarName: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
      <PiLightbulbFilament className="text-4xl text-gold-soft mb-4 animate-pulse" />
      <h2 className="text-xl font-bold text-offwhite mb-2">Start a conversation</h2>
      <p className="text-sm text-offwhite/50 max-w-sm">
        Ask {avatarName} anything to begin your lesson.
      </p>
    </div>
  );
}

// ─── MessageList ──────────────────────────────────────────────────────────────

export interface MessageListProps {
  messages: IMessage[];
  error?: string | null;
  avatarName: string;
}

const MessageList = React.memo(function MessageList({ messages, avatarName }: MessageListProps) {
  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      <MessageScrollerProvider>
        <div className="w-full flex flex-col gap-4 p-4 pb-20 min-h-full">
          {messages.length === 0 ? (
            <EmptyState avatarName={avatarName} />
          ) : (
            <>
              {messages.map((msg, index) => (
                <MessageScrollerItem key={msg.id ?? index}>
                  <MessageBubble
                    msg={msg}
                    isLast={index === messages.length - 1}
                    avatarName={avatarName}
                  />
                </MessageScrollerItem>
              ))}
              <StreamingLayer avatarName={avatarName} />
            </>
          )}
        </div>
      </MessageScrollerProvider>
    </div>
  );
});

export default MessageList;
