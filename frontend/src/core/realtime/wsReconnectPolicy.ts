import { WS_BASE_DELAY_MS, WS_MAX_DELAY_MS, WS_MAX_RECONNECT_ATTEMPTS } from './wsConstants';

export interface ReconnectPolicyOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
}

export interface ReconnectPolicy {
  nextDelay: () => number;
  shouldPause: () => boolean;
  reset: () => void;
  pause: () => void;
  increment: () => void;
  readonly attempt: number;
  readonly isPaused: boolean;
}

export function createReconnectPolicy({
  maxAttempts = WS_MAX_RECONNECT_ATTEMPTS,
  baseDelay = WS_BASE_DELAY_MS,
  maxDelay = WS_MAX_DELAY_MS,
}: ReconnectPolicyOptions = {}): ReconnectPolicy {
  let attempt = 0;
  let isPaused = false;

  return {
    nextDelay() {
      const delay = Math.min(baseDelay * (2 ** attempt) + Math.random() * 1000, maxDelay);
      attempt++;
      return delay;
    },
    shouldPause() {
      return attempt >= maxAttempts;
    },
    reset() {
      attempt = 0;
      isPaused = false;
    },
    pause() {
      isPaused = true;
    },
    increment() {
      attempt++;
    },
    get attempt() {
      return attempt;
    },
    get isPaused() {
      return isPaused;
    }
  };
}
