import React from 'react';
import { PiLightbulbFilament, PiClockFill } from 'react-icons/pi';
import { Bot, User } from 'lucide-react';
import { StreamingMessageRenderer } from './StreamingMessageRenderer';
import MessageBubble from './MessageBubble';
import { ChatBubble, MessageStatus } from '../../../shared/components/ChatPrimitives';
import { IMessage } from '../../session/types';
import { useChatUIStore } from '../store/useChatUIStore';

function StreamingLayer({ avatarName }: { avatarName: string }) {
  const currentMessage = useChatUIStore(s => s.currentMessage);
  const interimTranscript = useChatUIStore(s => s.interimTranscript);
  const pipelineState = useChatUIStore(s => s.pipelineState);

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
          <StreamingMessageRenderer content={currentMessage} isStreaming={true} />
        </ChatBubble>
      )}
    </>
  );
}

interface MessageListProps {
  messages: IMessage[];
  error?: string | null;
  avatarName: string;
  chatScrollRef: React.RefObject<HTMLDivElement>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onSendText?: (text: string) => void;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
}

const MessageList = React.memo(function MessageList({
  messages,
  avatarName,
  chatScrollRef,
  messagesEndRef,
  onScroll,
}: MessageListProps) {
  return (
    <div
      className="chat-messages"
      ref={chatScrollRef}
      onScroll={onScroll}
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
    >
      {messages.length === 0 ? (
        <div className="welcome-state">
          <PiLightbulbFilament className="welcome-icon" />
          <h2 className="welcome-title">Start a conversation</h2>
          <p className="welcome-subtitle">Ask {avatarName} anything to begin your lesson.</p>
        </div>
      ) : (
        <div className="chat-stream">
          {messages.map((msg, index) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isLast={index === messages.length - 1}
              avatarName={avatarName}
              onScrollToBottom={() => {
                if (chatScrollRef.current) {
                  chatScrollRef.current.scrollTo({
                    top: chatScrollRef.current.scrollHeight,
                    behavior: 'smooth'
                  });
                }
              }}
            />
          ))}
          <StreamingLayer avatarName={avatarName} />
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
});

export default MessageList;
