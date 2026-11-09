import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const active = vi.hoisted(() => ({ id: '1' as string | null }));

vi.mock('@salla.sa/twilight-theme-engine/api/client', () => ({
  api: {
    get: () => ({
      json: () =>
        Promise.resolve({
          data: {
            scopes: [
              { id: 1, name: 'سريع', type: 'scope', selected: true },
              { id: 2, name: 'السوق', type: 'scope', selected: false },
            ],
          },
        }),
    }),
  },
  getActiveScopeId: () => active.id,
}));

vi.mock('@salla.sa/twilight-theme-engine/api/store', () => ({
  store: {
    queries: {
      settings: () => ({
        queryKey: ['store', 'settings', active.id],
        queryFn: () => ({ theme: { name: 'grocery' }, store: { settings: {} } }),
      }),
    },
  },
}));

vi.mock('@salla.sa/twilight-theme-engine/providers', () => ({
  useTwilight: () => ({ theme: { name: 'grocery' } }),
}));

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback, locale: 'ar' }),
}));

vi.mock('@salla.sa/twilight-theme-engine/hooks/useStore', () => ({
  useStore: () => ({ icon: null }),
}));

vi.mock('../../../app/hooks/useBulletDelivery', () => ({
  clearDeliveryIntent: vi.fn(),
  saveMarketPlace: vi.fn(),
  marketPlace: () => undefined,
  isBulletDeliveryOn: () => false,
  openDeliverySheet: vi.fn(),
}));
vi.mock('../../../app/components/cart/useCart', () => ({ clearCartStore: vi.fn() }));

import { MarketSwitcher } from '../../../app/components/layout/MarketSwitcher';

/** A real router on a memory history, so the test reads the URL the switch leaves. */
async function mountAt(url: string) {
  const router = createRouter({
    routeTree: createRootRoute({ component: MarketSwitcher }),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  await act(() => router.load());
  return router;
}

function installSalla(change = vi.fn().mockResolvedValue({})) {
  (window as unknown as { salla: unknown }).salla = {
    scope: { change },
    api: { setHeaders: vi.fn() },
    storage: { set: (_key: string, value: { id: number }) => (active.id = String(value.id)) },
    cart: { reset: vi.fn() },
  };
}

afterEach(() => {
  active.id = '1';
  delete (window as unknown as { salla?: unknown }).salla;
});

describe('the address bar after a market switch', () => {
  it('names the new market and drops the previous one and its branch', async () => {
    installSalla();
    const router = await mountAt('/?q=milk&scope=1&allocation_type=branch&allocation_id=9#top');

    fireEvent.click(await screen.findByRole('button', { name: 'السوق' }));

    await waitFor(() => expect(router.history.location.search).toBe('?q=milk&scope=2'));
    expect(router.history.location.hash).toBe('#top');
    expect(router.history.length).toBe(1);
  });

  it('stays as it was when the switch is rejected', async () => {
    installSalla(vi.fn().mockRejectedValue(new Error('closed')));
    const router = await mountAt('/?scope=1');

    fireEvent.click(await screen.findByRole('button', { name: 'السوق' }));

    await waitFor(() =>
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'السوق' }).disabled).toBe(false)
    );
    expect(router.history.location.search).toBe('?scope=1');
  });
});
