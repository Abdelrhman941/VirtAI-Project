/*
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

/*
  * Single source of truth for post-auth navigation destination.
  * Used by useLogin, useSignup, and useGoogleCallback to prevent
  * duplicate routing logic scattered across hooks and components.
*/
export function postAuthDestination(setupComplete: boolean): '/classroom' | '/setup' {
  return setupComplete ? '/classroom' : '/setup';
}
