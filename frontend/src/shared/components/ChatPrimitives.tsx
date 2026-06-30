import React, { ReactNode } from 'react';
import { Bot, User } from 'lucide-react';

export interface AvatarProps {
  type: 'user' | 'assistant';
  size?: number;
  className?: string;
  isTyping?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({ type, size = 22, className = '', isTyping }) => {
  const isUser = type === 'user';
  return (
    <div className={`message-avatar ${isUser ? 'user-avatar' : `ai-avatar ${isTyping ? '' : 'mt-1'}`} ${className}`}>
      {isUser ? <User size={size} aria-hidden="true" /> : <Bot size={size} aria-hidden="true" />}
    </div>
  );
};

export const MessageStatus: React.FC = () => (
  <>
    <span className="typing-dot" />
    <span className="typing-dot" />
    <span className="typing-dot" />
  </>
);

export interface ChatBubbleProps {
  role: 'user' | 'assistant';
  children: ReactNode;
  avatarName?: string;
  isTyping?: boolean;
  isInterim?: boolean;
  timeString?: string;
  ariaLabel?: string;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  role,
  children,
  avatarName,
  isTyping,
  isInterim,
  timeString,
  ariaLabel
}) => {
  const isUser = role === 'user';
  
  return (
    <div
      className={`chat-message-wrapper ${isUser ? 'user-message-wrapper' : 'ai-message-wrapper'} ${isInterim ? '' : 'message-enter'}`}
      role={isInterim || isTyping ? 'status' : 'article'}
      aria-label={ariaLabel}
      aria-live={isInterim ? 'polite' : undefined}
    >
      <div 
        className={`chat-message ${isUser ? 'user-message' : 'ai-message'} ${isTyping ? 'typing-state' : 'items-start'} ${isInterim ? 'interim-transcript' : ''}`}
      >
        {!isUser && <Avatar type="assistant" isTyping={isTyping} />}
        
        <div className={`message-bubble-container flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-none w-full`}>
          {!isUser && avatarName && !isTyping && (
            <div className="flex justify-start items-center w-full mt-1 mb-0.5 px-1 gap-1">
              <span className="font-extrabold text-[#D4B47A] text-[15px] tracking-wide">{avatarName}</span>
            </div>
          )}
          
          <div className={`message-bubble ${isUser ? (isInterim ? '' : 'user-bubble-content relative') : (isTyping ? 'typing-indicator' : 'bg-transparent shadow-none border-none flex flex-col gap-2 w-full')}`}>
            {children}
            
            {isUser && !isInterim && timeString && (
              <>
                <span className="inline-block w-[45px]"></span>
                <span className="absolute bottom-1 right-2 text-[10px] text-black/60 leading-none font-medium">
                  {timeString}
                </span>
              </>
            )}
          </div>
        </div>

        {isUser && <Avatar type="user" />}
      </div>
    </div>
  );
};
