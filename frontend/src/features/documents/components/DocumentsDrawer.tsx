import SlideDrawer from '../../../shared/components/SlideDrawer';
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
      contentClassName="documents-drawer-content"
      zIndex={1000}
      width={width}
      onWidthChange={onWidthChange}
      resizable={resizable}
    >
      <DocumentsPanel sessionId={sessionId} onEnsureSession={onEnsureSession} onClose={onClose} />
    </SlideDrawer>
  );
}
