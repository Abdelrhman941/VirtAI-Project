const LEGACY_AUTH_KEYS = [
  'accessToken',
  'refreshToken',
  'token',
  'user',
  'auth',
  'auth-storage',
  'virtai-auth',
  'virtai-user',
  'virtai-token',
  'virtai-refresh-token',
];

const APP_STATE_KEYS = ['virtai-sessions', 'virtai-start-new-conversation', 'virtai-setup'];
const AUTH_SESSION_HINT_KEY = 'virtai-auth-session';

function removeKnownKeys(storage, keys) {
  if (!storage) {
    return;
  }

  for (const key of keys) {
    storage.removeItem(key);
  }
}

function removeLegacyAuthKeyPatterns(storage) {
  if (!storage) {
    return;
  }

  const keysToRemove = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) {
      continue;
    }

    const normalized = key.toLowerCase();
    if (
      normalized.includes('jwt') ||
      normalized.includes('access_token') ||
      normalized.includes('refresh_token') ||
      normalized.includes('auth-token')
    ) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    storage.removeItem(key);
  }
}

export function clearBrowserAuthState({ includeAppState = true } = {}) {
  if (typeof window === 'undefined') {
    return;
  }

  const storages = [window.localStorage, window.sessionStorage];
  for (const storage of storages) {
    removeKnownKeys(storage, LEGACY_AUTH_KEYS);
    removeKnownKeys(storage, [AUTH_SESSION_HINT_KEY]);
    removeLegacyAuthKeyPatterns(storage);
    if (includeAppState) {
      removeKnownKeys(storage, APP_STATE_KEYS);
    }
  }
}

export function markBrowserAuthSession() {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(AUTH_SESSION_HINT_KEY, '1');
}

export function hasBrowserAuthSessionHint() {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.localStorage.getItem(AUTH_SESSION_HINT_KEY) === '1';
}

export function isInvalidRefreshResponse(error: unknown): boolean {
  // Distinctly separate network errors (no response) from actual token expirations
  const err = error as { response?: { status?: number } };
  if (!err || !err.response) {
    return false; // Network error or timeout, don't force logout
  }
  const status = err.response.status;
  return status === 400 || status === 401 || status === 403;
}
