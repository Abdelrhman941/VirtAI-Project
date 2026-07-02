import React from 'react';
import { Loader2 } from 'lucide-react';

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: number;
}

export const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ className = '', size = 16, ...props }, ref) => {
    return (
      <span ref={ref} className={`inline-block animate-spin ${className}`} {...props}>
        <Loader2 size={size} />
      </span>
    );
  }
);
Spinner.displayName = 'Spinner';
