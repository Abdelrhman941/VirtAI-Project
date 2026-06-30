import { logger } from '@/shared/utils/logger';
import axios from 'axios';

export const CSRF_COOKIE_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'X-CSRF-Token';

let csrfTokenRequest: Promise<string | null> | null = null;

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookiePrefix = `${name}=`;
  const cookies = document.cookie ? document.cookie.split('; ') : [];

  for (const cookie of cookies) {
    if (cookie.startsWith(cookiePrefix)) {
      return decodeURIComponent(cookie.slice(cookiePrefix.length));
    }
  }

  return null;
}

export async function ensureCsrfToken(): Promise<string | null> {
  if (typeof document === 'undefined') {
    return null;
  }

  const existingToken = readCookie(CSRF_COOKIE_NAME);
  if (existingToken) {
    return existingToken;
  }

  if (!csrfTokenRequest) {
    csrfTokenRequest = axios
      .get<{ csrf_token?: string }>('/api/v1/auth/csrf', { withCredentials: true })
      .then(() => readCookie(CSRF_COOKIE_NAME))
      .catch((error: unknown) => {
        logger.error('Failed to fetch initial CSRF token:', error);
        return null;
      })
      .finally(() => {
        csrfTokenRequest = null;
      });
  }

  return csrfTokenRequest;
}
