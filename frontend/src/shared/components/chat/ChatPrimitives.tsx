import { cn } from '@/shared/utils/cn';
import { cva, type VariantProps } from 'class-variance-authority';
import { Bot, User } from 'lucide-react';
import type { ReactNode } from 'react';

/* ================================================================== */
/*  Avatar                                                             */
/* ================================================================== */

export interface AvatarProps {
  type: 'user' | 'assistant';
  size?: number;
  className?: string;
  isTyping?: boolean;
}

/**
 * Avatar — dark-premium circular bubble.
 * When `isTyping` is true, the assistant avatar gets a soft gold ring pulse
 * (fixed: previous version only shifted background, which read as "flat").
 */
export function Avatar({ type, size = 20, className, isTyping }: AvatarProps) {
  const isUser = type === 'user';
  return (
    <div
      className={cn(
        'relative flex-shrink-0 grid place-items-center rounded-full size-9',
        'border transition-all duration-300',
        isUser
          ? [
            'bg-[color:var(--color-gold)]/12',
            'border-[color:var(--color-gold)]/30',
            'text-[color:var(--color-gold)]',
          ]
          : [
            'bg-[color:var(--color-dark-tertiary)]',
            'border-white/10',
            'text-[color:var(--color-offwhite)]/85',
          ],
        !isUser && isTyping && [
          'ring-2 ring-offset-2',
          'ring-[color:var(--color-gold)]/25',
          'ring-offset-[color:var(--color-dark)]',
        ],
        className,
      )}
    >
      {isUser
        ? <User size={size} aria-hidden />
        : <Bot size={size} aria-hidden />}

      {/* Ambient glow behind assistant avatar when typing */}
      {!isUser && isTyping && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full animate-ping bg-[color:var(--color-gold)]/15"
        />
      )}
    </div>
  );
}

/* ================================================================== */
/*  Thinking marker (shimmer)                                          */
/* ================================================================== */

/**
 * ThinkingMarker — displays "Thinking…" with a gold shimmer sweep.
 *
 * Depends on `.shimmer` + `.shimmer-duration-1800` from globals.css.
 * If shimmer keyframes are missing, prefers-reduced-motion fallback
 * shows a static dim label instead of a broken effect.
 */
export function ThinkingMarker({ label = 'Thinking' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-baseline gap-1 select-none"
    >
      <span className="shimmer shimmer-duration-1800 text-sm font-mono font-medium tracking-[0.02em]">
        {label}
      </span>
      <span className="shimmer shimmer-duration-1800 text-sm font-mono tracking-[0.3em]">
        …
      </span>
    </div>
  );
}

/** @deprecated Kept only for external re-exports — use ThinkingMarker directly. */
export const MessageStatus = () => <ThinkingMarker />;

/* ================================================================== */
/*  Chat bubble                                                        */
/* ================================================================== */

const bubbleWrapperVariants = cva('flex w-full gap-3 px-2', {
  variants: {
    role: {
      user: 'justify-end',
      assistant: 'justify-start items-start',
    },
  },
  defaultVariants: { role: 'assistant' },
});

const bubbleVariants = cva('rounded-2xl break-words leading-relaxed', {
  variants: {
    role: {
      user: [
        // Rich gold gradient — clearly visible, not the old pale beige
        'bg-gradient-to-br from-[color:var(--color-gold)] to-[color:var(--color-gold-deep)]',
        'text-[color:var(--color-primary-foreground)]',
        'px-4 py-2.5 max-w-[75%]',
        'shadow-[0_2px_10px_rgba(201,169,97,0.18)]',
        'ms-auto',
      ],
      assistant: [
        // Transparent so markdown "breathes" — no double container feel
        'bg-transparent text-[color:var(--color-offwhite)]/95',
        'px-1 py-1 max-w-none w-full',
        'flex flex-col gap-2 border-none shadow-none',
      ],
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

      <div
        className={cn(
          'flex flex-col min-w-0',
          isUser ? 'items-end' : 'items-start flex-1',
        )}
      >
        {/* Assistant name + timestamp header — no more overlay on markdown */}
        {!isUser && avatarName && !isTyping && (
          <div className="flex items-baseline gap-2 mb-1 px-1">
            <span className="font-bold text-[color:var(--color-gold)] text-sm tracking-wide">
              {avatarName}
            </span>
            {timeString && (
              <span className="text-[10px] text-[color:var(--color-offwhite)]/40 font-mono">
                {timeString}
              </span>
            )}
          </div>
        )}

        <div className={bubbleVariants({ role, state })}>
          {children}
        </div>

        {/* User timestamp below bubble — never overlays text */}
        {isUser && timeString && !isInterim && (
          <span className="text-[10px] text-[color:var(--color-offwhite)]/40 font-mono mt-1 me-2">
            {timeString}
          </span>
        )}
      </div>

      {isUser && <Avatar type="user" />}
    </div>
  );
}
