// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const context = { scope: null as { id: string } | null, storeBase: null as string | null, locale: '' };
const components = vi.fn();
vi.mock('@salla.sa/twilight-theme-engine/api/home', () => ({ home: { components } }));
vi.mock('@salla.sa/twilight-theme-engine/tanstack', () => ({
  getTwilightContext: () => context,
  updateTwilightContext: (partial: { locale?: string }) => Object.assign(context, partial),
}));

const { earlyHomeComponents, homeLocale, withEarlyHomeComponents } = await import(
  '../../app/lib/earlyHomeComponents'
);

const request = (path: string) => new Request(`https://store.test${path}`);

beforeEach(() => {
  context.scope = null;
  context.storeBase = null;
  context.locale = '';
  components.mockReset().mockResolvedValue([{ path: 'enhanced-slider' }]);
});

describe('homeLocale', () => {
  it('reads the locale of a home URL, with or without a store base', () => {
    expect(homeLocale('/ar', null)).toBe('ar');
    expect(homeLocale('/en/', null)).toBe('en');
    expect(homeLocale('/meed-2027/ar', 'meed-2027')).toBe('ar');
  });

  it('is null for other pages and for a home URL without a locale', () => {
    expect(homeLocale('/ar/cart', null)).toBeNull();
    expect(homeLocale('/', null)).toBeNull();
    expect(homeLocale('/ar', 'meed-2027')).toBeNull();
  });
});

describe('withEarlyHomeComponents', () => {
  it('starts the layout request for a home URL and hands it to the loader', async () => {
    const seen = withEarlyHomeComponents(request('/ar'), () => earlyHomeComponents());
    expect(components).toHaveBeenCalledTimes(1);
    expect(context.locale).toBe('ar');
    await expect(seen).resolves.toEqual([{ path: 'enhanced-slider' }]);
  });

  it('does nothing for other pages', () => {
    expect(withEarlyHomeComponents(request('/ar/cart'), () => earlyHomeComponents())).toBeUndefined();
    expect(components).not.toHaveBeenCalled();
  });

  it('does nothing when a market is selected, whose theme version only the settings know', () => {
    context.scope = { id: '7' };
    expect(withEarlyHomeComponents(request('/ar'), () => earlyHomeComponents())).toBeUndefined();
    expect(components).not.toHaveBeenCalled();
  });

  it('withholds the result when the settings changed the scope after the request started', async () => {
    const seen = withEarlyHomeComponents(request('/ar'), () => {
      context.scope = { id: '7' };
      return earlyHomeComponents();
    });
    expect(seen).toBeUndefined();
  });

  it('resolves to undefined instead of failing the request when the API errors', async () => {
    components.mockRejectedValue(new Error('down'));
    await expect(
      withEarlyHomeComponents(request('/ar'), () => earlyHomeComponents())
    ).resolves.toBeUndefined();
  });

  it('is not shared with a request outside the run', () => {
    withEarlyHomeComponents(request('/ar'), () => undefined);
    expect(earlyHomeComponents()).toBeUndefined();
  });
});
