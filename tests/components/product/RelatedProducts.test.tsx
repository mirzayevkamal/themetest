import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RelatedProducts } from '../../../app/components/product/RelatedProducts';

const items: Array<Record<string, unknown>> = [
  {
    id: 1,
    name: 'مانجو يمني',
    url: '/p1',
    price: 12,
    subtitle: '900 - 1000 جرام',
    image: { url: 'm.jpg' },
  },
  { id: 2, name: 'توت أزرق', url: '/p2', price: 24.2, image: { url: 'b.jpg' } },
];

vi.mock('@salla.sa/twilight-theme-engine/api/product', () => ({
  product: {
    queries: {
      list: (params: unknown) => ({
        queryKey: ['products', params],
        queryFn: async () => ({ items, next: null }),
      }),
    },
  },
}));

vi.mock('@salla.sa/twilight-theme-engine/hooks/useMoney', () => ({
  useMoney: () => ({ format: (amount: number) => `${amount} ر.س` }),
}));

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

const productSettings: {
  fit_type?: 'cover' | 'contain' | null;
  availability_notify?: { email: boolean; sms: boolean; mobile: boolean; whatsapp: boolean };
} = { availability_notify: { email: true, sms: false, mobile: false, whatsapp: false } };
vi.mock('@salla.sa/twilight-theme-engine/providers', () => ({
  useTwilight: () => ({ store: { settings: { product: productSettings } } }),
}));

vi.mock('@salla.sa/twilight-theme-engine/common', () => ({
  Link: ({ to, children, ...props }: { to?: string; children?: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  Image: ({
    priority: _p,
    objectFit,
    noWrapper: _n,
    srcSetWidths: _s,
    ...props
  }: Record<string, unknown>) => <img {...props} data-object-fit={objectFit as string} />,
}));

vi.mock('@salla.sa/twilight-components-react/product-availability', () => ({
  SallaProductAvailability: ({ productId }: { productId: number }) => (
    <div data-testid={`product-availability-notify-${productId}`} />
  ),
}));

vi.mock('../../../app/components/product/AddToCartStepper', () => ({
  AddToCartStepper: ({ product }: { product: { id: number } }) => (
    <button type="button" data-testid={`product-stepper-add-${product.id}`} />
  ),
}));

const renderSection = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RelatedProducts productId={99} />
    </QueryClientProvider>
  );

describe('RelatedProducts', () => {
  it('renders a product card per related item: price, name, subtitle and a stepper', async () => {
    renderSection();
    expect(await screen.findByText('بالعادة يطلب معهُ')).toBeTruthy();
    expect(screen.getByText('12 ر.س')).toBeTruthy();
    expect(screen.getByText('900 - 1000 جرام')).toBeTruthy();
    expect(screen.getByText('توت أزرق').closest('a')?.getAttribute('href')).toBe('/p2');
    expect(screen.getAllByTestId(/^product-stepper-add-/)).toHaveLength(2);
  });

  it('offers notify-me instead of the stepper on an out-of-stock card, as on desktop', async () => {
    items[1].is_out_of_stock = true;
    renderSection();
    expect(await screen.findByTestId('product-availability-notify-2')).toBeTruthy();
    expect(screen.queryByTestId('product-stepper-add-2')).toBeNull();
    expect(screen.getByTestId('product-stepper-add-1')).toBeTruthy();
    delete items[1].is_out_of_stock;
  });

  it('fits card images per the store product fit_type, contain by default', async () => {
    const fits = async () => {
      const { container, unmount } = renderSection();
      await screen.findByText('توت أزرق');
      const result = [...container.querySelectorAll('img')].map((img) => img.dataset.objectFit);
      unmount();
      return result;
    };
    expect(await fits()).toEqual(['contain', 'contain']);
    productSettings.fit_type = 'cover';
    expect(await fits()).toEqual(['cover', 'cover']);
    delete productSettings.fit_type;
  });

  it('holds the row footprint while the list loads', async () => {
    const { container } = renderSection();
    const skeleton = container.querySelector('.product-page__related-skeleton');
    expect(skeleton?.getAttribute('aria-hidden')).toBe('true');
    // Outlines of both loaded layouts (phone tiles, desktop slider cards), not a blank box.
    expect(
      skeleton?.querySelector(
        '.product-page__related-skeleton-phone .product-page__related-skeleton-tile'
      )
    ).toBeTruthy();
    expect(
      skeleton?.querySelector('.product-page__related-skeleton-desktop .s-product-card')
    ).toBeTruthy();
    await screen.findByText('توت أزرق');
    expect(container.querySelector('.product-page__related-skeleton')).toBeNull();
  });

  it('renders nothing once the list comes back empty', async () => {
    items.length = 0;
    const { container } = renderSection();
    await waitFor(() => expect(container.innerHTML).toBe(''));
  });
});
