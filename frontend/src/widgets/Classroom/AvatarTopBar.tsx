import React from 'react';
import { PiWifiSlashFill, PiList } from 'react-icons/pi';
import { FiMonitor, FiShare2, FiEdit3, FiUser, FiFileText } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { ConnectionState } from '@/core/realtime/useWSClient';
import { ConnectionBadge } from '@/shared/components/ConnectionBadge';
import { ToolbarButton } from '@/shared/components/ToolbarButton';

interface AvatarTopBarProps {
  avatarName: string;
  connectionState: ConnectionState | string;
  currentSessionId: string | null;
  reconnectError: string | null;
  reconnect: () => void;
  hasDocuments: boolean;
  hasMessages: boolean;
  onGenerateDiagram: () => void;
  onGenerateSummary: () => void;
  onStartExplain: () => void;
  onStartQuiz: () => void;
  onOpenSettings?: () => void;
}

export function AvatarTopBar({
  avatarName,
  connectionState,
  currentSessionId,
  reconnectError,
  reconnect,
  hasDocuments,
  hasMessages,
  onGenerateDiagram,
  onGenerateSummary,
  onStartExplain,
  onStartQuiz,
  onOpenSettings
}: AvatarTopBarProps) {

  return (
    <header className="w-full pb-2 relative z-[60]">
      {/* Desktop Header Layout */}
      <div className="hidden lg:flex items-center justify-between w-full">
        {/* Left Section (Status) */}
        <ConnectionBadge
          currentSessionId={currentSessionId}
          size="md"
          onReconnect={reconnect}
        />

        {/* Right Section (Action Buttons) */}
        <div className="flex items-center gap-3">

          {hasDocuments && !hasMessages && (
            <ToolbarButton
              onClick={onStartExplain}
              icon={<FiMonitor size={15} />}
              label="Explain Slide"
            />
          )}
          
          <ToolbarButton
            onClick={onGenerateSummary}
            disabled={!hasDocuments}
            title={!hasDocuments ? "Please upload syllabus or reference materials to generate a summary" : "Generate Summary"}
            icon={<FiFileText size={15} />}
            label="Summarize"
          />
          
          <ToolbarButton
            onClick={onGenerateDiagram}
            disabled={!hasDocuments}
            title={!hasDocuments ? "Please upload syllabus or reference materials to generate a diagram" : "Synthesize Relationship Diagram"}
            icon={<FiShare2 size={15} />}
            label="Synthesize Tree Map"
          />
          
          <ToolbarButton
            onClick={onStartQuiz}
            disabled={!hasDocuments}
            title={!hasDocuments ? "Please upload syllabus or reference materials to generate a quiz" : "Start Knowledge Check"}
            icon={<FiEdit3 size={15} />}
            label="Start Quiz"
          />
        </div>
      </div>

      {/* Mobile Header Layout (Strict Requirements for sm/md screens) */}
      <div className="flex lg:hidden items-center justify-between w-full px-2 py-1">
        {/* Far Left: Hamburger Menu Icon */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-sessions'))}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-dark-tertiary/80 border border-white/10 text-white/80 active:bg-white/10 active:text-white transition-colors duration-200 cursor-pointer"
          aria-label="Open Sessions Drawer"
        >
          <PiList size={22} />
        </button>

        {/* Center: "AI Tutor Online" status indicator */}
        <ConnectionBadge
          currentSessionId={currentSessionId}
          size="sm"
          onReconnect={reconnect}
        />

        {/* Far Right: Setup Profile Icon */}
        <button
          onClick={() => navigate('/setup')}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#1a1a1a]/80 border border-white/10 text-white/80 active:bg-white/10 active:text-white transition-colors duration-200 cursor-pointer"
          aria-label="Setup Profile"
        >
          <FiUser size={18} />
        </button>
      </div>
    </header>
  );
}
