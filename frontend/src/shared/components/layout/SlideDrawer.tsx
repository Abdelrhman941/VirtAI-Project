import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import { cn } from '@/shared/utils/cn';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface SlideDrawerProps {
  title: string;
  description?: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  zIndex?: number;
  enableDrag?: boolean;
  width?: number;
  onWidthChange?: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
}

const FOCUSABLE_SELECTOR = 'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';

export default function SlideDrawer({
  title,
  description,
  isOpen,
  onClose,
  children,
  className,
  contentClassName,
  zIndex = 1000,
  enableDrag = false,
  width,
  onWidthChange,
  minWidth = 250,
  maxWidth = 480,
  resizable = false,
}: SlideDrawerProps) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches,
  );
  const [isResizing, setIsResizing] = useState(false);
  const titleId = useId();
  const descId = useId();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const handleChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      let newWidth = window.innerWidth - e.clientX;
      const dynamicMaxWidth = Math.min(maxWidth, window.innerWidth - 320);
      if (newWidth < minWidth) newWidth = minWidth;
      if (newWidth > dynamicMaxWidth) newWidth = dynamicMaxWidth;
      onWidthChange?.(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isResizing, minWidth, maxWidth, onWidthChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const container = contentRef.current;
    if (!container) return;
    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        showCloseButton={false}
        /* zIndex + width are runtime-dynamic → intentional inline style */
        style={{ zIndex, ...(!isMobile && width ? { width } : {}) }}
        className={cn(
          '!bg-transparent !border-0 !shadow-none !gap-0 !p-0 [&]:w-auto [&]:max-w-none',
          contentClassName,
          className,
        )}
        aria-labelledby={title ? `${titleId}-title` : undefined}
        aria-describedby={description ? `${descId}-desc` : undefined}
        onKeyDown={handleKeyDown}
      >
        <div ref={contentRef} className="contents">
          {title && (
            <SheetTitle id={`${titleId}-title`} className="sr-only">
              {title}
            </SheetTitle>
          )}
          {description && (
            <SheetDescription id={`${descId}-desc`} className="sr-only">
              {description}
            </SheetDescription>
          )}

          {!isMobile && resizable && (
            <div
              role="separator"
              aria-orientation="vertical"
              className={cn(
                'absolute start-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 transition-colors duration-200',
                'hover:bg-white/5',
                isResizing && 'bg-white/10',
              )}
              onMouseDown={() => setIsResizing(true)}
            />
          )}

          {isMobile && enableDrag && (
            <div
              aria-hidden
              className="w-10 h-[5px] mx-auto mt-3 rounded flex-shrink-0 bg-border/60"
            />
          )}

          {children ?? null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
