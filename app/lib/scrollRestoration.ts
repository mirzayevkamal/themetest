type Location = { pathname: string; search: Record<string, unknown> };
type Match = { loaderData?: unknown };

/** The slice of the TanStack router the scroll policy reads. */
export interface ScrollRouter {
  options: { scrollRestoration?: unknown; scrollToTopSelectors?: unknown };
  state: { matches: readonly Match[] };
  /** Absent on the server, where Start attaches the request's history after creation. */
  history?: { subscribe(fn: (event: { action: { type: string } }) => void): unknown };
  subscribe(
    event: 'onBeforeNavigate',
    fn: (event: { fromLocation?: Location; toLocation: Location }) => void
  ): unknown;
}

let returning = false;
/** The navigation in progress is a browser Back, Forward or Go: the page has a saved position. */
export const returningInHistory = () => returning;

const term = (search: Record<string, unknown>) => search.q;

/** A sub-category URL's loader data; the page jumps to that section on mount. */
const deepLinkedSub = (matches: readonly Match[]) =>
  matches.some((m) => Boolean((m.loaderData as { activeSub?: unknown } | undefined)?.activeSub));

/**
 * Decides when the router may scroll the page after a navigation.
 *
 * - Salla's filters component and the sort control rewrite only the query string, straight
 *   through `history`. The router still runs a navigation for it, and its scroll
 *   restoration would then jump the page (to a stale position, or the top). A refinement
 *   of the page in view keeps its scroll; a new path, or a new search term, restores.
 * - A sub-category deep link scrolls to its section when the page mounts. The router's
 *   scroll-to-top for a new path runs after that (on render), so it stays out of the way,
 *   except on Back or Forward, where the shopper's saved position wins.
 */
export function installScrollRestoration(router: ScrollRouter) {
  let refining = false;
  router.history?.subscribe(({ action }) => {
    // BACK, FORWARD, or a GO of several entries: anything but a new entry.
    returning = action.type !== 'PUSH' && action.type !== 'REPLACE';
  });
  router.subscribe('onBeforeNavigate', ({ fromLocation, toLocation }) => {
    refining =
      fromLocation?.pathname === toLocation.pathname &&
      term(fromLocation.search) === term(toLocation.search);
  });
  // The phone shell scrolls #main-content, not the window. Unlisted, the router carries an
  // element's scroll over to the next page, so a new page would open where the last one was.
  // The chip row likewise: carried over, it would cancel the scroll to the new active chip.
  router.options.scrollToTopSelectors = ['#main-content', '.category-chips .overflow-x-auto'];
  router.options.scrollRestoration = () =>
    !refining && (returning || !deepLinkedSub(router.state.matches));
}
