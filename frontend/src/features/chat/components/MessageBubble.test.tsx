import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MessageBubble from './MessageBubble';
import { formatTimeOnly } from '@/shared/utils/date';

vi.mock('@/shared/utils/date', () => ({
  formatTimeOnly: vi.fn((ts?: string | number | null) => (ts ? `formatted:${ts}` : '')),
}));

describe('MessageBubble timestamps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses created_at as the only canonical timestamp', () => {
    render(
      <MessageBubble
        msg={{
          id: 'm1',
          role: 'user',
          content: 'hello',
          created_at: '2026-06-25T10:00:00Z',
        }}
        avatarName="Tutor"
      />
    );

    expect(formatTimeOnly).toHaveBeenCalledWith('2026-06-25T10:00:00Z');
    expect(screen.getByText('formatted:2026-06-25T10:00:00Z')).toBeTruthy();
  });

  it('does not render legacy timestamp when created_at is missing', () => {
    render(
      <MessageBubble
        msg={{
          id: 'test-msg-1',
          role: 'user',
          content: 'Hello, world!',
          session_id: 'test-session',
        } as any}
        avatarName="Tutor"
      />
    );

    expect(formatTimeOnly).toHaveBeenCalledWith(undefined);
    expect(screen.queryByText('formatted:2026-06-25T09:00:00Z')).toBeNull();
  });

  it('renders pending state without a canonical timestamp fallback', () => {
    render(
      <MessageBubble
        msg={{ id: 'm1', role: 'user', content: 'hello', status: 'pending' }}
        avatarName="Tutor"
      />
    );

    expect(formatTimeOnly).not.toHaveBeenCalledWith(expect.any(Number));
    expect(screen.getByText('Sending...')).toBeTruthy();
  });
});
