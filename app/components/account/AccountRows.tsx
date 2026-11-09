import type { ReactNode } from 'react';
import { Link } from '@salla.sa/twilight-theme-engine/common';
import { ChevronIcon } from '../icons';

/** White card with the Figma section title and hairline-divided rows. */
export function Section({
  title,
  className = '',
  children,
}: {
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`flex flex-col gap-3 rounded-xl bg-white p-4 ${className}`}>
      {title && <h2 className="text-base font-bold text-brand">{title}</h2>}
      <div className="-my-2 divide-y divide-neutral-100">{children}</div>
    </section>
  );
}

interface RowProps {
  icon?: ReactNode;
  label: string;
  value?: ReactNode;
  to?: string;
  href?: string;
  onClick?: () => void;
  /** Replaces the default `py-2` row padding. */
  className?: string;
}

/** Icon + label + optional value + chevron; a Link, external anchor, or button. */
export function Row({ icon, label, value, to, href, onClick, className = 'py-2' }: RowProps) {
  className = `flex w-full items-center gap-2 text-start text-ink ${className}`;
  const content = (
    <>
      {icon}
      <span className="flex-1 text-sm">{label}</span>
      {value != null && <span className="text-xs text-brand">{value}</span>}
      <ChevronIcon />
    </>
  );
  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

interface ToggleRowProps {
  icon?: ReactNode;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}

/** Icon + label + switch; same row shape as `Row` but toggles instead of navigating. */
export function ToggleRow({ icon, label, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <div className="flex w-full items-center gap-2 py-2 text-start text-ink">
      {icon}
      <span className="flex-1 text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={onChange}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
          checked ? 'bg-brand' : 'bg-neutral-200'
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-[inset] ${
            checked ? 'start-[22px]' : 'start-0.5'
          }`}
        />
      </button>
    </div>
  );
}
