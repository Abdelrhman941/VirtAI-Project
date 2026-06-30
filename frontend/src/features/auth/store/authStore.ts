import { create } from 'zustand';
import { getMe } from '../services/authApi';
import {
  clearBrowserAuthState,
  hasBrowserAuthSessionHint,
  markBrowserAuthSession,
} from '../services/authStateCleanup';
import { refreshAccessTokenSingleFlight } from '../services/refreshService';

export interface User {
  id: string;
  email: string;
  setupComplete?: boolean;
  [key: string]: unknown;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isInitializing: boolean;
  isInitialized: boolean;

  setAuth: (user: User | null, accessToken: string | null) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
  setLoading: (isLoading: boolean) => void;
  initAuth: (options?: { forceRefresh?: boolean }) => Promise<void>;
}

let initAuthPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,

  // True while an auth operation (login, refresh, getMe) is in-flight.
  isLoading: false,

  // True while the app is attempting the first silent auth bootstrap.
  isInitializing: true,

  // False until the very first initAuth() attempt completes (success OR failure).
  // No routing decisions should be made while this is false.
  isInitialized: false,

  setAuth: (user, accessToken) => {
    markBrowserAuthSession();
    set({ user, accessToken, isLoading: false, isInitializing: false, isInitialized: true });
  },

  setUser: (user) => set((state) => ({ ...state, user, isLoading: false })),

  logout: () => {
    clearBrowserAuthState();
    set({
      user: null,
      accessToken: null,
      isLoading: false,
      isInitializing: false,
      isInitialized: true,
    });
  },

  setLoading: (isLoading) => set({ isLoading }),

  /**
   * Silent refresh + getMe.
   * Deduplicates concurrent calls via initAuthPromise.
   * Always sets isInitialized = true when done, regardless of outcome.
   */
  initAuth: async ({ forceRefresh = false } = {}) => {
    if (initAuthPromise) {
      return initAuthPromise;
    }

    initAuthPromise = (async () => {
      set({ isLoading: true, isInitializing: true });
      try {
        if (!forceRefresh && !hasBrowserAuthSessionHint()) {
          set({
            user: null,
            accessToken: null,
            isLoading: false,
            isInitializing: false,
            isInitialized: true,
          });
          return;
        }
        const { access_token } = await refreshAccessTokenSingleFlight();
        markBrowserAuthSession();
        // Store token immediately so the getMe() call (via apiClient) picks it up
        set((state) => ({ ...state, accessToken: access_token }));
        const user = await getMe();
        set({
          user,
          accessToken: access_token,
          isLoading: false,
          isInitializing: false,
          isInitialized: true,
        });
      } catch {
        clearBrowserAuthState();
        set({
          user: null,
          accessToken: null,
          isLoading: false,
          isInitializing: false,
          isInitialized: true,
        });
      }
    })().finally(() => {
      initAuthPromise = null;
    });

    return initAuthPromise;
  },
}));

export const selectIsAuthenticated = (state: AuthState): boolean => !!state.user && !!state.accessToken;
