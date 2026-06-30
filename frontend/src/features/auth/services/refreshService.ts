import { CSRF_HEADER_NAME, ensureCsrfToken } from '@/core/api/csrfService';
import axios from 'axios';
import {
  clearBrowserAuthState,
  isInvalidRefreshResponse,
  markBrowserAuthSession,
} from './authStateCleanup';

let refreshPromise = null;

// Removed duplicated CSRF token logic

/**
 * Single-flight refresh token queue.
 * Ensures concurrent requests or double-mounts merge into a single `/auth/refresh` API request
 * to prevent revoking the refresh token for parallel calls.
 */
export function refreshAccessTokenSingleFlight() {
  if (refreshPromise) {
    return refreshPromise;
  }

  // Use bare axios to bypass apiClient interceptors and avoid infinite 401 loops
  refreshPromise = (async () => {
    const csrfToken = await ensureCsrfToken();
    if (!csrfToken) {
      throw new Error('Unable to obtain CSRF token for refresh request.');
    }

    try {
      const response = await axios.post('/api/v1/auth/refresh', null, {
        withCredentials: true,
        headers: { [CSRF_HEADER_NAME]: csrfToken },
      });

      markBrowserAuthSession();
      return response.data;
    } catch (error) {
      if (isInvalidRefreshResponse(error)) {
        clearBrowserAuthState();
      }
      throw error;
    }
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}
