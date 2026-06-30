import { useState } from 'react';
import { useMotionValueEvent, useMotionValue } from 'framer-motion';
import steps from '@/features/overview/data/howItWorks';
import SectionHeader from '@/shared/components/SectionHeader';
import LeftPanel from './LeftPanel';
import RightPipeline from './RightPipeline';
import { useScrollPipeline } from './useScrollPipeline';
import useReducedMotionPreference from '@/features/overview/hooks/useReducedMotionPreference';

export default function HowItWorksSection() {
  const reduced = useReducedMotionPreference();
  const { containerRef, activeStep, scrollYProgress } = useScrollPipeline(steps.length);
  const [activeIndex, setActiveIndex] = useState(0);

  // Sync motion value to React state
  useMotionValueEvent(activeStep, 'change', (latest) => {
    setActiveIndex(latest);
  });

  const staticScrollYProgress = useMotionValue(1);

  if (reduced) {
    return (
      <section id="how-it-works" className="relative mx-auto max-w-6xl px-6 py-28">
        <SectionHeader
          className="mb-14 text-center"
          titlePrefix="How It"
          titleHighlight="Works"
          description="Your voice travels through a six-stage AI pipeline, from speech recognition to a lip-synced 3D avatar delivering the answer."
          descriptionClassName="mx-auto mt-4 max-w-[40ch] text-offwhite/70"
        />
        <div className="flex flex-col lg:flex-row gap-12 items-center">
          <LeftPanel activeIndex={steps.length - 1} />
          <RightPipeline activeIndex={steps.length - 1} scrollYProgress={staticScrollYProgress} />
        </div>
      </section>
    );
  }

  return (
    <section
      id="how-it-works"
      ref={containerRef}
      style={{ height: '400vh' }}
      className="relative w-full bg-dark"
    >
      <div className="sticky top-0 h-screen w-full flex flex-col justify-center overflow-hidden">
        {/* Header */}
        <div className="pt-20 pb-4 shrink-0">
          <SectionHeader
            className="text-center"
            titlePrefix="How It"
            titleHighlight="Works"
            description="Your voice travels through a six-stage AI pipeline, from speech recognition to a lip-synced 3D avatar."
            descriptionClassName="mx-auto mt-4 max-w-[40ch] text-offwhite/70"
          />
        </div>

        {/* Content */}
        <div className="relative mx-auto max-w-6xl w-full px-6 grid lg:grid-cols-2 gap-16 items-center flex-1 pb-12">
          {/* Ambient Glow */}
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_50%,rgba(109,0,26,0.06)_0%,transparent_70%)]"
            aria-hidden="true"
          />
          <LeftPanel activeIndex={activeIndex} />
          <RightPipeline activeIndex={activeIndex} scrollYProgress={scrollYProgress} />
        </div>
      </div>
    </section>
  );
}
