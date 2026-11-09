import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CartDrawer } from '../../../app/components/cart/CartDrawer';

const onClose = vi.fn();

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    locale: 'ar',
  }),
}));

vi.mock('../../../app/components/cart/CartView', () => ({
  CartView: ({ onClose: close }: { onClose?: () => void }) => (
    <div>
      <button type="button" onClick={close}>
        إغلاق
      </button>
      <p>cart body</p>
    </div>
  ),
}));

beforeEach(() => {
  onClose.mockClear();
});

describe('CartDrawer', () => {
  it('renders a dialog over a dimmed backdrop with the cart body', () => {
    render(<CartDrawer onClose={onClose} />);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('cart body')).toBeTruthy();
  });

  it('closes from the close control, the backdrop, and Escape', () => {
    const { container } = render(<CartDrawer onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'إغلاق' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(container.querySelector('.bg-ink\\/80') as Element);
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('moves focus into the panel and back to the opener on close', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = render(<CartDrawer onClose={onClose} />);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);

    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
