import { motion, MotionValue } from 'framer-motion';
import {
  PiBrainFill,
  PiMagnifyingGlassFill,
  PiMicrophoneFill,
  PiSpeakerHighFill,
  PiUserCircleFill,
  PiWaveformFill,
} from 'react-icons/pi';
import steps from '@/features/overview/data/howItWorks';
import useReducedMotionPreference from '@/features/overview/hooks/useReducedMotionPreference';

const STEP_ICONS = [
  PiMicrophoneFill,
  PiWaveformFill,
  PiMagnifyingGlassFill,
  PiBrainFill,
  PiSpeakerHighFill,
  PiUserCircleFill,
];

const NODE_POSITIONS = [
  { x: 25, y: 10 },
  { x: 75, y: 10 },
  { x: 75, y: 50 },
  { x: 25, y: 50 },
  { x: 25, y: 90 },
  { x: 75, y: 90 },
];

interface NodeComponentProps {
  index: number;
  isActive: boolean;
  isDone: boolean;
  label: string;
}

function NodeComponent({ index, isActive, isDone, label }: NodeComponentProps) {
  const Icon = STEP_ICONS[index];

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Node Circle */}
      <motion.div
        animate={{
          scale: isActive ? 1.2 : 1,
          borderColor: isActive ? 'rgba(255, 23, 68, 0.8)' : isDone ? 'rgba(180, 171, 139, 0.5)' : 'rgba(255, 255, 255, 0.1)',
        }}
        transition={{ duration: 0.3 }}
        className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border-2 shadow-[0_0_15px_rgba(0,0,0,0.5)] bg-[#0A0908]"
      >
        {/* Animated overlay to tint the background opaquely instead of transparency */}
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{
            backgroundColor: isActive ? 'rgba(109, 0, 26, 0.9)' : isDone ? 'rgba(180, 171, 139, 0.15)' : 'rgba(0, 0, 0, 0)',
          }}
          transition={{ duration: 0.3 }}
        />
        {isActive && (
          <motion.div
            layoutId="activeNodeGlow"
            className="absolute inset-0 -z-10 rounded-full bg-crimson-glow/30 blur-md"
            transition={{ duration: 0.3 }}
          />
        )}
        <Icon
          className={`relative z-10 h-6 w-6 transition-colors duration-300 ${
            isActive ? 'text-white' : isDone ? 'text-gold' : 'text-offwhite/30'
          }`}
        />
      </motion.div>

      {/* Label */}
      <div className="absolute top-16 w-32 text-center">
        <span
          className={`text-sm font-bold tracking-wide transition-colors duration-300 ${
            isActive ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : isDone ? 'text-gold/80' : 'text-offwhite/30'
          }`}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

interface RightPipelineProps {
  activeIndex: number;
  scrollYProgress: MotionValue<number>;
}

export default function RightPipeline({ activeIndex, scrollYProgress }: RightPipelineProps) {
  const reduced = useReducedMotionPreference();

  return (
    <div className="relative w-full aspect-square max-h-[80vh] mx-auto flex items-center justify-center">
      {/* Circuit SVG Background */}
      <svg
        viewBox="0 0 1000 1000"
        className="absolute inset-0 w-full h-full drop-shadow-2xl overflow-visible"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {/* Base inactive track */}
        <path
          d="M 250 100 L 750 100 A 200 200 0 0 1 750 500 L 250 500 A 200 200 0 0 0 250 900 L 750 900"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Glowing active track synced with scroll */}
        <motion.path
          d="M 250 100 L 750 100 A 200 200 0 0 1 750 500 L 250 500 A 200 200 0 0 0 250 900 L 750 900"
          stroke="url(#circuit-glow)"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            pathLength: reduced ? (activeIndex + 1) / steps.length : scrollYProgress,
            filter: 'drop-shadow(0px 0px 8px rgba(255, 23, 68, 0.6))',
          }}
        />

        <defs>
          <linearGradient id="circuit-glow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9B0827" />
            <stop offset="50%" stopColor="#FF1744" />
            <stop offset="100%" stopColor="#B4AB8B" />
          </linearGradient>
        </defs>
      </svg>

      {/* HTML Nodes overlay */}
      {NODE_POSITIONS.map((pos, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: `${pos.x}%`,
            top: `${pos.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <NodeComponent
            index={i}
            isActive={activeIndex === i}
            isDone={i < activeIndex}
            label={steps[i].label}
          />
        </div>
      ))}
    </div>
  );
}
