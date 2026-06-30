import { describe, expect, it } from 'vitest';
import { ISession } from '../types';
import {
  normalizeAndSortSessions,
  sortSessionsByRecency,
} from './sessionState';

describe('sessionState helpers', () => {
  it('sorts by last_message_at only', () => {
    const sorted = normalizeAndSortSessions([
      { _id: 'old', created_at: '2026-05-01T08:00:00Z', last_message_at: '2026-05-01T08:00:00Z' },
      {
        id: 'newest',
        updated_at: '2026-05-01T09:00:00Z',
        last_message_at: '2026-05-01T12:00:00Z',
      },
      { id: 'middle', updated_at: '2026-05-01T13:00:00Z', last_message_at: '2026-05-01T10:00:00Z' },
    ]);

    expect(sorted.map((s: ISession) => s.id)).toEqual(['newest', 'middle', 'old']);
  });

  it('does not use updated_at or created_at as recency fallbacks', () => {
    const sorted = normalizeAndSortSessions([
      { id: 'canonical', last_message_at: '2026-05-01T10:00:00Z' },
      { id: 'legacy-updated', updated_at: '2026-05-01T12:00:00Z' },
      { id: 'legacy-created', created_at: '2026-05-01T11:00:00Z' },
    ]);

    expect(sorted.map((s: ISession) => s.id)).toEqual([
      'canonical',
      'legacy-updated',
      'legacy-created',
    ]);
  });

  it('preserves last_message_at during normalization', () => {
    const [session] = normalizeAndSortSessions([
      {
        id: 's1',
        title: 'Session',
        created_at: '2026-05-01T08:00:00Z',
        updated_at: '2026-05-01T09:00:00Z',
        last_message_at: '2026-05-01T10:00:00Z',
      },
    ]);

    expect(session.last_message_at).toBe('2026-05-01T10:00:00Z');
  });

  it('sortSessionsByRecency handles an empty array', () => {
    expect(sortSessionsByRecency([])).toEqual([]);
  });

  it('normalizeAndSortSessions filters out sessions without an id', () => {
    const result = normalizeAndSortSessions([
      { id: 'valid', updated_at: '2026-05-01T10:00:00Z' },
      { title: 'no-id', updated_at: '2026-05-01T11:00:00Z' },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('valid');
  });

  it('normalizeAndSortSessions returns [] for non-array input', () => {
    expect(normalizeAndSortSessions(null)).toEqual([]);
    expect(normalizeAndSortSessions(undefined)).toEqual([]);
  });
});
