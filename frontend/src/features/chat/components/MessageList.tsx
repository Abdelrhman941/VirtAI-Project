import React from 'react';
import { PiLightbulbFilament, PiClockFill } from 'react-icons/pi';
import { Bot, User } from 'lucide-react';
import { StreamingMessageRenderer } from './StreamingMessageRenderer';
import MessageBubble from './MessageBubble';
import { ChatBubble, MessageStatus } from '../../../shared/components/ChatPrimitives';
import { IMessage } from '../../session/types';

interface MessageListProps {
  messages: IMessage[];
  currentMessage: string | null;
  interimTranscript?: string;
  error?: string | null;
  avatarName: string;
  chatScrollRef: React.RefObject<HTMLDivElement>;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  pipelineState?: string;
  onSendText?: (text: string) => void;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
}

const MessageList = React.memo(function MessageList({
  messages,
  currentMessage,
  interimTranscript,
  avatarName,
  chatScrollRef,
  messagesEndRef,
  onScroll,
  pipelineState,
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

          {/* Typing indicator when AI is thinking but not yet streaming */}
          {pipelineState === 'thinking' && !currentMessage && (
            <ChatBubble role="assistant" isTyping ariaLabel="AI is typing">
              <MessageStatus />
            </ChatBubble>
          )}

          {/* Show interim ASR transcript as grayed/italic user bubble */}
          {interimTranscript && (
            <ChatBubble role="user" isInterim ariaLabel="Interim transcript">
              {interimTranscript}
            </ChatBubble>
          )}

          {/* Show streaming message if present */}
          {currentMessage && (
            <ChatBubble role="assistant" avatarName={avatarName} ariaLabel="Assistant is typing">
              <StreamingMessageRenderer content={currentMessage} isStreaming={true} />
            </ChatBubble>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
});

export default MessageList;
