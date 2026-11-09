import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, fireEvent, screen } from '@testing-library/react';
import { BottomNav } from '../../app/components/BottomNav';
import { clearCartStore, resetCartStoreForTests } from '../../app/components/cart/useCart';

let mockRouteId = '/{-$locale}/';
let mockStore = {
  name: 'الدكان',
  icon: 'https://cdn.example.com/logo.png' as string | null,
};

const navigate = vi.hoisted(() => vi.fn());
const location = vi.hoisted(() => ({ href: '/cart' }));

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ navigate, state: { location } }),
  useRouterState: ({ select }: { select: (s: unknown) => string }) =>
    select({
      matches: [{ routeId: mockRouteId }],
    }),
}));

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock('@salla.sa/twilight-theme-engine/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@salla.sa/twilight-theme-engine/common')>();
  return {
    ...actual,
    Link: ({
      to,
      children,
      className,
      onClick,
    }: React.PropsWithChildren<{
      to: string;
      className?: string;
      onClick?: (event: React.MouseEvent) => void;
    }>) => (
      // Like TanStack's Link, a click something else already cancelled skips onClick.
      <a
        href={to}
        className={className}
        onClick={(event) => {
          if (!event.defaultPrevented) onClick?.(event);
        }}
      >
        {children}
      </a>
    ),
  };
});

vi.mock('@salla.sa/twilight-theme-engine/hooks/useStore', () => ({
  useStore: () => mockStore,
}));

const markets = vi.hoisted(() => ({
  list: [] as { id: number; name: string }[],
  activeId: '1',
  switchTo: vi.fn(),
}));

vi.mock('../../app/components/layout/MarketSwitcher', async (importOriginal) => ({
  hrefWithMarket: (
    await importOriginal<typeof import('../../app/components/layout/MarketSwitcher')>()
  ).hrefWithMarket,
  useMarkets: () => ({
    markets: markets.list,
    activeId: markets.activeId,
    switchTo: markets.switchTo,
  }),
}));

let cartCount = 0;
const eventHandlers: Record<string, (data: unknown) => void> = {};

beforeEach(() => {
  resetCartStoreForTests();
  mockRouteId = '/{-$locale}/';
  mockStore = { name: 'الدكان', icon: 'https://cdn.example.com/logo.png' };
  cartCount = 0;
  markets.list = [];
  markets.activeId = '1';
  markets.switchTo.mockReset();
  navigate.mockReset();
  location.href = '/cart';
  (window as unknown as { salla: unknown }).salla = {
    storage: {
      get: (key: string) => (key === 'cart.summary.count' ? cartCount : undefined),
    },
    event: {
      on: (name: string, handler: (data: unknown) => void) => {
        eventHandlers[name] = handler;
      },
      off: () => {},
    },
  };
});

function activeHref(container: HTMLElement) {
  return container.querySelector('a.font-bold')?.getAttribute('href');
}

describe('BottomNav', () => {
  it('serves the store icon at 2x and 3x for high-density phones', () => {
    mockStore = { name: 'الدكان', icon: 'https://cdn.salla.sa/other/icon.png' };
    const img = render(<BottomNav />).container.querySelector('nav img');
    expect(img?.getAttribute('sizes')).toBe('24px');
    expect(img?.getAttribute('srcset')).toMatch(/width=72\b[^,]* 72w/);
  });

  it('marks the tab matching the current route as active', () => {
    expect(activeHref(render(<BottomNav />).container)).toBe('/');

    mockRouteId = '/{-$locale}/cart';
    expect(activeHref(render(<BottomNav />).container)).toBe('/cart');

    mockRouteId = '/{-$locale}/account/orders/$id';
    expect(activeHref(render(<BottomNav />).container)).toBe('/account/orders');

    mockRouteId = '/{-$locale}/pending-orders';
    expect(activeHref(render(<BottomNav />).container)).toBe('/account/orders');

    mockRouteId = '/{-$locale}/account/profile';
    expect(activeHref(render(<BottomNav />).container)).toBe('/account/profile');

    mockRouteId = '/{-$locale}/account/wishlist';
    expect(activeHref(render(<BottomNav />).container)).toBe('/account/profile');
  });

  it('sits only the active tab in a shadowed pill', () => {
    const { container } = render(<BottomNav />);
    const pills = container.querySelectorAll('a.bg-neutral-100.shadow-light');
    expect(pills).toHaveLength(1);
    expect(pills[0].getAttribute('href')).toBe(activeHref(container));
  });

  it('paints only the active tab icon in the brand color', () => {
    mockRouteId = '/{-$locale}/cart';
    const { container } = render(<BottomNav />);
    const branded = container.querySelectorAll('nav .text-brand');
    expect(branded).toHaveLength(1);
    expect(branded[0].closest('a')?.getAttribute('href')).toBe('/cart');
  });

  it('shows the cart badge only when the cart has items, updating on cart events', () => {
    cartCount = 8;
    const { container } = render(<BottomNav />);
    expect(container.textContent).toContain('8');

    // cart::updated carries the count directly
    act(() => eventHandlers['cart::updated']?.({ count: 0 }));
    expect(container.textContent).not.toContain('8');

    act(() => eventHandlers['cart::updated']?.({ count: 3 }));
    expect(container.textContent).toContain('3');

    // fetch-shaped events nest it under data.cart
    act(() => eventHandlers['cart::latest.fetched']?.({ data: { cart: { count: 5 } } }));
    expect(container.textContent).toContain('5');

    // payload without a count falls back to storage
    cartCount = 2;
    act(() => eventHandlers['cart::updated']?.({}));
    expect(container.textContent).toContain('2');
  });

  it('drops the badge when a market switch clears the cart store', () => {
    cartCount = 8;
    const { container } = render(<BottomNav />);
    expect(container.textContent).toContain('8');

    act(() => clearCartStore());
    expect(container.textContent).not.toContain('8');
  });

  it("ignores the previous market's details() reply that lands after the clear", async () => {
    let oldReply!: (value: unknown) => void;
    const details = vi
      .fn()
      .mockReturnValueOnce(new Promise((resolve) => (oldReply = resolve)))
      .mockResolvedValueOnce({ data: { cart: { count: 0, items: [] } } });
    Object.assign(window.salla as object, {
      onReady: (cb?: () => unknown) => cb?.(),
      cart: { api: { details } },
    });
    const { container } = render(<BottomNav />);

    act(() => clearCartStore());
    await act(async () => oldReply({ data: { cart: { count: 8, items: [{ id: 1 }] } } }));
    expect(details).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain('8');
  });

  it('clears a stale storage badge once details() reports no cart', async () => {
    cartCount = 8;
    const details = vi.fn().mockResolvedValue({ events: {} });
    Object.assign(window.salla as object, {
      onReady: (cb?: () => unknown) => {
        cb?.();
        return Promise.resolve();
      },
      cart: { api: { details } },
    });
    const { container } = render(<BottomNav />);
    expect(container.textContent).toContain('8');
    await act(async () => {});
    expect(container.textContent).not.toContain('8');
  });

  it('uses the store logo and name for the home tab', () => {
    const { container } = render(<BottomNav />);
    const homeTab = container.querySelector('a[href="/"]');
    const homeIcon = homeTab?.querySelector('img');
    expect(homeIcon?.getAttribute('src')).toBe('https://cdn.example.com/logo.png');
    expect(homeIcon?.getAttribute('width')).toBe('24');
    expect(homeIcon?.getAttribute('height')).toBe('24');
    expect(homeTab?.textContent).toContain('الدكان');
  });

  it('uses a home icon when the store has no icon', () => {
    mockStore = { name: 'الدكان', icon: null };

    const { container } = render(<BottomNav />);
    const homeTab = container.querySelector('a[href="/"]');
    const cartTab = container.querySelector('a[href="/cart"]');
    const homeIconPath = homeTab?.querySelector('svg path')?.getAttribute('d');
    const cartIconPath = cartTab?.querySelector('svg path')?.getAttribute('d');

    expect(homeTab?.querySelector('img')).toBeNull();
    expect(homeIconPath).toBeTruthy();
    expect(homeIconPath).not.toBe(cartIconPath);
  });

  it('gives each market its own home tab, active on home only, and switches on tap', () => {
    markets.list = [
      { id: 1, name: 'مقاضي' },
      { id: 2, name: 'الكترونيات' },
    ];
    const view = render(<BottomNav />);

    expect(screen.queryByText('الدكان')).toBeNull();
    expect(screen.getByText('مقاضي').closest('a')?.className).toContain('font-bold');
    expect(screen.getByText('الكترونيات').closest('button')?.className).not.toContain('font-bold');

    view.unmount();

    mockRouteId = '/{-$locale}/cart';
    render(<BottomNav />);
    expect(screen.getByText('مقاضي').closest('a')?.className).not.toContain('font-bold');
  });

  it("switches even when the engine's document link handler cancels link clicks", () => {
    markets.list = [
      { id: 1, name: 'مقاضي' },
      { id: 2, name: 'الكترونيات' },
    ];
    markets.switchTo.mockResolvedValueOnce(true);
    // On the store's own domain the engine takes over every <a> click in the capture phase.
    const takeOver = (event: MouseEvent) => {
      if ((event.target as Element).closest('a')) event.preventDefault();
    };
    document.addEventListener('click', takeOver, { capture: true });
    try {
      render(<BottomNav />);
      fireEvent.click(screen.getByText('الكترونيات'));
      expect(markets.switchTo).toHaveBeenCalledWith(markets.list[1]);
    } finally {
      document.removeEventListener('click', takeOver, { capture: true });
    }
  });

  it('goes home only after the switch lands, and stays put when it fails', async () => {
    markets.list = [
      { id: 1, name: 'مقاضي' },
      { id: 2, name: 'الكترونيات' },
    ];
    mockRouteId = '/{-$locale}/cart';
    markets.switchTo.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const view = render(<BottomNav />);
    const other = screen.getByText('الكترونيات').closest('button')!;

    fireEvent.click(other);
    await act(async () => {});
    expect(markets.switchTo).toHaveBeenCalledWith(markets.list[1]);
    expect(navigate).not.toHaveBeenCalled();

    fireEvent.click(other);
    await act(async () => {});
    expect(navigate).toHaveBeenCalledWith({ to: '/' });

    // A shopper who moved on while the switch was pending is not pulled back home.
    markets.switchTo.mockResolvedValueOnce(true);
    fireEvent.click(other);
    location.href = '/account/orders';
    await act(async () => {});
    expect(navigate).toHaveBeenCalledOnce();

    // The switch put the new market in this page's URL: still here, so home it is.
    location.href = '/cart';
    markets.switchTo.mockImplementationOnce(async () => {
      location.href = '/cart?scope=2';
      return true;
    });
    fireEvent.click(other);
    await act(async () => {});
    expect(navigate).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenLastCalledWith({ to: '/' });

    // On home the switch reloads it; another navigation would drop that reload.
    view.unmount();
    mockRouteId = '/{-$locale}/';
    location.href = '/ar';
    markets.switchTo.mockResolvedValueOnce(true);
    render(<BottomNav />);
    fireEvent.click(screen.getByText('الكترونيات').closest('button')!);
    await act(async () => {});
    expect(markets.switchTo).toHaveBeenCalledTimes(5);
    expect(navigate).toHaveBeenCalledTimes(2);

    // The current market's tab is a plain home link.
    expect(fireEvent.click(screen.getByText('مقاضي').closest('a')!)).toBe(true);
    expect(markets.switchTo).toHaveBeenCalledTimes(5);
  });
});
