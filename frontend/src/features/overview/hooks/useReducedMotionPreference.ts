import { useEffect, useState } from 'react';

function getReducedMotionPreference(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useReducedMotionPreference(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(getReducedMotionPreference);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(media.matches);

    // Initial sync
    updatePreference();
    media.addEventListener('change', updatePreference);

    return () => media.removeEventListener('change', updatePreference);
  }, []);

  return prefersReducedMotion;
}

export default useReducedMotionPreference;
