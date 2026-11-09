import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddProductToast } from '../../../app/components/cart/AddProductToast';
import { resetCartDrawerForTests, useCartDrawerOpen } from '../../../app/hooks/useCartDrawer';

let mockIsWebDesktop = false;
vi.mock('../../../app/hooks/useIsWebDesktop', () => ({
  isWebDesktop: () => mockIsWebDesktop,
}));

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    isRTL: true,
  }),
}));

vi.mock('@salla.sa/twilight-theme-engine/hooks/useMoney', () => ({
  useMoney: () => ({ format: (n: number) => `${n}` }),
}));

vi.mock('@salla.sa/twilight-theme-engine/common', () => ({
  Link: ({ to, children, ...props }: { to?: string; children?: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  delete (window as { salla?: unknown }).salla;
  mockIsWebDesktop = false;
  resetCartDrawerForTests();
});

const sallaWithMilk = () =>
  ({
    onReady: () => Promise.resolve(),
    event: {
      on: (_name: string, handler: (data: unknown) => Promise<void>) => {
        onAdded = handler;
      },
      off: vi.fn(),
    },
    cart: {
      api: {
        details: () =>
          Promise.resolve({
            data: {
              cart: {
                items: [
                  {
                    id: 1,
                    product_id: 7,
                    product_name: 'Milk',
                    product_image: '',
                    total: 5,
                    quantity: 1,
                    url: '/milk',
                  },
                ],
              },
            },
          }),
      },
    },
  }) as unknown as typeof window.salla;
let onAdded: (data: unknown) => Promise<void> = async () => {};

const DrawerState = () => <span>{useCartDrawerOpen() ? 'drawer:open' : 'drawer:closed'}</span>;

describe('AddProductToast', () => {
  it('does not throw when onReady fires before event exists', async () => {
    window.salla = {
      onReady: () => Promise.resolve(),
    } as unknown as typeof window.salla;

    expect(() => render(<AddProductToast />)).not.toThrow();
    await act(async () => {});
  });

  it('listens for Product Added after onReady', async () => {
    const on = vi.fn();
    let release: () => void = () => {};
    window.salla = {
      onReady: () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
      event: { on, off: vi.fn() },
    } as unknown as typeof window.salla;

    render(<AddProductToast />);
    await act(async () => {});
    expect(on).not.toHaveBeenCalled();

    await act(async () => {
      release();
    });
    expect(on).toHaveBeenCalledWith('Product Added', expect.any(Function));
  });

  it('pauses the auto-hide countdown while hovered and resumes on leave', async () => {
    vi.useFakeTimers();
    let onAdded: (data: unknown) => Promise<void> = async () => {};
    window.salla = {
      onReady: () => Promise.resolve(),
      event: {
        on: (_name: string, handler: typeof onAdded) => {
          onAdded = handler;
        },
        off: vi.fn(),
      },
      cart: {
        api: {
          details: () =>
            Promise.resolve({
              data: {
                cart: {
                  items: [
                    {
                      id: 1,
                      product_id: 7,
                      product_name: 'Milk',
                      product_image: '',
                      total: 5,
                      quantity: 1,
                      url: '/milk',
                    },
                  ],
                },
              },
            }),
        },
      },
    } as unknown as typeof window.salla;

    try {
      render(<AddProductToast />);
      await act(async () => {});
      await act(async () => {
        await onAdded([{ cart_item_id: 1 }]);
      });
      const toast = screen.getByText('Added to Cart').closest('.s-add-product-toast')!;
      const bar = () => toast.querySelector<HTMLElement>('.s-add-product-toast__progress-bar')!;
      expect(bar().style.width).toBe('100%');

      act(() => vi.advanceTimersByTime(1000));
      expect(bar().style.width).toBe('80%');
      fireEvent.mouseOver(toast);
      act(() => vi.advanceTimersByTime(1000));
      expect(bar().style.width).toBe('80%');

      fireEvent.mouseOut(toast);
      act(() => vi.advanceTimersByTime(1000));
      expect(bar().style.width).toBe('60%');

      act(() => vi.advanceTimersByTime(3000));
      expect(screen.queryByText('Added to Cart')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('navigates to the cart page from View Cart on phones', async () => {
    window.salla = sallaWithMilk();
    render(<AddProductToast />);
    await act(async () => {});
    await act(async () => {
      await onAdded([{ cart_item_id: 1 }]);
    });
    const link = screen.getByText('View Cart').closest('a')!;
    expect(link.getAttribute('href')).toBe('/cart');
    const event = fireEvent.click(link);
    expect(event).toBe(true);
    expect(screen.queryByText('Added to Cart')).not.toBeNull();
  });

  it('opens the cart drawer and closes the toast from View Cart on web desktop', async () => {
    mockIsWebDesktop = true;
    window.salla = sallaWithMilk();
    render(
      <>
        <AddProductToast />
        <DrawerState />
      </>
    );
    await act(async () => {});
    await act(async () => {
      await onAdded([{ cart_item_id: 1 }]);
    });
    const link = screen.getByText('View Cart').closest('a')!;
    const event = fireEvent.click(link);
    expect(event).toBe(false);
    expect(screen.getByText('drawer:open')).toBeTruthy();
    expect(screen.queryByText('Added to Cart')).toBeNull();
  });
});
