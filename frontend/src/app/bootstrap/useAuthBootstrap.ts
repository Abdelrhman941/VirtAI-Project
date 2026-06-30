import { hasBrowserAuthSessionHint } from '@/features/auth/services/authStateCleanup';
import { useAuthStore } from '@/features/auth/store/authStore';
import { isProtectedPath, shouldAttemptRefresh, shouldSkipAuthRefresh } from '@/features/auth/utils/authDecisions';
import { useEffect, useRef } from 'react';

export default function useAuthBootstrap() {
  const bootstrapStartedRef = useRef(false);
  useEffect(() => {
    if (bootstrapStartedRef.current) {
      return;
    }
    bootstrapStartedRef.current = true;
    const pathname = window.location.pathname;
    if (shouldSkipAuthRefresh(pathname)) {
      useAuthStore.setState({ isInitialized: true, isInitializing: false, isLoading: false });
      return;
    }
    const protectedPath = isProtectedPath(pathname);
    const attemptRefresh = shouldAttemptRefresh(pathname, hasBrowserAuthSessionHint());
    if (!attemptRefresh) {
      useAuthStore.setState({ isInitialized: true, isInitializing: false, isLoading: false });
      return;
    }
    void useAuthStore.getState().initAuth({ forceRefresh: protectedPath });
  }, []);
}
