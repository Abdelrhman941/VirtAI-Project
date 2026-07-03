import { cn } from '@/shared/utils/cn';
import { cva, type VariantProps } from 'class-variance-authority';
import { Bot, User } from 'lucide-react';
import type { ReactNode } from 'react';

/* ------------------------------------------------------------------ */
/*  Avatar                                                             */
/* ------------------------------------------------------------------ */

export interface AvatarProps {
  type: 'user' | 'assistant';
  size?: number;
  className?: string;
  isTyping?: boolean;
}

export function Avatar({ type, size = 22, className, isTyping }: AvatarProps) {
  const isUser = type === 'user';
  return (
    <div
      className={cn(
        'flex-shrink-0 flex items-center justify-center rounded-full',
        'size-9 border border-white/10',
        isUser
          ? 'bg-primary/15 text-primary'
          : 'bg-white/[0.04] text-foreground/80',
        !isUser && !isTyping && 'mt-1',
        className,
      )}
    >
      {isUser ? <User size={size} aria-hidden /> : <Bot size={size} aria-hidden />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Thinking marker (shimmer)                                          */
/* ------------------------------------------------------------------ */

export function ThinkingMarker({ label = 'Thinking…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="shimmer shimmer-duration-1800 text-sm font-mono tracking-wide text-muted-foreground select-none"
    >
      {label}
    </div>
  );
}

/** @deprecated Kept only for external re-exports — use ThinkingMarker directly. */
export const MessageStatus = () => <ThinkingMarker />;

/* ------------------------------------------------------------------ */
/*  Chat bubble (CVA variants)                                         */
/* ------------------------------------------------------------------ */

const bubbleWrapperVariants = cva('flex w-full gap-3 px-2', {
  variants: {
    role: {
      user: 'justify-end',
      assistant: 'justify-start',
    },
  },
  defaultVariants: { role: 'assistant' },
});

const bubbleVariants = cva('rounded-2xl px-4 py-2.5 max-w-[85%] break-words', {
  variants: {
    role: {
      user: 'bg-primary text-primary-foreground ms-auto relative',
      assistant:
        'bg-transparent text-foreground me-auto w-full flex flex-col gap-2 border-none shadow-none',
    },
    state: {
      normal: '',
      interim: 'opacity-60 italic',
    },
  },
  defaultVariants: { role: 'assistant', state: 'normal' },
});

type BubbleVariantProps = VariantProps<typeof bubbleVariants>;

export interface ChatBubbleProps extends BubbleVariantProps {
  role: 'user' | 'assistant';
  children: ReactNode;
  avatarName?: string;
  isTyping?: boolean;
  isInterim?: boolean;
  timeString?: string;
  ariaLabel?: string;
}

export function ChatBubble({
  role,
  children,
  avatarName,
  isTyping,
  isInterim,
  timeString,
  ariaLabel,
}: ChatBubbleProps) {
  const isUser = role === 'user';
  const state = isInterim ? 'interim' : 'normal';

  return (
    <div
      className={bubbleWrapperVariants({ role })}
      role={isInterim || isTyping ? 'status' : 'article'}
      aria-label={ariaLabel}
      aria-live={isInterim ? 'polite' : undefined}
    >
      {!isUser && <Avatar type="assistant" isTyping={isTyping} />}

      <div className={cn('flex flex-col w-full max-w-none', isUser ? 'items-end' : 'items-start')}>
        {!isUser && avatarName && !isTyping && (
          <div className="flex items-center w-full mt-1 mb-0.5 px-1 gap-1">
            <span className="font-extrabold text-primary text-[15px] tracking-wide">
              {avatarName}
            </span>
          </div>
        )}

        <div className={bubbleVariants({ role, state })}>
          {children}

          {isUser && !isInterim && timeString && (
            <span className="absolute bottom-1 end-2 text-[10px] text-black/60 leading-none font-medium">
              {timeString}
            </span>
          )}
        </div>
      </div>

      {isUser && <Avatar type="user" />}
    </div>
  );
}
