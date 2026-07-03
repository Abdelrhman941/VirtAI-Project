import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface MessageScrollerItemProps {
  children: ReactNode;
}

/*
  * Wraps each message in a subtle fade-in/slide-up entrance animation.
  * Kept separate from MessageScrollerProvider so it can be used independently
  * in any list context.
*/
export function MessageScrollerItem({ children }: MessageScrollerItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
