import { useEffect, useState } from 'react';

interface SplashSessionOptions {
  isNavbarReady: boolean;
  prefersReducedMotion: boolean;
}

export function useSplashSession({ isNavbarReady, prefersReducedMotion }: SplashSessionOptions) {
  const [showSplash, setShowSplash] = useState(() => {
    if (prefersReducedMotion) return false;
    try {
      return sessionStorage.getItem('virtai:overview-splash-seen') !== '1';
    } catch {
      return true;
    }
  });

  const handleSplashComplete = () => {
    try {
      sessionStorage.setItem('virtai:overview-splash-seen', '1');
    } catch {
      // ignore
    } finally {
       
      setShowSplash(false);
    }
  };

  return { showSplash, handleSplashComplete };
}

export default useSplashSession;
