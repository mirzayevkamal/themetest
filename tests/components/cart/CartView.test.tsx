import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { CartView } from '../../../app/components/cart/CartView';
import { resetCartStoreForTests } from '../../../app/components/cart/useCart';
import { resetCartLinesForTests } from '../../../app/components/product/AddToCartStepper';
import type { CartPageProps } from '@salla.sa/twilight-theme-engine/routes/cart';

vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({
    select,
  }: {
    select: (s: { matches: { routeId: string }[]; location: { hash: string } }) => unknown;
  }) => select({ matches: [{ routeId: '/{-$locale}/cart' }], location: { hash: '' } }),
  useRouter: () => ({
    history: { back: vi.fn() },
    navigate: vi.fn(),
    state: { location: { hash: '' } },
  }),
}));

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) =>
      key === 'common.elements.choose' ? 'اختر' : (fallback ?? key),
  }),
}));

vi.mock('@salla.sa/twilight-theme-engine/common', () => ({
  Link: ({ to, children, ...props }: { to?: string; children?: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('../../../app/hooks/useProductSheet', () => ({
  productHref: (_url?: string | null, id?: number | string | null) =>
    id != null && String(id) !== '' ? `/p${id}` : undefined,
  ProductSheetLink: ({
    to,
    children,
    ...props
  }: React.PropsWithChildren<{ to: string; className?: string }>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@salla.sa/twilight-theme-engine/hooks/useMoney', () => ({
  useMoney: () => ({ format: (n: number) => `${n} SR` }),
}));

vi.mock('@salla.sa/twilight-theme-engine/skeleton', () => ({
  CartSkeleton: () => <div data-testid="cart-skeleton" />,
}));

const shipping: { express_delivery_promise: string | null } = { express_delivery_promise: null };
const themeSettings: Record<string, unknown> = {};
vi.mock('@salla.sa/twilight-theme-engine/providers', () => ({
  useTwilight: () => ({ theme: { settings: themeSettings }, store: { shipping } }),
}));

const cartSettings: { apply_coupon_enabled?: boolean } = {};
vi.mock('@salla.sa/twilight-theme-engine/hooks/useStore', () => ({
  useStore: () => ({ settings: { cart: cartSettings } }),
}));

// The real wrapper only forwards props to the CDN component; expose them for assertions.
vi.mock('@salla.sa/twilight-components-react/cart-item-offers', () => ({
  SallaCartItemOffers: (props: {
    itemId: string;
    quantity: number;
    productPrice: number;
    offers: string;
  }) => (
    <salla-cart-item-offers
      data-item-id={props.itemId}
      data-quantity={props.quantity}
      data-product-price={props.productPrice}
      data-offers={props.offers}
    />
  ),
}));

const handlers: Record<string, (data?: unknown) => void> = {};
const details = vi.fn().mockResolvedValue({});
const addCoupon = vi.fn();
const deleteCoupon = vi.fn();

beforeEach(() => {
  resetCartStoreForTests();
  details.mockReset().mockResolvedValue({});
  resetCartLinesForTests();
  delete cartSettings.apply_coupon_enabled;
  addCoupon.mockReset().mockResolvedValue({});
  deleteCoupon.mockReset().mockResolvedValue({});
  shipping.express_delivery_promise = '15 دقيقة';
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
    cart: { api: { details }, addCoupon, deleteCoupon },
    api: { withoutNotifier: (fn: () => unknown) => fn() },
  };
});

function emit(cart: unknown) {
  act(() => handlers['cart::updated']?.(cart));
}

type LoadedComponent = {
  host: HTMLElement;
  isCartMode: boolean;
  enterCartMode: () => Promise<void>;
};

/** The SDK hook registry's contract: componentDidLoad callbacks run for each
 *  component as it loads, and replay for components that loaded earlier. */
function sdkHooks() {
  const callbacks: ((c: LoadedComponent) => unknown)[] = [];
  const loaded: LoadedComponent[] = [];
  return {
    registerHook: vi.fn((_tag: string, _hook: string, cb: (c: LoadedComponent) => unknown) => {
      callbacks.push(cb);
      loaded.forEach((c) => void cb(c));
    }),
    registerComponent: async (_tag: string, c: LoadedComponent) => {
      loaded.push(c);
      for (const cb of callbacks) await cb(c);
    },
  };
}

const getPrice = vi.fn();

/** `<salla-product-options>` reduced to the lifecycle the cart relies on: it
 *  reads `options` from the attribute, awaits the SDK's componentDidLoad hooks,
 *  pre-selects saved values only in cart mode, and otherwise runs the product
 *  price lookup (the drawer is never the SDK's "cart" page). */
if (!customElements.get('salla-product-options')) {
  customElements.define(
    'salla-product-options',
    class extends HTMLElement {
      async connectedCallback() {
        const options = JSON.parse(this.getAttribute('options') ?? '[]') as {
          details: { id: number; is_selected?: boolean }[];
        }[];
        const component: LoadedComponent = {
          host: this,
          isCartMode: false,
          enterCartMode: async () => {
            component.isCartMode = true;
            const saved = options.flatMap((o) => o.details.filter((d) => d.is_selected));
            this.dataset.selected = saved.map((d) => d.id).join(',');
          },
        };
        const sdk = window.salla as unknown as {
          hooks?: { registerComponent?: (t: string, c: LoadedComponent) => Promise<void> };
        };
        await sdk.hooks?.registerComponent?.('salla-product-options', component);
        if (!component.isCartMode) getPrice();
      }
    }
  );
}

const orderOption = {
  id: 900,
  quantity: 1,
  price: 5,
  options: [
    {
      id: 5,
      name: 'تغليف هدية',
      type: 'single-option',
      placeholder: 'common.elements.choose',
      details: [{ id: 6, name: 'نعم', is_selected: true }],
    },
    { id: 7, name: 'ملاحظة', type: 'text', placeholder: 'اكتب هنا' },
  ],
};

const item = {
  id: 'ci1',
  product_id: 7,
  product_name: 'تفاح رويال غالا الفاخر مستورد',
  product_image: 'https://cdn.example.com/apple.jpg',
  url: '/apple',
  weight_label: '900 - 1000 جرام',
  price: 14.95,
  original_price: 19.95,
  has_discount: true,
  quantity: 1,
};

describe('CartView', () => {
  it('shows the skeleton before any cart data arrives', () => {
    const { getByTestId } = render(<CartView />);
    expect(getByTestId('cart-skeleton')).toBeTruthy();
  });

  it('renders the loader cart when the browser cart request fails', async () => {
    details.mockRejectedValue(new Error('network'));
    const { container, queryByTestId } = render(
      <CartView
        initialCart={
          { count: 1, items: [item], total: 14.95 } as NonNullable<CartPageProps['cart']>
        }
      />
    );
    await act(async () => {});
    expect(queryByTestId('cart-skeleton')).toBeNull();
    expect(container.textContent).toContain(item.product_name);
  });

  it('shows the empty state for a guest with no cart yet', async () => {
    details.mockRejectedValue(
      Object.assign(new Error('Cart not created yet'), { name: 'CartNotCreated' })
    );
    const { queryByTestId } = render(<CartView />);
    await act(async () => {});
    expect(queryByTestId('cart-skeleton')).toBeNull();
  });

  it('shows the empty state when the cart request returns no cart', async () => {
    details.mockResolvedValueOnce({ events: {} });
    const { container, queryByTestId } = render(<CartView />);
    await act(async () => {});
    expect(queryByTestId('cart-skeleton')).toBeNull();
    expect(container.textContent).toContain('سلتك فارغة');
  });

  it('shows the empty state when the cart has no items', () => {
    const { container } = render(<CartView />);
    emit({ count: 0, items: [] });
    expect(container.textContent).toContain('السلة');
    expect(container.textContent).toContain('سلتك فارغة');
    expect(container.querySelector('a[href="/"]')?.textContent).toContain('ابدأ التسوق');
  });

  it('uses a close control instead of back when opened as a drawer', () => {
    const onClose = vi.fn();
    const { getByRole, queryByRole } = render(<CartView onClose={onClose} />);
    emit({ count: 0, items: [] });
    expect(queryByRole('link', { name: 'ابدأ التسوق' })).toBeNull();
    fireEvent.click(getByRole('button', { name: 'إغلاق' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders line items with prices and a product-sheet link', () => {
    resetCartLinesForTests([{ id: 'ci1', product_id: 7, quantity: 1 }]);
    const { container } = render(<CartView />);
    emit({ count: 1, items: [item], total: 14.95 });
    expect(container.textContent).toContain(item.product_name);
    expect(container.textContent).toContain('14.95 SR');
    expect(container.querySelector('a[href="/p7"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Remove from cart"]')).toBeTruthy();
  });

  it('styles the promise bar from delivery_promise_color and accent_style', () => {
    shipping.express_delivery_promise = '15 دقيقة';
    resetCartLinesForTests([{ id: 'ci1', product_id: 7, quantity: 1 }]);
    const { container, unmount } = render(<CartView />);
    emit({ count: 1, items: [item], total: 14.95 });
    const promise = () =>
      [...container.querySelectorAll('span')].find((s) => s.textContent === '15 دقيقة');
    expect(promise()?.style.color).toBe('');
    expect(promise()?.parentElement?.classList).toContain('capitalize');
    expect(promise()?.parentElement?.querySelector('path')?.getAttribute('fill')).toBe('#FF4300');
    expect(container.querySelector('.border-brand-tint-hover')).toBeTruthy();
    unmount();

    Object.assign(themeSettings, { delivery_promise_color: '#F89817', accent_style: 'outlined' });
    const outlined = render(<CartView />);
    emit({ count: 1, items: [item], total: 14.95 });
    const value = [...outlined.container.querySelectorAll('span')].find(
      (s) => s.textContent === '15 دقيقة'
    );
    expect(value?.style.color).toBe('rgb(248, 152, 23)');
    expect(value?.parentElement?.querySelector('path')?.getAttribute('fill')).toBe('#F89817');
    expect(outlined.container.querySelector('.sticky.border-brand')).toBeTruthy();
    delete themeSettings.delivery_promise_color;
    delete themeSettings.accent_style;
    shipping.express_delivery_promise = null;
  });

  it('renders option chips pre-checked from the cart line selection', () => {
    resetCartLinesForTests([{ id: 'ci1', product_id: 7, quantity: 1 }]);
    const { container } = render(<CartView />);
    emit({
      count: 1,
      items: [
        {
          ...item,
          weight_label: undefined,
          options: [
            {
              id: 11,
              name: 'الحجم',
              type: 'radio',
              details: [
                { id: 22, name: 'صغير', is_selected: false },
                { id: 23, name: 'كبير', is_selected: true },
              ],
            },
            { id: 66, name: 'ملاحظة', type: 'text', value: 'بدون سكر' },
          ],
        },
      ],
    });
    const radios = container.querySelectorAll<HTMLInputElement>('input[name="options[11]"]');
    expect(Array.from(radios).map((r) => [r.value, r.checked])).toEqual([
      ['22', false],
      ['23', true],
    ]);
    expect(container.textContent).toContain('الحجم');
    expect(container.textContent).toContain('كبير');
    expect(container.querySelector<HTMLInputElement>('input[name="options[66]"]')?.value).toBe(
      'بدون سكر'
    );
  });

  it('renders order options as cart.updateItem forms', () => {
    const onChange = vi.fn();
    (window as unknown as { salla: { form: unknown } }).salla.form = { onChange };
    const { container } = render(<CartView />);
    emit({ count: 1, items: [item], options: [orderOption], options_total: 5 });
    expect(container.textContent).toContain('خيارات الطلب');
    expect(container.textContent).toContain('5 SR');
    const el = container.querySelector('salla-product-options')!;
    expect(el.getAttribute('product-id')).toBe('900');
    // Placeholders arriving as translation keys are resolved, and text options
    // get the `details` array the component dereferences.
    expect(JSON.parse(el.getAttribute('options')!)).toEqual([
      { ...orderOption.options[0], placeholder: 'اختر' },
      { ...orderOption.options[1], details: [] },
    ]);
    const form = el.closest('form') as HTMLFormElement;
    expect(form.querySelector<HTMLInputElement>('input[name="id"]')?.value).toBe('900');
    expect(form.querySelector<HTMLInputElement>('input[name="quantity"]')?.value).toBe('1');
    const select = document.createElement('select');
    select.name = 'options[5]';
    select.innerHTML = '<option value="">-</option><option value="6">نعم</option>';
    el.appendChild(select);
    fireEvent.change(select, { target: { value: '6' } });
    expect(onChange).toHaveBeenCalledWith('cart.updateItem', expect.anything());
  });

  it('shows saved order options without a price lookup outside the cart page', async () => {
    getPrice.mockClear();
    (window as unknown as { salla: { hooks: unknown } }).salla.hooks = sdkHooks();
    const { container } = render(<CartView />);
    emit({ count: 1, items: [item], options: [orderOption] });
    await act(async () => {});
    const el = container.querySelector<HTMLElement>('salla-product-options')!;
    expect(el.dataset.selected).toBe('6');
    expect(getPrice).not.toHaveBeenCalled();
  });

  it('applies cart mode to option elements that loaded before the cart store started', async () => {
    const hooks = sdkHooks();
    (window as unknown as { salla: { hooks: unknown } }).salla.hooks = hooks;
    const early = document.createElement('salla-product-options');
    early.setAttribute('data-cart-mode', '');
    early.setAttribute('options', JSON.stringify(orderOption.options.slice(0, 1)));
    const foreign = document.createElement('salla-product-options');
    foreign.setAttribute('options', JSON.stringify(orderOption.options.slice(0, 1)));
    document.body.append(early, foreign);
    await act(async () => {});
    render(<CartView />);
    await act(async () => {});
    expect(hooks.registerHook).toHaveBeenCalledTimes(1);
    expect(early.dataset.selected).toBe('6');
    // Product-page option elements keep their own behaviour.
    expect(foreign.dataset.selected).toBeUndefined();
    early.remove();
    foreign.remove();
  });

  it('shows savings and free delivery in the banner when earned', () => {
    const { container } = render(<CartView />);
    emit({
      count: 2,
      items: [{ ...item, quantity: 2 }],
      free_shipping_bar: {
        minimum_amount: 40,
        has_free_shipping: true,
        percent: 100,
        remaining: 0,
      },
    });
    // 2 × (19.95 − 14.95) = 10 saved
    expect(container.textContent).toContain('وفرت');
    expect(container.textContent).toContain('10 SR');
    expect(container.textContent).toContain('توصيل مجاني');
  });

  it('hides the delivery promise when the market has none', () => {
    shipping.express_delivery_promise = null;
    const { container } = render(<CartView />);
    emit({ count: 1, items: [item] });
    expect(container.textContent).not.toContain('ونوصلك');
  });

  it('keeps the skeleton when cart::updated has a count but no line items', () => {
    const { container, getByTestId } = render(<CartView />);
    emit({ count: 8, total: 99, items: [] });
    expect(getByTestId('cart-skeleton')).toBeTruthy();
    expect(container.textContent).not.toContain('سلتك فارغة');
  });

  it('keeps existing line items when a later summary-only cart::updated arrives', () => {
    resetCartLinesForTests([{ id: 'ci1', product_id: 7, quantity: 1 }]);
    const { container } = render(<CartView />);
    emit({ count: 1, items: [item], total: 14.95 });
    emit({ count: 1, total: 14.95, items: [] });
    expect(container.textContent).toContain(item.product_name);
    expect(container.textContent).not.toContain('سلتك فارغة');
  });

  it('fills in line items from cart::details.fetched after a summary-only update', () => {
    resetCartLinesForTests([{ id: 'ci1', product_id: 7, quantity: 1 }]);
    const { container, queryByTestId } = render(<CartView />);
    emit({ count: 8 });
    act(() => handlers['cart::details.fetched']?.({ data: { cart: { count: 1, items: [item] } } }));
    expect(queryByTestId('cart-skeleton')).toBeNull();
    expect(container.textContent).toContain(item.product_name);
  });

  it('applies the typed coupon code', async () => {
    const { getByLabelText, container } = render(<CartView />);
    emit({ count: 1, items: [item], total: 14.95 });
    fireEvent.change(getByLabelText('عندك كوبون خصم؟'), { target: { value: ' SAVE10 ' } });
    await act(async () => {
      fireEvent.submit(container.querySelector('form:has(input[name="coupon"])')!);
    });
    expect(addCoupon).toHaveBeenCalledWith('SAVE10');
  });

  it('shows the applied coupon from the cart and removes it', async () => {
    const { getByLabelText, container } = render(<CartView />);
    emit({ count: 1, items: [item], total: 14.95, coupon: 'SAVE10' });
    const input = getByLabelText('عندك كوبون خصم؟') as HTMLInputElement;
    expect(input.value).toBe('SAVE10');
    expect(input.readOnly).toBe(true);
    await act(async () => {
      fireEvent.submit(container.querySelector('form:has(input[name="coupon"])')!);
    });
    expect(deleteCoupon).toHaveBeenCalled();
    expect(addCoupon).not.toHaveBeenCalled();
  });

  it("shows the API's reason when a coupon is rejected", async () => {
    addCoupon.mockRejectedValue(
      Object.assign(new Error('Request failed'), {
        response: { data: { error: { message: 'الكوبون منتهي' } } },
      })
    );
    const { getByLabelText, findByRole, container } = render(<CartView />);
    emit({ count: 1, items: [item], total: 14.95 });
    fireEvent.change(getByLabelText('عندك كوبون خصم؟'), { target: { value: 'OLD' } });
    await act(async () => {
      fireEvent.submit(container.querySelector('form:has(input[name="coupon"])')!);
    });
    expect((await findByRole('alert')).textContent).toBe('الكوبون منتهي');
  });

  it('hides the coupon box when the merchant turns coupons off', () => {
    cartSettings.apply_coupon_enabled = false;
    const { queryByLabelText } = render(<CartView />);
    emit({ count: 1, items: [item], total: 14.95 });
    expect(queryByLabelText('عندك كوبون خصم؟')).toBeNull();
  });

  it('gives each mounted coupon box its own label target', () => {
    const { getAllByLabelText } = render(
      <>
        <CartView />
        <CartView onClose={() => {}} />
      </>
    );
    emit({ count: 1, items: [item], total: 14.95 });
    const [page, drawer] = getAllByLabelText('عندك كوبون خصم؟');
    expect(page).not.toBe(drawer);
    expect(page.id).not.toBe(drawer.id);
  });

  it('strikes the pre-offer price on an offer line and shows its offers', () => {
    const { container } = render(<CartView />);
    const detailed = [
      {
        offer_name: 'عرض الصيف',
        offer_type: 'buy_x_get_y',
        discount_amount: 5.03,
        free_quantity: 1,
        discount_icon: 'GiftIcon',
      },
    ];
    emit({
      count: 3,
      total: 10.06,
      discount: 5.03,
      items: [
        {
          ...item,
          quantity: 3,
          original_price: 8.95,
          product_price: 5.03,
          price: 3.35,
          offer: { discount: 5.03, names: 'عرض الصيف', offer_type: 'buy_x_get_y' },
          detailed_offers: detailed,
        },
      ],
    });
    const struck = container.querySelector('.line-through');
    expect(struck?.textContent).toBe('5.03 SR');
    expect(struck?.previousElementSibling?.textContent).toBe('3.35 SR');
    expect(container.textContent).toContain('16.79 SR');
    const offers = container.querySelector('salla-cart-item-offers') as HTMLElement;
    expect(offers.dataset).toMatchObject({ itemId: 'ci1', quantity: '3', productPrice: '5.03' });
    expect(JSON.parse(offers.dataset.offers ?? '[]')).toEqual(detailed);
  });

  it('renders no offers box for a line without offers', () => {
    const { container } = render(<CartView />);
    emit({ count: 1, items: [item], total: 14.95 });
    expect(container.querySelector('salla-cart-item-offers')).toBeNull();
  });
});
