import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useSessionManager from './useSessionManager';
import * as sessionService from '../services/sessionService';
import { useAuthStore } from '@/features/auth/store/authStore';

vi.mock('../services/sessionService', () => ({
  fetchSessions: vi.fn(),
  fetchSessionMessages: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  updateSessionTitle: vi.fn(),
  deleteAllSessions: vi.fn(),
}));

vi.mock('@/features/auth/store/authStore', () => ({
  useAuthStore: vi.fn(),
  selectIsAuthenticated: vi.fn(() => true),
}));

describe('useSessionManager', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
    (useAuthStore as unknown as any).mockReturnValue(true);
    (sessionService.fetchSessionMessages as any).mockResolvedValue([]);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('reuses latest session if message_count is 0', async () => {
    const mockSession = { id: 's1', title: 'Test', message_count: 0 };
    (sessionService.fetchSessions as any).mockResolvedValue([mockSession]);

    const { result } = renderHook(() => useSessionManager(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('success'));

    const newId = await result.current.createNewSession();
    expect(newId).toBe('s1');
    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  it('reuses latest session if message_count is undefined but messages_loaded is true and empty', async () => {
    const mockSession = { id: 's2', title: 'New chat', messages_loaded: true, messages: [] };
    (sessionService.fetchSessions as any).mockResolvedValue([mockSession]);

    const { result } = renderHook(() => useSessionManager(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('success'));

    const newId = await result.current.createNewSession();
    expect(newId).toBe('s2');
    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  it('creates a new session if latest session has messages', async () => {
    const mockSession = { id: 's3', title: 'Test', message_count: 1 };
    (sessionService.fetchSessions as any).mockResolvedValue([mockSession]);
    (sessionService.createSession as any).mockResolvedValue({ id: 's4', title: 'New chat' });

    const { result } = renderHook(() => useSessionManager(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('success'));

    const newId = await result.current.createNewSession();
    expect(newId).toBe('s4');
    expect(sessionService.createSession).toHaveBeenCalledOnce();
  });

  it('creates a new session if no sessions exist', async () => {
    (sessionService.fetchSessions as any).mockResolvedValue([]);
    (sessionService.createSession as any).mockResolvedValue({ id: 's5', title: 'New chat' });

    const { result } = renderHook(() => useSessionManager(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('success'));

    const newId = await result.current.createNewSession();
    expect(newId).toBe('s5');
    expect(sessionService.createSession).toHaveBeenCalledOnce();
  });

  it('reconciles a pending user message with server created_at without duplicating it', async () => {
    (sessionService.fetchSessions as any).mockResolvedValue([
      { id: 's1', title: 'Session', message_count: 0 },
    ]);

    const { result } = renderHook(() => useSessionManager('s1'), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('success'));

    result.current.addUserMessage(
      { id: 'm1', role: 'user', content: 'hello', status: 'pending' },
      's1'
    );
    result.current.addUserMessage(
      {
        id: 'm1',
        role: 'user',
        content: 'hello',
        created_at: '2026-06-25T10:00:00Z',
      },
      's1'
    );

    const messages = queryClient.getQueryData(['sessionMessages', 's1']);
    expect(messages).toEqual([
      {
        id: 'm1',
        role: 'user',
        content: 'hello',
        status: 'sent',
        created_at: '2026-06-25T10:00:00Z',
      },
    ]);

    const sessions = queryClient.getQueryData(['sessions']);
    expect(sessions).toMatchObject([
      {
        id: 's1',
        message_count: 1,
        last_message_at: '2026-06-25T10:00:00Z',
      },
    ]);
  });
});
