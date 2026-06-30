import { useLayoutEffect, useState, useRef } from 'react';

export function useActiveSection(sectionIds: string[], isScrollingRef: React.RefObject<boolean>) {
  const [activeId, setActiveId] = useState<string>('');
  
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    const visibleSections = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        // Skip observer state updates while a manual scrollTo is in progress
        if (isScrollingRef?.current) {
          return;
        }

        let hasChanges = false;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleSections.add(entry.target.id);
            hasChanges = true;
          } else {
            visibleSections.delete(entry.target.id);
            hasChanges = true;
          }
        }

        if (hasChanges) {
          if (visibleSections.size === 0) {
            setActiveId('');
          } else {
            const visibleArray = Array.from(visibleSections);
            const active = sectionIds.find((id) => visibleArray.includes(id));
            if (active) {
              setActiveId(active);
            }
          }
        }
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        observer.observe(el);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [sectionIds, isScrollingRef]);

  return { activeId, setActiveId };
}

export default useActiveSection;
