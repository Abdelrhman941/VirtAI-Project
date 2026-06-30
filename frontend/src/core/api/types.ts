/**
 * Shared API type definitions.
 * Import these in apiClient.ts, csrfService.ts, and any feature service.
 */

// ─── Generic wrappers ────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
}

export interface ErrorResponse {
  detail?: string;
  message?: string;
  [key: string]: unknown;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  access_token: string;
  token_type?: string;
}

// ─── CSRF ────────────────────────────────────────────────────────────────────

export interface CSRFResponse {
  csrf_token?: string;
}

// ─── Retry-aware Axios config extension ──────────────────────────────────────

/**
 * Augments InternalAxiosRequestConfig with our custom `_retry` flag.
 * Used in the response interceptor to prevent infinite refresh loops.
 */
export interface RetryableAxiosRequestConfig {
  _retry?: boolean;
}
