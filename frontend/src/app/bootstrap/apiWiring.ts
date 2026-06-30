import { injectApiAuthHandlers } from '@/core/api/apiClient';
import {
  clearBrowserAuthState,
  hasBrowserAuthSessionHint,
  markBrowserAuthSession,
} from '@/features/auth/services/authStateCleanup';
import { refreshAccessTokenSingleFlight } from '@/features/auth/services/refreshService';
import { useAuthStore } from '@/features/auth/store/authStore';

/**
 * Connects the core API client with the Auth feature module.
 * This Inversion of Control pattern keeps `core/api` ignorant of `features/auth`.
 */
export function setupApiAuthWiring(): void {
  injectApiAuthHandlers({
    getToken: () => useAuthStore.getState().accessToken,
    getHasSessionHint: () => hasBrowserAuthSessionHint(),
    refreshToken: () => refreshAccessTokenSingleFlight(),
    markSession: () => markBrowserAuthSession(),
    clearSession: () => clearBrowserAuthState(),
    logout: () => useAuthStore.getState().logout(),
    setToken: (token: string | null) => useAuthStore.setState({ accessToken: token }),
  });
}
