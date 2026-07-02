import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/shared/components/ui/sheet';

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

export default function SlideDrawer({
  title,
  description,
  isOpen,
  onClose,
  children,
  className = '',
  contentClassName = '',
  zIndex = 1000,
  enableDrag = false,
  width,
  onWidthChange,
  minWidth = 250,
  maxWidth = 480,
  resizable = false,
}: SlideDrawerProps) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches
  );
  const [isResizing, setIsResizing] = useState(false);
  const titleId = useId();
  const descId = useId();
  const contentRef = useRef<HTMLDivElement>(null);

  // Track mobile breakpoint
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const handleChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Resizing logic (desktop only)
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

  // Focus trap (Tab cycling) — Radix Dialog handles ESC and focus-lock natively,
  // but we preserve the custom Tab handler for backward-compat with any inner
  // content that bypasses Radix's focus scope.
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const container = contentRef.current;
    if (!container) return;
    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
      )
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
        // Radix Dialog handles focus-trap, ESC, scroll-lock, and portal rendering.
        // We override the default Sheet styles and preserve the existing class hooks
        // so that feature-level CSS (documents-drawer-content, sidebar-minimal) keeps working.
        side={isMobile ? 'bottom' : 'right'}
        showCloseButton={false}
        style={{ zIndex, ...((!isMobile && width) ? { width } : {}) }}
        className={cn(
          // Reset shadcn visual defaults — our feature CSS provides all layout/visual styles.
          // We do NOT reset inset/position — the `side` prop handles those correctly.
          '!bg-transparent !border-0 !shadow-none !gap-0 !p-0 [&]:w-auto [&]:max-w-none',
          // Preserve the existing drawer-content class hook so feature CSS (documents-drawer-content,
          // sidebar-minimal) continues to apply its full layout and visual styles
          `drawer-content ${contentClassName}`,
          isResizing ? 'resizing' : '',
          className
        )}
        aria-labelledby={title ? `${titleId}-title` : undefined}
        aria-describedby={description ? `${descId}-desc` : undefined}
        onKeyDown={handleKeyDown}
      >
        <div ref={contentRef} style={{ display: 'contents' }}>
        {/* Accessible title and description — visually hidden, preserved for AT */}
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

        {/* Resizable handle (desktop only) */}
        {!isMobile && resizable && (
          <div
            className="drawer-resize-handle"
            onMouseDown={() => setIsResizing(true)}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '6px',
              cursor: 'col-resize',
              zIndex: 10,
              backgroundColor: isResizing ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              transition: 'background-color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!isResizing) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            }}
            onMouseLeave={(e) => {
              if (!isResizing) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          />
        )}

        {/* Mobile drag handle pill */}
        {isMobile && enableDrag && (
          <div
            className="drawer-drag-handle"
            style={{
              width: '40px',
              height: '5px',
              background: 'var(--border-color)',
              margin: '12px auto 0',
              borderRadius: '4px',
              flexShrink: 0,
            }}
          />
        )}

        {children ?? null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
