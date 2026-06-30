/**
 * Pure functions for authentication routing and bootstrap decisions.
 */

export function shouldSkipAuthRefresh(pathname: string): boolean {
  return pathname.startsWith('/auth/callback');
}

export function isProtectedPath(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/setup') || pathname.startsWith('/classroom');
}

export function shouldAttemptRefresh(pathname: string, hasSessionHint: boolean): boolean {
  return isProtectedPath(pathname) || hasSessionHint;
}
