import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { CartAddedBar, CartCheckoutBar } from '../../../app/components/cart/CartBar';
import { resetCartStoreForTests } from '../../../app/components/cart/useCart';
import { resetCartDrawerForTests, useCartDrawerOpen } from '../../../app/hooks/useCartDrawer';

let mockPathname = '/ar';
let mockIsCart = false;
let mockIsWebDesktop = false;

vi.mock('../../../app/hooks/useIsWebDesktop', () => ({
  useIsWebDesktop: () => mockIsWebDesktop,
}));

const themeSettings: Record<string, unknown> = {};
vi.mock('@salla.sa/twilight-theme-engine/providers', () => ({
  useLocation: () => ({ pathname: mockPathname }),
  useTwilight: () => ({ theme: { settings: themeSettings } }),
}));

vi.mock('../../../app/hooks/useMatchedRoute', () => ({
  useIsCartRoute: () => mockIsCart,
}));

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

vi.mock('@salla.sa/twilight-theme-engine/hooks/useMoney', () => ({
  useMoney: () => ({ format: (n: number) => `${n} SR` }),
}));

const handlers: Record<string, (data?: unknown) => void> = {};
const details = vi.fn().mockResolvedValue({});
const submit = vi.fn().mockResolvedValue(undefined);
const mobileAction = vi.fn();

beforeEach(() => {
  resetCartStoreForTests();
  resetCartDrawerForTests();
  mockPathname = '/ar';
  mockIsCart = false;
  mockIsWebDesktop = false;
  details.mockClear();
  submit.mockClear();
  mobileAction.mockClear();
  (window as unknown as { salla: unknown }).salla = {
    onReady: (cb?: () => unknown) => {
      cb?.();
      return Promise.resolve();
    },
    event: {
      on: (event: string, cb: (data?: unknown) => void) => {
        handlers[event] = cb;
      },
      off: vi.fn(),
    },
    cart: { api: { details }, submit },
    mobile: { isEnabled: () => true, action: mobileAction },
  };
});

const bar = (over: Partial<Record<string, unknown>> = {}) => ({
  minimum_amount: 40,
  has_free_shipping: false,
  percent: 0,
  remaining: 40,
  ...over,
});

const emit = (cart: unknown) => act(() => handlers['cart::updated']?.(cart));

const DrawerState = () => <span>{useCartDrawerOpen() ? 'drawer:open' : 'drawer:closed'}</span>;

describe('CartAddedBar', () => {
  it('shows for a cart that already has items when the page loads', async () => {
    details.mockResolvedValueOnce({
      data: { cart: { count: 2, total: 29.9, free_shipping_bar: bar({ remaining: 10.1 }) } },
    });
    const { container } = render(<CartAddedBar />);
    await act(async () => {});
    expect(container.textContent).toContain('عرض السلة');
    expect(container.textContent).toContain('29.9 SR');
  });

  it('waits for a cart with a total instead of showing 0', async () => {
    const { container } = render(<CartAddedBar />);
    await act(async () => {});
    emit({ count: 2, items: [] });
    expect(container.firstChild).toBeNull();
    emit({ count: 2, total: 18, items: [] });
    expect(container.textContent).toContain('18 SR');
  });

  it('appears once the cart count grows, with the progress strip below the threshold', async () => {
    details.mockResolvedValueOnce({ data: { cart: { count: 0, total: 0 } } });
    const { container } = render(<CartAddedBar />);
    await act(async () => {});
    emit({
      count: 3,
      total: 44.85,
      free_shipping_bar: bar({ remaining: 10.2, percent: 79 }),
      items: [],
    });
    expect(container.textContent).toContain('عرض السلة');
    expect(container.textContent).toContain('واحصل على توصيل مجاني');
    expect(container.textContent).toContain('10.2 SR');
    expect(container.textContent).toContain('44.85 SR');
    // desktop.scss floats this class as a centered card on web desktop.
    expect(container.querySelector('.cart-added-bar')).toBeTruthy();
  });

  it('paints the view-cart button ink under primary_button_style dark', async () => {
    themeSettings.primary_button_style = 'dark';
    details.mockResolvedValueOnce({ data: { cart: { count: 0, total: 0 } } });
    const { container } = render(<CartAddedBar />);
    await act(async () => {});
    emit({ count: 1, total: 5, items: [] });
    expect(container.querySelector('.cta-dark .cta-button')?.textContent).toContain('عرض السلة');
    delete themeSettings.primary_button_style;
  });

  it('hides again when the cart empties', async () => {
    const { container } = render(<CartAddedBar />);
    await act(async () => {});
    emit({ count: 0, total: 0 });
    emit({ count: 1, total: 10 });
    expect(container.textContent).toContain('عرض السلة');
    emit({ count: 0, total: 0 });
    expect(container.firstChild).toBeNull();
  });

  it('stays up after navigating to another page', async () => {
    const { container, rerender } = render(<CartAddedBar />);
    await act(async () => {});
    emit({ count: 0, total: 0 });
    emit({ count: 1, total: 10 });
    expect(container.textContent).toContain('عرض السلة');
    mockPathname = '/ar/products';
    rerender(<CartAddedBar />);
    expect(container.textContent).toContain('عرض السلة');
  });

  it('links to the cart page on phones', async () => {
    const { container } = render(<CartAddedBar />);
    await act(async () => {});
    emit({ count: 1, total: 10 });
    expect(container.querySelector('a.cta-button')?.getAttribute('href')).toBe('/cart');
  });

  it('opens the cart drawer instead of navigating on web desktop', async () => {
    mockIsWebDesktop = true;
    const { container, getByText } = render(
      <>
        <CartAddedBar />
        <DrawerState />
      </>
    );
    await act(async () => {});
    emit({ count: 1, total: 10 });
    expect(container.querySelector('a.cta-button')).toBeNull();
    act(() => getByText('عرض السلة').click());
    expect(getByText('drawer:open')).toBeTruthy();
  });

  it('never shows on the cart page, even when quantity is bumped there', async () => {
    mockIsCart = true;
    const { container } = render(<CartAddedBar />);
    await act(async () => {});
    emit({ count: 1, total: 10 });
    emit({ count: 2, total: 20 });
    expect(container.firstChild).toBeNull();
  });
});

describe('CartCheckoutBar', () => {
  it('shows totals, savings and submits the cart to checkout', () => {
    const { container, getByText } = render(
      <CartCheckoutBar
        cart={{
          count: 3,
          total: 44.85,
          free_shipping_bar: { has_free_shipping: true },
          items: [{ price: 14.95, original_price: 19.95, has_discount: true, quantity: 3 }],
        }}
      />
    );
    expect(container.textContent).toContain('44.85 SR');
    expect(container.querySelector('.line-through')?.textContent).toContain('59.85 SR');
    expect(container.textContent).toContain('توصيل مجاني');
    expect(container.textContent).not.toContain('واحصل على توصيل مجاني');
    act(() => getByText('وصل طلبي').click());
    expect(submit).toHaveBeenCalled();
    expect(mobileAction).toHaveBeenCalledWith('haptic.impact', { impact_type: 'medium' });
  });

  it('stops loading when a guest dismisses the login modal', async () => {
    submit.mockReturnValueOnce(new Promise(() => {}));
    (window as unknown as { salla: { config: unknown } }).salla.config = { isGuest: () => true };
    const { container, getByText } = render(
      <CartCheckoutBar cart={{ count: 1, total: 10, free_shipping_bar: null, items: [] }} />
    );
    act(() => getByText('وصل طلبي').click());
    await act(async () => {});
    expect(container.querySelector('button[data-loading]')).not.toBeNull();
    act(() => handlers['salla-login::closed']?.());
    expect(container.querySelector('button[data-loading]')).toBeNull();
  });
});
