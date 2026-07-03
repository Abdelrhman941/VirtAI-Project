import React from 'react';

export interface VoiceIndicatorProps {
  isListening: boolean;
  isPaused: boolean;
  className?: string;
}

export const VoiceIndicator: React.FC<VoiceIndicatorProps> = ({ isListening, isPaused, className = '' }) => {
  if (!isListening || isPaused) return null;
  
  return (
    <span className={`voice-activity-indicator ${className}`}>
      <span className="pulse-ring" />
      <span className="pulse-ring pulse-ring-delay" />
    </span>
  );
};
