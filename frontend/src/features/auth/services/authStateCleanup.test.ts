// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearBrowserAuthState,
  hasBrowserAuthSessionHint,
  isInvalidRefreshResponse,
  markBrowserAuthSession,
} from './authStateCleanup';

describe('authStateCleanup', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('removes legacy token keys from local and session storage', () => {
    localStorage.setItem('refreshToken', 'legacy-refresh');
    localStorage.setItem('some_jwt_cache', 'legacy-jwt');
    localStorage.setItem('unrelated', 'keep');
    sessionStorage.setItem('access_token', 'legacy-access');
    sessionStorage.setItem('virtai-sessions', '[]');

    clearBrowserAuthState();

    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('some_jwt_cache')).toBeNull();
    expect(localStorage.getItem('unrelated')).toBe('keep');
    expect(sessionStorage.getItem('access_token')).toBeNull();
    expect(sessionStorage.getItem('virtai-sessions')).toBeNull();
  });

  it('classifies invalid refresh responses without treating 500s as auth corruption', () => {
    expect(isInvalidRefreshResponse({ response: { status: 401 } })).toBe(true);
    expect(isInvalidRefreshResponse({ response: { status: 403 } })).toBe(true);
    expect(isInvalidRefreshResponse({ response: { status: 500 } })).toBe(false);
  });

  it('tracks and clears non-secret auth session hints', () => {
    expect(hasBrowserAuthSessionHint()).toBe(false);
    markBrowserAuthSession();
    expect(hasBrowserAuthSessionHint()).toBe(true);
    clearBrowserAuthState({ includeAppState: false });
    expect(hasBrowserAuthSessionHint()).toBe(false);
  });
});
