import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { OrdersLoginRequired } from '../../../app/components/orders/OrdersLoginRequired';

const invalidate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    history: { back: vi.fn(), canGoBack: () => true },
    navigate: vi.fn(),
    invalidate,
  }),
}));

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    locale: 'ar',
  }),
}));

describe('OrdersLoginRequired', () => {
  beforeEach(() => invalidate.mockClear());

  it('opens the login modal for guests and reloads the route after login', async () => {
    const handlers: Record<string, () => void> = {};
    const dispatch = vi.fn();
    const off = vi.fn();
    (window as unknown as { salla: unknown }).salla = {
      onReady: () => Promise.resolve(),
      event: {
        on: (name: string, cb: () => void) => {
          handlers[name] = cb;
        },
        off,
        dispatch,
      },
    };
    const { unmount } = render(<OrdersLoginRequired />);
    await act(async () => {});
    expect(dispatch).toHaveBeenCalledWith('login::open', { withoutReload: true });
    act(() => handlers['auth::logged.in']?.());
    expect(invalidate).toHaveBeenCalled();
    unmount();
    expect(off).toHaveBeenCalledWith('auth::logged.in', expect.any(Function));
  });

  it('leaves no login listener behind when the guest navigates away', async () => {
    const off = vi.fn();
    (window as unknown as { salla: unknown }).salla = {
      onReady: () => Promise.resolve(),
      event: { on: vi.fn(), off, dispatch: vi.fn() },
    };
    const { unmount } = render(<OrdersLoginRequired />);
    await act(async () => {});
    unmount();
    expect(off).toHaveBeenCalledWith('auth::logged.in', expect.any(Function));
  });

  it('closes the layout-mounted modal when the guest navigates away', async () => {
    (window as unknown as { salla: unknown }).salla = {
      onReady: () => Promise.resolve(),
      event: { on: vi.fn(), off: vi.fn(), dispatch: vi.fn() },
    };
    const modal = document.createElement('salla-login-modal') as HTMLElement & {
      close: () => void;
    };
    modal.close = vi.fn();
    document.body.appendChild(modal);
    const { unmount } = render(<OrdersLoginRequired />);
    await act(async () => {});
    unmount();
    expect(modal.close).toHaveBeenCalled();
    modal.remove();
  });
});
