import React, { StrictMode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loaded: vi.fn(),
  cardProps: [] as Array<Record<string, unknown>>,
  settings: { show_out_of_stock_products: false },
}));

vi.mock('@salla.sa/twilight-theme-engine/hooks/useTheme', () => ({
  useTheme: () => ({ settings: mocks.settings }),
}));

vi.mock('@salla.sa/twilight-components-react', () => ({
  ProductsSliderSkeleton: () => null,
  SallaProductsSlider: ({
    loader,
    sliderProps,
    children,
  }: {
    loader: () => Promise<unknown>;
    sliderProps?: { showControls?: boolean };
    children?: (product: { id: number }, index: number) => React.ReactNode;
  }) => {
    React.useEffect(() => {
      void loader().then(mocks.loaded);
    }, [loader]);
    return (
      <div
        data-testid="salla-products-slider"
        {...(sliderProps?.showControls !== undefined && {
          'data-show-controls': String(sliderProps.showControls),
        })}
      >
        {children?.({ id: 1 }, 0)}
      </div>
    );
  },
}));

vi.mock('@salla.sa/twilight-theme-engine/api/product', () => {
  const list = vi.fn().mockResolvedValue({ items: [], next: null });

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

vi.mock('../../../app/components/product', () => ({
  ProductCard: (props: Record<string, unknown>) => {
    mocks.cardProps.push(props);
    return null;
  },
}));

import { product } from '@salla.sa/twilight-theme-engine/api/product';
import { ProductsSlider } from '../../../app/components/home/ProductsSlider';

describe('ProductsSlider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.settings.show_out_of_stock_products = false;
  });

  it('mounts arrows when the platform block omits show_controls', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { getByTestId } = render(
      <QueryClientProvider client={queryClient}>
        <ProductsSlider data={{ products: { source: 'latest' } }} />
      </QueryClientProvider>
    );
    expect(getByTestId('salla-products-slider').getAttribute('data-show-controls')).toBe('true');
  });

  it('honors show_controls from the block settings', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { getByTestId } = render(
      <QueryClientProvider client={queryClient}>
        <ProductsSlider data={{ products: { source: 'latest' }, show_controls: false }} />
      </QueryClientProvider>
    );
    expect(getByTestId('salla-products-slider').getAttribute('data-show-controls')).toBe('false');
  });

  it('passes an explicit show_controls flag through', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { getByTestId } = render(
      <QueryClientProvider client={queryClient}>
        <ProductsSlider data={{ products: { source: 'latest' }, show_controls: true }} />
      </QueryClientProvider>
    );
    expect(getByTestId('salla-products-slider').getAttribute('data-show-controls')).toBe('true');
  });

  it('deduplicates StrictMode loading and equal source arrays', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const renderSlider = () => (
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <ProductsSlider data={{ products: { source: 'selected', source_value: [1, 2] } }} />
        </QueryClientProvider>
      </StrictMode>
    );

    const { rerender } = render(renderSlider());
    await waitFor(() => expect(product.list).toHaveBeenCalledTimes(1));

    rerender(renderSlider());
    await waitFor(() => expect(product.list).toHaveBeenCalledTimes(1));
  });

  it('removes out-of-stock products when the setting is disabled', async () => {
    vi.mocked(product.list).mockResolvedValueOnce({
      items: [
        { id: 1, status: 'out' },
        { id: 2, status: 'sale' },
      ],
      next: null,
    } as Awaited<ReturnType<typeof product.list>>);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ProductsSlider data={{ products: { source: 'latest' } }} />
      </QueryClientProvider>
    );

    await waitFor(() =>
      expect(mocks.loaded).toHaveBeenCalledWith({
        items: [{ id: 2, status: 'sale' }],
        next: null,
      })
    );
  });

  it('asks cards for tile-sized images, not the listing-grid width', () => {
    mocks.cardProps.length = 0;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ProductsSlider data={{ products: { source: 'latest' } }} />
      </QueryClientProvider>
    );
    expect(mocks.cardProps[0]?.imageSizes).toBe('(min-width: 481px) 127px, 33vw');
  });

  it('keeps out-of-stock products when the setting is enabled', async () => {
    mocks.settings.show_out_of_stock_products = true;
    const result = {
      items: [{ id: 1, status: 'out' }],
      next: null,
    } as Awaited<ReturnType<typeof product.list>>;
    vi.mocked(product.list).mockResolvedValueOnce(result);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ProductsSlider data={{ products: { source: 'latest' } }} />
      </QueryClientProvider>
    );

    await waitFor(() => expect(mocks.loaded).toHaveBeenCalledWith(result));
  });
});
