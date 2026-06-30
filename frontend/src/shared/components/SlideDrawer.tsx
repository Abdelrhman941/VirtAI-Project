import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useId, useRef, useState, ReactNode } from 'react';

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
  const drawerRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches
  );
  const [isResizing, setIsResizing] = useState(false);
  const id = useId();

  // Resizing logic
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      let newWidth = window.innerWidth - e.clientX;
      const dynamicMaxWidth = Math.min(maxWidth, window.innerWidth - 320);
      if (newWidth < minWidth) newWidth = minWidth;
      if (newWidth > dynamicMaxWidth) newWidth = dynamicMaxWidth;
      
      if (onWidthChange) {
        onWidthChange(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isResizing, minWidth, maxWidth, onWidthChange]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const handleChange = (e) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Focus restoration
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  // Focus first focusable element on open
  useEffect(() => {
    if (!isOpen || !drawerRef.current) return;
    const firstFocusable = drawerRef.current.querySelector(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    requestAnimationFrame(() => firstFocusable?.focus());
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap
  const handleKeyDown = useCallback((e) => {
    if (e.key !== 'Tab') {
      return;
    }
    const drawer = drawerRef.current;
    if (!drawer) {
      return;
    }
    const focusable = Array.from(
      drawer.querySelectorAll(
        'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !(el as HTMLButtonElement).disabled && (el as HTMLElement).offsetParent !== null);
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside key="drawer-wrapper" className={`slide-drawer open ${className}`} style={{ zIndex }}>
          <motion.div
            className="drawer-overlay"
            onClick={onClose}
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            className={`drawer-content ${contentClassName} ${isResizing ? 'resizing' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? `${id}-title` : undefined}
            aria-describedby={description ? `${id}-desc` : undefined}
            ref={drawerRef}
            style={{ width: (!isMobile && width) ? width : undefined }}
            onKeyDown={handleKeyDown}
            drag={isMobile && enableDrag ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0}
            onDragEnd={(e, info) => {
              if (isMobile && enableDrag && info.offset.y > 100) {
                onClose();
              }
            }}
            initial={isMobile ? { y: '100%' } : { x: '100%' }}
            animate={isMobile ? { y: 0 } : { x: 0 }}
            exit={isMobile ? { y: '100%' } : { x: '100%' }}
            transition={{ type: 'tween', ease: [0.2, 0.8, 0.2, 1], duration: 0.3 }}
          >
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
                  if (!isResizing) (e.target as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  if (!isResizing) (e.target as HTMLElement).style.backgroundColor = 'transparent';
                }}
              />
            )}
            {isMobile && (
              <div
                className="drawer-drag-handle"
                style={
                  enableDrag
                    ? {
                      width: '40px',
                      height: '5px',
                      background: 'var(--border-color)',
                      margin: '12px auto 0',
                      borderRadius: '4px',
                      flexShrink: 0,
                    }
                    : undefined
                }
              />
            )}
            {title && <h2 id={`${id}-title`} className="sr-only">{title}</h2>}
            {description && <p id={`${id}-desc`} className="sr-only">{description}</p>}
            {children || null}
          </motion.div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
