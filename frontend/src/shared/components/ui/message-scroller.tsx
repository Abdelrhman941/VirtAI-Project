import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
} from 'react';

interface MessageScrollerContextProps {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  isAtBottom: boolean;
  setIsAtBottom: (atBottom: boolean) => void;
  visibleMessageIds: string[];
  currentAnchorId: string | null;
  setCurrentAnchorId: (id: string | null) => void;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  registerItem: (id: string, element: HTMLElement) => void;
  unregisterItem: (id: string) => void;
  observeItems: () => void;
}

const MessageScrollerContext = createContext<MessageScrollerContextProps | null>(null);

export function MessageScrollerProvider({
  children,
  defaultScrollPosition = 'last-anchor',
}: {
  children: React.ReactNode;
  defaultScrollPosition?: 'last-anchor' | 'bottom';
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [visibleMessageIds, setVisibleMessageIds] = useState<string[]>([]);
  const [currentAnchorId, setCurrentAnchorId] = useState<string | null>(null);
  const itemsRef = useRef<Map<string, HTMLElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (viewportRef.current) {
      viewportRef.current.scrollTo({
        top: viewportRef.current.scrollHeight,
        behavior,
      });
      setIsAtBottom(true);
    }
  }, []);

  const registerItem = useCallback((id: string, element: HTMLElement) => {
    itemsRef.current.set(id, element);
  }, []);

  const unregisterItem = useCallback((id: string) => {
    itemsRef.current.delete(id);
  }, []);

  const observeItems = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (!viewportRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleMessageIds((prev) => {
          let updated = [...prev];
          entries.forEach((entry) => {
            const id = entry.target.getAttribute('data-message-id');
            if (!id) return;
            if (entry.isIntersecting) {
              if (!updated.includes(id)) {
                updated.push(id);
              }
            } else {
              updated = updated.filter((x) => x !== id);
            }
          });
          return updated;
        });
      },
      {
        root: viewportRef.current,
        threshold: 0.1,
      }
    );

    observerRef.current = observer;
    itemsRef.current.forEach((el) => observer.observe(el));
  }, []);

  // Handle restoring scroll position
  useLayoutEffect(() => {
    if (defaultScrollPosition === 'last-anchor' && currentAnchorId) {
      const anchorEl = itemsRef.current.get(currentAnchorId);
      if (anchorEl) {
        anchorEl.scrollIntoView({ block: 'nearest' });
        return;
      }
    }
    scrollToBottom('instant');
  }, [currentAnchorId, defaultScrollPosition, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return (
    <MessageScrollerContext.Provider
      value={{
        viewportRef,
        isAtBottom,
        setIsAtBottom,
        visibleMessageIds,
        currentAnchorId,
        setCurrentAnchorId,
        scrollToBottom,
        registerItem,
        unregisterItem,
        observeItems,
      }}
    >
      {children}
    </MessageScrollerContext.Provider>
  );
}

export function useMessageScroller() {
  const ctx = useContext(MessageScrollerContext);
  if (!ctx) {
    throw new Error('useMessageScroller must be used within a MessageScrollerProvider');
  }
  return ctx;
}

export function useMessageScrollerVisibility() {
  const { currentAnchorId, visibleMessageIds } = useMessageScroller();
  return { currentAnchorId, visibleMessageIds };
}

export function useMessageScrollerScrollable() {
  const { isAtBottom, scrollToBottom } = useMessageScroller();
  return { isAtBottom, scrollToBottom };
}

export function MessageScroller({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col h-full relative overflow-hidden">{children}</div>;
}

export function MessageScrollerViewport({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { viewportRef, isAtBottom, setIsAtBottom, observeItems } = useMessageScroller();

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const threshold = 30; // pixels from bottom to trigger sticky scroll
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
    setIsAtBottom(isNearBottom);
  };

  // Watch for layout changes to update scroll pinning and trigger observer
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    let lastScrollHeight = el.scrollHeight;

    const observer = new MutationObserver(() => {
      observeItems();
      if (isAtBottom && el.scrollHeight !== lastScrollHeight) {
        el.scrollTop = el.scrollHeight;
        lastScrollHeight = el.scrollHeight;
      }
    });

    observer.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Run initial observation setup
    observeItems();

    return () => {
      observer.disconnect();
    };
  }, [isAtBottom, viewportRef, observeItems]);

  return (
    <div
      ref={viewportRef}
      onScroll={handleScroll}
      className={`overflow-y-auto flex-1 custom-scrollbar ${className || ''}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function MessageScrollerContent({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex flex-col min-h-full ${className || ''}`} {...props}>
      {children}
    </div>
  );
}

interface MessageScrollerItemProps extends React.HTMLAttributes<HTMLDivElement> {
  messageId: string;
  scrollAnchor?: boolean;
}

export const MessageScrollerItem = React.forwardRef<HTMLDivElement, MessageScrollerItemProps>(
  ({ children, messageId, scrollAnchor = false, className, ...props }, ref) => {
    const { registerItem, unregisterItem, setCurrentAnchorId } = useMessageScroller();
    const localRef = useRef<HTMLDivElement | null>(null);

    const setRefs = useCallback(
      (node: HTMLDivElement | null) => {
        localRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      [ref]
    );

    useEffect(() => {
      const el = localRef.current;
      if (el && messageId) {
        registerItem(messageId, el);
        if (scrollAnchor) {
          setCurrentAnchorId(messageId);
        }
      }
      return () => {
        if (messageId) {
          unregisterItem(messageId);
        }
      };
    }, [messageId, registerItem, unregisterItem, scrollAnchor, setCurrentAnchorId]);

    return (
      <div
        ref={setRefs}
        data-message-id={messageId}
        className={`flex-shrink-0 ${className || ''}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
MessageScrollerItem.displayName = 'MessageScrollerItem';

export function MessageScrollerButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { scrollToBottom } = useMessageScroller();
  return (
    <button
      onClick={() => scrollToBottom()}
      className={`absolute bottom-4 right-4 p-2.5 rounded-full bg-[#b4ab8b] text-[#1e1e1e] shadow-lg hover:bg-[#c9c0a0] hover:scale-105 active:scale-95 transition-all duration-200 z-50 flex items-center justify-center border border-[#c9c0a0]/30 ${
        className || ''
      }`}
      aria-label="Scroll to latest"
      {...props}
    >
      {children || '↓'}
    </button>
  );
}
