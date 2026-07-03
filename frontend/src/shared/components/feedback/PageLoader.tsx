import { motion, useReducedMotion } from 'framer-motion';

interface PageLoaderProps {
  label?: string | null;
}

export default function PageLoader({ label = 'Preparing VirtAI services…' }: PageLoaderProps) {
  const safeLabel = label ?? 'Preparing VirtAI services…';
  const reduce = useReducedMotion();

  return (
    <div
      role="status"
      aria-label={safeLabel}
      className="flex flex-col items-center gap-4"
    >
      <div aria-hidden className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-2 rounded-full bg-primary"
            animate={reduce ? undefined : { y: [0, -6, 0] }}
            transition={{
              duration: 0.9,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.15,
            }}
          />
        ))}
      </div>
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  );
}
