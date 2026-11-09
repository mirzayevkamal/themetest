import type { ReactNode } from 'react';

/**
 * Mobile page chrome, such as a back button or the category back-and-search bar.
 * The desktop shell does not show it. A page title or search field stays outside
 * this component so it remains part of the page.
 */
export function MobileOnly({ children }: { children: ReactNode }) {
  return <div className="mobile-only">{children}</div>;
}
