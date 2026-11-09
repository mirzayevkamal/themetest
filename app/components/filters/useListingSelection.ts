import { useEffect, useMemo, useState } from 'react';
import type { ProductListFilters } from '@salla.sa/twilight-theme-engine/api/product';
import { parseFiltersFromSearch } from '@salla.sa/twilight-theme-engine/routes/product-listing';
import { useSallaEvent } from '../../hooks/sdk';
import { clearFilters, pickFilters } from './FiltersButton';

export interface ListingSelection {
  sort?: string;
  filters?: ProductListFilters;
}

const sortFromUrl = () => new URLSearchParams(window.location.search).get('sort') ?? undefined;

/**
 * The shopper's sort and `<salla-filters>` selection for a page that lists several
 * category sections. Both live in the address bar (`?sort=`, `filters[...]`) so a
 * reload keeps them; they are read after mount, so the server HTML stays unsorted.
 * `filterKeys` are the filters that count (null: filters are off); the page's own
 * sections already split it by category, so `category_id` is left out. `resetKey`
 * (the parent tab) starts over from the address bar.
 */
export function useListingSelection(filterKeys: readonly string[] | null, resetKey: string) {
  // With the tab it was last read from the address bar for: until that read, the selection
  // is the previous tab's, or the empty first render's.
  const [read, setRead] = useState<{ for: string | null; selection: ListingSelection }>({
    for: null,
    selection: {},
  });
  const selection = read.selection;
  const setSelection = (next: (current: ListingSelection) => ListingSelection) =>
    setRead((current) => ({ ...current, selection: next(current.selection) }));
  const keys = useMemo(
    () => filterKeys?.filter((key) => key !== 'category_id') ?? null,
    [filterKeys]
  );

  useEffect(() => {
    const filters = parseFiltersFromSearch(window.location.search);
    setRead({
      for: resetKey,
      selection: { sort: sortFromUrl(), filters: keys ? pickFilters(filters, keys) : undefined },
    });
  }, [keys, resetKey]);

  useSallaEvent('salla-filters::changed', (data) => {
    if (!keys) return;
    setSelection((current) => ({
      ...current,
      filters: pickFilters(data as ProductListFilters | undefined, keys),
    }));
  });

  const setSort = (sort: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('sort', sort);
    window.history.replaceState(window.history.state, '', url);
    setSelection((current) => ({ ...current, sort }));
  };

  const clear = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('sort');
    window.history.replaceState(window.history.state, '', url);
    setSelection(() => ({}));
    if (selection.filters) clearFilters();
  };

  return { selection, setSort, clear, read: read.for === resetKey };
}
