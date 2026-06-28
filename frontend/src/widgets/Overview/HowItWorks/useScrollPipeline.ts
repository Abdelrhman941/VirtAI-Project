import { useScroll, useTransform } from 'framer-motion';
import { useRef, useEffect, useState } from 'react';

export function useScrollPipeline(stepCount: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollContainerRef] = useState<{ current: HTMLElement | null }>(() => {
    return { current: typeof document !== 'undefined' ? document.getElementById('main-scroll-container') : null };
  });

  const { scrollYProgress } = useScroll({
    target: containerRef,
    container: scrollContainerRef as React.RefObject<HTMLElement>,
    offset: ['start start', 'end end'],
  });

  // Path length nodes: 0%, 20.8%, 39.5%, 60.4%, 79.1%, 100%
  // Midpoints for switching active index:
  // 1-2: 9.1%
  // 2-3: 29.5%
  // 3-4: 50.0%
  // 4-5: 70.5%
  // 5-6: 91.0%
  const activeStep = useTransform(scrollYProgress, (p) => {
    if (p < 0.091) return 0;
    if (p < 0.295) return 1;
    if (p < 0.500) return 2;
    if (p < 0.705) return 3;
    if (p < 0.910) return 4;
    return 5;
  });

  return { containerRef, scrollYProgress, activeStep };
}
