import { motion, AnimatePresence } from 'framer-motion';
import steps from '@/features/overview/data/howItWorks';
import useReducedMotionPreference from '@/features/overview/hooks/useReducedMotionPreference';

interface LeftPanelProps {
  activeIndex: number;
}

export default function LeftPanel({ activeIndex }: LeftPanelProps) {
  const reduced = useReducedMotionPreference();
  const currentStep = steps[activeIndex] || steps[0];

  return (
    <div className="relative z-10 flex flex-col justify-center py-10 lg:w-full lg:shrink-0 lg:pr-12">
      {/* Label above */}
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3 py-1 text-xs font-bold uppercase tracking-widest text-gold">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/50 opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-gold"></span>
        </span>
        Pipeline State
      </div>

      <div className="relative min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={reduced ? false : { opacity: 0, y: 15, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={reduced ? undefined : { opacity: 0, y: -15, filter: 'blur(4px)' }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="absolute inset-0 flex flex-col"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-crimson text-white font-bold">
                {currentStep.step}
              </div>
              <h3 className="display-h3 text-offwhite m-0">{currentStep.label}</h3>
            </div>
            
            <p className="text-lg text-offwhite/80 leading-relaxed max-w-[45ch] font-medium">
              {currentStep.description}
            </p>

            <div className="mt-10 flex flex-col gap-4 p-6 rounded-2xl bg-dark-secondary">
              <div className="grid grid-cols-[80px_1fr] items-center gap-4 text-sm font-mono">
                <span className="text-offwhite/40 font-semibold tracking-wider">IN</span>
                <span className="text-gold/90">{currentStep.input}</span>
              </div>
              
              <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent w-full" />
              
              <div className="grid grid-cols-[80px_1fr] items-center gap-4 text-sm font-mono">
                <span className="text-offwhite/40 font-semibold tracking-wider">PROC</span>
                <span className="text-offwhite/90">{currentStep.processing}</span>
              </div>
              
              <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent w-full" />
              
              <div className="grid grid-cols-[80px_1fr] items-center gap-4 text-sm font-mono">
                <span className="text-offwhite/40 font-semibold tracking-wider">OUT</span>
                <span className="text-white font-bold bg-crimson px-3 py-1.5 rounded-md inline-block w-fit">{currentStep.output}</span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
