import { useEffect } from 'react';

/**
 * Hook to manage the Visual Viewport API.
 * Ensures that `--vv-height` is accurately set on the document root
 * to prevent the virtual keyboard from obscuring UI on mobile devices.
 */
export default function useVisualViewport() {
  useEffect(() => {
    let ticking = false;
    const updateViewportHeight = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const vv = window.visualViewport;
          const height = vv ? vv.height : window.innerHeight;
          document.documentElement.style.setProperty('--vv-height', `${height}px`);
          ticking = false;
        });
        ticking = true;
      }
    };

    updateViewportHeight();

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewportHeight);
      window.visualViewport.addEventListener('scroll', updateViewportHeight);
    } else {
      window.addEventListener('resize', updateViewportHeight);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateViewportHeight);
        window.visualViewport.removeEventListener('scroll', updateViewportHeight);
      } else {
        window.removeEventListener('resize', updateViewportHeight);
      }
    };
  }, []);
}
