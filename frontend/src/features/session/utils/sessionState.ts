import { ISession } from '../types';

import { safeParseDate } from '@/shared/utils/date';

type RawSession = Partial<ISession> & {
  _id?: unknown;
  id?: unknown;
  title?: unknown;
  messages?: unknown;
  messages_loaded?: unknown;
};

export function getSessionTimeMs(session: Partial<ISession>): number {
  const parsed = safeParseDate(session?.last_message_at);
  return parsed?.getTime() ?? 0;
}

export function sortSessionsByRecency(sessions: ISession[]): ISession[] {
  return [...sessions].sort((a, b) => getSessionTimeMs(b) - getSessionTimeMs(a));
}

export function normalizeSession(session: RawSession): ISession {
  const rawId = session?.id || session?._id || null;
  const id = typeof rawId === 'string' ? rawId : '';

  return {
    ...session,
    id,
    title: typeof session?.title === 'string' ? session.title : '',
    created_at: session?.created_at,
    last_message_at: session?.last_message_at,
    messages: Array.isArray(session?.messages) ? session.messages : undefined,
    messages_loaded: session?.messages_loaded === true,
    message_count: session?.message_count,
  };
}

export function normalizeAndSortSessions(data: unknown): ISession[] {
  const sessions = Array.isArray(data) ? data : [];

  return sortSessionsByRecency(
    sessions.map((session) => normalizeSession(session as RawSession)).filter((session) => Boolean(session.id))
  );
}
