import apiClient from '@/core/api/apiClient';
import { beforeEach, describe, expect, it, MockedFunction, vi } from 'vitest';
import { fetchSessionMessages, fetchSessions } from './sessionService';

vi.mock('@/core/api/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockGet = apiClient.get as MockedFunction<typeof apiClient.get>;
const apiResponse = (data: unknown) => ({ data }) as Awaited<ReturnType<typeof apiClient.get>>;

describe('sessionService response extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('unwraps wrapped sessions payloads', async () => {
    mockGet.mockResolvedValueOnce(apiResponse({ sessions: [{ id: 's1', title: 'Session 1' }] }));

    const sessions = await fetchSessions();

    expect(sessions).toEqual([{ id: 's1', title: 'Session 1' }]);
  });

  it('returns [] when sessions payload is not an array', async () => {
    mockGet.mockResolvedValueOnce(apiResponse({ ok: true }));

    const sessions = await fetchSessions();

    expect(sessions).toEqual([]);
  });

  it('unwraps wrapped messages payloads', async () => {
    mockGet.mockResolvedValueOnce(
      apiResponse({
        messages: [{ id: 'm1', session_id: 'session-1', role: 'assistant', content: 'Hello' }],
      })
    );

    const messages = await fetchSessionMessages('session-1');

    expect(messages).toEqual([{ id: 'm1', session_id: 'session-1', role: 'assistant', content: 'Hello' }]);
  });

  it('accepts canonical session timestamp fields', async () => {
    mockGet.mockResolvedValueOnce(
      apiResponse({
        sessions: [
          {
            id: 's1',
            title: 'Session 1',
            created_at: '2026-06-25T10:00:00Z',
            last_message_at: '2026-06-25T10:06:00Z',
          },
        ],
      })
    );

    const sessions = await fetchSessions();

    expect(sessions[0]).toMatchObject({
      created_at: '2026-06-25T10:00:00Z',
      last_message_at: '2026-06-25T10:06:00Z',
    });
  });

  it('accepts canonical message created_at field', async () => {
    mockGet.mockResolvedValueOnce(
      apiResponse({
        messages: [
          {
            id: 'm1',
            session_id: 'session-1',
            role: 'assistant',
            content: 'Hello',
            created_at: '2026-06-25T10:05:01Z',
          },
        ],
      })
    );

    const messages = await fetchSessionMessages('session-1');

    expect(messages[0]).toMatchObject({
      created_at: '2026-06-25T10:05:01Z',
    });
  });
});
