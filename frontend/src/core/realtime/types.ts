/**
 * Shared WebSocket type definitions.
 * All realtime-layer files import from here — no `any` anywhere.
 */

// ─── Outgoing (client → server) ──────────────────────────────────────────────

export interface WSOutgoingMessage {
  type: string;
  data?: unknown;
  [key: string]: unknown;
}

export interface WSAckPayload extends WSOutgoingMessage {
  type: 'ws.ack';
  data: {
    last_seq: number;
    session_id: string | null;
  };
}

// ─── Incoming (server → client) ──────────────────────────────────────────────

export interface WSIncomingMessage {
  type: string;
  seq_id?: number;
  data?: WSIncomingMessageData;
  [key: string]: unknown;
}

export interface WSIncomingMessageData {
  session_id?: string;
  last_seq?: number;
  [key: string]: unknown;
}

/** Generic alias kept for external usage. */
export type WSMessage = WSIncomingMessage | WSOutgoingMessage;

// ─── Session resume ───────────────────────────────────────────────────────────

export interface SessionResumePayload {
  resume: 'true';
  session_id: string;
  last_seq: string;
}

// ─── Event router ─────────────────────────────────────────────────────────────

/** The payload delivered to registered `onMessage` handlers. */
export type EventRouterPayload = WSIncomingMessageData;

/** Minimal logger interface used by the realtime layer. */
export interface RealtimeLogger {
  error: (message: string, ...args: unknown[]) => void;
  warn?: (message: string, ...args: unknown[]) => void;
  debug?: (message: string, ...args: unknown[]) => void;
}
