/**
 * Robust date parsing that handles both ISO strings and UNIX epochs safely.
 * @param timestamp - ISO string or numeric epoch (in ms or seconds)
 * @returns A valid Date object, or null when the timestamp is missing/invalid.
 */
export function safeParseDate(timestamp?: string | number | null): Date | null {
  if (!timestamp) {
    return null;
  }

  let ts = timestamp;
  
  // If numeric and looks like seconds (e.g. 1718000000), convert to ms
  if (typeof ts === 'number' && ts < 1e12 && ts > 1e8) {
    ts = ts * 1000;
  }
  // If string, try to parse it as number if it looks like one
  if (typeof ts === 'string' && /^\d+$/.test(ts)) {
    let numTs = parseInt(ts, 10);
    if (numTs < 1e12 && numTs > 1e8) {
      numTs = numTs * 1000;
    }
    ts = numTs;
  }

  const d = new Date(ts);
  
  // NaN protection
  if (isNaN(d.getTime())) {
    return null;
  }
  
  return d;
}

/**
 * Format date to a localized short string using Intl.DateTimeFormat
 * E.g., "Jan 1" or "5m" or "Just now"
 */
export function formatRelativeTime(ts?: string | number | null): string {
  if (!ts) return '';
  const d = safeParseDate(ts);
  if (!d) return '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m`;
  
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(d);
}

/**
 * Format date to a localized time string using Intl.DateTimeFormat
 * E.g., "12:30 PM"
 */
export function formatTimeOnly(ts?: string | number | null): string {
  if (!ts) return '';
  const d = safeParseDate(ts);
  if (!d) return '';
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(d);
}

/**
 * Format date to a localized date string using Intl.DateTimeFormat
 * E.g., "1/1/2024"
 */
export function formatDateOnly(ts?: string | number | null): string {
  if (!ts) return '';
  const d = safeParseDate(ts);
  if (!d) return '';
  return new Intl.DateTimeFormat(undefined).format(d);
}
