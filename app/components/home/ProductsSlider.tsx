import { Suspense, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SallaProductsSlider } from '@salla.sa/twilight-components-react';
import { ProductsSliderPlaceholder } from './placeholders';
import { useTheme } from '@salla.sa/twilight-theme-engine/hooks/useTheme';
import { product, ProductsListSource } from '@salla.sa/twilight-theme-engine/api/product';
import { ProductCard } from '../product';

// Slider tiles: a third of the phone shell (`.s-products-slider-card`), a fixed
// 127px from 481px up. The grid default would fetch 640px for them.
const SLIDER_CARD_IMAGE_SIZES = '(min-width: 481px) 127px, 33vw';

interface ProductsSourceConfig {
  source: ProductsListSource;
  source_value?: number | number[] | null;
}

export interface ProductsSliderProps {
  data: {
    products: ProductsSourceConfig;
    title?: string;
    display_all_url?: string;
    position?: number;
    priority?: boolean;
    /**
     * Platform block has no editor switch. Omitted mounts arrows; explicit
     * false hides them.
     */
    show_controls?: boolean;
    controls_outer?: boolean;
    loop?: boolean;
    centered?: boolean;
    slides_per_view?: number | 'auto';
    direction?: 'rtl' | 'ltr';
    autoplay?: boolean;
    [key: string]: unknown;
  };
}

export function ProductsSlider({ data }: ProductsSliderProps) {
  const { settings } = useTheme();
  const queryClient = useQueryClient();
  const showOutOfStockProducts =
    (settings as { show_out_of_stock_products?: boolean }).show_out_of_stock_products === true;
  const {
    products,
    title,
    position = 1,
    priority = false,
    show_controls,
    controls_outer: controlsOuter,
    loop,
    centered,
    slides_per_view: slidesPerView,
    direction,
    autoplay,
  } = data;

  const sliderProps = useMemo(
    () => ({
      id: `slider-${position}`,
      showControls: show_controls !== false,
      ...(controlsOuter !== undefined && { controlsOuter }),
      ...(loop !== undefined && { loop }),
      ...(centered !== undefined && { centered }),
      ...(slidesPerView !== undefined && { slidesPerView }),
      ...(direction !== undefined && { direction }),
    }),
    [position, show_controls, controlsOuter, loop, centered, slidesPerView, direction]
  );

  const sourceValueKey = Array.isArray(products.source_value)
    ? products.source_value.join(',')
    : products.source_value;
  const loader = useCallback(async () => {
    const result = await queryClient.fetchQuery(
      product.queries.list({
        source: products.source,
        sourceValue: products.source_value,
      })
    );

    return showOutOfStockProducts
      ? result
      : { ...result, items: result.items.filter((product) => product.status !== 'out') };
  }, [queryClient, products.source, sourceValueKey, showOutOfStockProducts]);

  return (
    <Suspense fallback={<ProductsSliderPlaceholder />}>
      <SallaProductsSlider
        id={`best-offers-${position}-slider`}
        loader={loader}
        sliderProps={sliderProps}
        {...(title ? { blockTitle: title } : {})}
        {...(autoplay !== undefined ? { autoplay } : {})}
        skeleton={<ProductsSliderPlaceholder />}
      >
        {(product, index) => (
          <ProductCard
            product={product}
            imagePriority={priority && index < 2}
            imageSizes={SLIDER_CARD_IMAGE_SIZES}
          />
        )}
      </SallaProductsSlider>
    </Suspense>
  );
}
