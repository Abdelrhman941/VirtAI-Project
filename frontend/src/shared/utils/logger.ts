/**
 * Dev-only logger — all methods are no-ops in production builds.
 * console.error is securely wrapped to prevent leaks in production.
 */
declare global {
  interface Window {
    __telemetry?: (data: unknown) => void;
  }
}

const isDev = import.meta.env.DEV;

const noop = () => { };

function reportError(level: string, msg: unknown, ...args: unknown[]) {
  // Slot in Sentry / Datadog / custom endpoint here.
  // Safe no-network fallback for now:
  if (typeof window !== 'undefined' && typeof window.__telemetry === 'function') {
    window.__telemetry({ level, msg, args, ts: Date.now() });
  }
}

export const logger = {
  debug: isDev ? console.debug.bind(console) : noop,
  log: isDev ? console.log.bind(console) : noop,
  info: isDev ? console.info.bind(console) : noop,
  warn: isDev ? console.warn.bind(console) : (...a: unknown[]) => reportError('warn', a[0], ...(a.slice(1))),
  error: isDev ? console.error.bind(console) : (...a: unknown[]) => reportError('error', a[0], ...(a.slice(1))),
};
