import { describe, it, expect, vi } from 'vitest';

const calls = vi.hoisted(() => [] as string[]);

vi.mock('@salla.sa/twilight-theme-engine/dom', () => ({
  removeEdgeInjections: () => calls.push('removeEdgeInjections'),
}));
vi.mock('@salla.sa/twilight-theme-engine/sentry/client', () => ({
  initThemeSentry: (theme: string) => calls.push(`sentry:${theme}`),
}));
vi.mock('react-dom/client', () => ({
  hydrateRoot: (container: unknown) => calls.push(container === document ? 'hydrate' : 'other'),
}));
vi.mock('@tanstack/react-start/client', () => ({ StartClient: () => null }));

describe('hydrate', () => {
  it('tags Sentry as grocery on import', async () => {
    await import('../app/hydrate');
    expect(calls).toEqual(['sentry:grocery']);
  });

  it('drops the edge-injected head tags before hydrating the document', async () => {
    const { hydrate } = await import('../app/hydrate');
    calls.length = 0;
    hydrate();
    expect(calls).toEqual(['removeEdgeInjections', 'hydrate']);
  });
});
