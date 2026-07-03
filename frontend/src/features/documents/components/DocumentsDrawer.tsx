import SlideDrawer from '@/shared/components/layout/SlideDrawer';
import { DocumentsPanel } from './DocumentsPanel';

interface DocumentsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string | null;
  onEnsureSession?: () => Promise<string | null>;
  width?: number;
  onWidthChange?: (width: number) => void;
  resizable?: boolean;
}

export function DocumentsDrawer({ isOpen, onClose, sessionId, onEnsureSession, width, onWidthChange, resizable }: DocumentsDrawerProps) {
  return (
    <SlideDrawer
      title="Curricular Library"
      description="Manage reference syllabus, textbooks, and notes for this session"
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="absolute top-0 right-0 w-[420px] max-w-[92vw] h-full flex flex-col pt-3 px-4 pb-4 ltr overflow-visible bg-card border-l-0 shadow-[-4px_0_24px_rgba(0,0,0,0.4)] z-[1000] max-lg:inset-auto max-lg:bottom-0 max-lg:left-0 max-lg:w-full max-lg:max-w-[100vw] max-lg:h-[min(82vh,720px)] max-lg:border-t max-lg:border-white/10 max-lg:rounded-t-[20px]"
      zIndex={1000}
      width={width}
      onWidthChange={onWidthChange}
      resizable={resizable}
    >
      <DocumentsPanel sessionId={sessionId} onEnsureSession={onEnsureSession} onClose={onClose} />
    </SlideDrawer>
  );
}
