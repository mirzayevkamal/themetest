import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useStore } from '@salla.sa/twilight-theme-engine/hooks/useStore';
import { availableSortIds } from '@salla.sa/twilight-theme-engine/utils/sort-options';
import type { Category } from '@salla.sa/twilight-theme-engine/types';
import { useFilterKeys } from '../filters/FiltersButton';
import { useListingSelection } from '../filters/useListingSelection';
import { categoryFiltersQuery } from './sectionQuery';

/**
 * The top sort and filters of a category tab, applied to every one of its sections.
 * `sections` are the ones that still have products under the filters, `settled` is the
 * selection the sections render: a new filter reaches them only once that answer is in,
 * so the ones about to disappear never fetch it.
 */
export function useSectionSelection({
  activeParent,
  allSections,
  hasSubSections,
}: {
  activeParent: Category;
  allSections: Category[];
  hasSubSections: boolean;
}) {
  const store = useStore();
  const sortIds = availableSortIds('categories', store?.settings?.product?.sort_options);
  const filterKeys = useFilterKeys();
  const parentId = String(activeParent.id_ ?? activeParent.id);
  const { selection, setSort, clear, read } = useListingSelection(filterKeys, parentId);

  // The options come from a separate request, made once this tab's drawer opens. The
  // category option is left out: the chips and sections already split the tab.
  const [filtersFor, setFiltersFor] = useState<string | null>(null);
  const { data: options } = useQuery({
    ...categoryFiltersQuery(activeParent),
    enabled: filtersFor === parentId,
  });
  const filterOptions = useMemo(
    () => options?.filters?.filter((filter) => filter.key !== 'category_id'),
    [options]
  );

  // One request per filter change says which sub-categories still have products; the
  // others lose their chip and section. The previous answer holds until the next lands.
  const { data: inFilter, isPlaceholderData: inFilterStale } = useQuery({
    ...categoryFiltersQuery(activeParent, selection.filters),
    enabled: hasSubSections && Boolean(selection.filters),
    placeholderData: keepPreviousData,
    select: (result) =>
      new Set(
        result.filters?.find((f) => f.key === 'category_id')?.values?.map((v) => String(v.key)) ??
          []
      ),
  });
  const sections =
    hasSubSections && selection.filters && inFilter
      ? allSections.filter((s) => inFilter.has(String(s.id_ ?? s.id)))
      : allSections;
  // Until the answer for the current filters is in, the sections keep the previous one.
  const waiting = hasSubSections && Boolean(selection.filters) && (!inFilter || inFilterStale);
  const [settled, setSettled] = useState(selection);
  if (!waiting && settled !== selection) setSettled(selection);

  return {
    sortIds,
    filtersEnabled: filterKeys !== null,
    parentId,
    selection,
    setSort,
    clear,
    filterOptions,
    openFilters: () => setFiltersFor(parentId),
    sections,
    settled,
    // This tab's own selection, read from the address bar, with no filter applied or pending.
    unfiltered: read && !selection.filters && !settled.filters,
  };
}
