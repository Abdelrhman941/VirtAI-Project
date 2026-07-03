import { cn } from '@/shared/utils/cn';
import { motion, useReducedMotion } from 'framer-motion';

export interface VoiceIndicatorProps {
  isListening: boolean;
  isPaused: boolean;
  className?: string;
}

export function VoiceIndicator({ isListening, isPaused, className }: VoiceIndicatorProps) {
  const reduce = useReducedMotion();
  if (!isListening || isPaused) return null;

  if (reduce) {
    return (
      <span
        aria-hidden
        className={cn('inline-block size-2 rounded-full bg-crimson-glow', className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn('relative inline-flex items-center justify-center', className)}
    >
      {[0, 0.6].map((delay) => (
        <motion.span
          key={delay}
          className="absolute inline-block size-3 rounded-full border-2 border-crimson-glow"
          animate={{ scale: [1, 1.9], opacity: [0.65, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut', delay }}
        />
      ))}
      <span className="relative inline-block size-2 rounded-full bg-crimson-glow" />
    </span>
  );
}
