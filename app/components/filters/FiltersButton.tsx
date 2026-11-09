import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { Filter, ProductListFilters } from '@salla.sa/twilight-theme-engine/api/product';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { useStore } from '@salla.sa/twilight-theme-engine/hooks/useStore';
import { FilterIcon } from '../icons/FilterIcon';
import {
  closeFiltersDrawer,
  openFiltersDrawer,
  useFiltersDrawerOpen,
} from '../../hooks/useFiltersDrawer';

// The drawer, motion and the filters component load on the first tap.
const FiltersDrawer = lazy(() =>
  import('./FiltersDrawer').then((m) => ({ default: m.FiltersDrawer }))
);

/** The merchant's "product filters" switch (Settings → Products → Filters). */
export function useFiltersEnabled() {
  return Boolean(useStore()?.settings?.product?.filters);
}

/** Every filter the platform has, for a store whose setting is a bare `true`. */
const ALL_FILTER_KEYS = ['category_id', 'brand_id', 'price', 'variants', 'rating', 'tag_name'];

/** The keys of the filters the merchant switched on, or null when filters are off. */
export function useFilterKeys(): string[] | null {
  const setting = useStore()?.settings?.product?.filters;
  return useMemo(() => {
    if (!setting) return null;
    if (typeof setting !== 'object') return ALL_FILTER_KEYS;
    return Object.keys(setting).filter((key) => setting[key as keyof typeof setting]);
  }, [setting]);
}

/** Only the real filters out of a `<salla-filters>` payload: the component also turns
 *  every other query param (`scope`, `allocation_id`, …) into a filter. A copy, too:
 *  it keeps mutating the arrays it emitted, which would change query keys under React. */
export function pickFilters(
  filters: ProductListFilters | null | undefined,
  keys: readonly string[]
): ProductListFilters | undefined {
  const wanted = new Set(keys);
  const picked = Object.fromEntries(
    Object.entries(filters ?? {}).filter(([key]) => wanted.has(key))
  );
  return Object.keys(picked).length ? structuredClone(picked) : undefined;
}

/** Opens the filters drawer. A page that fetches its filters itself starts that on
 *  `onOpen`; the drawer shows a skeleton until `filters` arrive. */
export function FiltersButton({
  filters,
  active = false,
  onOpen,
}: {
  filters?: Filter[];
  active?: boolean;
  onOpen?: () => void;
}) {
  const { t } = useTranslation();
  // Shell state, so MainLayout makes the page inert while the drawer is open. The
  // button owns it: unmounting (a new search term remounts the search's button) takes
  // the drawer away, so the page must not stay inert behind nothing.
  const open = useFiltersDrawerOpen();
  const [opened, setOpened] = useState(false);
  useEffect(() => closeFiltersDrawer, []);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          openFiltersDrawer();
          setOpened(true);
          onOpen?.();
        }}
        aria-label={t('pages.filters.title', 'تصفية المنتجات')}
        aria-haspopup="dialog"
        className="relative flex size-9 shrink-0 items-center justify-center rounded-lg border border-neutral-100 bg-white text-ink"
      >
        <FilterIcon />
        {active ? (
          <span className="absolute -top-1 -end-1 size-2.5 rounded-full border-2 border-white bg-brand" />
        ) : null}
      </button>
      {opened ? (
        <Suspense fallback={null}>
          <FiltersDrawer open={open} filters={filters} onClose={closeFiltersDrawer} />
        </Suspense>
      ) : null}
    </>
  );
}

/** Drops the whole selection, the way `<salla-filters>` does on "reset", for a page
 *  whose filters drawer is closed. */
export function clearFilters() {
  const url = new URL(window.location.href);
  [...url.searchParams.keys()]
    .filter((key) => key.startsWith('filters['))
    .forEach((key) => url.searchParams.delete(key));
  window.history.replaceState(window.history.state, '', url);
  window.salla?.event.dispatch('salla-filters::changed', {});
}
