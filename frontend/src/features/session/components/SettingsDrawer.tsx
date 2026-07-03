import SlideDrawer from '@/shared/components/layout/SlideDrawer';
import { ISession } from '../types';
import SessionList from './SessionList';

export interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ISession[];
  currentSessionId: string | null;
  onSessionSelect: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onClearAllSessions?: () => void;
  width?: number;
  onWidthChange?: (width: number) => void;
  resizable?: boolean;
}

/*
  * Side drawer for settings, session list, current session info, and tutor status.
*/
export default function SettingsDrawer({
  isOpen,
  onClose,
  sessions,
  currentSessionId,
  onSessionSelect,
  onNewSession,
  onDeleteSession,
  onRenameSession,
  onClearAllSessions,
  width,
  onWidthChange,
  resizable,
}: SettingsDrawerProps) {
  return (
    <SlideDrawer
      title="Settings Drawer"
      description="Sidebar for chat sessions and account settings"
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="sidebar-minimal"
      enableDrag={true}
      width={width}
      onWidthChange={onWidthChange}
      resizable={resizable}
    >
      <div className="flex flex-col h-full py-4 min-h-0">
        <SessionList
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSessionSelect={onSessionSelect}
          onNewSession={onNewSession}
          onDeleteSession={onDeleteSession}
          onRenameSession={onRenameSession}
          onClearAllSessions={onClearAllSessions}
          onCloseDrawer={onClose}
        />
      </div>
    </SlideDrawer>
  );
}
