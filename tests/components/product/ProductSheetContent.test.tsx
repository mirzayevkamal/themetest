import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@salla.sa/twilight-theme-engine/types';
import ProductSheetContent, {
  loadProductPage,
} from '../../../app/components/product/ProductSheetContent';

const previews = new Map<string, Product>();
let resolveDetail!: (product: Product) => void;
let rejectDetail!: (reason: Error) => void;

vi.mock('@salla.sa/twilight-theme-engine/api/product', () => ({
  product: {
    queries: {
      detail: (id: string) => ({
        queryKey: ['products', 'detail', id],
        queryFn: () =>
          new Promise<Product>((resolve, reject) => {
            resolveDetail = resolve;
            rejectDetail = reject;
          }),
        placeholderData: () => previews.get(id),
      }),
    },
  },
}));
vi.mock('@salla.sa/twilight-theme-engine/skeleton', () => ({
  ProductDetailSkeleton: () => <p>skeleton</p>,
}));
vi.mock('../../../app/components/product/ProductPage', () => ({
  ProductPage: ({ product, isPreview }: { product: Product; isPreview?: boolean }) => (
    <p>
      page {product.name}
      {isPreview ? ' preview' : ''}
    </p>
  ),
}));
vi.mock('../../../app/components/product/ProductGallery', () => ({
  ProductGalleryStage: () => null,
}));
vi.mock('../../../app/components/product/ProductInfo', () => ({
  ProductInfo: ({ product }: { product: Product }) => <h1>{product.name}</h1>,
}));
vi.mock('../../../app/components/product/ProductActionBar', () => ({
  ProductActionBar: () => null,
}));

const renderSheet = (id: string, onClose = vi.fn()) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    onClose,
    ...render(
      <QueryClientProvider client={client}>
        <ProductSheetContent id={id} onClose={onClose} />
      </QueryClientProvider>
    ),
  };
};

describe('ProductSheetContent', () => {
  afterEach(() => {
    previews.clear();
  });

  it('shows the card product first, then upgrades when details arrive', async () => {
    await loadProductPage();
    previews.set('7', { id: 7, name: 'تفاح', price: 9 } as Product);
    renderSheet('7');

    expect(screen.queryByText('skeleton')).toBeNull();
    expect(await screen.findByText('page تفاح preview')).toBeTruthy();

    await act(async () => resolveDetail({ id: 7, name: 'تفاح كامل' } as Product));
    expect(await screen.findByText('page تفاح كامل')).toBeTruthy();
    expect(screen.queryByText(/preview/)).toBeNull();
  });

  it('falls back to the skeleton when there is no card product', () => {
    renderSheet('99');
    expect(screen.getByText('skeleton')).toBeTruthy();
  });

  it('closes the sheet when the product-detail request fails', async () => {
    const { onClose } = renderSheet('99');
    await act(async () => rejectDetail(new Error('Not Found')));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
