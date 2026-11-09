import type { ReactNode } from 'react';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { useStore } from '@salla.sa/twilight-theme-engine/hooks/useStore';
import { availableSortIds, sortOptions } from '@salla.sa/twilight-theme-engine/utils/sort-options';

/** The engine list's sort select, rendered by search above its category chips;
 *  `children` sit beside it (the filters button). */
export function SearchSort({
  sort = '',
  onChange,
  children,
}: {
  sort?: string;
  onChange: (sort: string) => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const store = useStore();
  const options = sortOptions(
    sort,
    t,
    availableSortIds('search', store?.settings?.product?.sort_options)
  );
  // The merchant may have turned off the sort the URL asks for.
  const shown = options.some((option) => option.is_selected) ? sort : '';
  if (!options.length && !children) return null;

  return (
    <div className="search-sort container flex justify-end gap-2 py-4">
      {children}
      {/* A content-sized box: `.form-input` is width: 100%. */}
      <div className={options.length ? undefined : 'hidden'}>
        <select
          aria-label={t('pages.categories.sorting', 'Sort By')}
          className="form-input !h-9 py-0 pe-9"
          value={shown}
          onChange={(event) => onChange(event.target.value)}
        >
          {shown === '' && (
            <option value="" disabled hidden>
              {t('pages.categories.sorting', 'Sort By')}
            </option>
          )}
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
