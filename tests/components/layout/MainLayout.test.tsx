import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { MainLayout } from '../../../app/components/layout/MainLayout';
import { ThankYouRedirect } from '../../../app/routes/thankyou.$orderId';
import {
  closeOrderDrawer,
  openOrderDrawer,
  openOrderDrawerOnArrival,
  useOrderDrawerId,
} from '../../../app/hooks/useOrderDrawer';
import { openFiltersDrawer, useFiltersDrawerOpen } from '../../../app/hooks/useFiltersDrawer';

let mockRouteId = '/{-$locale}/';
let mockLoggedIn = true;
let mockPathname = '/';
const navigate = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => options,
  useNavigate: () => navigate,
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({
      matches: [{ routeId: mockRouteId }],
      location: { hash: '' },
    }),
  useRouter: () => ({ navigate: vi.fn(), history: { canGoBack: () => true, back: vi.fn() } }),
}));

vi.mock('@salla.sa/twilight-theme-engine', () => ({
  useTwilight: () => ({ store: { settings: { auth: {} } } }),
}));

vi.mock('@salla.sa/twilight-theme-engine/providers', () => ({
  useLocation: () => ({ pathname: mockPathname }),
  useTwilight: () => ({ store: { settings: { auth: {} } } }),
}));

vi.mock('@salla.sa/twilight-theme-engine/api/order', () => ({
  order: { find: vi.fn(async () => ({ order: { id: 42 } })) },
}));

vi.mock('@salla.sa/twilight-theme-engine/api/client', () => ({ getAuthToken: () => 'jwt' }));

vi.mock('../../../app/hooks/useIsWebDesktop', () => ({
  isWebDesktop: () => true,
  useIsWebDesktop: () => true,
}));

vi.mock('@salla.sa/twilight-theme-engine/hooks/useUser', () => ({
  useUser: () => ({ isLoggedIn: mockLoggedIn }),
}));

vi.mock('@salla.sa/twilight-components-react/offer-modal', () => ({
  SallaOfferModal: () => null,
}));

vi.mock('@salla.sa/twilight-components-react/login-modal', () => ({
  SallaLoginModal: () => null,
}));

vi.mock('@salla.sa/twilight-components-react/scopes', () => ({
  SallaScopes: () => null,
}));

vi.mock('@salla.sa/twilight-theme-engine/layout', () => ({
  PageAdvertisements: () => <div data-testid="layout-announcement-bar" />,
}));

vi.mock('../../../app/components/product/ProductSheet', () => ({
  ProductSheet: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="product-sheet">{children}</div>
  ),
  ProductSheetOverlay: ({ id }: { id: string }) => <div data-testid="product-sheet">{id}</div>,
}));

vi.mock('../../../app/components/BottomNav', () => ({
  BottomNav: () => <nav data-testid="bottom-nav" />,
}));

vi.mock('../../../app/components/cart/CartBar', () => ({
  CartAddedBar: () => <div data-testid="cart-dock" />,
}));

vi.mock('../../../app/components/layout/PullToRefresh', () => ({
  PullToRefresh: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pull-to-refresh">{children}</div>
  ),
}));

vi.mock('../../../app/components/layout/RouteGestureTransition', () => ({
  RouteGestureTransition: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="route-gesture">{children}</div>
  ),
}));

vi.mock('../../../app/components/layout/SiteHeader', () => ({
  SiteHeader: () => <header data-testid="site-header" />,
}));

let mockSwitching = false;
vi.mock('../../../app/components/layout/MarketSwitcher', () => ({
  MarketSwitcher: () => null,
  useMarketSwitchPending: () => mockSwitching,
}));

vi.mock('../../../app/components/home/placeholders', () => ({
  HomeSkeleton: () => <div data-testid="market-skeleton-loading" />,
}));

vi.mock('../../../app/components/layout/DesktopHeader', () => ({
  DesktopHeader: () => <header data-testid="desktop-header" />,
}));

vi.mock('../../../app/components/layout/LocalizationModal', () => ({
  LocalizationModal: () => null,
}));

vi.mock('../../../app/components/cart/CartDrawer', () => ({
  CartDrawer: () => <div data-testid="cart-drawer" />,
}));

vi.mock('../../../app/components/layout/DesktopFooter', () => ({
  DesktopFooter: () => <footer data-testid="desktop-footer" />,
}));

vi.mock('../../../app/components/orders/tracking/OrderTrackingBanner', () => ({
  OrderTrackingBanner: () => <div data-testid="home-order-banner" />,
}));

vi.mock('../../../app/components/orders/tracking/OrderDrawer', () => ({
  OrderDrawer: ({ id }: { id: string }) => <div data-testid="order-drawer">{id}</div>,
}));

beforeEach(() => {
  mockRouteId = '/{-$locale}/';
  mockLoggedIn = true;
  mockPathname = '/';
  mockSwitching = false;
  HTMLElement.prototype.scrollTo = vi.fn();
});

async function renderLayout(children: React.ReactNode) {
  const view = render(<MainLayout>{children}</MainLayout>);
  await act(async () => {});
  return view;
}

describe('MainLayout', () => {
  it('renders a fluid app-shell with the mobile chrome in the default markup', async () => {
    const view = await renderLayout('home');
    const shell = view.container.querySelector('.app-inner');
    expect(shell?.className).not.toContain('max-w-[480px]');
    expect(view.getByTestId('desktop-header')).toBeTruthy();
    expect(view.getByTestId('desktop-footer')).toBeTruthy();
    expect(view.getByTestId('bottom-nav')).toBeTruthy();
    // The engine's server-rendered ad bar, directly above the home header.
    expect(
      view
        .getByTestId('layout-announcement-bar')
        .compareDocumentPosition(view.getByTestId('site-header')) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(view.container.querySelector('#main-content')?.className).toContain('app-main--home');
    view.unmount();

    mockRouteId = '/{-$locale}/cart';
    const cart = await renderLayout('cart');
    expect(cart.container.querySelector('#main-content')?.className).not.toContain(
      'app-main--home'
    );
    cart.unmount();
    mockRouteId = '/{-$locale}/';
  });

  it('pins SiteHeader on the homepage and leaves inner screens to render their own header', async () => {
    const home = await renderLayout('home');
    expect(home.getByTestId('site-header')).toBeTruthy();
    expect(await home.findByTestId('home-order-banner')).toBeTruthy();
    expect(home.queryByTestId('cart-dock')).toBeNull();
    home.unmount();

    mockRouteId = '/{-$locale}/cart';
    const cart = await renderLayout('cart');
    expect(cart.queryByTestId('site-header')).toBeNull();
    expect(cart.queryByTestId('home-order-banner')).toBeNull();
    expect(cart.getByTestId('cart-dock')).toBeTruthy();
    cart.unmount();

    mockRouteId = '/{-$locale}/account/orders';
    const orders = await renderLayout('orders');
    expect(orders.queryByTestId('site-header')).toBeNull();
    expect(await orders.findByTestId('home-order-banner')).toBeTruthy();
    orders.unmount();

    mockRouteId = '/{-$locale}/account/orders/$id';
    const orderDetails = await renderLayout('order-details');
    expect(orderDetails.queryByTestId('home-order-banner')).toBeNull();
    orderDetails.unmount();

    mockRouteId = '/{-$locale}/';
    const backHome = await renderLayout('home');
    expect(backHome.getByTestId('site-header')).toBeTruthy();
    backHome.unmount();

    mockLoggedIn = false;
    const guestHome = await renderLayout('home');
    expect(guestHome.queryByTestId('home-order-banner')).toBeNull();
    expect(guestHome.queryByTestId('cart-dock')).toBeNull();
  });
});

describe('MainLayout bottom docks', () => {
  it('puts the cart bar and the tracking banner in one dock so desktop can stack them', async () => {
    mockRouteId = '/{-$locale}/account/orders';
    const view = await renderLayout('orders');
    const dock = view.container.querySelector('.bottom-docks');
    expect(dock?.className).toContain('contents');
    expect(dock?.contains(view.getByTestId('cart-dock'))).toBe(true);
    expect(dock?.contains(await view.findByTestId('home-order-banner'))).toBe(true);
  });
});

describe('MainLayout drawers', () => {
  it('makes the shell inert while a drawer is open and closes it on navigation', async () => {
    const view = await renderLayout('home');
    const shell = view.container.querySelector('.app-inner') as HTMLElement;
    expect(shell.hasAttribute('inert')).toBe(false);

    await act(async () => openOrderDrawer(42));
    expect((await view.findByTestId('order-drawer')).textContent).toBe('42');
    expect(shell.hasAttribute('inert')).toBe(true);

    mockPathname = '/milk/p10';
    view.rerender(<MainLayout>home</MainLayout>);
    await act(async () => {});
    expect(renderHook(() => useOrderDrawerId()).result.current).toBeNull();
    expect(shell.hasAttribute('inert')).toBe(false);
    expect(view.queryByTestId('order-drawer')).toBeNull();
  });

  it('makes the shell inert while the filters drawer is open and closes it on navigation', async () => {
    const view = await renderLayout('home');
    const shell = view.container.querySelector('.app-inner') as HTMLElement;

    await act(async () => openFiltersDrawer());
    expect(shell.hasAttribute('inert')).toBe(true);

    mockPathname = '/milk/c10';
    view.rerender(<MainLayout>home</MainLayout>);
    await act(async () => {});
    expect(renderHook(() => useFiltersDrawerOpen()).result.current).toBe(false);
    expect(shell.hasAttribute('inert')).toBe(false);
  });
});

describe('MainLayout queued order drawer', () => {
  it('opens the drawer when the thank-you route hands off to the home page', async () => {
    mockPathname = '/thankyou/ENZWrjY';
    navigate.mockImplementation(({ to }: { to: string }) => {
      mockPathname = to;
    });
    const view = await renderLayout(<ThankYouRedirect orderId="ENZWrjY" />);
    expect(view.queryByTestId('order-drawer')).toBeNull();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/', replace: true }));
    view.rerender(<MainLayout>home</MainLayout>);
    expect((await view.findByTestId('order-drawer')).textContent).toBe('42');
  });

  it('opens a queued order drawer once on arrival and not again on the next render', async () => {
    mockPathname = '/';
    openOrderDrawerOnArrival(42);
    const view = await renderLayout('home');
    expect((await view.findByTestId('order-drawer')).textContent).toBe('42');

    await act(async () => closeOrderDrawer());
    mockPathname = '/ar';
    view.rerender(<MainLayout>home</MainLayout>);
    await act(async () => {});
    expect(view.queryByTestId('order-drawer')).toBeNull();
  });
});

describe('MainLayout native gestures', () => {
  it('mounts pull-to-refresh and swipe navigation only inside the native app', async () => {
    const web = await renderLayout('page');
    expect(web.queryByTestId('pull-to-refresh')).toBeNull();
    expect(web.queryByTestId('route-gesture')).toBeNull();
    web.unmount();

    // An event bus is what tells the engine the SDK has loaded, not the head stub.
    window.salla = {
      mobile: { isEnabled: () => true },
      event: { on: () => {}, off: () => {} },
    } as unknown as typeof window.salla;
    try {
      const native = await renderLayout('page');
      expect(native.getByTestId('pull-to-refresh')).toBeTruthy();
      expect(native.getByTestId('route-gesture')).toBeTruthy();
    } finally {
      delete (window as { salla?: unknown }).salla;
    }
  });

  it('swaps the page for the home skeleton while a market switch is pending', async () => {
    mockRouteId = '/{-$locale}/cart';
    mockSwitching = true;
    const view = await renderLayout('cart');
    expect(view.getByTestId('market-skeleton-loading')).toBeTruthy();
    expect(view.queryByText('cart')).toBeNull();
    expect(view.container.querySelector('#main-content')?.className).toContain('app-main--home');
    view.unmount();

    mockSwitching = false;
    const landed = await renderLayout('cart');
    expect(landed.queryByTestId('market-skeleton-loading')).toBeNull();
    expect(landed.getByText('cart')).toBeTruthy();
    landed.unmount();
  });
});
