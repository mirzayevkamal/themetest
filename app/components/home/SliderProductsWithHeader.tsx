import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { useTheme } from '@salla.sa/twilight-theme-engine/hooks/useTheme';
import type { Product } from '@salla.sa/twilight-theme-engine/types';
import { product, type ProductsListSource } from '@salla.sa/twilight-theme-engine/api/product';

import { SallaProductsSlider } from '@salla.sa/twilight-components-react';
import { ProductCard } from '../product';
import { ProductsSliderPlaceholder } from './placeholders';

interface ProductsSourceConfig {
  source?: string;
  source_value?: number | number[] | null;
}

export interface SliderProductsWithHeaderData {
  background?: string;
  title?: string;
  description?: string;
  display_all_url?: string;
  products?: ProductsSourceConfig | Product[];
  position?: number;
  [key: string]: unknown;
}

export interface SliderProductsWithHeaderProps {
  data: SliderProductsWithHeaderData;
}

export function SliderProductsWithHeader({ data }: SliderProductsWithHeaderProps) {
  const { t } = useTranslation();
  const { settings } = useTheme();
  const queryClient = useQueryClient();
  const showOutOfStockProducts =
    (settings as { show_out_of_stock_products?: boolean }).show_out_of_stock_products === true;
  const {
    background,
    title,
    description,
    display_all_url: displayAll,
    products: productsField,
    position = 1,
  } = data;

  let resolvedSource: ProductsListSource | undefined;
  let resolvedSourceValue: string | number | number[] | undefined;

  if (
    productsField &&
    !Array.isArray(productsField) &&
    typeof productsField === 'object' &&
    'source' in productsField
  ) {
    const config = productsField as ProductsSourceConfig;
    if (config.source) {
      resolvedSource = config.source as ProductsListSource;
      resolvedSourceValue = config.source_value ?? undefined;
    }
  } else {
    const products: Product[] = Array.isArray(productsField) ? productsField : [];
    const ids = products.map((p) => p.id).filter((id): id is number => typeof id === 'number');
    if (ids.length) {
      resolvedSource = 'selected';
      resolvedSourceValue = ids;
    }
  }

  // display_all_url is a variable-list field in twilight.json; unset it can arrive
  // as null or [] — only a real URL string should render the link.
  const displayAllUrl =
    typeof displayAll === 'string' && displayAll !== '' && displayAll !== '#'
      ? displayAll
      : undefined;
  const hasHeader = Boolean(title || description);

  // The inline-products branch builds a fresh ids array every render; key the
  // callback on its contents so SallaProductsSlider doesn't refetch each render.
  const sourceValueKey = Array.isArray(resolvedSourceValue)
    ? resolvedSourceValue.join(',')
    : resolvedSourceValue;
  const loadKey = `${resolvedSource ?? ''}:${sourceValueKey ?? ''}:${showOutOfStockProducts}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  // Nothing to show (empty, all filtered out, or failed): render nothing so the
  // section collapses instead of keeping its reserved height.
  const [emptyKey, setEmptyKey] = useState<string | null>(null);
  const loader = useCallback(async () => {
    let result;
    try {
      result = await queryClient.fetchQuery(
        product.queries.list({
          source: resolvedSource as ProductsListSource,
          sourceValue: resolvedSourceValue,
        })
      );
    } catch (error) {
      setEmptyKey(loadKey);
      throw error;
    }

    const filteredResult = showOutOfStockProducts
      ? result
      : { ...result, items: result.items.filter((product) => product.status !== 'out') };

    if (filteredResult.items.length > 0) setLoadedKey(loadKey);
    else setEmptyKey(loadKey);
    return filteredResult;
  }, [queryClient, resolvedSource, sourceValueKey, showOutOfStockProducts, loadKey]);

  if (!resolvedSource || emptyKey === loadKey) return null;

  return (
    <div className="slider-products-with-header" hidden={loadedKey !== loadKey}>
      <div
        className="slider-bg"
        style={{ backgroundImage: background ? `url('${background}')` : undefined }}
      >
        {hasHeader && (
          <div className="container pt-8 sm:pt-20 relative">
            <div>
              {title && <h3 className="text-lg font-bold leading-12">{title}</h3>}
              {description && <p className="text-sm mb-8 line-clamp-2 max-w-lg">{description}</p>}
            </div>
          </div>
        )}
      </div>

      <div className="container -mt-[122px] sm:-mt-62 relative overflow-hidden">
        <SallaProductsSlider
          loader={loader}
          sliderProps={{
            id: `slider-with-bg-${position}`,
            displayAllTitle: t('blocks.home.display_all', 'View All'),
            // No editor switch. Omitting the prop mounts the element default arrows,
            // and a saved show_controls value must not turn them back on.
            showControls: false,
          }}
          blockTitle=" "
          skeleton={<ProductsSliderPlaceholder withTitle={false} />}
          {...(displayAllUrl ? { displayAllUrl } : {})}
        >
          {(product) => <ProductCard product={product} />}
        </SallaProductsSlider>
      </div>
    </div>
  );
}
