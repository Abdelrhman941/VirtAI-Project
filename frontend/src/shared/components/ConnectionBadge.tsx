import React, { useEffect, useState } from 'react';
import { PiWifiSlashFill } from 'react-icons/pi';
import { FiRefreshCw } from 'react-icons/fi';
import { useWsStatus } from '@/core/realtime/useWsStatus';
import { ConnectionState } from '@/core/realtime/wsConstants';
import wsManager from '@/services/wsManager';

export interface ConnectionBadgeProps {
  currentSessionId: string | null;
  size?: 'sm' | 'md';
  onReconnect?: () => void;
}

export function ConnectionBadge({
  currentSessionId,
  size = 'md',
  onReconnect
}: ConnectionBadgeProps) {
  const { status, retryCount, nextRetryIn } = useWsStatus();
  
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (nextRetryIn === null) {
      setCountdown(null);
      return;
    }
    
    const targetTime = Date.now() + nextRetryIn;
    
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
      setCountdown(remaining);
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextRetryIn]);

  const stateGroup = status === ConnectionState.CONNECTED ? 'ready' 
    : (status === ConnectionState.CONNECTING || status === ConnectionState.RECONNECTING) ? 'connecting'
    : 'offline';

  let statusText = '';
  if (stateGroup === 'ready') {
    statusText = 'Assistant Connected';
  } else if (stateGroup === 'connecting') {
    if (status === ConnectionState.RECONNECTING && retryCount > 0) {
      statusText = `Reconnecting (Attempt ${retryCount})...`;
      if (countdown !== null && countdown > 0) {
        statusText = `Reconnecting in ${countdown}s...`;
      }
    } else {
      statusText = 'Establishing Connection...';
    }
  } else {
    if (status === ConnectionState.FAILED) {
      statusText = 'Connection Failed (Max Retries)';
    } else {
      statusText = 'Disconnected';
    }
  }

  const isConnecting = stateGroup === 'connecting';
  const pulseClass = (stateGroup === 'ready' || isConnecting) ? 'animate-pulse' : '';
  
  let dotColor = '';
  if (stateGroup === 'ready') dotColor = 'bg-green-500';
  else if (stateGroup === 'connecting') dotColor = 'bg-yellow-500';
  else dotColor = 'bg-red-500';

  const isSmall = size === 'sm';
  const containerClasses = isSmall 
    ? "flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-dark-tertiary/80 shadow-sm"
    : "flex items-center gap-2.5 px-4 py-2 rounded-full border border-white/10 bg-dark-tertiary/80 shadow-sm transition-colors duration-300";
    
  const dotWrapperClasses = "relative flex items-center justify-center";
  const iconSize = isSmall ? 12 : 14;
  const dotClasses = isSmall ? `w-2 h-2 rounded-full ${dotColor} ${pulseClass}` : `w-2.5 h-2.5 rounded-full ${dotColor} ${pulseClass}`;
  const pingClasses = isSmall ? `absolute w-2 h-2 rounded-full ${dotColor} animate-ping opacity-75` : `absolute w-2.5 h-2.5 rounded-full ${dotColor} animate-ping opacity-75`;
  const textClasses = isSmall 
    ? "text-xs font-semibold text-white/95 tracking-wide font-display truncate max-w-[120px]"
    : "text-sm font-semibold text-white/90 tracking-wide font-display truncate max-w-[150px] lg:max-w-[200px]";
  const buttonClasses = isSmall
    ? "flex items-center justify-center text-gray-400 hover:text-white active:text-white transition-colors ml-0.5 cursor-pointer"
    : "flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer ml-1";

  const showReconnectButton = status === ConnectionState.FAILED || status === ConnectionState.DISCONNECTED;

  return (
    <div className={containerClasses}>
      <div className={dotWrapperClasses}>
        {stateGroup === 'offline' && currentSessionId !== null ? (
          <PiWifiSlashFill size={iconSize} className="text-red-500" />
        ) : (
          <>
            <div className={dotClasses}></div>
            {(stateGroup === 'ready' || isConnecting) && (
              <div className={pingClasses}></div>
            )}
          </>
        )}
      </div>
      <span className={textClasses} title={statusText}>
        {statusText}
      </span>
      
      {showReconnectButton && onReconnect && (
        <button
          onClick={onReconnect}
          title="Reconnect"
          className={buttonClasses}
        >
          <FiRefreshCw size={iconSize} />
        </button>
      )}
    </div>
  );
}
