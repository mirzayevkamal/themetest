import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import type { Product } from '@salla.sa/twilight-theme-engine/types';
import {
  AddToCartStepper,
  CartLineStepper,
  ProductLineStepper,
  parkSyncQueueForTests,
  resetCartLinesForTests,
  seedCartLinesFromStorageForTests,
} from '../../../app/components/product/AddToCartStepper';
import { ProductConsentPrompt } from '../../../app/components/product/ProductConsent';

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

const themeSettings: Record<string, unknown> = {};
vi.mock('@salla.sa/twilight-theme-engine/providers', () => ({
  useTwilight: () => ({ theme: { settings: themeSettings } }),
}));

vi.mock('@salla.sa/twilight-components-react/add-product-button', () => ({
  SallaAddProductButton: ({
    productId,
    productStatus,
    productType,
    className,
    children,
  }: {
    productId?: number | string;
    productStatus?: string;
    productType?: string;
    className?: string;
    children?: React.ReactNode;
  }) => (
    <salla-add-product-button
      class={className}
      product-id={productId}
      product-status={productStatus}
      product-type={productType}
    >
      {children}
    </salla-add-product-button>
  ),
}));

const details = vi.fn();
const addItem = vi.fn().mockResolvedValue({});
const updateItem = vi.fn().mockResolvedValue(undefined);
const deleteItem = vi.fn().mockResolvedValue(undefined);
const storageGet = vi.fn();
const storageSet = vi.fn();
const mobileAction = vi.fn();
// Captured so tests can fire cart events at the stepper's module store.
const handlers: Record<string, (data?: unknown) => void> = {};
const notifyError = vi.fn();

window.salla = {
  onReady: (cb?: () => unknown) => {
    cb?.();
    return Promise.resolve();
  },
  event: {
    on: (event: string, cb: (data?: unknown) => void) => {
      handlers[event] = cb;
    },
    off: vi.fn(),
    dispatch: vi.fn(),
  },
  cart: { api: { addItem, details, updateItem, deleteItem } },
  api: { withoutNotifier: (fn: () => unknown) => fn() },
  notify: { error: notifyError },
  storage: { get: storageGet, set: storageSet },
  mobile: { isEnabled: () => true, action: mobileAction },
} as unknown as typeof window.salla;

async function flushDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(600);
  });
}

const product = { id: 7, url: '/p7', status: 'sale', type: 'product' } as Product;

describe('AddToCartStepper', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetCartLinesForTests();
    addItem.mockReset().mockResolvedValue({});
    updateItem.mockReset().mockResolvedValue(undefined);
    deleteItem.mockReset().mockResolvedValue(undefined);
    storageGet.mockReset();
    storageSet.mockReset();
    mobileAction.mockReset();
    notifyError.mockReset();
    details.mockResolvedValue({ data: { cart: { items: [] } } });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('quick-adds a consent-tagged product only after the customer agrees', async () => {
    Object.assign(themeSettings, { product_consent_enabled: true, product_consent_tags: 'c' });
    try {
      render(
        <>
          <AddToCartStepper product={{ ...product, tags: [{ name: 'c', url: '' }] } as Product} />
          <ProductConsentPrompt />
        </>
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add to Cart' }));
      await flushDebounce();
      expect(addItem).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'أوافق' }));
      await flushDebounce();
      expect(addItem).toHaveBeenCalledWith({ id: 7, quantity: 1, endpoint: 'quickAdd' });
    } finally {
      delete themeSettings.product_consent_enabled;
      delete themeSettings.product_consent_tags;
      document.cookie = 'product_consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    }
  });

  it('gives a product with options the stepper and quick-adds it like any other', async () => {
    render(<AddToCartStepper product={{ ...product, has_options: true } as Product} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to Cart' }));
    expect(screen.getByLabelText('Remove from cart')).toBeTruthy();
    await flushDebounce();
    expect(addItem).toHaveBeenCalledWith({ id: 7, quantity: 1, endpoint: 'quickAdd' });
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('resends the selected option when decreasing a line of a product with options', async () => {
    render(<AddToCartStepper product={{ ...product, has_options: true } as Product} />);
    await act(async () => {
      handlers['cart::latest.fetched']?.({
        data: {
          cart: {
            items: [
              {
                id: 'ci1',
                product_id: 7,
                quantity: 2,
                options: [{ id: 11, details: [{ id: 22, is_selected: true }, { id: 23 }] }],
              },
            ],
          },
        },
      });
    });
    expect(screen.getByText('2')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Decrease quantity'));
    await flushDebounce();
    expect(updateItem).toHaveBeenCalledTimes(1);
    const payload = updateItem.mock.calls[0][0] as FormData;
    expect(payload.get('id')).toBe('ci1');
    expect(payload.get('quantity')).toBe('1');
    expect(payload.get('options[11]')).toBe('22');
  });

  it('gives non-food sale types like group products the quick-add stepper', async () => {
    render(<AddToCartStepper product={{ ...product, type: 'group_products' } as Product} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add to Cart' }));
    await flushDebounce();
    expect(addItem).toHaveBeenCalledWith({ id: 7, quantity: 1, endpoint: 'quickAdd' });
  });

  it.each(['booking', 'donating', 'financial_support'])(
    'hands %s products to salla-add-product-button with the + icon',
    (type) => {
      const { container } = render(
        <AddToCartStepper product={{ ...product, type } as unknown as Product} />
      );
      const button = container.querySelector('salla-add-product-button');
      expect(button?.getAttribute('product-id')).toBe('7');
      expect(button?.getAttribute('product-status')).toBe('sale');
      expect(button?.getAttribute('product-type')).toBe(type);
      expect(button?.querySelector('svg')).toBeTruthy();
      expect(screen.queryByRole('link')).toBeNull();
    }
  );

  it('disables the tile for out-and-notify when the merchant turned off in-card notify', () => {
    render(<AddToCartStepper product={{ ...product, status: 'out-and-notify' } as Product} />);
    expect(screen.getByLabelText('Out of Stock')).toHaveProperty('disabled', true);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('styles the + tile per accent_style, soft by default', () => {
    const { unmount } = render(<AddToCartStepper product={product} />);
    expect(screen.getByLabelText('Add to Cart').className).toContain('text-brand');
    unmount();

    themeSettings.accent_style = 'outlined';
    render(<AddToCartStepper product={product} />);
    const tile = screen.getByLabelText('Add to Cart');
    expect(tile.className).toContain('border-brand text-ink');
    expect(tile.className).not.toContain('border-brand-tint-hover');
    delete themeSettings.accent_style;
  });

  it("styles the order row's + per accent_style too, soft by default", () => {
    const { unmount } = render(<ProductLineStepper productId={7} />);
    const soft = screen.getByLabelText('Add to Cart').className;
    expect(soft).toContain('border-brand-tint-hover text-brand');
    expect(soft).not.toContain('mint');
    unmount();

    themeSettings.accent_style = 'outlined';
    render(<ProductLineStepper productId={7} />);
    expect(screen.getByLabelText('Add to Cart').className).toContain('border-brand text-ink');
    delete themeSettings.accent_style;
  });

  it('marks the booking add button outlined too', () => {
    themeSettings.accent_style = 'outlined';
    const { container } = render(
      <AddToCartStepper product={{ ...product, type: 'booking' } as Product} />
    );
    expect(container.querySelector('salla-add-product-button')?.getAttribute('class')).toBe(
      's-product-card-add-button s-product-card-add-button--outlined'
    );
    delete themeSettings.accent_style;
  });

  it('shows the Figma out-of-stock chip on top and a disabled "+" in its corner', () => {
    const { unmount } = render(
      <AddToCartStepper product={{ ...product, status: 'out' } as Product} />
    );
    const chip = screen.getByText('Out of Stock');
    expect(chip.className).toContain('top-1 end-1');
    expect(chip.className).toContain('bg-light-grey');
    expect(chip.className).toContain('text-xxs font-normal leading-3 text-silver-dark');
    const tile = screen.getByLabelText('Out of Stock');
    expect(tile.tagName).toBe('BUTTON');
    expect(tile).toHaveProperty('disabled', true);
    expect(tile.className).toContain('bottom-1 end-1');
    expect(screen.queryByRole('link')).toBeNull();
    unmount();

    // With the wishlist heart on, the heart takes that corner and the chip joins the bottom row.
    themeSettings.show_wishlist = true;
    render(<AddToCartStepper product={{ ...product, status: 'out' } as Product} />);
    expect(screen.getByText('Out of Stock').className).toContain('bottom-2 start-1');
    delete themeSettings.show_wishlist;
  });

  it('sends native haptics immediately: medium on add, light on decrease/remove', () => {
    render(<AddToCartStepper product={product} />);
    fireEvent.click(screen.getByLabelText('Add to Cart'));
    expect(mobileAction).toHaveBeenLastCalledWith('haptic.impact', { impact_type: 'medium' });
    fireEvent.click(screen.getByLabelText('Add to Cart'));
    fireEvent.click(screen.getByLabelText('Decrease quantity'));
    expect(mobileAction).toHaveBeenLastCalledWith('haptic.impact', { impact_type: 'light' });
    fireEvent.click(screen.getByLabelText('Remove from cart'));
    expect(mobileAction).toHaveBeenLastCalledWith('haptic.impact', { impact_type: 'light' });
    expect(mobileAction).toHaveBeenCalledTimes(4);
  });

  it('debounces a burst of + taps into one quick-add for the net delta', async () => {
    render(<AddToCartStepper product={product} />);
    fireEvent.click(screen.getByLabelText('Add to Cart'));
    // the pill appears optimistically; keep tapping its + before the debounce fires
    fireEvent.click(screen.getByLabelText('Add to Cart'));
    fireEvent.click(screen.getByLabelText('Add to Cart'));
    expect(screen.getByText('3')).toBeTruthy();
    expect(addItem).not.toHaveBeenCalled();
    await flushDebounce();
    expect(addItem).toHaveBeenCalledTimes(1);
    expect(addItem).toHaveBeenCalledWith({ id: 7, quantity: 3, endpoint: 'quickAdd' });
  });

  it('quick-adds the delta when increasing a line that is already in the cart', async () => {
    resetCartLinesForTests([{ id: 'ci1', product_id: 7, quantity: 3 }]);
    render(<AddToCartStepper product={product} />);
    expect(screen.getByText('3')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Add to Cart'));
    fireEvent.click(screen.getByLabelText('Add to Cart'));
    expect(screen.getByText('5')).toBeTruthy();
    expect(addItem).not.toHaveBeenCalled();
    await flushDebounce();
    expect(addItem).toHaveBeenCalledTimes(1);
    expect(addItem).toHaveBeenCalledWith({ id: 7, quantity: 2, endpoint: 'quickAdd' });
    expect(updateItem).not.toHaveBeenCalled();
  });

  it('removes a qty-1 line immediately and does not wait for the debounce', async () => {
    resetCartLinesForTests([{ id: 'ci1', product_id: 7, quantity: 1 }]);
    render(<AddToCartStepper product={product} />);
    expect(screen.getByText('1')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Remove from cart'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(deleteItem).toHaveBeenCalledWith('ci1');
    expect(addItem).not.toHaveBeenCalled();
    expect(updateItem).not.toHaveBeenCalled();
  });

  it('cancels an optimistic add when trash is tapped before the debounce fires', async () => {
    render(<AddToCartStepper product={product} />);
    fireEvent.click(screen.getByLabelText('Add to Cart'));
    expect(screen.getByText('1')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Remove from cart'));
    expect(screen.getByLabelText('Add to Cart')).toBeTruthy();
    await flushDebounce();
    expect(addItem).not.toHaveBeenCalled();
    expect(deleteItem).not.toHaveBeenCalled();
  });

  it('does not send a queued first-add after the user removes it', async () => {
    const release = parkSyncQueueForTests();
    render(<AddToCartStepper product={product} />);
    fireEvent.click(screen.getByLabelText('Add to Cart'));
    await flushDebounce();
    expect(addItem).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Remove from cart'));
    expect(screen.getByLabelText('Add to Cart')).toBeTruthy();

    await act(async () => {
      release();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(addItem).not.toHaveBeenCalled();
    expect(deleteItem).not.toHaveBeenCalled();
  });

  it('deletes a first-add that finished after the user already removed it', async () => {
    let resolveAdd: (value?: unknown) => void = () => {};
    addItem.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAdd = resolve;
        })
    );

    render(<AddToCartStepper product={product} />);
    fireEvent.click(screen.getByLabelText('Add to Cart'));
    await flushDebounce();
    expect(addItem).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Remove from cart'));
    expect(screen.getByLabelText('Add to Cart')).toBeTruthy();

    details
      .mockResolvedValueOnce({
        data: { cart: { items: [{ id: 'ci-new', product_id: 7, quantity: 1 }] } },
      })
      .mockResolvedValue({ data: { cart: { items: [] } } });

    await act(async () => {
      resolveAdd({});
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(deleteItem).toHaveBeenCalledWith('ci-new');
    expect(screen.getByLabelText('Add to Cart')).toBeTruthy();
  });

  it('still deletes a removed first-add when the post-add refresh fails', async () => {
    let resolveAdd: (value?: unknown) => void = () => {};
    addItem.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAdd = resolve;
        })
    );

    render(<AddToCartStepper product={product} />);
    fireEvent.click(screen.getByLabelText('Add to Cart'));
    await flushDebounce();
    expect(addItem).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Remove from cart'));

    // The add's own refresh dies, so serverLines never sees the new line;
    // the reconcile must refetch before concluding there is nothing to delete.
    details
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({
        data: { cart: { items: [{ id: 'ci-new', product_id: 7, quantity: 1 }] } },
      })
      .mockResolvedValue({ data: { cart: { items: [] } } });

    await act(async () => {
      resolveAdd({});
      for (let i = 0; i < 8; i++) await Promise.resolve();
    });

    expect(deleteItem).toHaveBeenCalledWith('ci-new');
    expect(screen.getByLabelText('Add to Cart')).toBeTruthy();
  });

  // Taps + on a one-unit line whose quick-add the backend rejects with `error`.
  async function rejectQuickAdd(error: unknown) {
    resetCartLinesForTests([{ id: 'ci-7', product_id: 7, quantity: 1 }]);
    details.mockResolvedValue({
      data: { cart: { items: [{ id: 'ci-7', product_id: 7, quantity: 1 }] } },
    });
    addItem.mockRejectedValueOnce(error);
    render(<AddToCartStepper product={product} />);
    fireEvent.click(screen.getAllByLabelText('Add to Cart')[0]);
    expect(screen.getByText('2')).toBeTruthy();
    await flushDebounce();
    expect(screen.getByText('1')).toBeTruthy();
  }

  it('shows the backend field error and reverts when a quick-add is rejected', async () => {
    await rejectQuickAdd({
      response: {
        data: {
          status: 422,
          error: {
            message: 'حقول غير صالحة',
            fields: { quantity: ['المنتج موجود مسبقا في السلة'] },
          },
        },
      },
    });
    expect(notifyError).toHaveBeenCalledWith('المنتج موجود مسبقا في السلة');
  });

  it('falls back to the top-level backend message when the error has no fields', async () => {
    await rejectQuickAdd({
      response: { data: { status: 422, error: { message: 'الكمية غير متوفرة' } } },
    });
    expect(notifyError).toHaveBeenCalledWith('الكمية غير متوفرة');
  });

  it('stays silent and still reverts when the failure carries no backend message', async () => {
    await rejectQuickAdd(new Error('network'));
    expect(notifyError).not.toHaveBeenCalled();
  });

  it('deletes a removed first-add from the addItem payload when every refresh fails', async () => {
    let resolveAdd: (value?: unknown) => void = () => {};
    addItem.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAdd = resolve;
        })
    );

    render(<AddToCartStepper product={product} />);
    fireEvent.click(screen.getByLabelText('Add to Cart'));
    await flushDebounce();
    expect(addItem).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Remove from cart'));

    // details() is down for good — the created line's id can only come from
    // the addItem response itself.
    details.mockRejectedValue(new Error('network'));

    await act(async () => {
      resolveAdd({
        data: { cart: { items: [{ id: 'ci-new', product_id: 7, quantity: 1 }] } },
      });
      for (let i = 0; i < 8; i++) await Promise.resolve();
    });

    expect(deleteItem).toHaveBeenCalledWith('ci-new');
  });

  it('shows a minus at qty > 1 that decrements by one', async () => {
    resetCartLinesForTests([{ id: 'ci1', product_id: 7, quantity: 3 }]);
    render(<AddToCartStepper product={product} />);
    expect(screen.getByText('3')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Decrease quantity'));
    expect(screen.getByText('2')).toBeTruthy();
    await flushDebounce();
    expect(updateItem).toHaveBeenCalledTimes(1);
    const payload = updateItem.mock.calls[0][0] as FormData;
    expect(payload.get('id')).toBe('ci1');
    expect(payload.get('quantity')).toBe('2');
    expect(addItem).not.toHaveBeenCalled();
  });

  it('seeds the pill from salla.storage cart.items so a first tap quick-adds a delta', async () => {
    storageGet.mockReturnValue({ 7: { cartItemId: 'ci9', quantity: 4 } });
    seedCartLinesFromStorageForTests();
    render(<AddToCartStepper product={product} />);
    expect(screen.getByText('4')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Add to Cart'));
    await flushDebounce();
    expect(addItem).toHaveBeenCalledWith({ id: 7, quantity: 1, endpoint: 'quickAdd' });
    expect(updateItem).not.toHaveBeenCalled();
  });

  it('keeps option values through salla.storage so a restored line can still be decreased', async () => {
    render(<AddToCartStepper product={{ ...product, has_options: true } as Product} />);
    await act(async () => {
      handlers['cart::latest.fetched']?.({
        data: {
          cart: {
            items: [
              {
                id: 'ci1',
                product_id: 7,
                quantity: 2,
                options: [{ id: 11, details: [{ id: 22, is_selected: true }] }],
              },
            ],
          },
        },
      });
    });
    const saved = storageSet.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    expect(saved['7']).toMatchObject({ cartItemId: 'ci1', options: { 11: '22' }, lineCount: 1 });

    // A fresh page: only storage is available, details() has not answered yet.
    resetCartLinesForTests();
    storageGet.mockReturnValue(saved);
    seedCartLinesFromStorageForTests();
    expect(screen.getByText('2')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Decrease quantity'));
    await flushDebounce();
    const payload = updateItem.mock.calls[0][0] as FormData;
    expect(payload.get('id')).toBe('ci1');
    expect(payload.get('options[11]')).toBe('22');
  });

  it('only adds when the product spans several option lines, since "-" could hit the wrong one', async () => {
    render(<AddToCartStepper product={{ ...product, has_options: true } as Product} />);
    await act(async () => {
      handlers['cart::latest.fetched']?.({
        data: {
          cart: {
            items: [
              { id: 'small', product_id: 7, quantity: 1 },
              { id: 'large', product_id: 7, quantity: 2 },
            ],
          },
        },
      });
    });
    expect(screen.queryByLabelText('Decrease quantity')).toBeNull();
    expect(screen.queryByLabelText('Remove from cart')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Add to Cart' }));
    await flushDebounce();
    expect(addItem).toHaveBeenCalledWith({ id: 7, quantity: 1, endpoint: 'quickAdd' });
    expect(updateItem).not.toHaveBeenCalled();
    expect(deleteItem).not.toHaveBeenCalled();
  });

  it('ProductLineStepper also only adds, one more unit, across several option lines', async () => {
    render(<ProductLineStepper productId={7} />);
    await act(async () => {
      handlers['cart::latest.fetched']?.({
        data: {
          cart: {
            items: [
              { id: 'small', product_id: 7, quantity: 1 },
              { id: 'large', product_id: 7, quantity: 2 },
            ],
          },
        },
      });
    });
    expect(screen.queryByLabelText('Decrease quantity')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add to Cart' }));
    await flushDebounce();
    expect(addItem).toHaveBeenCalledWith({ id: 7, quantity: 1, endpoint: 'quickAdd' });
    expect(updateItem).not.toHaveBeenCalled();
  });

  it('refreshes once per sync even though the SDK fires cart::updated for the same mutation', async () => {
    addItem.mockImplementation(() => {
      handlers['cart::updated']?.();
      return Promise.resolve({});
    });
    render(<AddToCartStepper product={product} />);
    details.mockClear();
    fireEvent.click(screen.getByLabelText('Add to Cart'));
    await flushDebounce();
    // let the event-scheduled 250ms refresh fire if it survived the sync
    await flushDebounce();
    expect(details).toHaveBeenCalledTimes(1);
  });

  it('applies the cart::latest.fetched payload without refetching details()', async () => {
    render(<AddToCartStepper product={product} />);
    details.mockClear();
    await act(async () => {
      handlers['cart::latest.fetched']?.({
        data: { cart: { items: [{ id: 'ci1', product_id: 7, quantity: 2 }] } },
      });
    });
    expect(screen.getByText('2')).toBeTruthy();
    await flushDebounce();
    expect(details).not.toHaveBeenCalled();
  });

  it('disables + at the line max quantity', () => {
    resetCartLinesForTests([{ id: 'ci1', product_id: 7, quantity: 5, max_quantity: 5 }]);
    render(<AddToCartStepper product={product} />);
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByLabelText('Add to Cart')).toHaveProperty('disabled', true);
  });

  it('updates the selected cart item when variants share a product id', async () => {
    resetCartLinesForTests([
      { id: 'ci1', product_id: 7, quantity: 1 },
      { id: 'ci2', product_id: 7, quantity: 2 },
    ]);
    render(
      <>
        <CartLineStepper productId={7} itemId="ci1" quantity={1} />
        <CartLineStepper productId={7} itemId="ci2" quantity={2} />
      </>
    );

    fireEvent.click(screen.getAllByLabelText('Add to Cart')[1]);
    await flushDebounce();

    expect(updateItem).toHaveBeenCalledTimes(1);
    const payload = updateItem.mock.calls[0][0] as FormData;
    expect(payload.get('id')).toBe('ci2');
    expect(payload.get('quantity')).toBe('3');
    expect(addItem).not.toHaveBeenCalled();
  });

  it("sends the row form's current option choice with the quantity update", async () => {
    resetCartLinesForTests([{ id: 'ci1', product_id: 7, quantity: 1 }]);
    const formRef = { current: null as HTMLFormElement | null };
    render(
      <form ref={(el) => void (formRef.current = el)}>
        <input type="radio" name="options[11]" value="22" defaultChecked />
        <input type="radio" name="options[11]" value="23" aria-label="Large" />
        <input type="hidden" name="options[66]" value="gift note" />
        <CartLineStepper productId={7} itemId="ci1" quantity={1} formRef={formRef} />
      </form>
    );

    fireEvent.click(screen.getByLabelText('Large'));
    fireEvent.click(screen.getByLabelText('Add to Cart'));
    await flushDebounce();

    expect(updateItem).toHaveBeenCalledTimes(1);
    const payload = updateItem.mock.calls[0][0] as FormData;
    expect(payload.get('id')).toBe('ci1');
    expect(payload.get('quantity')).toBe('2');
    expect(payload.get('options[11]')).toBe('23');
    expect(payload.get('options[66]')).toBe('gift note');
  });

  it('saves a re-chosen option at the current quantity', async () => {
    resetCartLinesForTests([{ id: 'ci1', product_id: 7, quantity: 3 }]);
    const formRef = { current: null as HTMLFormElement | null };
    render(
      <form ref={(el) => void (formRef.current = el)}>
        <input type="radio" name="options[11]" value="22" defaultChecked />
        <input type="radio" name="options[11]" value="23" aria-label="Large" />
        <CartLineStepper productId={7} itemId="ci1" quantity={3} formRef={formRef} />
      </form>
    );

    fireEvent.click(screen.getByLabelText('Large'));
    await flushDebounce();

    expect(updateItem).toHaveBeenCalledTimes(1);
    const payload = updateItem.mock.calls[0][0] as FormData;
    expect(payload.get('quantity')).toBe('3');
    expect(payload.get('options[11]')).toBe('23');
  });

  it('requests item options with cart details so option lines stay updatable', async () => {
    render(<CartLineStepper productId={7} itemId="ci1" quantity={1} />);
    await act(async () => {});
    expect(details).toHaveBeenCalledWith(null, ['options']);
  });

  it('deletes the selected cart item when variants share a product id', async () => {
    resetCartLinesForTests([
      { id: 'ci1', product_id: 7, quantity: 1 },
      { id: 'ci2', product_id: 7, quantity: 1 },
    ]);
    render(
      <>
        <CartLineStepper productId={7} itemId="ci1" quantity={1} />
        <CartLineStepper productId={7} itemId="ci2" quantity={1} />
      </>
    );

    fireEvent.click(screen.getAllByLabelText('Remove from cart')[1]);
    await act(async () => {
      await Promise.resolve();
    });

    expect(deleteItem).toHaveBeenCalledWith('ci2');
  });

  it('keeps the synced quantity visible while the parent prop still lags behind', async () => {
    let serverQty = 2;
    updateItem.mockImplementation(async (fd: FormData) => {
      serverQty = Number(fd.get('quantity'));
    });
    details.mockImplementation(async () => ({
      data: { cart: { items: [{ id: 'ci1', product_id: 7, quantity: serverQty }] } },
    }));
    render(<CartLineStepper productId={7} itemId="ci1" quantity={serverQty} />);

    fireEvent.click(screen.getByLabelText('Add to Cart'));
    expect(screen.getByText('3')).toBeTruthy();
    await flushDebounce();
    // updateItem settled and pending cleared; the stale prop (2) must not win
    expect(updateItem).toHaveBeenCalledTimes(1);
    expect(screen.getByText('3')).toBeTruthy();

    // decrementing while the parent still passes 2 must not no-op on
    // delta === 0 — it has to send the absolute target built from what is
    // actually displayed
    fireEvent.click(screen.getByLabelText('Decrease quantity'));
    expect(screen.getByText('2')).toBeTruthy();
    await flushDebounce();
    expect(updateItem).toHaveBeenCalledTimes(2);
    const payload = updateItem.mock.calls[1][0] as FormData;
    expect(payload.get('quantity')).toBe('2');

    // and a further increment builds on the synced value too
    fireEvent.click(screen.getByLabelText('Add to Cart'));
    await flushDebounce();
    const next = updateItem.mock.calls[2][0] as FormData;
    expect(next.get('quantity')).toBe('3');
    expect(screen.getByText('3')).toBeTruthy();
  });
});
