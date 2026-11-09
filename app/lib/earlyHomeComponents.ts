import { home } from '@salla.sa/twilight-theme-engine/api/home';
import { getTwilightContext, updateTwilightContext } from '@salla.sa/twilight-theme-engine/tanstack';
import type { HomeComponentData } from '@salla.sa/twilight-theme-engine/types';

// The root route's beforeLoad awaits settings, snippets and translations before the home
// loader may ask for the layout, so the two `component/list` calls (~150 ms) run after them
// instead of beside them. This starts them from the request middleware and hands the promise
// to the home loader through request-scoped storage.
// ponytail: theme-side workaround; the right place is the engine's rootBeforeLoad.

type EarlyStore = { components: Promise<HomeComponentData[] | undefined> };
type AsyncLocalStore<T> = { run<R>(store: T, fn: () => R): R; getStore(): T | undefined };

// Loaded the way the engine does: a static `node:async_hooks` import would reach the client bundle.
const storage: AsyncLocalStore<EarlyStore> | null = (() => {
  const proc = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }).process;
  const mod = proc?.getBuiltinModule?.('node:async_hooks') as
    | { AsyncLocalStorage: new <T>() => AsyncLocalStore<T> }
    | undefined;
  return mod ? new mod.AsyncLocalStorage<EarlyStore>() : null;
})();

const HOME_PATH = /^\/(?<locale>[a-z]{2}(?:-[a-z]{2})?)\/?$/i;

/** The locale of a home URL (`/ar`, `/meed-2027/en`), or null for any other page. */
export function homeLocale(pathname: string, storeBase: string | null): string | null {
  const base = storeBase ? `/${storeBase}` : '';
  if (!pathname.startsWith(base)) return null;
  return HOME_PATH.exec(pathname.slice(base.length))?.groups?.locale ?? null;
}

/** Runs `next` with the home layout request already in flight, when this is a home request. */
export function withEarlyHomeComponents<T>(request: Request, next: () => T): T {
  const { scope, storeBase } = getTwilightContext();
  const locale = homeLocale(new URL(request.url).pathname, storeBase);
  // A market (scope) may name its own theme version, which only the settings know.
  if (!storage || scope || !locale) return next();
  updateTwilightContext({ locale });
  const components = home.components().catch((): undefined => undefined);
  return storage.run({ components }, next);
}

/** The in-flight layout for this request, unless the request's scope changed since it started. */
export function earlyHomeComponents(): Promise<HomeComponentData[] | undefined> | undefined {
  const store = storage?.getStore();
  return store && !getTwilightContext().scope ? store.components : undefined;
}
