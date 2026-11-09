import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrdersPage } from '../../../app/components/orders/OrdersPage';

const invalidate = vi.fn();
const ratingModal = vi.hoisted(() => ({ open: vi.fn(), orderIds: [] as unknown[] }));
vi.mock('@salla.sa/twilight-components-react/rating-modal', () => ({
  SallaRatingModal: React.forwardRef(function SallaRatingModal(
    { orderId }: { orderId?: number },
    ref: React.ForwardedRef<unknown>
  ) {
    ratingModal.orderIds.push(orderId);
    // Stable handle, like a real element: a repeat tap must reuse it, not get a new ref.
    React.useImperativeHandle(ref, () => {
      const el = { orderId, open: ratingModal.open, componentOnReady: () => Promise.resolve(el) };
      return el;
    }, [orderId]);
    return null;
  }),
}));
const navigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    history: { back: vi.fn(), canGoBack: () => true },
    navigate,
    invalidate,
  }),
}));
vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
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
vi.mock('@salla.sa/twilight-theme-engine/hooks/useUser', () => ({
  useUser: () => ({ isLoggedIn: true }),
}));
vi.mock('@salla.sa/twilight-theme-engine/providers', () => ({
  useTwilight: () => ({ theme: { settings: {} } }),
}));

// Sidebar (AccountShell) dependencies.
vi.mock('@salla.sa/twilight-theme-engine', () => ({
  useTwilight: () => ({ store: { id: 42 } }),
}));
vi.mock('@salla.sa/twilight-theme-engine/routes/account', () => ({
  Wallet: { loader: walletLoader },
}));
vi.mock('@salla.sa/twilight-theme-engine/hooks/useMoney', () => ({
  useMoney: () => ({ format: (n: number) => `${n} SAR` }),
}));

const { listOrders, walletLoader } = vi.hoisted(() => ({
  listOrders: vi.fn(),
  walletLoader: vi.fn().mockResolvedValue({ balance: 15, transactions: [], pagination: {} }),
}));
vi.mock('@salla.sa/twilight-theme-engine/api/client', () => ({
  api: { get: () => ({ json: () => Promise.resolve({ data: [] }) }) },
}));
vi.mock('@salla.sa/twilight-theme-engine/api/order', () => ({
  order: {
    list: listOrders,
  },
}));

function order(
  id: number,
  slug: string,
  extra: {
    rateable?: boolean;
    items?: { name: string; quantity: number; thumbnail: string }[];
  } = {}
) {
  return {
    id,
    reference_id: id,
    status: { name: slug, slug },
    actions: {
      cancellable: false,
      payable: false,
      reorderable: true,
      rateable: extra.rateable ?? false,
    },
    created_at: { date: '2026-01-01 12:00:00' },
    items: extra.items,
  } as never;
}

const orders = [
  order(1, 'in_progress', { items: [{ name: 'Milk', quantity: 1, thumbnail: '/milk.webp' }] }),
  order(2, 'delivered', {
    rateable: true,
    items: [{ name: 'Bread', quantity: 1, thumbnail: '/bread.webp' }],
  }),
];

function renderPage(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('OrdersPage', () => {
  beforeEach(() => {
    navigate.mockClear();
    invalidate.mockClear();
    listOrders.mockReset();
    listOrders.mockResolvedValue({ data: [] });
  });

  it('renders a card per order with a details link', () => {
    const { container } = renderPage(<OrdersPage page={{} as never} orders={orders} />);
    expect(container.querySelectorAll('article')).toHaveLength(2);
    expect(container.querySelector('a[href="/account/orders/1"]')).toBeTruthy();
    expect(container.querySelector('a[href="/account/orders/2"]')).toBeTruthy();
  });

  it('opens the rating modal for that order in place, without leaving the list', async () => {
    ratingModal.open.mockClear();
    ratingModal.orderIds.length = 0;
    const { getByText, container } = renderPage(<OrdersPage page={{} as never} orders={orders} />);
    expect(container.querySelector('salla-rating-modal')).toBeNull();
    expect(ratingModal.orderIds).toEqual([]);
    fireEvent.click(getByText('قيم الطلب'));
    await waitFor(() => expect(ratingModal.open).toHaveBeenCalledTimes(1));
    expect(ratingModal.orderIds).toContain(2);
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(getByText('قيم الطلب'));
    await waitFor(() => expect(ratingModal.open).toHaveBeenCalledTimes(2));
    expect(ratingModal.orderIds.filter((id) => id === 2)).toHaveLength(1);
  });

  it('opens details from the card body, not from its action buttons', async () => {
    (window as unknown as { salla: unknown }).salla = {
      onReady: () => Promise.resolve(),
      order: { createCartFromOrder: vi.fn().mockResolvedValue(undefined) },
    };
    const { container } = renderPage(<OrdersPage page={{} as never} orders={orders} />);
    const card = container.querySelector<HTMLElement>('article')!;
    await act(async () => {
      card.querySelector<HTMLElement>('span')!.click();
    });
    expect(navigate).toHaveBeenCalledWith({ to: '/account/orders/1' });

    navigate.mockClear();
    await act(async () => {
      card.querySelector<HTMLButtonElement>('button')!.click();
    });
    expect(navigate).not.toHaveBeenCalledWith({ to: '/account/orders/1' });
  });

  it('renders the empty state with a link back to the store', () => {
    const { container, getByText } = renderPage(<OrdersPage page={{} as never} orders={[]} />);
    expect(getByText('لا توجد طلبات')).toBeTruthy();
    expect(getByText('تسوق الان').getAttribute('href')).toBe('/');
    // The web-desktop sidebar is in the DOM; CSS decides when it shows, and its
    // balance is not fetched while it is hidden (jsdom has no desktop viewport).
    expect(container.querySelector('.account-sidebar a[href="/account/wallet"]')).toBeTruthy();
    expect(walletLoader).not.toHaveBeenCalled();
  });

  it('keeps the first-order copy out of a filtered empty result', () => {
    const { getByText, queryByText } = renderPage(
      <OrdersPage page={{} as never} orders={[]} query={{ status: 'cancelled' }} />
    );
    expect(getByText('لا توجد طلبات')).toBeTruthy();
    expect(queryByText('تسوق الان')).toBeNull();
    expect(getByText('عرض كل الطلبات').getAttribute('href')).toBe('/account/orders');
  });

  it('renders product thumbs from list items', () => {
    const { getByRole } = renderPage(<OrdersPage page={{} as never} orders={orders} />);
    expect(getByRole('img', { name: 'Milk' }).getAttribute('src')).toBe('/milk.webp');
  });

  it('reorders through the SDK, and serializes concurrent clicks', async () => {
    let finish: () => void = () => {};
    const createCartFromOrder = vi
      .fn()
      .mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    (window as unknown as { salla: unknown }).salla = {
      onReady: () => Promise.resolve(),
      order: { createCartFromOrder },
    };
    const { container } = renderPage(<OrdersPage page={{} as never} orders={orders} />);
    const buttons = container.querySelectorAll<HTMLButtonElement>('article button');
    await act(async () => {
      buttons[0].click();
      buttons[0].click();
      buttons[1].click();
    });
    expect(createCartFromOrder).toHaveBeenCalledTimes(1);
    expect(createCartFromOrder).toHaveBeenCalledWith(1);
    await act(async () => {
      finish();
    });
    expect(navigate).toHaveBeenCalledWith({ to: '/cart' });
  });
});
