import React from 'react';
import { FiMonitor } from 'react-icons/fi';
import './ExplainButton.css';

interface ExplainButtonProps {
  onClick: () => void;
  isVisible: boolean;
}

export function ExplainButton({ onClick, isVisible }: ExplainButtonProps) {
  if (!isVisible) return null;

  return (
    <button
      type="button"
      className="classroom-action-btn"
      data-variant="explain"
      onClick={!isVisible ? undefined : onClick}
      disabled={!isVisible}
      aria-label="Start Presentation"
      title="Start slide-by-slide presentation"
    >
      <FiMonitor />
      <span>Explain</span>
    </button>
  );
}
