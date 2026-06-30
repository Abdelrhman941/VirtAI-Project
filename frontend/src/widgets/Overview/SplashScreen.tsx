import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const MIN_VISIBLE_MS = 2800;

export default function SplashScreen({ onComplete }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), MIN_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence onExitComplete={() => onComplete?.()}>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-dark"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.65, ease: 'easeInOut' }}
        >
          {/* glow ring */}
          <motion.div
            className="absolute rounded-full"
            style={{ width: 260, height: 260 }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0, 0.5, 0], scale: [0.6, 1.3, 1.5] }}
            transition={{ duration: 2, ease: 'easeOut' }}
          >
            <div className="h-full w-full rounded-full bg-crimson/30 blur-3xl" />
          </motion.div>

          {/* logo */}
          <motion.img
            src="/assets/icons/logo.svg"
            alt="VirtAI logo"
            className="relative h-160 w-160 drop-shadow-[0_0_60px_rgba(109,0,26,0.6)]"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          />

          {/* title */}
          <motion.h1
            className="absolute mt-[280px] text-center px-6 text-2xl font-bold tracking-wide text-offwhite/90 font-display"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7 }}
          >
            Welcome to the <span className="text-gold">Future</span> of Teaching
          </motion.h1>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
