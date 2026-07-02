import React from 'react';
import { FiMonitor } from 'react-icons/fi';
import { Button } from '@/shared/components/ui/button';

interface ExplainButtonProps {
  onClick: () => void;
  isVisible: boolean;
}

export function ExplainButton({ onClick, isVisible }: ExplainButtonProps) {
  if (!isVisible) return null;

  return (
    <Button
      type="button"
      variant="action"
      onClick={!isVisible ? undefined : onClick}
      disabled={!isVisible}
      aria-label="Start Presentation"
      title="Start slide-by-slide presentation"
    >
      <FiMonitor className="size-4" />
      <span>Explain</span>
    </Button>
  );
}
