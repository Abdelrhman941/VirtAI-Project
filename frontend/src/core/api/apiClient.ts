import axios, { AxiosError, AxiosHeaders, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { CSRF_HEADER_NAME, ensureCsrfToken } from './csrfService';
import type { AuthResponse, RetryableAxiosRequestConfig } from './types';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const API_PREFIX = '/api/v1';

function normalizeApiUrl(url?: string): string | undefined {
  if (typeof url !== 'string') {
    return url;
  }

  if (url === API_PREFIX) {
    return '/';
  }

  if (url.startsWith(`${API_PREFIX}/`)) {
    return url.slice(API_PREFIX.length);
  }

  return url;
}

interface ApiAuthHandlers {
  getToken: () => string | null;
  getHasSessionHint: () => boolean;
  refreshToken: () => Promise<AuthResponse>;
  markSession: () => void;
  clearSession: () => void;
  logout: () => void;
  setToken: (token: string) => void;
}

let authHandlers: ApiAuthHandlers | null = null;

export function injectApiAuthHandlers(handlers: ApiAuthHandlers) {
  authHandlers = handlers;
}

const apiClient: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  xsrfCookieName: 'csrf_token',
  xsrfHeaderName: 'X-CSRF-Token',
});

if (typeof window !== 'undefined') {
  void ensureCsrfToken();
}

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  config.url = normalizeApiUrl(config.url);

  // Ensure headers is always a proper AxiosHeaders instance
  if (!(config.headers instanceof AxiosHeaders)) {
    config.headers = new AxiosHeaders(config.headers ?? {});
  }

  const method = config.method?.toUpperCase() ?? 'GET';

  if (STATE_CHANGING_METHODS.has(method)) {
    const csrfToken = await ensureCsrfToken();
    if (!csrfToken) {
      throw new Error('Unable to obtain CSRF token for state-changing request.');
    }
    config.headers.set(CSRF_HEADER_NAME, csrfToken);
  }

  if (authHandlers) {
    const token = authHandlers.getToken();
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & RetryableAxiosRequestConfig) | undefined;
    if (!original || !authHandlers) {
      return Promise.reject(error);
    }

    const hasRefreshCandidate = authHandlers.getToken() || authHandlers.getHasSessionHint();

    if (error.response?.status === 401 && !original._retry && hasRefreshCandidate) {
      original._retry = true;
      try {
        const resData = await authHandlers.refreshToken();
        authHandlers.markSession();
        authHandlers.setToken(resData.access_token);

        if (!(original.headers instanceof AxiosHeaders)) {
          original.headers = new AxiosHeaders(original.headers ?? {});
        }
        original.headers.set('Authorization', `Bearer ${resData.access_token}`);

        return apiClient(original);
      } catch {
        authHandlers.clearSession();
        authHandlers.logout();
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
