import { useEffect, useState } from 'react';

interface NetworkInformation {
  readonly saveData: boolean;
  readonly effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
}

interface NavigatorWithExtras extends Navigator {
  deviceMemory?: number;
  connection?: NetworkInformation;
}

export function useDevicePerformance() {
  const [isLowPerformance, setIsLowPerformance] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const nav = navigator as NavigatorWithExtras;
    const connection = nav.connection;
    
    const saveDataEnabled = !!connection?.saveData;
    const slowNetwork = ['slow-2g', '2g'].includes(connection?.effectiveType || '');
    const lowMemoryDevice = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
    const lowCpuDevice =
      typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4;
    const isMobileViewport =
      typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1023px)').matches;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLowPerformance(
      saveDataEnabled || slowNetwork || lowMemoryDevice || lowCpuDevice || isMobileViewport
    );
  }, []);

  return { isLowPerformance };
}

export default useDevicePerformance;
