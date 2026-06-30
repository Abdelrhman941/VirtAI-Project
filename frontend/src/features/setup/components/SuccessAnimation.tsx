import { motion } from 'framer-motion';

import { rand } from '@/shared/utils/math';

const PARTICLES = Array.from({ length: 10 }, (_, i) => {
  const angle = (i / 10) * Math.PI * 2;
  const dist = rand(45, 70);
  return {
    tx: `${Math.cos(angle) * dist}px`,
    ty: `${Math.sin(angle) * dist}px`,
    size: rand(4, 8),
    delay: rand(0.5, 0.7),
  };
});

export default function SuccessAnimation() {
  return (
    <motion.div
      className="success-animation"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {/* Expanding ring */}
      <div className="success-ring" />

      {/* SVG circle + checkmark */}
      <svg className="success-check" viewBox="0 0 100 100">
        <circle className="success-check-circle" cx="50" cy="50" r="42" />
        <path className="success-check-path" d="M30 52 L44 66 L70 38" />
      </svg>

      {/* Particle burst */}
      {PARTICLES.map((p, i) => (
        <div
          key={i}
          className="success-particle"
          style={{
            '--tx': p.tx,
            '--ty': p.ty,
            width: p.size,
            height: p.size,
            animationDelay: `${p.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </motion.div>
  );
}
