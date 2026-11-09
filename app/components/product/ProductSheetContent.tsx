import { lazy, Suspense, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { product as productApi } from '@salla.sa/twilight-theme-engine/api/product';
import { ProductDetailSkeleton } from '@salla.sa/twilight-theme-engine/skeleton';
import type { Product as ProductType } from '@salla.sa/twilight-theme-engine/types';
import { ProductActionBar } from './ProductActionBar';
import { ProductGalleryStage } from './ProductGallery';
import { ProductInfo } from './ProductInfo';

// Only the full page is lazy (comments, offers, the engine form); the preview
// pieces are in the shell so the sheet can paint on the click itself.
export const loadProductPage = () => import('./ProductPage');
const ProductPage = lazy(() => loadProductPage().then((m) => ({ default: m.ProductPage })));

/**
 * Body of the product sheet opened over the current page (see useProductSheetLinks).
 * `product.queries.detail` paints the list-card name/price as placeholderData.
 * The gallery shows the image already on that product until the first gallery
 * image is decoded, then the slider mounts once.
 */
export default function ProductSheetContent({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isPlaceholderData, isError } = useQuery(productApi.queries.detail(id));

  useEffect(() => {
    // Out-of-stock/hidden products 404; the full product route redirects home.
    if (isError) onClose();
  }, [isError, onClose]);

  if (!data) return <ProductDetailSkeleton />;
  // Always mount ProductPage once we have any product (card placeholder or
  // details). Swapping Preview → Page remounted the gallery and flashed its
  // image skeleton. The form stays behind ProductPage's own Suspense.
  return (
    <Suspense fallback={<ProductPreview product={data} isPreview={isPlaceholderData} />}>
      <ProductPage product={data} isPreview={isPlaceholderData} />
    </Suspense>
  );
}

/** Same layout as ProductPage minus the engine form, so the swap doesn't shift. */
export function ProductPreview({
  product,
  isPreview = true,
}: {
  product: ProductType;
  isPreview?: boolean;
}) {
  return (
    <div className="product-page flex h-full min-h-0 flex-col">
      <div className="product-page__scroll min-h-0 flex-1 overflow-y-auto">
        <div className="container">
          <div className="product-page__hero flex flex-col items-start">
            <ProductGalleryStage product={product} isPreview={isPreview} />
            <div className="product-page__details main-content w-full">
              <ProductInfo product={product} />
              <ProductActionBar product={product} className="product-page__buy--inline" />
            </div>
          </div>
        </div>
      </div>
      <ProductActionBar product={product} className="product-page__buy--dock" />
    </div>
  );
}
