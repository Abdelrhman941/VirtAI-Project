import { motion } from 'framer-motion';

export default function DemoPreview() {
  return (
    <section id="demo" className="relative mx-auto max-w-6xl px-4 sm:px-6 py-24 md:py-32 overflow-hidden">
      {/* Background ambient glow behind the mockup */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 h-[500px] w-[500px] rounded-full bg-crimson/[0.04] blur-[150px] pointer-events-none" />

      <motion.h2
        className="mb-14 text-center display-h2 text-offwhite"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.6 }}
      >
        See It in <span className="text-gold">Action</span>
      </motion.h2>

      <div className="relative mx-auto w-full max-w-5xl">
        <motion.div
          className="relative w-full overflow-hidden rounded-xl sm:rounded-2xl border border-white/10 bg-dark shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7 }}
        >
          {/* macOS-style Window Header Bar */}
          <div className="relative flex h-10 items-center justify-center px-4">
            {/* Window controls (Coloured dots) */}
            <div className="absolute left-4 flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-[#FF5F56] block shrink-0" />
              <span className="h-3 w-3 rounded-full bg-[#FFBD2E] block shrink-0" />
              <span className="h-3 w-3 rounded-full bg-[#27C93F] block shrink-0" />
            </div>
            
            {/* Centered URL Bar */}
            <div className="truncate text-center text-[11px] sm:text-xs font-medium text-offwhite/40 tracking-wide font-display max-w-[50%] sm:max-w-xs">
              virtai.app/classroom
            </div>
          </div>
          <div className="h-px bg-white/5 w-full" />

          {/* Screenshot Display */}
          <div className="relative w-full overflow-hidden bg-[#0A0908]">
            <img
              src="/assets/images/demo.webp"
              alt="VirtAI platform classroom layout demonstration"
              className="w-full h-auto object-contain block"
              loading="lazy"
              width={1920}
              height={1080}
            />
          </div>
        </motion.div>
      </div>

      <p className="mx-auto mt-8 max-w-md text-center text-sm leading-relaxed text-offwhite/60 font-medium px-4">
        A single classroom surface where voice input, retrieval, and avatar delivery stay in perfect synchronization.
      </p>
    </section>
  );
}
