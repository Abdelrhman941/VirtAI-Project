import { useLogout } from '@/features/auth/hooks/useAuth';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiLogOut } from 'react-icons/fi';
import {
  PiChatCircleTextFill,
  PiChatsFill,
  PiPencilSimpleFill,
  PiPlusFill,
  PiTrashSimpleFill,
} from 'react-icons/pi';
import { ISession } from '../types';
import SessionHoverPreview from './SessionHoverPreview';

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
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onMouseEnter: (session: ISession, element: HTMLElement) => void;
  onMouseLeave: () => void;
  onSelect: (id: string) => void;
}

const SessionListItem = memo(function SessionListItem({
  session,
  isActive,
  isEditing,
  editValue,
  onEditValueChange,
  onSaveEdit,
  onEditKeyDown,
  onContextMenu,
  onMouseEnter,
  onMouseLeave,
  onSelect,
}: SessionListItemProps) {
  const displayTime = session.last_message_at;

  return (
    <div
      className="sidebar-session-item-wrapper"
      onContextMenu={(e) => onContextMenu(e, session.id)}
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

  // Context menu state: { sessionId, x, y } or null
  const [contextMenu, setContextMenu] = useState<{
    sessionId: string;
    x: number;
    y: number;
  } | null>(null);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu on any click outside of it
  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    function handleClickOutside(event: MouseEvent) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    }
    const id = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [contextMenu]);

  // Close context menu on scroll
  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    const handleScroll = () => setContextMenu(null);
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [contextMenu]);

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

  const handleContextMenu = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ sessionId, x: e.clientX, y: e.clientY });
  }, []);

  const handleDelete = useCallback(
    (sessionId: string) => {
      onDeleteSession(sessionId);
      setContextMenu(null);
    },
    [onDeleteSession]
  );

  const startEditing = useCallback((session: ISession) => {
    setEditingId(session.id);
    setEditValue(session.title || 'New chat');
    setContextMenu(null);
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

  const contextSession = contextMenu ? sessions.find((s) => s.id === contextMenu.sessionId) : null;

  return (
    <div className="sidebar-inner" style={{ width: '100%', position: 'relative' }}>

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

        <div className="sidebar-sessions-scroll">
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
                  onContextMenu={handleContextMenu}
                  onMouseEnter={handleItemMouseEnter}
                  onMouseLeave={handleItemMouseLeave}
                  onSelect={handleSessionSelect}
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

      {contextMenu &&
        contextSession &&
        createPortal(
          <div
            className="flex flex-col min-w-[160px] bg-dark-tertiary/95 backdrop-blur-xl border border-white/10 shadow-2xl rounded-xl overflow-hidden p-1 z-[9999]"
            ref={contextMenuRef}
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
            }}
          >
            <button 
              className="flex items-center gap-2 w-full text-left px-3.5 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white rounded-lg transition-colors"
              onClick={() => startEditing(contextSession)}
            >
              <PiPencilSimpleFill size={16} /> Rename Session
            </button>
            <div className="h-px bg-white/10 my-1 mx-2" />
            <button
              className="flex items-center gap-2 w-full text-left px-3.5 py-2.5 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              onClick={() => handleDelete(contextMenu.sessionId)}
            >
              <PiTrashSimpleFill size={16} /> Delete Session
            </button>
          </div>,
          document.body
        )}

      {isConfirmClearOpen &&
        createPortal(
          <div className="clear-confirm-overlay">
            <div className="clear-confirm-modal">
              <h3 className="clear-confirm-title">Delete All Sessions?</h3>
              <p className="clear-confirm-desc">This will permanently erase all active and archived sessions from this device. This operation cannot be reversed.</p>
              <div className="clear-confirm-actions">
                <button
                  className="clear-confirm-cancel"
                  onClick={() => setIsConfirmClearOpen(false)}
                >
                  Keep Sessions
                </button>
                <button
                  className="clear-confirm-danger"
                  onClick={() => {
                    setIsConfirmClearOpen(false);
                    onClearAllSessions?.();
                  }}
                >
                  Delete All Sessions
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

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
