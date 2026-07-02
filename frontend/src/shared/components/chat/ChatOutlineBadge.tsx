import React from 'react';
import { useMessageScrollerVisibility } from '@/shared/components/ui/message-scroller';
import { IMessage } from '@/features/session/types';

interface ChatOutlineBadgeProps {
  messages: IMessage[];
}

export function ChatOutlineBadge({ messages }: ChatOutlineBadgeProps) {
  const { currentAnchorId, visibleMessageIds } = useMessageScrollerVisibility();

  if (!messages || messages.length === 0) return null;

  const userMessages = messages.filter((m) => m.role === 'user');
  const totalTurns = userMessages.length;
  
  if (totalTurns === 0) return null;

  const currentTurnIndex = userMessages.findIndex((m) => m.id === currentAnchorId);
  const displayTurn = currentTurnIndex !== -1 ? currentTurnIndex + 1 : totalTurns;

  // Track visibility of overall messages
  const total = messages.length;
  const visibleIndices = messages
    .map((m, i) => (visibleMessageIds.includes(m.id || '') ? i : -1))
    .filter((idx) => idx !== -1);

  const firstVisible = visibleIndices.length > 0 ? visibleIndices[0] : 0;
  const lastVisible = visibleIndices.length > 0 ? visibleIndices[visibleIndices.length - 1] : 0;

  const topPercent = (firstVisible / total) * 100;
  const heightPercent = ((lastVisible - firstVisible + 1) / total) * 100;

  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-40 pointer-events-none">
      {/* Floating turn indicator */}
      <div className="px-2 py-1 rounded-md bg-black/60 border border-[#b4ab8b]/20 text-[10px] font-mono text-[#c9c0a0] shadow-md backdrop-blur-sm whitespace-nowrap">
        Turn {displayTurn}/{totalTurns}
      </div>

      {/* Mini vertical scroll track representation */}
      <div className="w-1.5 h-24 bg-white/5 border border-white/10 rounded-full overflow-hidden relative">
        <div
          className="absolute w-full bg-[#b4ab8b] rounded-full transition-all duration-200"
          style={{
            top: `${topPercent}%`,
            height: `${Math.max(10, heightPercent)}%`,
          }}
        />
      </div>
    </div>
  );
}
