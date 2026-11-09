import { product, type ProductListFilters } from '@salla.sa/twilight-theme-engine/api/product';
import type { Category } from '@salla.sa/twilight-theme-engine/types';
import type { CategoryListLoaderData } from '../../routes/$slug.c$id';
import type { ListingSelection } from '../filters/useListingSelection';

// The Storefront API's largest page: above 32 it silently answers with 15.
export const PRODUCTS_PER_PAGE = 32;

/** Without a sort or filters the params stay exactly the server's, so its cache entry is reused. */
export const categorySectionParams = (
  category: Category,
  { sort, filters }: ListingSelection = {}
) => ({
  source: 'categories' as const,
  sourceValue: category.id_ ?? category.id,
  perPage: PRODUCTS_PER_PAGE,
  ...(sort && { sort }),
  ...(filters && { filterable: true, filters }),
});

export const categorySectionQuery = (
  category: Category,
  selection?: ListingSelection
): ReturnType<typeof product.queries.list> =>
  product.queries.list(categorySectionParams(category, selection));

/** The section a visit lands on: the deep-linked sub-category, else the first one. */
export const landingSection = ({
  activeParent,
  activeSub,
}: Pick<CategoryListLoaderData, 'activeParent' | 'activeSub'>): Category =>
  activeSub ?? activeParent.sub_categories?.[0] ?? activeParent;

/** Sections in the HTML: the landing one and the next, which a short landing grid leaves above the fold. */
export const serverSections = (
  data: Pick<CategoryListLoaderData, 'activeParent' | 'activeSub'>
): Category[] => {
  const landing = landingSection(data);
  const subs = data.activeParent.sub_categories ?? [];
  const next = subs[subs.findIndex((s) => s.id === landing.id) + 1];
  return next ? [landing, next] : [landing];
};

/** The filter options for a parent tab's products (only fetched once its filters drawer
 *  opens), or, with a selection, the options left under it: its `category_id` values are
 *  the sub-categories that still have products. One product keeps the response small. */
export const categoryFiltersQuery = (
  category: Category,
  filters?: ProductListFilters
): ReturnType<typeof product.queries.list> =>
  product.queries.list({
    source: 'categories',
    sourceValue: category.id_ ?? category.id,
    perPage: 1,
    filterable: true,
    ...(filters && { filters }),
  });
