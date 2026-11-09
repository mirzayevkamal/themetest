import { describe, it, expect, vi } from 'vitest';

const handler = vi.hoisted(() => ({ fetch: () => new Response() }));

vi.mock('@tanstack/react-start/server-entry', () => ({ default: handler }));
vi.mock('@salla.sa/twilight-theme-engine/sentry/server', () => ({
  withThemeSentry: (wrapped: unknown, theme: string) => ({ wrapped, theme }),
}));

describe('server entry', () => {
  it('wraps the TanStack handler with Sentry tagged as grocery', async () => {
    const { default: entry } = await import('../app/server');
    expect(entry).toEqual({ wrapped: handler, theme: 'grocery' });
  });
});
