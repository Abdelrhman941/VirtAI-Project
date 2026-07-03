import { ChatBubble } from '@/shared/components/chat/ChatPrimitives';
import CopyButton from '@/shared/components/controls/CopyButton';
import {
  MarkdownRenderer,
  StreamingMarkdownRenderer,
} from '@/shared/markdown';
import React, { memo } from 'react';
import { formatTimeOnly } from '../../../shared/utils/date';
import { IMessage } from '../../session/types';
import { VisualizeButton } from './VisualizeButton';

interface MessageBubbleProps {
  msg: IMessage;
  isLast?: boolean;
  avatarName: string;
  /**
   * Whether this specific message is currently the streaming target.
   * When true, the renderer switches to StreamingMarkdownRenderer,
   * which parses the "hot tail" incrementally and shows a blinking
   * cursor at the end.
   */
  isStreaming?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = memo(function MessageBubble({
  msg,
  isLast,
  avatarName,
  isStreaming = false,
}) {
  const isUser = msg.role === 'user';
  const canonicalTimestamp = msg.created_at;
  const timeString =
    msg.status === 'pending' ? 'Sending...' : formatTimeOnly(canonicalTimestamp);

  return (
    <ChatBubble
      role={isUser ? 'user' : 'assistant'}
      avatarName={avatarName}
      timeString={timeString}
      ariaLabel={
        timeString
          ? `${isUser ? 'You' : avatarName} at ${timeString}`
          : `${isUser ? 'You' : avatarName}`
      }
    >
      {isUser ? (
        msg.content
      ) : (
        <>
          {/*
            ✅ FIX (#6 in report): use StreamingMarkdownRenderer only while
            actively streaming so the last chunk parses incrementally and
            a cursor blinks at the tail. Once committed, switch back to the
            static MarkdownRenderer for cheaper re-renders.
          */}
          {isStreaming ? (
            <StreamingMarkdownRenderer
              content={msg.content}
              variant="chat"
              streaming
            />
          ) : (
            <MarkdownRenderer content={msg.content} variant="chat" />
          )}

          {!isStreaming && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <CopyButton content={msg.content} />
            </div>
          )}

          {!isStreaming && isLast && msg.id && (
            <VisualizeButton messageId={msg.id} locale="en" />
          )}
        </>
      )}
    </ChatBubble>
  );
});

export default MessageBubble;
