import { useSyncExternalStore } from 'react';

/** Module-level open state for a shell overlay (drawer, sheet). `closed` is also
 *  the SSR snapshot, so an overlay never renders on the server. */
export function createOverlayStore<T>(closed: T) {
  let value = closed;
  const listeners = new Set<() => void>();

  const set = (next: T) => {
    if (Object.is(value, next)) return;
    value = next;
    listeners.forEach((cb) => cb());
  };
  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  };

  return {
    open: set,
    close: () => set(closed),
    useValue: () =>
      useSyncExternalStore(
        subscribe,
        () => value,
        () => closed
      ),
  };
}
