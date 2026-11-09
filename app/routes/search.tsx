// Theme-owned: do NOT restore the `@auto-generated` marker — the engine's vite
// plugin overwrites marked files on dev-server boot (dist/vite/index.js).
import { Suspense, use, useMemo, useState } from 'react';
import { createFileRoute, useLocation } from '@tanstack/react-router';
import {
  parseFiltersFromSearch,
  ProductListing,
  ProductListPage,
  searchListingSearch,
} from '@salla.sa/twilight-theme-engine/routes/product-listing';
import type { ProductListLoaderData } from '@salla.sa/twilight-theme-engine/routes/product-listing';
import type { Filter } from '@salla.sa/twilight-theme-engine/api/product';
import { withHead } from '@salla.sa/twilight-theme-engine/tanstack';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { SORT_IDS } from '@salla.sa/twilight-theme-engine/utils/sort-options';
import { SearchInput } from '../components/SearchBar';
import { BackButton, MobileOnly } from '../components/navigation';
import { CategoryChip } from '../components/categories/CategoryChip';
import { ScrollStrip } from '../components/categories/ScrollStrip';
import { SearchSort } from '../components/search/SearchSort';
import { FiltersButton, pickFilters, useFilterKeys } from '../components/filters/FiltersButton';
import { useSallaEvent } from '../hooks/sdk';

const CATEGORY_FILTER = 'category_id';

/**
 * Search route configuration. The engine's `searchListingSearch` keeps ?q=,
 * ?page= and ?sort= and hands them to the loader as `deps`.
 *
 * The loader hands back the listing promise unresolved, so this route renders
 * before it settles. Only `SearchResults` reads it, with React's `use()`.
 */
export const Route = createFileRoute('/{-$locale}/search')({
  ...searchListingSearch,
  // Never swap the page for the skeleton while a new query loads: keep the
  // search bar mounted (and focused) and let only the results update.
  pendingMs: Infinity,
  loader: ({ deps, params }) => ({
    results: ProductListing.loader({
      params: { source: 'search' },
      search: deps,
      locale: params.locale,
    }),
  }),
  // The title comes from the URL, not the listing, so the head never waits on it.
  head: withHead({ head: (ctx) => ({ title: String(ctx.location.search.q ?? '') }) }),
  component: ProductListingComponent,
});

/**
 * Search page. The bar reads the URL only, so it paints before the listing does.
 */
function ProductListingComponent() {
  const { results } = Route.useLoaderData();
  const { q, sort } = Route.useSearch();
  const navigate = Route.useNavigate();
  // Through `history`, like the chips and the drawer write their filters: the router
  // picks it up as a navigation (new `sort` dep, so the loader runs again) and the
  // `filters[...]` params in the address bar, which the router does not know, survive.
  const sortTo = (next: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('sort', next);
    url.searchParams.delete('page');
    window.history.pushState(window.history.state, '', url);
  };
  const { t } = useTranslation();
  const filtersEnabled = useFilterKeys() !== null;

  return (
    <div className="search-page">
      <header className="search-page-header mobile-sticky-bar sticky top-0 z-20 flex gap-2 border-b border-neutral-100 bg-white px-4 py-2">
        <MobileOnly>
          <BackButton />
        </MobileOnly>
        <SearchInput
          initialQuery={q}
          placeholder={t('pages.categories.search_placeholder', 'ابحث عن الموز، الخيار وغيره....')}
          onSearch={(query) => void navigate({ search: { q: query }, replace: true })}
        />
      </header>
      {q.trim() ? (
        <>
          {/* The sort needs only the URL, normalised the way the engine's loader does. */}
          <SearchSort
            sort={sort && SORT_IDS.includes(sort) ? sort : 'ourSuggest'}
            onChange={(next) => sortTo(next)}
          >
            {filtersEnabled ? (
              <Suspense fallback={null}>
                <SearchFilters key={q} results={results} />
              </Suspense>
            ) : null}
          </SearchSort>
          <Suspense fallback={null}>
            <SearchResults results={results} q={q} />
          </Suspense>
        </>
      ) : null}
    </div>
  );
}

/**
 * Chips and the engine list. Suspending here leaves the bar and sort mounted. The
 * chips wait with the list: the engine fetches filters and products in one request.
 */
function SearchResults({ results, q }: { results: Promise<ProductListLoaderData>; q: string }) {
  const data = use(results);

  return (
    <>
      <CategoryChips key={q} filters={data.filters} />
      <div className="search-results products-page [&_.breadcrumbs]:hidden">
        {/* Own boundary: the engine's lazy empty-state chunk must not suspend
            the chips. The raw engine list, not ProductListing.Component:
            search keeps its own bar, so it must stay clear of the
            `product:list-page` override. */}
        <Suspense fallback={null}>
          <ProductListPage {...data} />
        </Suspense>
      </div>
    </>
  );
}

/** The filters button, once the listing (which carries the options) has loaded. The
 *  category option stays out of the drawer: the chips are that filter. */
function SearchFilters({ results }: { results: Promise<ProductListLoaderData> }) {
  const { filters } = use(results);
  const filterKeys = useFilterKeys();
  const keys = useMemo(
    () => (filterKeys ?? []).filter((key) => key !== CATEGORY_FILTER),
    [filterKeys]
  );
  const searchStr = useLocation({ select: (location) => location.searchStr });
  const [active, setActive] = useState(
    () => pickFilters(parseFiltersFromSearch(searchStr), keys) !== undefined
  );
  useSallaEvent('salla-filters::changed', (data) =>
    setActive(pickFilters(data as Parameters<typeof pickFilters>[0], keys) !== undefined)
  );
  const options = filters?.filter((filter) => filter.key !== CATEGORY_FILTER);
  if (!options?.length) return null;
  return <FiltersButton filters={options} active={active} />;
}

/** The chip a `category_id` selection stands for: null is "all"; several categories
 *  have no single chip, "all" included. */
function chipFor(value: unknown): string | null {
  const ids = Array.isArray(value) ? value : value == null ? [] : [value];
  return ids.length === 0 ? null : ids.length === 1 ? String(ids[0]) : '';
}

/**
 * The search's categories (from the engine's filters) as chips. A tap goes through
 * the event `<salla-filters>` emits, so the engine refetches the list filtered on the
 * server; the URL keeps the choice the way `<salla-filters>` writes it.
 */
function CategoryChips({ filters }: { filters?: Filter[] }) {
  const { t } = useTranslation();
  const searchStr = useLocation({ select: (location) => location.searchStr });
  const [selected, setSelected] = useState(() =>
    chipFor(parseFiltersFromSearch(searchStr)?.[CATEGORY_FILTER])
  );
  // The drawer may pick (or drop) a category too.
  useSallaEvent('salla-filters::changed', (data) =>
    setSelected(chipFor((data as Record<string, unknown> | undefined)?.[CATEGORY_FILTER]))
  );
  const categories = filters?.find((filter) => filter.key === CATEGORY_FILTER)?.values ?? [];
  if (categories.length < 2) return null;

  const select = (id: string | null) => {
    setSelected(id);
    const url = new URL(window.location.href);
    url.searchParams.delete(`filters[${CATEGORY_FILTER}][]`);
    if (id) url.searchParams.append(`filters[${CATEGORY_FILTER}][]`, id);
    window.history.replaceState(window.history.state, '', url);
    // The rest of the drawer's selection stays applied.
    window.salla?.event.dispatch(
      'salla-filters::changed',
      parseFiltersFromSearch(url.search) ?? {}
    );
  };

  return (
    <div className="search-chips category-toolbar mb-4">
      <ScrollStrip className="bg-smoke">
        <div className="container flex w-max min-w-full max-w-none gap-2 py-3">
          <CategoryChip active={selected === null} onClick={() => select(null)}>
            {t('pages.search.all_categories', 'الكل')}
          </CategoryChip>
          {categories.map((category) => (
            <CategoryChip
              key={category.key}
              active={selected === category.key}
              onClick={() => select(category.key ?? null)}
            >
              {category.value}
            </CategoryChip>
          ))}
        </div>
      </ScrollStrip>
    </div>
  );
}
