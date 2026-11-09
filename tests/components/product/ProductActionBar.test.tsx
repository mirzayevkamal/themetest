import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import type { Product } from '@salla.sa/twilight-theme-engine/types';
import { ProductActionBar } from '../../../app/components/product/ProductActionBar';
import { resetCartLinesForTests } from '../../../app/components/product/AddToCartStepper';

const themeSettings: Record<string, unknown> = {};
const storeSettings: Record<string, unknown> = {};
vi.mock('@salla.sa/twilight-theme-engine/providers', () => ({
  useTwilight: () => ({
    theme: { settings: themeSettings },
    store: { id: 42, api: 'https://api.salla.dev/store/v1', settings: storeSettings },
  }),
}));

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback, locale: 'ar' }),
}));

vi.mock('@salla.sa/twilight-theme-engine/hooks/useMoney', () => ({
  useMoney: () => ({ format: (n: number | string) => `${n} SR` }),
}));

vi.mock('@salla.sa/twilight-components-react', () => ({
  SallaButton: ({
    children,
    onClick,
    disabled,
    ariaLabel,
    className,
  }: React.PropsWithChildren<{
    onClick?: () => void;
    disabled?: boolean;
    ariaLabel?: string;
    className?: string;
  }>) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </button>
  ),
}));

const product = (over: Partial<Product> = {}) =>
  ({
    id: 1,
    price: 14.95,
    sale_price: 14.95,
    regular_price: 19.95,
    is_on_sale: true,
    status: 'sale',
    ...over,
  }) as Product;

const handlers: Record<string, (data?: unknown) => void> = {};
const mobileAction = vi.fn();
const deleteItem = vi.fn().mockResolvedValue(undefined);

const renderBar = (p: Product) => render(<ProductActionBar product={p} />);

beforeEach(() => {
  document.body.innerHTML = '';
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
    mobile: { isEnabled: () => true, action: mobileAction },
    cart: { api: { deleteItem, details: vi.fn() } },
    api: { withoutNotifier: (fn: () => unknown) => fn() },
  };
  mobileAction.mockClear();
  resetCartLinesForTests();
  delete storeSettings.buy_now;
});

describe('ProductActionBar buy now', () => {
  const widget = () => document.querySelector('salla-mini-checkout-widget');

  it('renders the mini-checkout widget bound to the product form when quick purchase is on', () => {
    storeSettings.buy_now = { networks: ['visa'] };
    renderBar(product({ id: 99 }));

    const el = widget();
    expect(el).not.toBeNull();
    expect(el?.getAttribute('form-selector')).toBe('form.product-form');
    expect(el?.getAttribute('products')).toBe('[99]');
    expect(el?.getAttribute('store-id')).toBe('42');
    expect(el?.getAttribute('language')).toBe('ar');
    expect(el?.hasAttribute('outline')).toBe(true);
    expect(el?.textContent).toContain('اشتر الآن');
  });

  it('hands the signed-in customer to the widget once the SDK is ready', async () => {
    storeSettings.buy_now = { networks: ['visa'] };
    const ready: Array<() => void> = [];
    const sdk = (window as unknown as { salla: Record<string, unknown> }).salla;
    sdk.onReady = () => new Promise<void>((resolve) => ready.push(resolve));
    renderBar(product());

    const el = widget() as (HTMLElement & { config?: { user?: unknown } }) | null;
    expect(el?.config).toBeUndefined();

    // The SDK (and the customer) arrive after mount.
    sdk.config = { get: (key: string) => (key === 'user' ? { id: 7 } : undefined) };
    await act(async () => {
      ready.forEach((resolve) => resolve());
    });
    expect(el?.config?.user).toEqual({ id: 7 });
  });

  it('renders nothing without the store setting, out of stock, or for own-flow types', () => {
    renderBar(product());
    expect(widget()).toBeNull();

    storeSettings.buy_now = { networks: ['visa'] };
    cleanup();
    renderBar(product({ status: 'out' }));
    expect(widget()).toBeNull();

    cleanup();
    renderBar(product({ type: 'booking' }));
    expect(widget()).toBeNull();
  });
});

describe('ProductActionBar', () => {
  it('shows sale price, struck original and discount tag', () => {
    const { container } = renderBar(product());
    expect(container.textContent).toContain('14.95 SR');
    expect(container.querySelector('.line-through')?.textContent).toBe('19.95 SR');
    expect(container.textContent).toContain('%25');
    expect(container.querySelector('p')).toBeNull();
  });

  it('shows the option checked in the product form under the price and follows changes', () => {
    document.body.innerHTML = `
      <form class="form product-form">
        <input type="radio" name="options[5]" value="51" checked />
        <input type="radio" name="options[5]" value="52" />
      </form>`;
    const options = [
      {
        id: 5,
        name: 'الوزن',
        details: [
          { id: 51, name: '900 - 1000 جرام' },
          { id: 52, name: '2 كيلو' },
        ],
      },
    ] as unknown as Product['options'];
    const { container } = renderBar(product({ options }));
    expect(container.querySelector('p')?.textContent).toBe('900 - 1000 جرام');

    const second = document.querySelector<HTMLInputElement>('input[value="52"]')!;
    second.checked = true;
    fireEvent.change(second);
    expect(container.querySelector('p')?.textContent).toBe('2 كيلو');
  });

  it('lists every value checked in a multi-select option', () => {
    document.body.innerHTML = `
      <form class="form product-form">
        <input type="radio" name="options[5]" value="51" checked />
        <input type="checkbox" name="options[6][]" value="61" checked />
        <input type="checkbox" name="options[6][]" value="62" checked />
        <input type="checkbox" name="options[6][]" value="63" />
      </form>`;
    const options = [
      { id: 5, name: 'الحجم', details: [{ id: 51, name: 'كبير' }] },
      {
        id: 6,
        name: 'إضافات',
        details: [
          { id: 61, name: 'تغليف هدية' },
          { id: 62, name: 'بطاقة' },
          { id: 63, name: 'شريطة' },
        ],
      },
    ] as unknown as Product['options'];
    const { container } = renderBar(product({ options }));
    expect(container.querySelector('p')?.textContent).toBe('كبير · تغليف هدية · بطاقة');
  });

  it('follows the SDK price update when a variant is picked', () => {
    const { container } = renderBar(product());
    act(() =>
      handlers['product::price.updated']?.({
        data: { price: 8.98, regular_price: 19.95, has_sale_price: false },
      })
    );
    expect(container.textContent).toContain('8.98 SR');
    expect(container.querySelector('.line-through')).toBeNull();
    expect(container.textContent).not.toContain('%');
  });

  it('shows only the plain price when not on sale', () => {
    const { container } = renderBar(product({ is_on_sale: false, price: 9 }));
    expect(container.textContent).toContain('9 SR');
    expect(container.querySelector('.line-through')).toBeNull();
    expect(container.textContent).not.toContain('%');
  });

  it('paints add to cart ink under primary_button_style dark, brand by default', () => {
    const button = () => renderBar(product()).getByRole('button', { name: 'أضف للسلة' });
    expect(button().closest('.cta-dark')).toBeNull();
    cleanup();
    themeSettings.primary_button_style = 'dark';
    const dark = button();
    expect(dark.className).toContain('cta-button');
    expect(dark.closest('.cta-dark')).toBeTruthy();
    delete themeSettings.primary_button_style;
  });

  it('submits the engine product form and disables when out of stock', () => {
    const form = document.createElement('form');
    form.className = 'form product-form';
    form.requestSubmit = vi.fn();
    document.body.appendChild(form);

    const live = renderBar(product());
    fireEvent.click(live.getByRole('button', { name: 'أضف للسلة' }));
    expect(form.requestSubmit).toHaveBeenCalledTimes(1);
    expect(mobileAction).toHaveBeenCalledWith('haptic.impact', { impact_type: 'medium' });
    live.unmount();

    const out = renderBar(product({ id: 2, status: 'out' }));
    expect((out.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('swaps to the cart stepper once the product is in the cart and back at 0', async () => {
    const { getByRole, queryByRole, getByText } = renderBar(product());
    await act(async () =>
      handlers['cart::latest.fetched']?.({
        data: { cart: { items: [{ id: 'line-1', product_id: 1, quantity: 1 }] } },
      })
    );
    expect(queryByRole('button', { name: 'أضف للسلة' })).toBeNull();
    expect(getByText('1')).toBeTruthy();

    await act(async () => {
      fireEvent.click(getByRole('button', { name: 'Remove from cart' }));
    });
    expect(deleteItem).toHaveBeenCalledWith('line-1');
    expect(getByRole('button', { name: 'أضف للسلة' })).toBeTruthy();
  });

  it('keeps the cart stepper "+" ink under primary_button_style dark', async () => {
    themeSettings.primary_button_style = 'dark';
    const { getByRole } = renderBar(product());
    await act(async () =>
      handlers['cart::latest.fetched']?.({
        data: { cart: { items: [{ id: 'line-1', product_id: 1, quantity: 1 }] } },
      })
    );
    const plus = getByRole('button', { name: 'Add to Cart' });
    expect(plus.className).toContain('cta-button');
    expect(plus.closest('.cta-dark')).toBeTruthy();
    delete themeSettings.primary_button_style;
  });

  it.each([
    ['has options', { options: [{ id: 5, details: [] }] as unknown as Product['options'] }],
    ['is out of stock', { status: 'out' as Product['status'] }],
  ])('keeps the form button when the product %s, even if it is in the cart', async (_, over) => {
    const { getByRole, queryByRole } = renderBar(product(over));
    await act(async () =>
      handlers['cart::latest.fetched']?.({
        data: { cart: { items: [{ id: 'line-1', product_id: 1, quantity: 1 }] } },
      })
    );
    expect(getByRole('button', { name: 'أضف للسلة' })).toBeTruthy();
    expect(queryByRole('button', { name: 'Remove from cart' })).toBeNull();
  });
});
