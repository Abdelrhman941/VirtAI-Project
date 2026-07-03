import { Button } from '@/shared/components/ui/button';
import { FiShare2 } from 'react-icons/fi';

interface DiagramButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function DiagramButton({ onClick, disabled }: DiagramButtonProps) {
  return (
    <Button
      type="button"
      variant="action"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label="Generate Diagram"
      title={disabled ? "Upload a document first to generate a diagram" : "Generate Diagram"}
    >
      <FiShare2 className="size-4" />
      <span>Diagram</span>
    </Button>
  );
}
