import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({
  invalidate: vi.fn(),
  navigate: vi.fn(),
  state: { location: { href: '/ar' } },
}));
const scopes = vi.hoisted(() => ({ list: [] as unknown[] }));
const active = vi.hoisted(() => ({ id: '1' as string | null }));

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => router,
  useNavigate: () => vi.fn(),
  useParams: () => ({ locale: 'ar' }),
}));

vi.mock('@salla.sa/twilight-theme-engine/api/client', () => ({
  api: { get: () => ({ json: () => Promise.resolve({ data: { scopes: scopes.list } }) }) },
  getActiveScopeId: () => active.id,
}));

// Each market answers its own settings, keyed like the engine's query by the active market.
vi.mock('@salla.sa/twilight-theme-engine/api/store', () => ({
  store: {
    queries: {
      settings: () => ({
        queryKey: ['store', 'settings', active.id],
        queryFn: () => {
          if (themes.fail) throw new Error('settings down');
          return {
            theme: { name: themes.byMarket[active.id ?? ''] ?? 'grocery' },
            store: { settings: { bullet_delivery: { enabled: delivery.on } } },
          };
        },
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

const cleared = vi.hoisted(() => ({ intent: vi.fn(), cart: vi.fn() }));
const themes = vi.hoisted(() => ({ byMarket: {} as Record<string, string>, fail: false }));
const delivery = vi.hoisted(() => ({
  on: false,
  places: {} as Record<string, { allocation_type: string; allocation_id: string }>,
  save: vi.fn(),
  open: vi.fn(),
}));

vi.mock('../../../app/hooks/useBulletDelivery', () => ({
  clearDeliveryIntent: cleared.intent,
  saveMarketPlace: delivery.save,
  marketPlace: (id: number) => delivery.places[id],
  isBulletDeliveryOn: (store?: { settings?: { bullet_delivery?: { enabled?: boolean } } }) =>
    Boolean(store?.settings?.bullet_delivery?.enabled),
  openDeliverySheet: delivery.open,
}));

vi.mock('../../../app/components/cart/useCart', () => ({
  clearCartStore: cleared.cart,
}));

vi.mock('@salla.sa/twilight-theme-engine/hooks/useStore', () => ({
  useStore: () => ({ icon: null }),
}));

import {
  hrefWithMarket,
  MarketSwitcher,
  resetMarketSwitchForTests,
  useMarkets,
  useMarketSwitchPending,
} from '../../../app/components/layout/MarketSwitcher';

const quick = { id: 1, name: 'سريع', type: 'scope', selected: true };
const market = { id: 2, name: 'السوق', type: 'scope', selected: false };

function installSalla(change = vi.fn().mockResolvedValue({})) {
  const sdk = {
    scope: { change },
    api: { setHeaders: vi.fn() },
    storage: {
      set: vi.fn((_key: string, value: { id: number }) => (active.id = String(value.id))),
    },
    cart: { reset: vi.fn() },
    config: { set: vi.fn() },
  };
  (window as unknown as { salla: unknown }).salla = sdk;
  return sdk;
}

function mount(ui = <MarketSwitcher />) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, ...render(ui, { wrapper }) };
}

/** The phone's tabs: links that stay tappable while a switch is pending. */
function Tabs() {
  const { markets, pending, switchTo } = useMarkets();
  return (
    <>
      {markets.map((market) => (
        <button key={market.id} type="button" onClick={() => void switchTo(market)}>
          {market.name}
        </button>
      ))}
      <output data-testid="markets-tabs-pending">{String(pending)}</output>
    </>
  );
}

/** A `scope.change` that resolves only when the test says so. */
function deferredChange() {
  const calls: Array<{ resolve: (value: unknown) => void; reject: (error: Error) => void }> = [];
  const change = vi.fn(
    () => new Promise<unknown>((resolve, reject) => calls.push({ resolve, reject }))
  );
  return {
    change,
    finish: (index: number) => calls[index].resolve({}),
    fail: (index: number) => calls[index].reject(new Error('closed')),
  };
}

describe('MarketSwitcher', () => {
  beforeEach(() => {
    resetMarketSwitchForTests();
    router.invalidate.mockReset();
    router.invalidate.mockResolvedValue(undefined);
    router.navigate.mockReset();
    router.navigate.mockResolvedValue(undefined);
    router.state.location.href = '/ar';
    scopes.list = [quick, market];
    active.id = '1';
    cleared.intent.mockReset();
    cleared.cart.mockReset();
    delivery.on = false;
    delivery.places = {};
    delivery.save.mockReset();
    delivery.open.mockReset();
    delivery.open.mockResolvedValue(undefined);
    themes.byMarket = {};
    themes.fail = false;
  });

  afterEach(() => {
    delete (window as unknown as { salla?: unknown }).salla;
  });

  it('stays hidden for a store with a single market', async () => {
    scopes.list = [quick];
    const { container, queryClient } = mount();

    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(container.innerHTML).toBe('');
  });

  it('marks the market requests are sent with', async () => {
    mount();

    expect((await screen.findByRole('button', { name: 'سريع' })).getAttribute('aria-pressed')).toBe(
      'true'
    );
    expect(screen.getByRole('button', { name: 'السوق' }).getAttribute('aria-pressed')).toBe(
      'false'
    );
  });

  it('changes the market, drops the old allocation and cart, then refreshes the page', async () => {
    const sdk = installSalla();
    mount();

    fireEvent.click(await screen.findByRole('button', { name: 'السوق' }));

    await waitFor(() => expect(router.invalidate).toHaveBeenCalledOnce());
    expect(sdk.scope.change).toHaveBeenCalledWith({ id: 2 });
    expect(sdk.storage.set).toHaveBeenCalledWith('scope', { id: 2, type: 'scope' });
    expect(sdk.config.set).toHaveBeenCalledWith('store.scope', { id: 2, type: 'scope' });
    expect(sdk.api.setHeaders).toHaveBeenCalledWith({
      's-scope-id': 2,
      's-scope-type': 'scope',
      's-scope-allocation-type': undefined,
      's-scope-allocation-id': undefined,
    });
    expect(sdk.cart.reset).toHaveBeenCalledOnce();
    expect(cleared.intent).toHaveBeenCalledOnce();
    expect(cleared.cart).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'السوق' }).getAttribute('aria-pressed')).toBe(
        'true'
      )
    );
  });

  it('brings back the place picked in that market before, without asking again', async () => {
    const sdk = installSalla();
    delivery.on = true;
    delivery.places[2] = { allocation_type: 'branch', allocation_id: '676605929' };
    mount();

    fireEvent.click(await screen.findByRole('button', { name: 'السوق' }));

    await waitFor(() => expect(router.invalidate).toHaveBeenCalledOnce());
    expect(delivery.save).toHaveBeenCalledBefore(sdk.scope.change);
    const scope = { id: 2, type: 'scope', allocation_type: 'branch', allocation_id: '676605929' };
    expect(sdk.storage.set).toHaveBeenCalledWith('scope', scope);
    expect(sdk.api.setHeaders).toHaveBeenCalledWith({
      's-scope-id': 2,
      's-scope-type': 'scope',
      's-scope-allocation-type': 'branch',
      's-scope-allocation-id': '676605929',
    });
    expect(cleared.intent).toHaveBeenCalledWith(delivery.places[2]);
    await waitFor(() =>
      expect(sdk.config.set).toHaveBeenCalledWith('store.settings', expect.anything())
    );
    expect(delivery.open).not.toHaveBeenCalled();
  });

  it('asks for a place in a market with delivery and none picked yet', async () => {
    installSalla();
    delivery.on = true;
    mount();

    fireEvent.click(await screen.findByRole('button', { name: 'السوق' }));

    await waitFor(() => expect(delivery.open).toHaveBeenCalledOnce());
  });

  it('does not ask in a market without delivery', async () => {
    const sdk = installSalla();
    mount();

    fireEvent.click(await screen.findByRole('button', { name: 'السوق' }));

    await waitFor(() =>
      expect(sdk.config.set).toHaveBeenCalledWith('store.settings', expect.anything())
    );
    expect(delivery.open).not.toHaveBeenCalled();
  });

  it("hands the SDK the new market's settings, as the reload Twig does would", async () => {
    const sdk = installSalla();
    mount();

    fireEvent.click(await screen.findByRole('button', { name: 'السوق' }));

    await waitFor(() =>
      expect(sdk.config.set).toHaveBeenCalledWith('store.settings', {
        bullet_delivery: { enabled: false },
      })
    );
  });

  it('puts the new market in the address bar, replacing the one it came from', async () => {
    installSalla();
    router.state.location.href =
      '/ar/offers?page=2&scope=1&allocation_type=branch&allocation_id=676605929#top';
    mount();

    fireEvent.click(await screen.findByRole('button', { name: 'السوق' }));

    await waitFor(() => expect(router.invalidate).toHaveBeenCalledOnce());
    expect(router.navigate).toHaveBeenCalledWith({
      href: '/ar/offers?page=2&scope=2#top',
      replace: true,
      resetScroll: false,
    });
  });

  it('loads a market that runs another theme as a new document, skeleton kept up', async () => {
    const sdk = installSalla();
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    themes.byMarket['2'] = 'namou';
    router.state.location.href = '/ar/offers?scope=1';
    mount(<Tabs />);

    fireEvent.click(await screen.findByRole('button', { name: 'السوق' }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/ar/offers?scope=2'));
    expect(sdk.scope.change).toHaveBeenCalledWith({ id: 2 });
    expect(sdk.storage.set).toHaveBeenCalledWith('scope', { id: 2, type: 'scope' });
    expect(router.navigate).not.toHaveBeenCalled();
    expect(router.invalidate).not.toHaveBeenCalled();
    expect(cleared.cart).not.toHaveBeenCalled();
    expect(screen.getByTestId('markets-tabs-pending').textContent).toBe('true');
    vi.unstubAllGlobals();
  });

  it('sends a page restored from the bfcache on to the market it had selected', async () => {
    installSalla();
    const replace = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign: vi.fn(), replace });
    themes.byMarket['2'] = 'namou';
    router.state.location.href = '/ar?scope=1';
    mount(<Tabs />);

    fireEvent.click(await screen.findByRole('button', { name: 'السوق' }));
    await waitFor(() => expect(window.location.assign).toHaveBeenCalledOnce());
    expect(screen.getByTestId('markets-tabs-pending').textContent).toBe('true');

    const restored = new Event('pageshow');
    Object.defineProperty(restored, 'persisted', { value: true });
    fireEvent(window, restored);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/ar?scope=2'));
    vi.unstubAllGlobals();
  });

  it('leaves a restored page alone when no switch was running', async () => {
    const replace = vi.fn();
    vi.stubGlobal('location', { ...window.location, replace });
    mount(<Tabs />);
    await screen.findByRole('button', { name: 'السوق' });

    const restored = new Event('pageshow');
    Object.defineProperty(restored, 'persisted', { value: true });
    fireEvent(window, restored);

    expect(replace).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('finishes the in-place switch when the settings call fails', async () => {
    const sdk = installSalla();
    themes.fail = true;
    mount(<Tabs />);

    fireEvent.click(await screen.findByRole('button', { name: 'السوق' }));

    await waitFor(() => expect(router.invalidate).toHaveBeenCalledOnce());
    expect(router.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ href: '/ar?scope=2', replace: true })
    );
    expect(sdk.cart.reset).toHaveBeenCalledOnce();
    expect(sdk.config.set).not.toHaveBeenCalledWith('store.settings', expect.anything());
    await waitFor(() =>
      expect(screen.getByTestId('markets-tabs-pending').textContent).toBe('false')
    );
  });

  it('leaves the address bar alone when the switch is rejected', async () => {
    installSalla(vi.fn().mockRejectedValue(new Error('closed')));
    mount();

    fireEvent.click(await screen.findByRole('button', { name: 'السوق' }));

    await waitFor(() =>
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'السوق' }).disabled).toBe(false)
    );
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('marks the stored market when the SDK keeps its id as a string or there is none', async () => {
    active.id = '2';
    const view = mount();
    expect(
      (await screen.findByRole('button', { name: 'السوق' })).getAttribute('aria-pressed')
    ).toBe('true');
    view.unmount();

    active.id = null;
    mount();
    expect((await screen.findByRole('button', { name: 'سريع' })).getAttribute('aria-pressed')).toBe(
      'true'
    );
  });

  it('keeps the current market when the change is rejected', async () => {
    const sdk = installSalla(vi.fn().mockRejectedValue(new Error('closed')));
    mount();

    fireEvent.click(await screen.findByRole('button', { name: 'السوق' }));

    await waitFor(() => expect(sdk.scope.change).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'السوق' }).disabled).toBe(false)
    );
    expect(sdk.storage.set).not.toHaveBeenCalled();
    expect(sdk.cart.reset).not.toHaveBeenCalled();
    expect(cleared.intent).not.toHaveBeenCalled();
    expect(cleared.cart).not.toHaveBeenCalled();
    expect(router.invalidate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'سريع' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('waits for the SDK to boot before switching', async () => {
    let ready!: () => void;
    const sdk = installSalla();
    Object.assign(sdk, { onReady: () => new Promise<void>((resolve) => (ready = resolve)) });
    mount();

    fireEvent.click(await screen.findByRole('button', { name: 'السوق' }));
    expect(sdk.scope.change).not.toHaveBeenCalled();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'السوق' }).disabled).toBe(true);

    await waitFor(() => expect(ready).toBeTypeOf('function'));
    ready();
    await waitFor(() => expect(sdk.scope.change).toHaveBeenCalledWith({ id: 2 }));
  });

  it('queues a tap made during a switch, so the last tapped market wins', async () => {
    const { change, finish } = deferredChange();
    installSalla(change);
    mount(<Tabs />);

    fireEvent.click(await screen.findByRole('button', { name: 'السوق' }));
    await waitFor(() => expect(change).toHaveBeenCalledWith({ id: 2 }));
    fireEvent.click(screen.getByRole('button', { name: 'سريع' }));
    expect(change).toHaveBeenCalledOnce();

    finish(0);
    await waitFor(() => expect(change).toHaveBeenCalledWith({ id: 1 }));
    finish(1);
    await waitFor(() => expect(router.invalidate).toHaveBeenCalledTimes(2));
    expect(active.id).toBe('1');
  });

  it('skips a queued tap that a later tap replaced', async () => {
    const { change, finish } = deferredChange();
    installSalla(change);
    mount(<Tabs />);

    fireEvent.click(await screen.findByRole('button', { name: 'السوق' }));
    await waitFor(() => expect(change).toHaveBeenCalledWith({ id: 2 }));
    fireEvent.click(screen.getByRole('button', { name: 'سريع' }));
    fireEvent.click(screen.getByRole('button', { name: 'السوق' }));

    finish(0);
    await waitFor(() => expect(router.invalidate).toHaveBeenCalledOnce());
    // The store is already on السوق, so neither queued tap calls the SDK again.
    await waitFor(() => expect(change).toHaveBeenCalledOnce());
    expect(active.id).toBe('2');
    expect(screen.getByTestId('markets-tabs-pending').textContent).toBe('false');
  });

  it('clears the pending state when a failed switch leaves the store on the queued market', async () => {
    const { change, fail } = deferredChange();
    installSalla(change);
    mount(<Tabs />);

    fireEvent.click(await screen.findByRole('button', { name: 'السوق' }));
    await waitFor(() => expect(change).toHaveBeenCalledWith({ id: 2 }));
    fireEvent.click(screen.getByRole('button', { name: 'سريع' }));
    fail(0);

    await waitFor(() =>
      expect(screen.getByTestId('markets-tabs-pending').textContent).toBe('false')
    );
    expect(change).toHaveBeenCalledOnce();
    expect(active.id).toBe('1');
  });

  it('shares the pending state with the layout, from the tap until the switch lands', async () => {
    const { change, finish } = deferredChange();
    installSalla(change);
    function Layout() {
      return (
        <output data-testid="market-layout-pending">{String(useMarketSwitchPending())}</output>
      );
    }
    mount(
      <>
        <MarketSwitcher />
        <Layout />
      </>
    );
    expect(screen.getByTestId('market-layout-pending').textContent).toBe('false');

    fireEvent.click(await screen.findByRole('button', { name: 'السوق' }));
    await waitFor(() =>
      expect(screen.getByTestId('market-layout-pending').textContent).toBe('true')
    );

    finish(0);
    await waitFor(() =>
      expect(screen.getByTestId('market-layout-pending').textContent).toBe('false')
    );
  });
});

describe('hrefWithMarket', () => {
  it('adds the market to a URL that names none', () => {
    expect(hrefWithMarket('/ar', 5)).toBe('/ar?scope=5');
  });

  it('keeps the rest of the query and the hash', () => {
    expect(hrefWithMarket('/ar/search?q=milk#results', 5)).toBe(
      '/ar/search?q=milk&scope=5#results'
    );
  });
});
