import { useQuery } from '@tanstack/react-query';
import { product as productApi } from '@salla.sa/twilight-theme-engine/api/product';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { useIsWebDesktop } from '../../hooks/useIsWebDesktop';
import { ProductsSlider } from '../home/ProductsSlider';
import { ProductsSliderPlaceholder } from '../home/placeholders';
import { ProductCard } from './ProductCard';

/**
 * Outline of the loaded row in the same footprint (`.product-page__related-skeleton`
 * sizes it per layout). SSR can't know the viewport, so both outlines ship and CSS
 * shows the phone tile row or the web-desktop slider.
 */
export function RelatedProductsSkeleton() {
  return (
    <div aria-hidden="true" className="product-page__related-skeleton">
      <div className="product-page__related-skeleton-phone flex flex-col gap-3 overflow-hidden rounded-xl bg-white p-3">
        <div className="h-4 w-28 animate-pulse rounded bg-gray-100" />
        <div className="product-page__related-row grid grid-flow-col gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex flex-col gap-1">
              <div className="product-page__related-skeleton-tile animate-pulse rounded-xl bg-gray-100" />
              <div className="h-3 w-10 animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
      <div className="product-page__related-skeleton-desktop">
        <ProductsSliderPlaceholder />
      </div>
    </div>
  );
}

/**
 * "Usually ordered with it". Phone: a scrolling row of product cards, sized like the
 * category grid, under the details card.
 * Web desktop: the home products slider (same query key, so no second fetch).
 */
export function RelatedProducts({ productId }: { productId: number }) {
  const { t } = useTranslation();
  const desktop = useIsWebDesktop();
  const { data, isPending } = useQuery(
    productApi.queries.list({ source: 'related', sourceValue: productId })
  );
  // Keyed so React swaps the node rather than restyling it in place.
  if (isPending) return <RelatedProductsSkeleton key="pending" />;
  const items = data?.items ?? [];
  if (!items.length) return null;
  const title = t('pages.products.usually_ordered_with', 'بالعادة يطلب معهُ');

  if (desktop) {
    return (
      <section className="s-block s-block--products-slider">
        <ProductsSlider
          data={{
            products: { source: 'related', source_value: productId },
            title,
            show_controls: true,
            position: productId,
          }}
        />
      </section>
    );
  }

  return (
    <div key="list" className="mt-2 flex flex-col gap-3 overflow-hidden rounded-xl bg-white p-3">
      <h2 className="text-base font-bold leading-none text-ink">{title}</h2>
      <ul className="product-page__related-row -mx-3 grid grid-flow-col gap-2 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <li key={item.id}>
            <ProductCard product={item} imageSizes="33vw" />
          </li>
        ))}
      </ul>
    </div>
  );
}
