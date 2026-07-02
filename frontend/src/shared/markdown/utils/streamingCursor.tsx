import { motion, useReducedMotion } from 'framer-motion';

/**
 * Framer-driven cursor. Avoids CSS keyframes so `prefers-reduced-motion`
 * is honoured automatically.
 */
export function StreamingCursor() {
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden
      className="inline-block w-[2px] h-[1em] translate-y-[2px] bg-primary ms-1 align-middle"
      animate={reduce ? undefined : { opacity: [1, 0.3] }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}
