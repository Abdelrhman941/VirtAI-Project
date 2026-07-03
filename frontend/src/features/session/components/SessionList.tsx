import { useLogout } from '@/features/auth/hooks/useAuth';
import { memo, useCallback, useMemo, useState } from 'react';
import { FiLogOut } from 'react-icons/fi';
import {
  PiChatCircleTextFill,
  PiPencilSimpleFill,
  PiPlusFill,
  PiTrashSimpleFill
} from 'react-icons/pi';
import { ISession } from '../types';
import SessionHoverPreview from './SessionHoverPreview';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/shared/components/ui/context-menu';
import { formatRelativeTime, safeParseDate } from '@/shared/utils/date';

export interface SessionListProps {
  sessions: ISession[];
  currentSessionId: string | null;
  onSessionSelect: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onClearAllSessions?: () => void;
  onCloseDrawer?: () => void;
}

interface SessionListItemProps {
  session: ISession;
  isActive: boolean;
  isEditing: boolean;
  editValue: string;
  onEditValueChange: (val: string) => void;
  onSaveEdit: (id: string) => void;
  onEditKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, id: string) => void;
  onMouseEnter: (session: ISession, element: HTMLElement) => void;
  onMouseLeave: () => void;
  onSelect: (id: string) => void;
  startEditing: (session: ISession) => void;
  setDeleteSessionId: (id: string) => void;
}

const SessionListItem = memo(function SessionListItem({
  session,
  isActive,
  isEditing,
  editValue,
  onEditValueChange,
  onSaveEdit,
  onEditKeyDown,
  onMouseEnter,
  onMouseLeave,
  onSelect,
  startEditing,
  setDeleteSessionId,
}: SessionListItemProps) {
  const displayTime = session.last_message_at;

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className="sidebar-session-item-wrapper"
          onMouseEnter={(e) => onMouseEnter(session, e.currentTarget)}
          onMouseLeave={onMouseLeave}
        >
          <button
            className={`sidebar-session-item ${isActive ? 'active' : ''}`}
            onClick={() => onSelect(session.id)}
            aria-label={`Open chat: ${session.title || 'New chat'}`}
          >
            <PiChatCircleTextFill className="session-icon" />

            <div className="session-info">
              {isEditing ? (
                <input
                  type="text"
                  className="session-edit-input"
                  value={editValue}
                  onChange={(e) => onEditValueChange(e.target.value)}
                  onBlur={() => onSaveEdit(session.id)}
                  onKeyDown={(e) => onEditKeyDown(e, session.id)}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div className="session-title-row min-w-0">
                  <span className="session-title truncate block w-full overflow-hidden text-ellipsis" dir="auto" title={session.title || 'New chat'}>{session.title || 'New chat'}</span>
                  {displayTime && (
                    <span className="session-time">{formatRelativeTime(displayTime)}</span>
                  )}
                </div>
              )}
            </div>
          </button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="bg-dark-tertiary/95 backdrop-blur-xl border border-white/10 shadow-2xl rounded-xl p-1 z-[9999]">
        <ContextMenuItem
          className="flex items-center gap-2 w-full text-left px-3.5 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white rounded-lg transition-colors cursor-pointer"
          onClick={() => startEditing(session)}
        >
          <PiPencilSimpleFill size={16} /> Rename Session
        </ContextMenuItem>
        <ContextMenuSeparator className="bg-white/10 my-1 mx-2" />
        <ContextMenuItem
          className="flex items-center gap-2 w-full text-left px-3.5 py-2.5 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
          onClick={() => setDeleteSessionId(session.id)}
        >
          <PiTrashSimpleFill size={16} /> Delete Session
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});

/**
 * Scrollable list of chat sessions with new/rename/delete actions.
 * Right-click a chat item to open the floating context menu.
 */
const SessionList = memo(function SessionList({
  sessions,
  currentSessionId,
  onSessionSelect,
  onNewSession,
  onDeleteSession,
  onRenameSession,
  onClearAllSessions,
  onCloseDrawer,
}: SessionListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [hoveredSession, setHoveredSession] = useState<ISession | null>(null);
  const [hoverElement, setHoverElement] = useState<HTMLElement | null>(null);
  const { logout } = useLogout();

  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

  // Schwartzian transform: parse each timestamp exactly once, then sort.
  // The previous version called `new Date()` inside the comparator, executing
  // it O(N log N) times on every render — catastrophic for large session lists.

  function toMs(v: string | number | undefined): number {
    if (v === undefined || v === null) return 0;
    return safeParseDate(v)?.getTime() ?? 0;
  }

  const sortedIds = useMemo(() => {
    // Step 1: compute a numeric timestamp for every session — O(N).
    const tsMap = new Map<string, number>(
      sessions.map((s) => [s.id, toMs(s.last_message_at)])
    );
    // Step 2: sort by pre-computed value — O(N log N), comparisons are cheap.
    return [...sessions]
      .sort((a, b) => (tsMap.get(b.id) ?? 0) - (tsMap.get(a.id) ?? 0))
      .map((s) => s.id);
  }, [sessions]);

  const filtered = useMemo(() => {
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));
    return sortedIds
      .map((id) => sessionMap.get(id))
      .filter((s): s is ISession => {
        if (!s) return false;
        const isNewChat = !s.title || s.title === 'New chat';
        const hasNoMessages =
          (s.messages && s.messages.length === 0) || s.message_count === 0 || (!s.messages && typeof s.message_count !== 'number');

        // Ghost session filter
        if (isNewChat && hasNoMessages && s.id !== currentSessionId) {
          return false;
        }
        return true;
      });
  }, [sortedIds, sessions, currentSessionId]);

  const startEditing = useCallback((session: ISession) => {
    setEditingId(session.id);
    setEditValue(session.title || 'New chat');
  }, []);

  const saveEdit = useCallback(
    (sessionId: string) => {
      if (editValue.trim() && editingId === sessionId) {
        onRenameSession(sessionId, editValue.trim());
      }
      setEditingId(null);
    },
    [editValue, editingId, onRenameSession]
  );

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, sessionId: string) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveEdit(sessionId);
      } else if (e.key === 'Escape') {
        setEditingId(null);
      }
    },
    [saveEdit]
  );

  const handleSessionSelect = useCallback(
    (id: string) => {
      onSessionSelect(id);
      if (onCloseDrawer && window.innerWidth < 1024) {
        onCloseDrawer();
      }
    },
    [onSessionSelect, onCloseDrawer]
  );

  const handleLogout = useCallback(() => {
    void logout();
    if (onCloseDrawer) {
      onCloseDrawer();
    }
  }, [logout, onCloseDrawer]);

  const handleItemMouseEnter = useCallback((session: ISession, element: HTMLElement) => {
    setHoveredSession(session);
    setHoverElement(element);
  }, []);

  const handleItemMouseLeave = useCallback(() => {
    setHoveredSession(null);
    setHoverElement(null);
  }, []);

  return (
    <div className="sidebar-inner w-full relative">

      <div className="sidebar-chats-section">
        <div className="flex items-center justify-between w-full mb-4 px-4 pt-4 border-b border-white/5 pb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 m-0 leading-none">
            Discussion History
          </h2>
          <div className="flex items-center gap-2">
            <button
              className="text-xs font-medium px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 transition-all flex items-center gap-1.5 text-white"
              onClick={onNewSession}
              aria-label="Start new session"
            >
              <PiPlusFill size={14} /> New Session
            </button>
            {sessions.length > 0 && (
              <button
                id="clear-all-chats-btn"
                className="flex items-center justify-center p-1"
                onClick={() => setIsConfirmClearOpen(true)}
                aria-label="Delete all sessions"
                title="Clear Session History"
              >
                <PiTrashSimpleFill className="w-4 h-4 text-gray-400 hover:text-red-400 cursor-pointer transition-colors" />
              </button>
            )}
          </div>
        </div>

        <div className="sidebar-sessions-scroll overflow-y-auto no-scrollbar h-full">
          {filtered.length === 0 ? (
            <div className="sidebar-empty-state">
              <p>No active classroom sessions. Upload a syllabus or document to start your first session.</p>
            </div>
          ) : (
            filtered.map((session) => {
              const isEditing = editingId === session.id;

              return (
                <SessionListItem
                  key={session.id}
                  session={session}
                  isActive={session.id === currentSessionId}
                  isEditing={isEditing}
                  editValue={isEditing ? editValue : ''}
                  onEditValueChange={setEditValue}
                  onSaveEdit={saveEdit}
                  onEditKeyDown={handleEditKeyDown}
                  onMouseEnter={handleItemMouseEnter}
                  onMouseLeave={handleItemMouseLeave}
                  onSelect={handleSessionSelect}
                  startEditing={startEditing}
                  setDeleteSessionId={setDeleteSessionId}
                />
              );
            })
          )}
        </div>

        <div className="mt-auto px-0 pb-4 pt-4">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-offwhite/75 transition-colors duration-200 hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
            onClick={handleLogout}
            aria-label="Disconnect account from VirtAI"
          >
            <FiLogOut className="h-4 w-4" />
            <span>Disconnect Account</span>
          </button>
        </div>
      </div>

      <AlertDialog open={!!deleteSessionId} onOpenChange={(open) => !open && setDeleteSessionId(null)}>
        <AlertDialogContent className="bg-dark-secondary border border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to delete this session? This will permanently remove all logs and history associated with it. This operation cannot be reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border border-white/10 hover:bg-white/10 text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white border-0"
              onClick={() => {
                if (deleteSessionId) {
                  onDeleteSession(deleteSessionId);
                  setDeleteSessionId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isConfirmClearOpen} onOpenChange={setIsConfirmClearOpen}>
        <AlertDialogContent className="bg-dark-secondary border border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Sessions?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This will permanently erase all active and archived sessions from this device. This operation cannot be reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border border-white/10 hover:bg-white/10 text-white">
              Keep Sessions
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white border-0"
              onClick={() => {
                setIsConfirmClearOpen(false);
                onClearAllSessions?.();
              }}
            >
              Delete All Sessions
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {hoveredSession && hoverElement && (
        <SessionHoverPreview
          session={hoveredSession}
          triggerElement={hoverElement}
          isHovered={!!hoveredSession}
        />
      )}
    </div>
  );
});

export default SessionList;
