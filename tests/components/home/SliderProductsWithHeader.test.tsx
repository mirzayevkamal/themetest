import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const sliderMockState = vi.hoisted(() => ({ shouldLoad: false }));

vi.mock('@salla.sa/twilight-theme-engine/hooks/useTheme', () => ({
  useTheme: () => ({ settings: { show_out_of_stock_products: false } }),
}));

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

vi.mock('@salla.sa/twilight-theme-engine/api/product', () => {
  const list = vi.fn().mockResolvedValue({ items: [{ id: 1, name: 'Product 1' }], next: null });

  return {
    product: {
      list,
      queries: {
        list: (params: unknown) => ({
          queryKey: ['products', 'list', params],
          queryFn: () => list(params),
        }),
      },
    },
  };
});

vi.mock('@salla.sa/twilight-theme-engine/product', () => ({
  ProductCard: ({ product }: { product: { id: number; name: string } }) => (
    <div data-testid="product-card">{product.name}</div>
  ),
}));

vi.mock('@salla.sa/twilight-components-react', () => ({
  ProductsSliderSkeleton: () => <div data-testid="products-slider-skeleton" />,
  SallaProductsSlider: ({
    loader,
    blockTitle,
    sliderProps,
    displayAllUrl,
    skeleton,
  }: Record<string, unknown>) => {
    React.useEffect(() => {
      if (!sliderMockState.shouldLoad) return;
      void (loader as () => Promise<unknown>)().catch(() => undefined);
    }, [loader]);
    return (
      <div
        data-testid="salla-products-slider"
        data-block-title={blockTitle ?? ''}
        data-slider-id={(sliderProps as Record<string, unknown>)?.id ?? ''}
        data-display-all-url={displayAllUrl ?? ''}
        data-has-skeleton={skeleton ? 'true' : 'false'}
        {...((sliderProps as { showControls?: boolean })?.showControls !== undefined && {
          'data-show-controls': String((sliderProps as { showControls?: boolean }).showControls),
        })}
      />
    );
  },
}));

import { SliderProductsWithHeader } from '../../../app/components/home/SliderProductsWithHeader';

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('SliderProductsWithHeader', () => {
  const mockData = {
    background: 'bg.jpg',
    title: 'Featured Products',
    description: 'Check out our best products',
    display_all_url: '/products',
    products: { source: 'latest' as const },
  };

  beforeEach(() => {
    sliderMockState.shouldLoad = false;
  });

  it('renders slider-bg with background image', () => {
    const { container } = renderWithQuery(<SliderProductsWithHeader data={mockData} />);
    const sliderBg = container.querySelector('.slider-bg');
    expect(sliderBg?.getAttribute('style')).toContain('background-image');
    expect(sliderBg?.getAttribute('style')).toContain('bg.jpg');
  });

  it('renders title', () => {
    const { container } = renderWithQuery(<SliderProductsWithHeader data={mockData} />);
    const title = container.querySelector('h3');
    expect(title?.textContent).toBe('Featured Products');
  });

  it('renders description', () => {
    const { container } = renderWithQuery(<SliderProductsWithHeader data={mockData} />);
    const desc = container.querySelector('.line-clamp-2');
    expect(desc?.textContent).toBe('Check out our best products');
  });

  it('does not render the header spacer without title or description', () => {
    const { container } = renderWithQuery(
      <SliderProductsWithHeader data={{ ...mockData, title: undefined, description: undefined }} />
    );
    expect(container.querySelector('.slider-bg > .container')).toBeNull();
  });

  it('renders SallaProductsSlider with correct slider id', async () => {
    const { container } = renderWithQuery(
      <SliderProductsWithHeader data={{ ...mockData, position: 1 }} />
    );
    const slider = container.querySelector('[data-testid="salla-products-slider"]');
    expect(slider).toBeTruthy();
    expect(slider?.getAttribute('data-slider-id')).toBe('slider-with-bg-1');
    expect(slider?.getAttribute('data-show-controls')).toBe('false');
  });

  it('keeps arrows off even when saved data includes show_controls', () => {
    const { container } = renderWithQuery(
      <SliderProductsWithHeader data={{ ...mockData, show_controls: true }} />
    );
    expect(
      container.querySelector('[data-testid="salla-products-slider"]')?.getAttribute('data-show-controls')
    ).toBe('false');
  });

  it('passes the loading skeleton directly to SallaProductsSlider', () => {
    const { container } = renderWithQuery(<SliderProductsWithHeader data={mockData} />);
    const slider = container.querySelector('[data-testid="salla-products-slider"]');
    expect(slider?.getAttribute('data-has-skeleton')).toBe('true');
  });

  it('renders with source from products config', async () => {
    const { product } = await import('@salla.sa/twilight-theme-engine/api/product');
    sliderMockState.shouldLoad = true;
    renderWithQuery(
      <SliderProductsWithHeader data={{ ...mockData, products: { source: 'best_selling' } }} />
    );
    await waitFor(() =>
      expect(product.list).toHaveBeenCalledWith(expect.objectContaining({ source: 'best_selling' }))
    );
  });

  it('passes display_all_url through to the slider', () => {
    const { container } = renderWithQuery(<SliderProductsWithHeader data={mockData} />);
    const slider = container.querySelector('[data-testid="salla-products-slider"]');
    expect(slider?.getAttribute('data-display-all-url')).toBe('/products');
  });

  it.each([['#'], [''], [undefined], [[] as unknown as string]])(
    'drops display_all_url when it is %j',
    (display_all_url) => {
      const { container } = renderWithQuery(
        <SliderProductsWithHeader data={{ ...mockData, display_all_url }} />
      );
      const slider = container.querySelector('[data-testid="salla-products-slider"]');
      expect(slider?.getAttribute('data-display-all-url')).toBe('');
    }
  );

  it('returns null when no source can be resolved', () => {
    const { container } = renderWithQuery(
      <SliderProductsWithHeader data={{ ...mockData, products: undefined }} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when every product is filtered out', async () => {
    const { product } = await import('@salla.sa/twilight-theme-engine/api/product');
    sliderMockState.shouldLoad = true;
    vi.mocked(product.list).mockClear();
    vi.mocked(product.list).mockResolvedValueOnce({
      items: [{ id: 1, name: 'Unavailable product', status: 'out' }],
      next: null,
    });

    const { container } = renderWithQuery(<SliderProductsWithHeader data={mockData} />);

    await waitFor(() => expect(container.firstChild).toBeNull());
    expect(product.list).toHaveBeenCalled();
  });

  it('renders nothing when loading products fails', async () => {
    const { product } = await import('@salla.sa/twilight-theme-engine/api/product');
    sliderMockState.shouldLoad = true;
    vi.mocked(product.list).mockClear();
    vi.mocked(product.list).mockRejectedValueOnce(new Error('Request failed'));

    const { container } = renderWithQuery(<SliderProductsWithHeader data={mockData} />);

    await waitFor(() => expect(container.firstChild).toBeNull());
    expect(product.list).toHaveBeenCalled();
  });

  it('keeps the complete block hidden until products load successfully', async () => {
    const { product } = await import('@salla.sa/twilight-theme-engine/api/product');
    sliderMockState.shouldLoad = true;
    vi.mocked(product.list).mockClear();
    vi.mocked(product.list).mockResolvedValueOnce({
      items: [{ id: 1, name: 'Available product', status: 'sale' }],
      next: null,
    });
    const { container } = renderWithQuery(<SliderProductsWithHeader data={mockData} />);
    const block = container.querySelector('.slider-products-with-header');

    expect(block?.hasAttribute('hidden')).toBe(true);
    await waitFor(() => expect(block?.hasAttribute('hidden')).toBe(false));
  });
});
