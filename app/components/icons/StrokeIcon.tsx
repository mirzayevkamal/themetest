import type { ReactNode } from 'react';

// Account screens: stroke icons from the Figma set, 16px in list rows.
export type StrokeIconProps = { size?: number; className?: string };

export function StrokeIcon({
  size = 16,
  className,
  viewBox,
  children,
}: StrokeIconProps & { viewBox: string; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.125"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}
