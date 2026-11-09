import { QueryClient } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  type AnyRoute,
} from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { store } from '@salla.sa/twilight-theme-engine/api/store';
// The `/{-$locale}` layout the installed engine generates (`pnpm dev` / `pnpm build`).
import { Route as LocaleRoute } from '../../node_modules/@salla.sa/twilight-theme-engine/.twilight/$locale';

/** The engine's locale layout on a real router, with a store that offers Arabic and English. */
async function visit(url: string) {
  const { beforeLoad, loader } = LocaleRoute.options as AnyRoute['options'];
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()();
  const locale = createRoute({
    getParentRoute: () => root,
    path: '/{-$locale}',
    beforeLoad,
    loader,
  });
  const queryClient = new QueryClient();
  queryClient.setQueryData(store.queries.settings().queryKey, {
    store: { settings: { is_multilingual: true } },
    languages: [
      { code: 'ar', iso_code: 'ar' },
      { code: 'en', iso_code: 'en' },
    ],
  } as never);
  const router = createRouter({
    routeTree: root.addChildren([
      locale.addChildren([createRoute({ getParentRoute: () => locale, path: '/' })]),
    ]),
    history: createMemoryHistory({ initialEntries: [url] }),
    context: { queryClient },
  });
  await router.load();
  const { pathname, searchStr } = router.state.location;
  return { pathname, search: new URLSearchParams(searchStr) };
}

describe('changing language from the localization modal', () => {
  it('keeps the market when the home page URL names one', async () => {
    // The modal leaves `/ar?scope=7` as `/ar?scope=7&lang=en`: no slash after the locale to rewrite.
    const { pathname, search } = await visit('/ar?scope=7&lang=en');
    expect(pathname).toBe('/en');
    expect(search.get('scope')).toBe('7');
    expect(search.has('lang')).toBe(false);
  });

  it('switches back to Arabic the same way', async () => {
    const { pathname, search } = await visit('/en?scope=7&lang=ar');
    expect(pathname).toBe('/ar');
    expect(search.get('scope')).toBe('7');
  });

  it('stays on the page for a language the store does not offer', async () => {
    expect((await visit('/ar?scope=7&lang=bg')).pathname).toBe('/ar');
  });
});
