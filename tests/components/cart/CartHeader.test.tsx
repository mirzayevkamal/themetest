import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { CartHeader } from '../../../app/components/cart/CartHeader';

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ history: { back: vi.fn() } }),
}));

vi.mock('@salla.sa/twilight-theme-engine/providers', () => ({
  useTwilight: () => ({
    store: { features: ['bullet-delivery-v2'], settings: { bullet_delivery: { enabled: true } } },
  }),
}));

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

describe('CartHeader', () => {
  it('renders the cart title and address', () => {
    const { container, getByText } = render(<CartHeader />);
    expect(getByText('السلة')).toBeTruthy();
    expect(container.textContent).toContain('حدد عنوان التوصيل');
    expect(container.querySelector('header')?.classList).toContain('cart-page-header');
  });

  it('swaps back and address for a close control in the drawer', () => {
    const onClose = vi.fn();
    const { container, getByRole, queryByText } = render(<CartHeader onClose={onClose} />);
    expect(queryByText('حدد عنوان التوصيل')).toBeNull();
    expect(container.querySelector('header')?.classList).not.toContain('cart-page-header');
    const close = getByRole('button', { name: 'إغلاق' });
    expect(close.className).toContain('rounded-xl');
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalled();
  });
});
