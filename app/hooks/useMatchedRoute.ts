import { useRouterState } from '@tanstack/react-router';

/** TanStack file-route ids — locale-agnostic, unlike pathname matching. */
export const HOME_ROUTE_ID = '/{-$locale}/';
export const CART_ROUTE_ID = '/{-$locale}/cart';
export const ORDERS_LIST_ROUTE_ID = '/{-$locale}/account/orders';
export const CATEGORY_ROUTE_ID = '/{-$locale}/$slug/c{$id}';
export const PRODUCT_ROUTE_ID = '/{-$locale}/$slug/p{$id}';
export const SEARCH_ROUTE_ID = '/{-$locale}/search';

/** Engine `useRouteId` / `useIsHome` lag behind client navigations. Shell UI
 *  that must match the URL (home SiteHeader, cart dock, bottom nav) reads the
 *  leaf TanStack match instead. */
export function useMatchedRouteId(): string {
  return useRouterState({
    select: (s) => String(s.matches[s.matches.length - 1]?.routeId ?? ''),
  });
}

export function useIsHomeRoute(): boolean {
  return useMatchedRouteId() === HOME_ROUTE_ID;
}

export function useIsCartRoute(): boolean {
  return useMatchedRouteId() === CART_ROUTE_ID;
}

export function useIsOrdersListRoute(): boolean {
  return useMatchedRouteId() === ORDERS_LIST_ROUTE_ID;
}
