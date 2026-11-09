import { describe, expect, it } from 'vitest';
import {
  installScrollRestoration,
  returningInHistory,
  type ScrollRouter,
} from '../../app/lib/scrollRestoration';

type Navigate = Parameters<ScrollRouter['subscribe']>[1];
type HistoryEvent = Parameters<Parameters<NonNullable<ScrollRouter['history']>['subscribe']>[0]>[0];

function fakeRouter(matches: ScrollRouter['state']['matches'] = []) {
  let onBeforeNavigate: Navigate = () => {};
  let onHistory: (e: HistoryEvent) => void = () => {};
  const router: ScrollRouter = {
    options: {},
    state: { matches },
    history: { subscribe: (fn) => void (onHistory = fn) },
    subscribe: (_event, fn) => void (onBeforeNavigate = fn),
  };
  installScrollRestoration(router);
  const restores = () => (router.options.scrollRestoration as () => boolean)();
  const navigate = (e: Parameters<Navigate>[0], action = 'PUSH') => {
    onHistory({ action: { type: action } });
    onBeforeNavigate(e);
  };
  return { router, navigate, restores };
}

const at = (pathname: string, search: Record<string, unknown> = {}) => ({ pathname, search });

describe('installScrollRestoration', () => {
  it('installs on the server router, which has no history yet', () => {
    const router: ScrollRouter = { options: {}, state: { matches: [] }, subscribe: () => {} };
    expect(() => installScrollRestoration(router)).not.toThrow();
  });

  it('restores scroll for a new path', () => {
    const { navigate, restores } = fakeRouter();
    navigate({ fromLocation: at('/ar'), toLocation: at('/ar/-/c1') });
    expect(restores()).toBe(true);
  });

  it('keeps the scroll while sort or filters refine the page in view', () => {
    const { navigate, restores } = fakeRouter();
    navigate({ fromLocation: at('/ar/-/c1'), toLocation: at('/ar/-/c1', { sort: 'price' }) });
    expect(restores()).toBe(false);
  });

  it('restores for a new search term on the same path', () => {
    const { navigate, restores } = fakeRouter();
    navigate({
      fromLocation: at('/ar/search', { q: 'milk' }),
      toLocation: at('/ar/search', { q: 'rice' }),
    });
    expect(restores()).toBe(true);
  });

  it('leaves a sub-category deep link at the section the page jumped to', () => {
    const { router, navigate, restores } = fakeRouter();
    navigate({ fromLocation: at('/ar'), toLocation: at('/ar/-/c1130730266') });
    router.state.matches = [{}, { loaderData: { activeSub: { id: 'chips' } } }];
    expect(restores()).toBe(false);
    // A parent category URL has no activeSub: the router scrolls to the top as usual.
    router.state.matches = [{}, { loaderData: { activeParent: { id: 'snacks' } } }];
    expect(restores()).toBe(true);
  });

  it('restores the saved position when Back or Forward returns to a sub-category', () => {
    const { router, navigate, restores } = fakeRouter();
    router.state.matches = [{}, { loaderData: { activeSub: { id: 'chips' } } }];
    navigate({ fromLocation: at('/ar/p/lays'), toLocation: at('/ar/-/c1130730266') }, 'BACK');
    expect(restores()).toBe(true);
    expect(returningInHistory()).toBe(true);
    navigate({ fromLocation: at('/ar/-/c1130730266'), toLocation: at('/ar/-/c2') }, 'PUSH');
    expect(restores()).toBe(false);
    expect(returningInHistory()).toBe(false);
    // history.go(-2) and a Back without TanStack's index state both arrive as GO.
    navigate({ fromLocation: at('/ar/-/c2'), toLocation: at('/ar/-/c1130730266') }, 'GO');
    expect(restores()).toBe(true);
  });
});
