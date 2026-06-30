import { describe, expect, it } from 'vitest';
import { formatRelativeTime, formatTimeOnly, safeParseDate } from './date';

describe('date utilities', () => {
  it('does not coerce missing timestamps to the current time', () => {
    expect(safeParseDate(null)).toBeNull();
    expect(safeParseDate(undefined)).toBeNull();
    expect(formatTimeOnly(null)).toBe('');
    expect(formatRelativeTime(undefined)).toBe('');
  });

  it('does not coerce invalid timestamps to the current time', () => {
    expect(safeParseDate('not-a-date')).toBeNull();
    expect(formatTimeOnly('not-a-date')).toBe('');
    expect(formatRelativeTime('not-a-date')).toBe('');
  });
});
