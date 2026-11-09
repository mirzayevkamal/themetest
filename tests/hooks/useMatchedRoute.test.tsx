import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useIsCartRoute,
  useIsHomeRoute,
  useIsOrdersListRoute,
  useMatchedRouteId,
} from '../../app/hooks/useMatchedRoute';

let matches: Array<{ routeId: string }> = [];

vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (s: { matches: Array<{ routeId: string }> }) => unknown }) =>
    select({ matches }),
}));

describe('useMatchedRoute', () => {
  it('reads the leaf TanStack match so home/cart stay correct across navigations', () => {
    matches = [{ routeId: '/{-$locale}' }, { routeId: '/{-$locale}/' }];
    expect(renderHook(() => useMatchedRouteId()).result.current).toBe('/{-$locale}/');
    expect(renderHook(() => useIsHomeRoute()).result.current).toBe(true);
    expect(renderHook(() => useIsCartRoute()).result.current).toBe(false);
    expect(renderHook(() => useIsOrdersListRoute()).result.current).toBe(false);

    matches = [{ routeId: '/{-$locale}' }, { routeId: '/{-$locale}/cart' }];
    expect(renderHook(() => useIsHomeRoute()).result.current).toBe(false);
    expect(renderHook(() => useIsCartRoute()).result.current).toBe(true);

    matches = [{ routeId: '/{-$locale}' }, { routeId: '/{-$locale}/account/orders' }];
    expect(renderHook(() => useIsOrdersListRoute()).result.current).toBe(true);

    matches = [{ routeId: '/{-$locale}' }, { routeId: '/{-$locale}/account/orders/$id' }];
    expect(renderHook(() => useIsOrdersListRoute()).result.current).toBe(false);

    matches = [{ routeId: '/{-$locale}' }, { routeId: '/{-$locale}/account/profile' }];
    expect(renderHook(() => useIsHomeRoute()).result.current).toBe(false);
    expect(renderHook(() => useIsCartRoute()).result.current).toBe(false);
  });
});
