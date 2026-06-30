import React, { memo } from 'react';
import CopyButton from '../../../shared/components/CopyButton';
import { StreamingMessageRenderer } from './StreamingMessageRenderer';
import { VisualizeButton } from './VisualizeButton';
import { IMessage } from '../../session/types';
import { formatTimeOnly } from '../../../shared/utils/date';
import { ChatBubble } from '../../../shared/components/ChatPrimitives';

interface MessageBubbleProps {
  msg: IMessage;
  isLast?: boolean;
  avatarName: string;
  onScrollToBottom?: () => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = memo(function MessageBubble({ msg, isLast, avatarName, onScrollToBottom }) {
  const isUser = msg.role === 'user';
  const canonicalTimestamp = msg.created_at;
  const timeString = msg.status === 'pending' ? 'Sending...' : formatTimeOnly(canonicalTimestamp);

  return (
    <ChatBubble
      role={isUser ? 'user' : 'assistant'}
      avatarName={avatarName}
      timeString={timeString}
      ariaLabel={timeString ? `${isUser ? 'You' : avatarName} at ${timeString}` : `${isUser ? 'You' : avatarName}`}
    >
      {isUser ? (
        msg.content
      ) : (
        <>
          <StreamingMessageRenderer content={msg.content} isStreaming={false} />
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <CopyButton content={msg.content} />
          </div>
          {isLast && msg.id && (
            <VisualizeButton messageId={msg.id} locale="en" onExpand={onScrollToBottom} />
          )}
        </>
      )}
    </ChatBubble>
  );
});

export default MessageBubble;
