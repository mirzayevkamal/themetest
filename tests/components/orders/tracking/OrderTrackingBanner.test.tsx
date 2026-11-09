import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderTrackingBanner } from '../../../../app/components/orders/tracking/OrderTrackingBanner';
import { ACTIVE_ORDER_STATUS } from '../../../../app/components/orders/tracking/phase';
import { closeOrderDrawer, useOrderDrawerId } from '../../../../app/hooks/useOrderDrawer';

const api = vi.hoisted(() => ({
  loggedIn: true,
  orders: [] as { id: number; status: { slug: string; name: string } }[],
  listCalls: 0,
  listParams: undefined as unknown,
  bullet: true,
  desktop: false,
}));

vi.mock('../../../../app/hooks/useIsWebDesktop', () => ({
  isWebDesktop: () => api.desktop,
}));

vi.mock('@salla.sa/twilight-theme-engine/providers', () => ({
  useTwilight: () => ({
    store: {
      features: ['bullet-delivery-v2'],
      settings: { bullet_delivery: { enabled: api.bullet } },
      scope: { display_as: 'delivery_pickup' },
    },
  }),
}));
vi.mock('@salla.sa/twilight-theme-engine/api/client', () => ({
  api: { get: () => ({ json: async () => ({ data: [] }) }) },
}));
vi.mock('@salla.sa/twilight-theme-engine/api/order', () => ({
  order: {
    list: async (params: unknown) => {
      api.listCalls += 1;
      api.listParams = params;
      return { data: api.orders };
    },
  },
}));
vi.mock('@salla.sa/twilight-theme-engine/hooks/useUser', () => ({
  useUser: () => ({ isLoggedIn: api.loggedIn }),
}));
vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, vars?: Record<string, unknown>) =>
      (fallback ?? key).replace(/{{(\w+)}}/g, (_m, k: string) => String(vars?.[k] ?? _m)),
    locale: 'ar',
  }),
}));
vi.mock('@salla.sa/twilight-theme-engine/common', () => ({
  Link: ({
    to,
    children,
    className,
    onClick,
  }: {
    to: string;
    children: unknown;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  }) => (
    <a href={to} className={className} onClick={onClick}>
      {children as React.ReactNode}
    </a>
  ),
}));

const inProgress = {
  id: 42,
  status: { slug: 'in_progress', name: 'جاري التحضير' },
  items: [
    { name: 'Milk', thumbnail: '/milk.webp', quantity: 2 },
    { name: 'Bread', thumbnail: '/bread.webp', quantity: 1 },
  ],
};

function renderBanner() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OrderTrackingBanner />
    </QueryClientProvider>
  );
}

describe('OrderTrackingBanner', () => {
  beforeEach(() => {
    api.loggedIn = true;
    api.orders = [inProgress];
    api.listCalls = 0;
    api.listParams = undefined;
    api.bullet = true;
    api.desktop = false;
    closeOrderDrawer();
  });

  it('opens the tracking drawer instead of the order route on web desktop', async () => {
    const { container } = renderBanner();
    await waitFor(() => expect(container.querySelector('a')).toBeTruthy());
    const link = container.querySelector('a') as HTMLAnchorElement;
    const drawer = renderHook(() => useOrderDrawerId());

    expect(fireEvent.click(link)).toBe(true);
    expect(drawer.result.current).toBeNull();

    api.desktop = true;
    expect(fireEvent.click(link, { metaKey: true })).toBe(true);
    expect(drawer.result.current).toBeNull();

    expect(fireEvent.click(link)).toBe(false);
    expect(drawer.result.current).toBe('42');
  });

  it('does not fetch in a market with Bullet Delivery off, even one shown as delivery_pickup, or for a guest', async () => {
    api.bullet = false;
    const off = renderBanner();
    await new Promise((r) => setTimeout(r, 0));
    expect(off.container.innerHTML).toBe('');
    expect(api.listCalls).toBe(0);
    off.unmount();

    api.bullet = true;
    api.loggedIn = false;
    const guest = renderBanner();
    await new Promise((r) => setTimeout(r, 0));
    expect(guest.container.innerHTML).toBe('');
    expect(api.listCalls).toBe(0);
  });

  it('paints the card, basket and progress in the store brand, not a fixed mint', async () => {
    const { container } = renderBanner();
    await waitFor(() =>
      expect(container.querySelector('.order-tracking-banner__card')).toBeTruthy()
    );
    expect(container.querySelector('.order-tracking-banner__card')?.className).toContain(
      'border-brand'
    );
    expect(container.innerHTML).not.toMatch(/mint-(dark|tint)/);
    expect(container.querySelector('.bg-brand')).toBeTruthy();
  });

  it('shows the newest in-progress order and reads products from the list', async () => {
    const { container } = renderBanner();
    await waitFor(() =>
      expect(container.querySelector('a')?.getAttribute('href')).toBe('/account/orders/42')
    );
    expect(api.listParams).toEqual({ status: ACTIVE_ORDER_STATUS, with_items: 1 });
    await waitFor(() => expect(container.textContent).toContain('3'));
    expect(container.textContent).not.toContain('يوصلك الساعة');
    expect(container.textContent).toContain('جاري التحضير');
    expect(container.textContent).toContain('بنحضرلك طلبك بدقة وعناية...');
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/milk.webp');
  });

  it('pins an under_review order and skips completed ones from the same list', async () => {
    api.orders = [
      { id: 7, status: { slug: 'completed', name: 'تم التنفيذ' } },
      { id: 8, status: { slug: 'under_review', name: 'بإنتظار المراجعة' } },
    ];
    const { container } = renderBanner();
    await waitFor(() =>
      expect(container.querySelector('a')?.getAttribute('href')).toBe('/account/orders/8')
    );
    expect(container.textContent).toContain('بإنتظار المراجعة');
    expect(container.textContent).toContain('بنحضرلك طلبك بدقة وعناية...');
    expect(container.textContent).not.toContain('طلبك قيد التنفيذ...');
  });

  it('stacks the three newest in-flight orders with the newest in front', async () => {
    api.orders = [5, 4, 3, 2].map((id) => ({
      id,
      status: { slug: 'in_progress', name: 'جاري التحضير' },
    }));
    const { container } = renderBanner();
    await waitFor(() => expect(container.querySelectorAll('a')).toHaveLength(3));
    const hrefs = [...container.querySelectorAll('a')].map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['/account/orders/3', '/account/orders/4', '/account/orders/5']);
    const peeking = [...container.querySelectorAll('.order-tracking-banner__peek a')];
    expect(peeking.map((link) => link.getAttribute('href'))).toEqual([
      '/account/orders/3',
      '/account/orders/4',
    ]);
  });

  it('shows only the newest order on a short viewport', async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('max-height'),
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
    api.orders = [5, 4, 3].map((id) => ({
      id,
      status: { slug: 'in_progress', name: 'جاري التحضير' },
    }));
    try {
      const { container } = renderBanner();
      await waitFor(() => expect(container.querySelector('a')).toBeTruthy());
      await new Promise((r) => setTimeout(r, 0));
      const hrefs = [...container.querySelectorAll('a')].map((link) => link.getAttribute('href'));
      expect(hrefs).toEqual(['/account/orders/5']);
    } finally {
      window.matchMedia = original;
    }
  });

  it('shows nothing when there is no in-progress order', async () => {
    api.orders = [];
    const empty = renderBanner();
    await waitFor(() => expect(api.listCalls).toBe(1));
    expect(empty.container.innerHTML).toBe('');
    empty.unmount();

    api.orders = [{ id: 1, status: { slug: 'delivered', name: 'تم التوصيل' } }];
    const settled = renderBanner();
    await waitFor(() => expect(api.listCalls).toBe(2));
    expect(settled.container.innerHTML).toBe('');
  });
});
