import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, screen } from '@testing-library/react';
import { resetCartStoreForTests, useCartCount } from '../../../app/components/cart/useCart';

function Badge() {
  return <span data-testid="cart-badge-count">{useCartCount()}</span>;
}

beforeEach(() => {
  vi.useFakeTimers();
  resetCartStoreForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCart when React hydrates before the SDK module evaluates', () => {
  it('still receives cart::updated once the SDK is ready', async () => {
    let sdkReady = false;
    const queued: Array<() => unknown> = [];
    // Engine head stub: only onReady exists until the SDK <script> runs.
    (window as unknown as { salla: unknown }).salla = {
      onReady: (cb?: () => unknown) => {
        if (cb && sdkReady) cb();
        else if (cb) queued.push(cb);
        return Promise.resolve();
      },
    };

    render(<Badge />);
    await act(async () => {});
    expect(screen.getByTestId('cart-badge-count').textContent).toBe('0');

    // SDK module evaluates: installs event/storage/cart, then fires ready.
    const handlers: Record<string, Array<(d?: unknown) => void>> = {};
    const details = vi.fn().mockResolvedValue({ data: { cart: { count: 0, items: [] } } });
    Object.assign((window as unknown as { salla: object }).salla, {
      status: 'ready',
      storage: { get: () => undefined },
      event: {
        on: (e: string, cb: (d?: unknown) => void) => (handlers[e] ??= []).push(cb),
        off: vi.fn(),
      },
      cart: { api: { details } },
    });
    await act(async () => {
      sdkReady = true;
      queued.forEach((cb) => cb());
    });
    // The store polls every 250 ms until `event` exists.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(details).toHaveBeenCalledTimes(1);

    // Customer quick-adds a product: the SDK dispatches cart::updated.
    await act(async () => {
      handlers['cart::updated']?.forEach((cb) => cb({ count: 1, items: [] }));
    });
    expect(screen.getByTestId('cart-badge-count').textContent).toBe('1');
  });

  it('refetches the cart when the page is restored from the back/forward cache', async () => {
    const details = vi.fn().mockResolvedValue({ data: { cart: { count: 2, items: [] } } });
    (window as unknown as { salla: unknown }).salla = {
      status: 'ready',
      onReady: (cb?: () => unknown) => Promise.resolve(cb?.()),
      storage: { get: () => undefined },
      event: { on: vi.fn(), off: vi.fn() },
      cart: { api: { details } },
    };

    render(<Badge />);
    await act(async () => {});
    expect(details).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('cart-badge-count').textContent).toBe('2');

    details.mockResolvedValueOnce({ data: { cart: { count: 3, items: [] } } });
    await act(async () => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    expect(details).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('cart-badge-count').textContent).toBe('3');

    await act(async () => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
    });
    expect(details).toHaveBeenCalledTimes(2);
  });
});
