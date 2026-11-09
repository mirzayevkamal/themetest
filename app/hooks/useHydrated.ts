import { useEffect, useState } from 'react';

/**
 * False during SSR and the first client render, true after mount.
 * Use this to keep custom elements (salla-slider, etc.) out of the hydrate
 * pass — Twilight defines them from a head module before React runs, and
 * they move slot children so hydration cannot match.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
