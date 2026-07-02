import React from 'react';
import { PiLightbulbFilament } from 'react-icons/pi';
import { AnimatePresence, motion } from 'framer-motion';
import MessageBubble from './MessageBubble';
import { ChatBubble, MessageStatus } from '../../../shared/components/ChatPrimitives';
import { IMessage } from '../../session/types';
import { useChatUIStore } from '../store/useChatUIStore';
import {
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  useMessageScrollerScrollable,
} from '@/shared/components/ui/message-scroller';

const MotionMessageScrollerItem = motion.create(MessageScrollerItem);

function StreamingLayer({ avatarName }: { avatarName: string }) {
  const currentMessage = useChatUIStore((s) => s.currentMessage);
  const interimTranscript = useChatUIStore((s) => s.interimTranscript);
  const pipelineState = useChatUIStore((s) => s.pipelineState);

  return (
    <>
      {pipelineState === 'thinking' && !currentMessage && (
        <MessageScrollerItem messageId="thinking-state" className="w-full">
          <ChatBubble role="assistant" isTyping ariaLabel="AI is typing">
            <MessageStatus />
          </ChatBubble>
        </MessageScrollerItem>
      )}

      {interimTranscript && (
        <MessageScrollerItem messageId="interim-transcript" className="w-full">
          <ChatBubble role="user" isInterim ariaLabel="Interim transcript">
            {interimTranscript}
          </ChatBubble>
        </MessageScrollerItem>
      )}

      {currentMessage && (
        <MessageScrollerItem messageId="streaming-message" className="w-full" scrollAnchor={true}>
          <ChatBubble role="assistant" avatarName={avatarName} ariaLabel="Assistant is typing">
            {/* The streaming message content is formatted inside ChatBubble */}
            {currentMessage}
          </ChatBubble>
        </MessageScrollerItem>
      )}
    </>
  );
}

// Scroll-to-bottom overlay button gated by scroll position state
function ScrollToLatestButton() {
  const { isAtBottom } = useMessageScrollerScrollable();

  return (
    <AnimatePresence>
      {!isAtBottom && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          className="absolute bottom-4 right-4 z-50 pointer-events-auto"
        >
          <MessageScrollerButton>
            <span>↓</span>
          </MessageScrollerButton>
        </motion.div>
      )}
    </AnimatePresence>
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
  return (
    <MessageScroller>
      <MessageScrollerViewport className="flex-1 w-full relative scroll-fade scroll-fade-24">
        <MessageScrollerContent className="w-full pb-20">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
              <PiLightbulbFilament className="text-4xl text-[#b4ab8b] mb-4 animate-pulse" />
              <h2 className="text-xl font-bold text-white mb-2">Start a conversation</h2>
              <p className="text-sm text-gray-400 max-w-sm">Ask {avatarName} anything to begin your lesson.</p>
            </div>
          ) : (
            <div className="w-full flex flex-col gap-4 p-4">
              {messages.map((msg, index) => {
                const isUser = msg.role === 'user';
                return (
                  <MotionMessageScrollerItem
                    key={msg.id || index}
                    messageId={msg.id || `msg-${index}`}
                    scrollAnchor={isUser}
                    initial={{ opacity: 0, x: isUser ? 24 : -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                    className="w-full"
                  >
                    <MessageBubble
                      msg={msg}
                      isLast={index === messages.length - 1}
                      avatarName={avatarName}
                    />
                  </MotionMessageScrollerItem>
                );
              })}
              <StreamingLayer avatarName={avatarName} />
            </div>
          )}
        </MessageScrollerContent>
      </MessageScrollerViewport>
      <ScrollToLatestButton />
    </MessageScroller>
  );
});

export default MessageList;
export type { MessageListProps };
