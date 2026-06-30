import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from './AvatarTab';
import useReducedMotionPreference from '@/features/overview/hooks/useReducedMotionPreference';

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
      className="launch-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Launching Classroom"
    >
      <div className="launch-overlay-bg" />

      
      <div className="launch-content">
        {/* Visual Portal Container */}
        <div className="portal-container">
          {/* Outer glowing ambient rings */}
          <div className="portal-glow-gold" style={{ opacity: 0.15 + (progress / 100) * 0.15 }} />
          <div className="portal-glow-crimson" style={{ opacity: 0.1 + (progress / 100) * 0.15 }} />

          {/* SVG Progress Circle */}
          <svg className="portal-progress-svg" width="200" height="200" viewBox="0 0 200 200">
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
          <div className="portal-avatar-wrapper">
            <AnimatePresence mode="wait">
              {avatar && (
                <motion.img
                  key={avatar.id}
                  src={avatar.image}
                  alt={avatar.name}
                  className="portal-avatar-img"
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
        <div className="portal-status-container">
          <div className="portal-percentage-wrapper">
            <span className="portal-percentage font-mono">{Math.round(progress)}%</span>
            <span className="portal-percentage-label">Calibrated</span>
          </div>

          <div className="portal-text-wrapper">
            <AnimatePresence mode="wait">
              <motion.p
                key={phaseIndex}
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 5 }}
                animate={{ opacity: 0.9, y: 0 }}
                exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -5 }}
                transition={{ duration: 0.25 }}
                className="portal-status-text font-mono"
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

