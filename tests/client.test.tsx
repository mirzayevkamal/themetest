import { afterEach, describe, it, expect, vi } from 'vitest';

const hydrate = vi.hoisted(() => vi.fn());

vi.mock('../app/hydrate', () => ({ hydrate }));
vi.mock('../app/styles/app.css?url', () => ({ default: '/assets/app.css' }));

const sheets = () =>
  document.head.querySelectorAll('link[rel="stylesheet"][href="/assets/app.css"]');

describe('client entry', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    vi.resetModules();
    hydrate.mockClear();
  });

  it('starts the full sheet without blocking and hydrates at once on a critical-CSS page', async () => {
    await import('../app/client');
    expect(sheets()).toHaveLength(1);
    expect((sheets()[0] as HTMLLinkElement).dataset.precedence).toBe('default');
    expect(hydrate).toHaveBeenCalledTimes(1);
  });

  it('adds no second sheet where the server already linked it', async () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/assets/app.css';
    document.head.appendChild(link);

    await import('../app/client');
    expect(sheets()).toHaveLength(1);
    expect(hydrate).toHaveBeenCalledTimes(1);
  });
});
