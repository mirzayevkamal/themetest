import React from 'react';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { installScrollRestoration } from '../../app/lib/scrollRestoration';

describe('installScrollRestoration in the phone shell', () => {
  it('opens a new page at the top of #main-content, and Back returns to the saved spot', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    // jsdom has no layout or Element#scrollTo: back the scroller with a plain number.
    let top = 0;
    HTMLElement.prototype.scrollTo = function (this: HTMLElement, opts?: ScrollToOptions | number) {
      if (this.id === 'main-content') top = typeof opts === 'number' ? 0 : (opts?.top ?? 0);
    } as typeof HTMLElement.prototype.scrollTo;
    const rootRoute = createRootRoute({
      component: () => (
        <main id="main-content">
          <Outlet />
        </main>
      ),
    });
    const page = (path: string) =>
      createRoute({ getParentRoute: () => rootRoute, path, component: () => <p>{path}</p> });
    const router = createRouter({
      routeTree: rootRoute.addChildren([page('/fruits'), page('/meat')]),
      history: createMemoryHistory({ initialEntries: ['/fruits'] }),
      scrollRestoration: true,
    });
    installScrollRestoration(router);
    render(<RouterProvider router={router} />);
    await act(() => router.load());

    const main = document.getElementById('main-content')!;
    Object.defineProperty(main, 'scrollTop', { get: () => top, set: (y) => (top = y) });

    // Halfway down one category, the shopper opens another.
    top = 1000;
    main.dispatchEvent(new Event('scroll'));
    await act(() => router.navigate({ to: '/meat' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/meat'));
    expect(top).toBe(0);

    act(() => router.history.back());
    await waitFor(() => expect(top).toBe(1000));
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo');
  });

  it('opens a new category with its chip row at the start, and Back returns to the saved spot', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    let left = 0;
    HTMLElement.prototype.scrollTo = function (this: HTMLElement, opts?: ScrollToOptions | number) {
      if (this.classList.contains('overflow-x-auto'))
        left = typeof opts === 'number' ? 0 : (opts?.left ?? 0);
    } as typeof HTMLElement.prototype.scrollTo;
    const rootRoute = createRootRoute({ component: () => <Outlet /> });
    const page = (path: string) =>
      createRoute({
        getParentRoute: () => rootRoute,
        path,
        component: () => (
          <div className="category-chips">
            <div className="overflow-x-auto">{path}</div>
          </div>
        ),
      });
    const router = createRouter({
      routeTree: rootRoute.addChildren([page('/fruits'), page('/meat')]),
      history: createMemoryHistory({ initialEntries: ['/fruits'] }),
      scrollRestoration: true,
    });
    installScrollRestoration(router);
    render(<RouterProvider router={router} />);
    await act(() => router.load());

    // Each page mounts its own strip: back every strip's scrollLeft with the one number.
    Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
      configurable: true,
      get: () => left,
      set: (x) => (left = x),
    });
    const strip = () => document.querySelector<HTMLElement>('.category-chips .overflow-x-auto')!;

    // The shopper swipes the chips (RTL scrolls negative), then opens another category.
    left = -400;
    strip().dispatchEvent(new Event('scroll'));
    await act(() => router.navigate({ to: '/meat' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/meat'));
    expect(left).toBe(0);

    act(() => router.history.back());
    await waitFor(() => expect(left).toBe(-400));
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo');
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollLeft');
  });
});
