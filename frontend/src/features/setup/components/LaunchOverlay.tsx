import useReducedMotionPreference from '@/features/overview/hooks/useReducedMotionPreference';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Avatar } from './AvatarTab';

interface LaunchOverlayProps {
  avatar: Avatar | null;
  onComplete: () => void;
}

const PHASES = [
  { text: 'Establishing secure communication tunnel...', duration: 1000 },
  { text: 'Synchronizing neural audio synthesis weights...', duration: 1100 },
  { text: 'Instantiating curriculum alignment vectors...', duration: 1000 },
  { text: 'Calibrating WebGL graphics pipeline...', duration: 900 },
  { text: 'VirtAI TA online. Launching classroom...', duration: 500 }
];

export default function LaunchOverlay({ avatar, onComplete }: LaunchOverlayProps) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const shouldReduceMotion = useReducedMotionPreference();

  useEffect(() => {
    let currentPhase = 0;
    let elapsed = 0;
    const totalDuration = PHASES.reduce((acc, p) => acc + p.duration, 0);

    const interval = setInterval(() => {
      elapsed += 50;
      const rawProgress = Math.min((elapsed / totalDuration) * 100, 100);
      setProgress(rawProgress);

      // Determine current phase based on elapsed time
      let sum = 0;
      for (let i = 0; i < PHASES.length; i++) {
        sum += PHASES[i].duration;
        if (elapsed <= sum) {
          if (currentPhase !== i) {
            currentPhase = i;
            setPhaseIndex(i);
          }
          break;
        }
      }

      if (elapsed >= totalDuration) {
        clearInterval(interval);
        setIsDone(true);
        // Delay callback slightly to allow the 100% and zoom transition to be visible
        setTimeout(() => {
          onComplete();
        }, 600);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [onComplete]);

  // SVG Circle parameters for progress ring
  const radius = 90;
  const strokeWidth = 4;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 1.05 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0A0908] overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Launching Classroom"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#1a1518_0%,#0A0908_100%)] opacity-95 z-[1]" />


      <div className="relative z-[2] flex flex-col items-center gap-10 w-full max-w-[480px] p-6 box-border">
        {/* Visual Portal Container */}
        <div className="relative w-[240px] h-[240px] flex items-center justify-center">
          {/* Outer glowing ambient rings */}
          <div className="portal-glow-gold absolute -inset-2.5 rounded-full bg-[radial-gradient(circle,#b4ab8b_0%,transparent_65%)] blur-[15px] z-0 pointer-events-none [mix-blend-mode:screen] transition-opacity duration-100" style={{ opacity: 0.15 + (progress / 100) * 0.15 }} />
          <div className="portal-glow-crimson absolute -inset-5 rounded-full bg-[radial-gradient(circle,#9b0827_0%,transparent_70%)] blur-[25px] z-0 pointer-events-none [mix-blend-mode:screen] transition-opacity duration-100" style={{ opacity: 0.1 + (progress / 100) * 0.15 }} />

          {/* SVG Progress Circle */}
          <svg className="absolute inset-5 z-[2]" width="200" height="200" viewBox="0 0 200 200">
            <defs>
              <linearGradient id="portal-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--color-crimson-soft, #9b0827)" />
                <stop offset="50%" stopColor="var(--color-gold, #b4ab8b)" />
                <stop offset="100%" stopColor="var(--color-gold-soft, #c9c0a0)" />
              </linearGradient>
            </defs>
            {/* Background ring */}
            <circle
              className="portal-ring-bg"
              cx="100"
              cy="100"
              r={radius}
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Active progress ring */}
            <motion.circle
              className="portal-ring-active"
              cx="100"
              cy="100"
              r={radius}
              stroke="url(#portal-gradient)"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              animate={{ strokeDashoffset }}
              transition={{ ease: 'easeOut', duration: 0.1 }}
              strokeLinecap="round"
              fill="transparent"
              transform="rotate(-90 100 100)"
            />
          </svg>

          {/* Avatar Face Container (placed inside the ring) */}
          <div className="absolute inset-8 rounded-full overflow-hidden flex items-center justify-center z-[1] bg-white/[0.02] border border-white/[0.05]">
            <AnimatePresence mode="wait">
              {avatar && (
                <motion.img
                  key={avatar.id}
                  src={avatar.image}
                  alt={avatar.name}
                  className="w-full h-full object-cover rounded-full transition-[filter] duration-200"
                  style={{
                    filter: `grayscale(${Math.max(0, 1 - progress / 80)}) contrast(${1 + (progress / 100) * 0.15})`,
                  }}
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{
                    scale: isDone && !shouldReduceMotion ? 1.15 : 1,
                    opacity: 0.3 + (progress / 100) * 0.7
                  }}
                  transition={{
                    scale: isDone ? { duration: 0.5, ease: 'easeOut' } : { duration: 0.3 },
                    opacity: { duration: 0.5 }
                  }}
                />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Status Copy and Percentage */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[2.2rem] font-bold tracking-[-0.02em] text-[#c9c0a0] [text-shadow:0_0_16px_rgba(201,192,160,0.35)] leading-[1.1] font-mono">{Math.round(progress)}%</span>
            <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">Calibrated</span>
          </div>

          <div className="min-h-6 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={phaseIndex}
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 5 }}
                animate={{ opacity: 0.9, y: 0 }}
                exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -5 }}
                transition={{ duration: 0.25 }}
                className="text-[13px] text-[#b0b0b0] opacity-90 tracking-[0.02em] m-0 [text-shadow:0_0_8px_rgba(255,255,255,0.1)] font-mono"
              >
                {PHASES[phaseIndex]?.text}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
