import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { CartDesktopPage } from '../../../app/components/cart/CartDesktopPage';
import { CartView } from '../../../app/components/cart/CartView';
import { resetCartStoreForTests } from '../../../app/components/cart/useCart';
import { resetCartLinesForTests } from '../../../app/components/product/AddToCartStepper';

let mockIsWebDesktop = true;
vi.mock('../../../app/hooks/useIsWebDesktop', () => ({
  useIsWebDesktop: () => mockIsWebDesktop,
}));

vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ matches: [{ routeId: '/{-$locale}/cart' }], location: { hash: '' } }),
  useRouter: () => ({ history: { back: vi.fn() }, navigate: vi.fn() }),
}));

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

vi.mock('@salla.sa/twilight-theme-engine/components/common', () => ({
  Breadcrumb: () => <nav data-testid="cart-breadcrumb-display" />,
}));

vi.mock('../../../app/hooks/useProductSheet', () => ({
  productHref: (_url?: string | null, id?: number | string | null) =>
    id != null ? `/p${id}` : undefined,
  ProductSheetLink: ({ to, children, ...props }: React.PropsWithChildren<{ to: string }>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@salla.sa/twilight-theme-engine/hooks/useMoney', () => ({
  useMoney: () => ({ format: (n: number) => `${n} SR` }),
}));

vi.mock('@salla.sa/twilight-theme-engine/skeleton', () => ({
  CartSkeleton: () => <div data-testid="cart-skeleton-loading" />,
}));

const themeSettings: Record<string, unknown> = {};
vi.mock('@salla.sa/twilight-theme-engine/providers', () => ({
  useTwilight: () => ({
    theme: { settings: themeSettings },
    store: { shipping: { express_delivery_promise: null } },
  }),
}));

vi.mock('@salla.sa/twilight-theme-engine/hooks/useStore', () => ({
  useStore: () => ({ settings: { cart: {} } }),
}));

vi.mock('@salla.sa/twilight-components-react/cart-item-offers', () => ({
  SallaCartItemOffers: () => <salla-cart-item-offers />,
}));

const submit = vi.fn().mockResolvedValue(undefined);
const details = vi.fn().mockResolvedValue({});

beforeEach(() => {
  resetCartStoreForTests();
  resetCartLinesForTests();
  mockIsWebDesktop = true;
  submit.mockClear();
  (window as unknown as { salla: unknown }).salla = {
    onReady: (cb?: () => unknown) => {
      cb?.();
      return Promise.resolve();
    },
    event: { on: vi.fn(), off: vi.fn() },
    cart: { api: { details }, submit },
    api: { withoutNotifier: (fn: () => unknown) => fn() },
    mobile: { isEnabled: () => false },
  };
});

const cart = {
  id: 1,
  count: 3,
  sub_total: 50,
  discount: 10,
  total: 40,
  coupon: null,
  options: [],
  free_shipping_bar: { has_free_shipping: false, remaining: 20, percent: 60, minimum_amount: 60 },
  items: [
    {
      id: 11,
      product_id: 7,
      product_name: 'Milk',
      product_image: '',
      url: '/milk',
      price: 10,
      product_price: 10,
      original_price: 10,
      quantity: 2,
      total: 20,
      options: [],
    },
    {
      id: 12,
      product_id: 8,
      product_name: 'Oil',
      product_image: '',
      url: '/oil',
      price: 15,
      product_price: 15,
      original_price: 20,
      has_discount: true,
      quantity: 2,
      total: 30,
      options: [],
    },
  ],
} as unknown as React.ComponentProps<typeof CartDesktopPage>['cart'];

describe('CartDesktopPage', () => {
  it('lists the items as a table with line totals and an order summary', () => {
    const { container, getByText } = render(<CartDesktopPage cart={cart} />);
    expect(getByText('المنتجات (2)')).toBeTruthy();
    expect(container.textContent).toContain('20 SR');
    expect(container.textContent).toContain('30 SR');
    expect(getByText('ملخص الطلب')).toBeTruthy();
    expect(getByText('50 SR')).toBeTruthy();
    expect(getByText('- 10 SR')).toBeTruthy();
    expect(getByText('40 SR')).toBeTruthy();
    expect(container.textContent).toContain('واحصل على توصيل مجاني');
    expect(container.querySelector('form.flex input[name="coupon"]')).toBeTruthy();
  });

  it('keeps the class hooks desktop-pages.scss stacks under 1200px', () => {
    const { container } = render(<CartDesktopPage cart={cart} />);
    expect(container.querySelector('.cart-desktop__body > .cart-desktop__summary')).toBeTruthy();
  });

  it('submits the cart from the summary button', () => {
    const { getByText } = render(<CartDesktopPage cart={cart} />);
    act(() => getByText('إتمام الطلب').click());
    expect(submit).toHaveBeenCalled();
  });
});

describe('CartView on web desktop', () => {
  it('renders the two-column page with the breadcrumb instead of the phone screen', () => {
    const page = { title: 'Cart' } as unknown as NonNullable<
      React.ComponentProps<typeof CartView>['page']
    >;
    const { container, getByTestId, queryByText } = render(
      <CartView initialCart={cart as never} page={page} />
    );
    expect(container.querySelector('.cart-desktop')).toBeTruthy();
    expect(getByTestId('cart-breadcrumb-display')).toBeTruthy();
    expect(queryByText('وصل طلبي')).toBeNull();
  });

  it('keeps the phone screen inside the drawer', () => {
    const { container, getByText } = render(
      <CartView initialCart={cart as never} onClose={() => {}} />
    );
    expect(container.querySelector('.cart-desktop')).toBeNull();
    expect(getByText('وصل طلبي')).toBeTruthy();
  });

  it('keeps the phone screen on phones', () => {
    mockIsWebDesktop = false;
    const { container, getByText } = render(<CartView initialCart={cart as never} />);
    expect(container.querySelector('.cart-desktop')).toBeNull();
    expect(getByText('وصل طلبي')).toBeTruthy();
  });
});
