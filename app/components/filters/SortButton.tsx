import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { sortOptions } from '@salla.sa/twilight-theme-engine/utils/sort-options';
import { SortIcon } from '../icons/SortIcon';

/** Icon-sized sort control: the native select sits invisibly over the icon, so the
 *  phone opens its own picker. `sort` is null until the shopper picks one. */
export function SortButton({
  sort,
  ids,
  onChange,
}: {
  sort: string | null;
  ids: readonly string[];
  onChange: (sort: string) => void;
}) {
  const { t } = useTranslation();
  const options = sortOptions(sort ?? 'ourSuggest', t, ids);
  if (!options.length) return null;
  // The merchant may have turned off the default, or the sort an old link asks for.
  const shown = options.find((option) => option.is_selected)?.id ?? '';
  const label = t('pages.categories.sorting', 'Sort By');

  return (
    <label className="relative flex size-9 shrink-0 items-center justify-center rounded-lg border border-neutral-100 bg-white text-ink">
      <SortIcon />
      {sort ? (
        <span className="absolute -top-1 -end-1 size-2.5 rounded-full border-2 border-white bg-brand" />
      ) : null}
      <select
        aria-label={label}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
        value={shown}
        onChange={(event) => onChange(event.target.value)}
      >
        {shown === '' && (
          <option value="" disabled hidden>
            {label}
          </option>
        )}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}
