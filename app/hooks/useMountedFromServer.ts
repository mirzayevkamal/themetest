import { useState, useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * True when this component was server-rendered (SSR and its hydration pass),
 * false when it first mounted on the client, e.g. a sheet opened by a click.
 * Latched on the first render, so it doesn't flip once hydration ends.
 */
export function useMountedFromServer(): boolean {
  const fromServer = useSyncExternalStore(
    subscribe,
    () => false,
    () => true
  );
  const [latched] = useState(fromServer);
  return latched;
}
