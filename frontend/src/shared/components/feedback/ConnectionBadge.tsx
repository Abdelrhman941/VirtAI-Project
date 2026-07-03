import { useWsStatus } from '@/core/realtime/useWsStatus';
import { ConnectionState } from '@/core/realtime/wsConstants';
import { cn } from '@/shared/utils/cn';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiLoader, FiRefreshCw } from 'react-icons/fi';

/**
 * ConnectionBadge — dark-premium status pill.
 *
 * Replaces the previous WarningAlert-based banner (which rendered an amber
 * warning banner even for benign reconnect states) with a semantic pill:
 *   • ready       → subtle emerald
 *   • connecting  → gold, spinner
 *   • offline     → crimson, reconnect button
 */

export interface ConnectionBadgeProps {
  currentSessionId: string | null;
  size?: 'sm' | 'md';
  onReconnect?: () => void;
  /** Hide the pill entirely once fully connected, so it's not always on-screen. */
  hideWhenReady?: boolean;
}

type Group = 'ready' | 'connecting' | 'offline';

function useStatusView(
  status: ConnectionState,
  retryCount: number,
  countdown: number | null,
) {
  const group: Group =
    status === ConnectionState.CONNECTED ? 'ready'
      : (status === ConnectionState.CONNECTING || status === ConnectionState.RECONNECTING) ? 'connecting'
        : 'offline';

  let text = '';
  if (group === 'ready') {
    text = 'Connected';
  } else if (group === 'connecting') {
    if (status === ConnectionState.RECONNECTING && retryCount > 0) {
      text = countdown != null && countdown > 0
        ? `Reconnecting in ${countdown}s`
        : `Reconnecting (${retryCount})`;
    } else {
      text = 'Connecting';
    }
  } else {
    text = status === ConnectionState.FAILED
      ? 'Connection failed'
      : 'Disconnected';
  }

  return { group, text };
}

export function ConnectionBadge({
  currentSessionId: _currentSessionId,
  size = 'md',
  onReconnect,
  hideWhenReady = false,
}: ConnectionBadgeProps) {
  const { status, retryCount, nextRetryIn } = useWsStatus();
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (nextRetryIn == null) {
      setCountdown(null);
      return;
    }
    const target = Date.now() + nextRetryIn;
    const tick = () =>
      setCountdown(Math.max(0, Math.ceil((target - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextRetryIn]);

  const { group, text } = useStatusView(status, retryCount, countdown);
  const isSmall = size === 'sm';

  if (hideWhenReady && group === 'ready') return null;

  const showReconnect =
    (status === ConnectionState.FAILED ||
      status === ConnectionState.DISCONNECTED) &&
    !!onReconnect;

  const surface = cn(
    'inline-flex items-center gap-2 rounded-full backdrop-blur-md border transition-colors select-none',
    isSmall ? 'h-7 px-2.5 text-[11px]' : 'h-9 px-3.5 text-xs',

    group === 'ready' && [
      'bg-emerald-500/8 border-emerald-400/25 text-emerald-300',
    ],
    group === 'connecting' && [
      'bg-[color:var(--color-gold)]/8',
      'border-[color:var(--color-gold)]/30',
      'text-[color:var(--color-gold-glow)]',
    ],
    group === 'offline' && [
      'bg-[color:var(--color-crimson)]/12',
      'border-[color:var(--color-crimson)]/35',
      'text-[color:var(--color-crimson-soft)]',
    ],
  );

  const Icon =
    group === 'ready' ? FiCheckCircle
      : group === 'connecting' ? FiLoader
        : FiAlertTriangle;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={group}
        initial={{ opacity: 0, y: -4, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.98 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className={surface}
        role="status"
        aria-live="polite"
      >
        <Icon
          size={isSmall ? 12 : 14}
          className={cn(group === 'connecting' && 'animate-spin')}
          aria-hidden
        />
        <span
          className="font-semibold tracking-wide truncate max-w-[200px]"
          title={text}
        >
          {text}
        </span>

        {showReconnect && (
          <button
            onClick={onReconnect}
            title="Reconnect now"
            aria-label="Reconnect"
            className={cn(
              'ml-1 grid place-items-center rounded-full transition-colors',
              'text-current/70 hover:text-current hover:bg-white/8',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-current/40',
              isSmall ? 'size-5' : 'size-6',
            )}
          >
            <FiRefreshCw size={isSmall ? 11 : 12} />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
