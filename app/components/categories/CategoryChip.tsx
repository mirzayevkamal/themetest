import type { ReactNode } from 'react';
import { useAccentOutlined } from '../../hooks/useAccentStyle';

/** Sub-category chip of the category page, also the category filter on search. */
export function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const outlined = useAccentOutlined();
  return (
    <button
      type="button"
      aria-current={active || undefined}
      onClick={onClick}
      className={`whitespace-nowrap rounded-lg border px-2 py-1 text-sm transition-colors ${
        active
          ? outlined
            ? 'bg-brand-reverse border-brand text-ink font-bold'
            : 'bg-brand-tint border-brand-tint-hover text-brand-deep font-bold'
          : 'bg-white border-brand-tint text-ink'
      }`}
    >
      {children}
    </button>
  );
}
