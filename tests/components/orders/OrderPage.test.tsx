import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderPage, orderAddress } from '../../../app/components/orders/OrderPage';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({}),
  useRouterState: ({
    select,
  }: {
    select: (s: { matches: { routeId: string }[]; location: { hash: string } }) => unknown;
  }) =>
    select({
      matches: [{ routeId: '/{-$locale}/account/orders/$id' }],
      location: { hash: '' },
    }),
  useRouter: () => ({
    history: { back: vi.fn(), canGoBack: () => true },
    navigate,
    invalidate: vi.fn(),
    state: { location: { hash: '' } },
  }),
}));

const api = vi.hoisted(() => ({
  find: vi.fn(),
  get: vi.fn(),
  products: vi.fn(),
}));
vi.mock('@salla.sa/twilight-theme-engine/api/client', () => ({
  api: { get: (url: string) => ({ json: () => api.get(url) }) },
}));
vi.mock('@salla.sa/twilight-theme-engine/api/product', () => ({
  rememberProductPreview: vi.fn(),
  product: {
    queries: {
      list: (params: object) => ({
        queryKey: ['products', 'search', params],
        queryFn: () => api.products(params),
      }),
    },
  },
}));
vi.mock('@salla.sa/twilight-theme-engine/api/order', () => ({
  order: {
    find: (id: string) => api.find(id),
    queries: {
      find: (id: string) => ({
        queryKey: ['orders', 'detail', id],
        queryFn: () => api.find(id),
      }),
    },
  },
}));
vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, vars?: Record<string, unknown>) =>
      (fallback ?? key).replace(/{{(\w+)}}/g, (_m, k: string) => String(vars?.[k] ?? _m)),
    locale: 'ar',
  }),
}));
vi.mock('@salla.sa/twilight-theme-engine/common', () => ({
  Link: ({ to, children, className }: { to: string; children: unknown; className?: string }) => (
    <a href={to} className={className}>
      {children as React.ReactNode}
    </a>
  ),
}));
vi.mock('@salla.sa/twilight-theme-engine/hooks/useMoney', () => ({
  useMoney: () => ({ format: (n: number) => `${n} SAR` }),
}));
const bullet = vi.hoisted(() => ({ enabled: true }));
vi.mock('@salla.sa/twilight-theme-engine/providers', () => ({
  useTwilight: () => ({
    store: {
      features: ['bullet-delivery-v2'],
      settings: { bullet_delivery: bullet },
      scope: { display_as: 'delivery_pickup' },
    },
  }),
}));
vi.mock('@salla.sa/twilight-components-react/rating-modal', () => ({
  SallaRatingModal: () => null,
}));
// Account sidebar dependencies.
vi.mock('@salla.sa/twilight-theme-engine', () => ({
  useTwilight: () => ({ store: { id: 42 } }),
}));
vi.mock('@salla.sa/twilight-theme-engine/routes/account', () => ({
  Wallet: { loader: vi.fn().mockResolvedValue({ balance: 15, transactions: [], pagination: {} }) },
}));
vi.mock('../../../app/components/product/AddToCartStepper', () => ({
  ProductLineStepper: ({ productId }: { productId: number }) => (
    <button data-testid={`add-${productId}`}>+</button>
  ),
}));

const money = (amount: number) => ({ amount, currency: 'SAR' });

function details(
  slug: string,
  extra: Record<string, unknown> = {},
  line: Record<string, unknown> = {}
) {
  return {
    id: 1,
    reference_id: 100,
    status: { name: slug, slug },
    actions: {
      cancellable: false,
      payable: false,
      reorderable: true,
      rateable: slug === 'delivered',
    },
    payment: { method: 'card' },
    amounts: { sub_total: money(10), total: money(25), shipping_cost: money(0), discounts: [] },
    items: [
      {
        id: 9,
        name: 'Milk',
        thumbnail: '/milk.webp',
        quantity: 2,
        product: { id: 10, url: '/milk/p10' },
        amounts: { total: money(10), original_price: money(10) },
        ...line,
      },
    ],
    ...extra,
  } as never;
}

function renderPage(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('OrderPage', () => {
  beforeEach(() => {
    navigate.mockReset();
    api.find.mockReset();
    api.find.mockResolvedValue({ order: details('delivered') });
    api.get.mockReset();
    api.get.mockResolvedValue({ data: [] });
    api.products.mockReset();
    api.products.mockResolvedValue({ items: [] });
  });

  it('renders order-details items and total, and opens the product sheet', () => {
    const order = details('delivered');
    const { getByTestId, container, getByRole } = renderPage(
      <OrderPage page={{} as never} order={order} />
    );
    expect(container.textContent).toContain('Milk');
    expect(container.textContent).toContain('25');
    fireEvent.click(getByRole('button', { name: /Milk/ }));
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        hash: '-sheet-10',
        mask: { to: '/milk/p10', unmaskOnReload: true },
      })
    );
    expect(getByTestId('add-10')).toBeTruthy();
  });

  it('opens the product sheet from product_id when the line has no product url', () => {
    const order = details('delivered', {}, { product: undefined, product_id: 1328021726 });
    const { getByRole, getByTestId } = renderPage(<OrderPage page={{} as never} order={order} />);
    fireEvent.click(getByRole('button', { name: /Milk/ }));
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        hash: '-sheet-1328021726',
        mask: { to: '/product/p1328021726', unmaskOnReload: true },
      })
    );
    expect(getByTestId('add-1328021726')).toBeTruthy();
  });

  it('does not guess a product link when search finds nothing', async () => {
    const order = details('delivered', {}, { product: undefined });
    const { container, queryByRole, queryByTestId } = renderPage(
      <OrderPage page={{} as never} order={order} />
    );
    await act(async () => {});
    expect(queryByRole('button', { name: /Milk/ })).toBeNull();
    expect(queryByTestId(/^add-/)).toBeNull();
    expect(container.textContent).toContain('Milk');
  });

  it('opens the product sheet after resolving the line from a name search', async () => {
    api.products.mockResolvedValue({
      items: [{ id: 88, name: 'Milk', url: '/milk/p88' }],
    });
    const order = details('delivered', {}, { product: undefined });
    const { getByRole, getByTestId } = renderPage(<OrderPage page={{} as never} order={order} />);
    await waitFor(() => expect(getByRole('button', { name: /Milk/ })).toBeTruthy());
    expect(getByTestId('add-88')).toBeTruthy();
    fireEvent.click(getByRole('button', { name: /Milk/ }));
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        hash: '-sheet-88',
        mask: { to: '/milk/p88', unmaskOnReload: true },
      })
    );
  });

  it('links an unmatched search result but gives it no cart stepper', async () => {
    api.products.mockResolvedValue({ items: [{ id: 77, name: 'Cheese', url: '/cheese/p77' }] });
    const order = details('delivered', {}, { product: undefined });
    const { getByRole, queryByTestId } = renderPage(<OrderPage page={{} as never} order={order} />);
    await waitFor(() => expect(getByRole('button', { name: /Milk/ })).toBeTruthy());
    expect(queryByTestId(/^add-/)).toBeNull();
  });

  it('tracks under_review as confirmed without treating the slug as the phase copy', () => {
    const order = details('under_review');
    const { container } = renderPage(<OrderPage page={{} as never} order={order} />);
    expect(container.textContent).toContain('under_review');
    expect(container.textContent).toContain('طلبك قيد التنفيذ...');
    expect(container.textContent).not.toContain('تم توصيل طلبك');
  });

  it('does not call a completed order delivered', () => {
    const order = details('completed');
    const { container } = renderPage(<OrderPage page={{} as never} order={order} />);
    expect(container.textContent).toContain('completed');
    expect(container.textContent).toContain('تم تنفيذ طلبك بدقة وعناية');
    expect(container.textContent).not.toContain('تم توصيل طلبك');
    expect(container.textContent).toContain('كرر الطلب');
  });

  it('describes the delivering phase instead of preparing', () => {
    const order = details('delivering', {}, {});
    const { container } = renderPage(<OrderPage page={{} as never} order={order} />);
    expect(container.textContent).toContain('delivering');
    expect(container.textContent).toContain('طلبك جاي بالطريق...');
    expect(container.textContent).toContain('جمعنا طلبك بدقة وعناية وهو بطريقه لك');
    expect(container.textContent).not.toContain('بنحضرلك طلبك بدقة وعناية...');
  });

  it('renders the shipment ETA, embedded live map and driver from the shipments API', async () => {
    api.get.mockResolvedValue({
      data: [
        {
          tracking_url: 'https://carrier.example/track/1',
          tracking_embed_link: 'https://carrier.example/live-map/1',
          estimated_delivery_at: '2026-10-04 15:45:00',
          driver_info: { name: 'سالم', mobile: '+966500000000' },
        },
      ],
    });
    const { container, getByText } = renderPage(
      <OrderPage page={{} as never} order={details('delivering')} />
    );
    await waitFor(() => expect(container.textContent).toContain('يوصلك الساعة'));
    expect(container.textContent).toContain('03:45');
    expect(container.querySelector('iframe')?.getAttribute('src')).toBe(
      'https://carrier.example/live-map/1'
    );
    expect(getByText('سالم')).toBeTruthy();
    expect(container.querySelector('a[href="tel:+966500000000"]')).toBeTruthy();
    expect(container.querySelector('a[href="https://wa.me/966500000000"] svg')).toBeTruthy();
    // The avatar placeholder ships through Vite, not from /images on the store domain.
    const avatar = container.querySelector<HTMLImageElement>('img[src*="driver-placeholder"]');
    expect(avatar?.getAttribute('src')?.startsWith('/images/')).toBe(false);
  });

  it('keeps the map hidden until the delivering stage even when the carrier sent a link', async () => {
    api.get.mockResolvedValue({
      data: [
        {
          tracking_embed_link: 'https://carrier.example/live-map/1',
          driver_info: { name: 'سالم', mobile: '+966500000000' },
        },
      ],
    });
    const { container, getByText } = renderPage(
      <OrderPage page={{} as never} order={details('in_progress')} />
    );
    // The driver card proves the shipment response reached the page before we check the map.
    await waitFor(() => expect(getByText('سالم')).toBeTruthy());
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('shows no ETA and no map until the shipment has an embed link', async () => {
    api.get.mockResolvedValue({
      data: [
        {
          tracking_url: 'https://carrier.example/track/1',
          tracking_embed_link: null,
          estimated_delivery_at: null,
          driver_info: null,
        },
      ],
    });
    const { container } = renderPage(
      <OrderPage page={{} as never} order={details('delivering')} />
    );
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container.textContent).not.toContain('يوصلك الساعة');
    expect(container.querySelector('iframe, img[src*="tracking-map"]')).toBeNull();
    // No empty ETA slot beside the status chip.
    expect(container.querySelector('section .ms-auto')?.parentElement?.childElementCount).toBe(1);
    expect(container.textContent).toContain('لم يتعين مندوب التوصيل');
  });

  it('shows the delivery address from the shipment ship_to when order details have none', async () => {
    api.get.mockResolvedValue({
      data: [
        {
          ship_to: {
            name: 'زائر ',
            address_line: 'ابو رجاء العطاردي, مكة المكرمة, MQ, SA',
            address_line_two: 'ابي عطاردي',
          },
        },
      ],
    });
    const { container } = renderPage(<OrderPage page={{} as never} order={details('completed')} />);
    await waitFor(() => expect(container.textContent).toContain('ابو رجاء العطاردي, مكة المكرمة'));
    expect(container.textContent).toContain('ابي عطاردي');
    expect(container.textContent).toContain('زائر');
  });

  it('still shows the ship_to address in a market without live tracking', async () => {
    bullet.enabled = false;
    api.get.mockResolvedValue({ data: [{ ship_to: { address_line: 'حي العدل، مكة' } }] });
    try {
      const { container } = renderPage(
        <OrderPage page={{} as never} order={details('delivering')} />
      );
      await waitFor(() => expect(container.textContent).toContain('حي العدل، مكة'));
      expect(container.querySelector('iframe')).toBeNull();
    } finally {
      bullet.enabled = true;
    }
  });

  it('falls back to the receiver address when ship_to has no lines', async () => {
    api.get.mockResolvedValue({ data: [{ ship_to: { name: 'مندوب' } }] });
    const order = details('completed', { receiver: { name: 'أحمد', address: 'مكة، العدل' } });
    const { container } = renderPage(<OrderPage page={{} as never} order={order} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    await waitFor(() => expect(container.textContent).toContain('مكة، العدل'));
    expect(container.textContent).toContain('أحمد');
    expect(container.textContent).not.toContain('مندوب');
  });

  it('tells a delivered order how long delivery took from actual_delivered_at', async () => {
    api.get.mockResolvedValue({ data: [{ actual_delivered_at: '2026-10-04 12:25:00' }] });
    const order = details('delivered', { created_at: { date: '2026-10-04 12:00:00.000000' } });
    const { container } = renderPage(<OrderPage page={{} as never} order={order} />);
    await waitFor(() => expect(container.textContent).toContain('25 دقيقة'));
  });

  it('swaps the back control for close inside the drawer', () => {
    const onClose = vi.fn();
    const { getByRole, container } = renderPage(
      <OrderPage order={details('in_progress')} onClose={onClose} />
    );
    expect(container.querySelector('h1#drawer-title')?.textContent).toBe('#100');
    fireEvent.click(getByRole('button', { name: 'إغلاق' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('puts the account sidebar beside the page, but not inside the drawer', () => {
    const page = renderPage(<OrderPage order={details('delivered')} />);
    const sidebar = page.getByRole('navigation', { name: 'حسابي' });
    expect(sidebar.querySelector('a[href="/account/orders"]')).toBeTruthy();
    expect(page.container.querySelector('h1')?.textContent).toBe('#100');
    page.unmount();

    const drawer = renderPage(<OrderPage order={details('delivered')} onClose={vi.fn()} />);
    expect(drawer.queryByRole('navigation', { name: 'حسابي' })).toBeNull();
  });

  it('polls shipments and order details while the order is in progress', async () => {
    vi.useFakeTimers();
    const order = details('in_progress');
    const { queryAllByTestId, container } = renderPage(
      <OrderPage page={{} as never} order={order} />
    );
    expect(queryAllByTestId(/^add-/)).toHaveLength(0);
    expect(container.textContent).not.toContain('يوصلك الساعة');
    expect(container.textContent).toContain('in_progress');
    expect(container.textContent).toContain('بنحضرلك طلبك بدقة وعناية...');
    expect(container.textContent).toContain('تم تأكيد طلبك وجاري العمل على تحضيره بدقة وعناية...');
    expect(container.textContent).toContain('Milk');
    expect(container.textContent).toContain('25');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(api.get).toHaveBeenCalledWith('orders/1/shipments?with_products=true');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(api.find).toHaveBeenCalledWith('1');
    expect(api.get).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

describe('orderAddress', () => {
  it('never pairs the ship_to name with the receiver address', () => {
    expect(orderAddress({ name: 'مندوب' }, { name: 'أحمد', address: 'مكة' })).toEqual({
      name: 'أحمد',
      lines: ['مكة'],
    });
  });

  it('ignores blank ship_to lines and falls back to the receiver', () => {
    expect(orderAddress({ address_line: '  ', address_line_two: '' }, { address: 'مكة' })).toEqual({
      name: undefined,
      lines: ['مكة'],
    });
    expect(orderAddress({ address_line: ' ' }, null)).toBeNull();
  });
});
