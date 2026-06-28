export const WS_CLOSE_TOKEN_EXPIRED = 4401;
export const WS_CLOSE_UNAUTHORIZED = 4403;
export const WS_CLOSE_SESSION_INVALID = 4404;
export const WS_CLOSE_NORMAL = 1000;

export const WS_BASE_DELAY_MS = 1000;
export const WS_MAX_DELAY_MS = 30000;
export const WS_MAX_RECONNECT_ATTEMPTS = 5;

export const RECONNECT_PAUSE_MESSAGE = 'Connection paused after 5 retries. Click Reconnect to try again.';

export const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  FAILED: 'failed',
} as const;

export type ConnectionState = typeof ConnectionState[keyof typeof ConnectionState];
