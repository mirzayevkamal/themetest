import { useEffect, useEffectEvent, useRef } from 'react';
import { Link } from '@salla.sa/twilight-theme-engine/common';
import { SearchIcon } from './icons';

/**
 * Header search box that opens the full-page search experience.
 *
 * Replaces the old `salla-search` inline dropdown: in the native webview the
 * dropdown rendered as a cramped transparent overlay on top of the page, so
 * search now lives on the /search route with the theme's product grid.
 */
export function SearchTrigger({ label, className = '' }: { label: string; className?: string }) {
  return (
    <Link
      to="/search"
      className={`flex h-11 w-full items-center gap-2 rounded-xl bg-white px-3 text-sm text-neutral-500 ${className}`}
    >
      <span className="shrink-0 text-neutral-400">
        <SearchIcon />
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

const SEARCH_DEBOUNCE_MS = 400;

/** Live search input (the /search page, the web-desktop header); debounces onSearch while typing. */
export function SearchInput({
  initialQuery,
  placeholder,
  onSearch,
  onClear,
  autoFocus = true,
  className = '',
  inputClassName = 'h-11 w-full rounded-xl border-neutral-100 bg-white pe-3 ps-9 text-sm text-ink placeholder:text-neutral-500 focus:border-neutral-200 focus:ring-0',
}: {
  initialQuery?: string;
  placeholder: string;
  onSearch: (query: string) => void;
  /** The field's own clear (✕) button emptied it. */
  onClear?: () => void;
  autoFocus?: boolean;
  className?: string;
  inputClassName?: string;
}) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const input = useRef<HTMLInputElement>(null);

  // Show a query that changed elsewhere (Back to a search, leaving it), but never
  // overwrite what the shopper is typing.
  useEffect(() => {
    const el = input.current;
    if (el && el !== document.activeElement) el.value = initialQuery ?? '';
  }, [initialQuery]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // The ✕ of a search field fires the native `search` event (Enter does too, but
  // never on an empty field: that is the clear), which React has no prop for.
  const onNativeSearch = useEffectEvent(() => {
    if (!onClear || input.current?.value) return;
    clearTimeout(timer.current);
    onClear();
  });
  useEffect(() => {
    const el = input.current;
    const listener = () => onNativeSearch();
    el?.addEventListener('search', listener);
    return () => el?.removeEventListener('search', listener);
  }, []);

  return (
    <div className={`relative min-w-0 flex-1 ${className}`}>
      <span className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-neutral-400 ltr:left-3 rtl:right-3">
        <SearchIcon />
      </span>
      <input
        ref={input}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoFocus={autoFocus}
        defaultValue={initialQuery}
        placeholder={placeholder}
        className={inputClassName}
        onChange={(e) => {
          clearTimeout(timer.current);
          const value = e.target.value;
          timer.current = setTimeout(() => onSearch(value), SEARCH_DEBOUNCE_MS);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            clearTimeout(timer.current);
            onSearch(e.currentTarget.value);
          }
        }}
      />
    </div>
  );
}
