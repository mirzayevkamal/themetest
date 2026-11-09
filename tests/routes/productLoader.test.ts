import { describe, it, expect, vi } from 'vitest';

const loader = vi.hoisted(() => vi.fn());

vi.mock('@salla.sa/twilight-theme-engine/routes/product', () => ({ Product: { loader } }));
vi.mock('@salla.sa/twilight-theme-engine/skeleton', () => ({ ProductDetailSkeleton: () => null }));
vi.mock('@salla.sa/twilight-theme-engine/tanstack', () => ({ withHead: () => () => ({}) }));
vi.mock('../../app/components/product/ProductPage', () => ({ ProductPage: () => null }));
vi.mock('../../app/components/product/ProductSheetContent', () => ({
  ProductPreview: () => null,
}));

import { productLoader } from '../../app/routes/$slug.p$id';

describe('productLoader', () => {
  it('returns engine data when the product loads', async () => {
    loader.mockResolvedValueOnce({ product: { id: 1 } });
    await expect(productLoader({ params: { id: '1', locale: 'ar' } })).resolves.toEqual({
      product: { id: 1 },
    });
  });

  it('redirects home (locale-aware) when the API 404s, e.g. out-of-stock product', async () => {
    loader.mockRejectedValueOnce(new Error('Not Found'));
    await expect(productLoader({ params: { id: '1', locale: 'ar' } })).rejects.toMatchObject({
      options: { to: '/ar', replace: true },
    });
  });

  it('redirects to / when there is no locale segment', async () => {
    loader.mockRejectedValueOnce(new Error('Not Found'));
    await expect(productLoader({ params: { id: '1' } })).rejects.toMatchObject({
      options: { to: '/' },
    });
  });
});
