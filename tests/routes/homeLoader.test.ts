import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchLayout = vi.hoisted(() => vi.fn());
const early = vi.hoisted(() => vi.fn());
const queryClient = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('@salla.sa/twilight-theme-engine/api/home', () => ({
  home: {
    queries: {
      components: () => ({ queryKey: ['home', 'components', { scope: null }], queryFn: fetchLayout }),
    },
  },
}));
vi.mock('@salla.sa/twilight-theme-engine/tanstack', () => ({
  getTwilightContext: () => ({ queryClient: queryClient.current }),
  withHead: () => () => ({}),
}));
// What the engine's loader does with the cache: ensureQueryData under the components key.
vi.mock('@salla.sa/twilight-theme-engine/routes/home', async () => {
  const { home } = await import('@salla.sa/twilight-theme-engine/api/home');
  const { getTwilightContext } = await import('@salla.sa/twilight-theme-engine/tanstack');
  return {
    Home: {
      loader: async ({ locale }: { locale?: string }) => ({
        locale: locale ?? 'ar',
        components: await getTwilightContext().queryClient.ensureQueryData(home.queries.components()),
        page: { slug: 'index' },
      }),
    },
  };
});
vi.mock('../../app/lib/earlyHomeComponents', () => ({ earlyHomeComponents: early }));
vi.mock('../../app/components/home/placeholders', () => ({ HomeSkeleton: () => null }));

import { homeLoader } from '../../app/routes/index';

const layout = [{ path: 'enhanced-slider' }];

beforeEach(() => {
  queryClient.current = new QueryClient();
  fetchLayout.mockReset().mockResolvedValue(layout);
  early.mockReset();
});

describe('homeLoader', () => {
  it('seeds the cache with the middleware’s layout so the engine loader makes no second request', async () => {
    early.mockReturnValue(Promise.resolve(layout));
    await expect(homeLoader({ params: { locale: 'ar' } })).resolves.toMatchObject({
      locale: 'ar',
      components: layout,
    });
    expect(fetchLayout).not.toHaveBeenCalled();
    expect(
      (queryClient.current as QueryClient).getQueryData(['home', 'components', { scope: null }])
    ).toEqual(layout);
  });

  it('lets the engine loader fetch when nothing was started early or the early request failed', async () => {
    early.mockReturnValueOnce(undefined);
    await expect(homeLoader({ params: { locale: 'en' } })).resolves.toMatchObject({ locale: 'en' });
    expect(fetchLayout).toHaveBeenCalledTimes(1);

    early.mockReturnValueOnce(Promise.resolve(undefined));
    queryClient.current = new QueryClient();
    await homeLoader({ params: { locale: 'en' } });
    expect(fetchLayout).toHaveBeenCalledTimes(2);
  });
});
