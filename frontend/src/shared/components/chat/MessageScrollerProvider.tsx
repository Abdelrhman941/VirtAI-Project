import { cn } from '@/shared/utils/cn';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

// ─── Context ──────────────────────────────────────────────────────────────────

interface MessageScrollerContextValue {
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  isAtBottom: boolean;
}

const MessageScrollerContext = createContext<MessageScrollerContextValue | null>(null);

export function useMessageScroller(): MessageScrollerContextValue {
  const ctx = useContext(MessageScrollerContext);
  if (!ctx) throw new Error('useMessageScroller must be used inside <MessageScrollerProvider>');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface MessageScrollerProviderProps {
  children: ReactNode;
  className?: string;
  /** Distance in px from the bottom that counts as "pinned". Default: 48 */
  threshold?: number;
}

/**
 * Replaces the inline viewportRef / isAtBottomRef / handleScroll pattern
 * that was duplicated in MessageList. Provides a stable context so any
 * descendant can query isAtBottom or imperatively call scrollToBottom.
 */
export function MessageScrollerProvider({
  children,
  className,
  threshold = 48,
}: MessageScrollerProviderProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
      isAtBottomRef.current = atBottom;
      setIsAtBottom(atBottom);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return (
    <MessageScrollerContext.Provider value={{ scrollToBottom, isAtBottom }}>
      <div
        ref={viewportRef}
        className={cn('flex-1 w-full overflow-y-auto no-scrollbar', className)}
      >
        {children}
      </div>
    </MessageScrollerContext.Provider>
  );
}
