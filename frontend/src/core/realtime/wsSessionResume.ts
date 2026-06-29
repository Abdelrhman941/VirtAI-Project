import type { RealtimeLogger, WSOutgoingMessage } from './types';

export interface SessionResumeState {
  sessionId: string | null;
  lastSeq: number;
  lastAckedSeq: number;
  messageQueue: WSOutgoingMessage[];
}

export function createSessionResumeState(useLocalStorage = true): SessionResumeState {
  const savedSessionId = (typeof window !== 'undefined' && useLocalStorage) ? localStorage.getItem('virt_session_id') : null;
  return {
    sessionId: savedSessionId,
    lastSeq: 0,
    lastAckedSeq: 0,
    messageQueue: [],
  };
}

export function buildResumeUrl(url: string | null, state: SessionResumeState): string | null {
  if (!state.sessionId || !url) return url;
  try {
    const parsed = new URL(url);
    const requestedSessionId = parsed.searchParams.get('session_id');
    
    // If the URL explicitly requests a different session, DO NOT resume the old one
    if (requestedSessionId && requestedSessionId !== state.sessionId) {
      resetSessionState(state);
      return url;
    }

    parsed.searchParams.set('resume', 'true');
    parsed.searchParams.set('session_id', state.sessionId);
    parsed.searchParams.set('last_seq', String(state.lastSeq));
    return parsed.toString();
  } catch {
    return url;
  }
}

export function flushAckBatch(state: SessionResumeState, sendFn: (data: string) => void): void {
  if (state.lastSeq <= state.lastAckedSeq) return;
  const ackPayload = {
    type: 'ws.ack',
    data: {
      last_seq: state.lastSeq,
      session_id: state.sessionId,
    },
  };
  try {
    sendFn(JSON.stringify(ackPayload));
    state.lastAckedSeq = state.lastSeq;
  } catch (err: unknown) {
    if (import.meta.env.DEV) {
      console.debug('[WS] Failed to send ack payload:', err);
    }
  }
}

export function flushMessageQueue(
  state: SessionResumeState,
  sendFn: (data: string) => void,
  logger: RealtimeLogger
): void {
  while (state.messageQueue.length > 0) {
    const msg = state.messageQueue.shift();
    try {
      sendFn(JSON.stringify(msg));
    } catch (err: unknown) {
      logger.error('[WS] Failed to send queued message:', err);
    }
  }
}

export function pushToMessageQueue(
  state: SessionResumeState,
  message: WSOutgoingMessage,
  maxQueueSize = 100
): void {
  if (state.messageQueue.length >= maxQueueSize) {
    state.messageQueue.shift();
  }
  state.messageQueue.push(message);
}

export function resetSessionState(state: SessionResumeState, useLocalStorage = true): void {
  state.sessionId = null;
  state.lastSeq = 0;
  state.lastAckedSeq = 0;
  if (typeof window !== 'undefined' && useLocalStorage) {
    localStorage.removeItem('virt_session_id');
  }
}
