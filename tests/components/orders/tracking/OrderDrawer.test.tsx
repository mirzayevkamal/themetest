import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrderDrawer } from '../../../../app/components/orders/tracking/OrderDrawer';

const api = vi.hoisted(() => ({
  order: undefined as { id: number } | undefined,
  isFetching: true,
  refetch: vi.fn(),
}));
vi.mock('@salla.sa/twilight-theme-engine/providers', () => ({
  useTwilight: () => ({ theme: { settings: {} } }),
}));

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({}),
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => unknown }) =>
    select({ location: { pathname: '/' } }),
}));

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    locale: 'ar',
  }),
}));
vi.mock('../../../../app/components/orders/tracking/queries', () => ({
  useLiveOrderQuery: () => ({
    data: api.order && { order: api.order },
    isFetching: api.isFetching,
    refetch: api.refetch,
  }),
}));
vi.mock('@salla.sa/twilight-components-react', () => ({
  SallaButton: ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));
vi.mock('../../../../app/components/orders/OrderPage', () => ({
  OrderPage: ({ order, onClose }: { order: { id: number }; onClose: () => void }) => (
    <button type="button" onClick={onClose}>
      order {order.id}
    </button>
  ),
}));

describe('OrderDrawer', () => {
  it('shows the skeleton until the order lands, then the order page in a dialog', () => {
    const onClose = vi.fn();
    const { rerender } = render(<OrderDrawer id="42" onClose={onClose} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'إعادة المحاولة' })).toBeNull();
    expect(document.getElementById('drawer-title')?.textContent).toBe('تفاصيل الطلب');
    fireEvent.click(screen.getByRole('button', { name: 'إغلاق' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    onClose.mockClear();

    api.order = { id: 42 };
    rerender(<OrderDrawer id="42" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'order 42' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('offers a retry instead of an endless skeleton when the order fails to load', () => {
    api.order = undefined;
    api.isFetching = false;
    const onClose = vi.fn();
    render(<OrderDrawer id="42" onClose={onClose} />);
    expect(document.getElementById('drawer-title')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'إعادة المحاولة' }));
    expect(api.refetch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'إغلاق' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
