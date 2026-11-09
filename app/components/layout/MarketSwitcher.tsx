import { useEffect, useEffectEvent, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { api, getActiveScopeId } from '@salla.sa/twilight-theme-engine/api/client';
import { store } from '@salla.sa/twilight-theme-engine/api/store';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { useTwilight } from '@salla.sa/twilight-theme-engine/providers';
import { useRefreshPage } from '../../hooks/useMobileUiUpdate';
import {
  clearDeliveryIntent,
  isBulletDeliveryOn,
  marketPlace,
  openDeliverySheet,
  saveMarketPlace,
} from '../../hooks/useBulletDelivery';
import { isNativeApp } from '@salla.sa/twilight-theme-engine/native-app';
import { clearCartStore } from '../cart/useCart';
import { createOverlayStore } from '../../hooks/overlayStore';
import { StoreIcon } from '../icons/StoreIcon';

// Shared by the desktop tabs, the bottom nav and the layout, which swaps the page for the
// home skeleton while a switch runs.
const pendingMarket = createOverlayStore<number | null>(null);

/** True from a market tap until the store is on that market (or the switch failed). */
export const useMarketSwitchPending = () => pendingMarket.useValue() !== null;

/** A switch that left for a new document: the skeleton stays up until it answers. */
const LEFT = 'left';

export const resetMarketSwitchForTests = pendingMarket.close;

export interface Market {
  id: number;
  name: string;
  type?: string;
  selected?: boolean;
}

// These exist on the SDK at runtime; the engine typings don't list them.
type MarketSdk = {
  api?: { setHeaders?: (headers: Record<string, unknown>) => void };
  scope?: { change: (payload: { id: number }) => Promise<unknown> };
  storage?: { set: (key: string, value: unknown) => void };
  config?: { set?: (key: string, value: unknown) => void };
  cart?: { reset?: () => void };
};

/**
 * `href` naming `marketId` as its market, as Twig leaves the address bar after a switch:
 * a reload or a shared link opens the same market, and a `?scope=` left from the previous
 * one can't take the page back to it. Its branch is dropped with it.
 */
export function hrefWithMarket(href: string, marketId: number): string {
  const url = new URL(href, 'http://localhost');
  url.searchParams.set('scope', String(marketId));
  url.searchParams.delete('allocation_type');
  url.searchParams.delete('allocation_id');
  return url.pathname + url.search + url.hash;
}

/**
 * The store's markets (scopes) and a switch between them. Same steps as the SDK's
 * salla-scopes modal, minus its document reload: the SDK call also emits `scope::changed`,
 * which the native bridge forwards to the app. `markets` is empty for a single-market store.
 */
export function useMarkets() {
  const { locale } = useTranslation();
  const themeName = useTwilight().theme?.name;
  const router = useRouter();
  const refresh = useRefreshPage();
  const queryClient = useQueryClient();
  const pendingId = pendingMarket.useValue();

  // ponytail: fetched on the client, so the tabs appear after hydration; prefetch it
  // in a loader if they must be in the first paint.
  const { data = [] } = useQuery({
    queryKey: ['scopes', locale],
    queryFn: () =>
      api
        .get('scopes')
        .json<{ data?: { scopes?: Market[] } }>()
        .then((json) => json.data?.scopes ?? []),
    staleTime: Infinity,
  });
  const markets = data.length > 1 ? data : [];

  // What requests are sent with, not `store.scope`: the settings API still answers with
  // the default market. Compared as strings because the SDK stores the id either way.
  const activeId = String(pendingId ?? getActiveScopeId() ?? markets.find((m) => m.selected)?.id);

  // Taps queue instead of dropping: a switch takes a second or more (SDK boot, the scopes
  // call, the page refresh), and a shopper who taps another market meanwhile means the last
  // one they tapped. `requested` is that market; a queued tap it replaced does nothing.
  const queue = useRef<Promise<unknown> | null>(null);
  const requested = useRef<number | null>(null);

  // Back from the other theme can restore this document from the bfcache mid-leave: its
  // requests already name the new market while its content is the old one. Take it there.
  const onRestore = useEffectEvent(() => {
    if (pendingId === null) return;
    const id = getActiveScopeId();
    window.location.replace(
      id ? hrefWithMarket(router.state.location.href, Number(id)) : router.state.location.href
    );
  });
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) onRestore();
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  const change = async (market: Market): Promise<boolean | typeof LEFT> => {
    try {
      // The tabs can render before the SDK has booted.
      await Promise.resolve(window.salla?.onReady?.());
      const sdk = window.salla as MarketSdk | undefined;
      if (!sdk?.scope) return false;

      saveMarketPlace();
      await sdk.scope.change({ id: market.id });
      // Replaces the whole entry: the previous market's allocation must not follow. The
      // place picked in this market before, if any, comes back with it.
      const place = marketPlace(market.id);
      const scope = {
        id: market.id,
        type: market.type,
        ...(place && {
          allocation_type: place.allocation_type,
          allocation_id: place.allocation_id,
        }),
      };
      sdk.storage?.set('scope', scope);
      // The SDK copied the store into its config at init; its analytics read the market there.
      sdk.config?.set?.('store.scope', scope);
      clearDeliveryIntent(place);
      // The SDK copied the scope into its request headers at init; without a document
      // reload its own calls (cart) would stay on the previous market. Axios skips the
      // undefined allocation headers, which drops the previous market's.
      sdk.api?.setHeaders?.({
        's-scope-id': market.id,
        's-scope-type': market.type,
        's-scope-allocation-type': place?.allocation_type,
        's-scope-allocation-id': place?.allocation_id,
      });
      // Twig reloads the document, so the SDK re-reads the market's settings at init; here
      // they'd stay from the first market (bullet delivery on in one, off in the other).
      // The market is already selected, so a failed call keeps the in-place switch going.
      const settings = await queryClient
        .ensureQueryData(store.queries.settings())
        .catch(() => null);
      // A market can run another theme. This page can't render it, so the document loads
      // it, as Twig switches.
      if (settings?.theme?.name && settings.theme.name !== themeName) {
        window.location.assign(hrefWithMarket(router.state.location.href, market.id));
        return LEFT;
      }
      sdk.cart?.reset?.();
      clearCartStore();
      await router.navigate({
        href: hrefWithMarket(router.state.location.href, market.id),
        replace: true,
        resetScroll: false,
      });
      await refresh();
      if (settings?.store?.settings) sdk.config?.set?.('store.settings', settings.store.settings);
      // Like a first visit: a market with delivery and no place yet asks for one. The tap
      // that switched is the interaction, so this never runs on load. The app prompts with its native sheet itself.
      if (!place && isBulletDeliveryOn(settings?.store) && !isNativeApp()) {
        void openDeliverySheet().catch(() => {
          // A failed mount leaves the AddressBar tap as the way in.
        });
      }
      return true;
    } catch {
      // The SDK already shows the API error.
      return false;
    }
  };

  /** Resolves true once the store is on `market`; false when it is already there, a later
   *  tap replaced it, or the switch failed. */
  const switchTo = (market: Market): Promise<boolean> => {
    if (String(market.id) === activeId) return Promise.resolve(false);

    requested.current = market.id;
    pendingMarket.open(market.id);
    const run = (queue.current ?? Promise.resolve()).then(async () => {
      const wanted = requested.current === market.id;
      const switched =
        wanted && String(market.id) !== String(getActiveScopeId()) ? await change(market) : false;
      // The latest tap owns the pending state, whether it switched or found the store there.
      // A tap that left for a new document keeps the skeleton up until that one answers.
      if (requested.current === market.id) {
        requested.current = null;
        if (switched !== LEFT) pendingMarket.close();
      }
      return switched === true;
    });
    queue.current = run;
    return run;
  };

  return { markets, activeId, pending: pendingId !== null, switchTo };
}

/** Web-desktop market tabs under the header. The phone switches from the bottom nav. */
export function MarketSwitcher() {
  const { t } = useTranslation();
  const { markets, activeId, pending, switchTo } = useMarkets();

  if (!markets.length) return null;

  return (
    <div className="desktop-markets justify-center bg-white px-11 pt-4">
      <div
        role="group"
        aria-label={t('common.markets.switch_label', 'اختر السوق')}
        className="desktop-markets__tabs flex gap-6"
      >
        {markets.map((market) => {
          const active = String(market.id) === activeId;
          return (
            <button
              key={market.id}
              type="button"
              aria-pressed={active}
              disabled={pending}
              onClick={() => void switchTo(market)}
              className="desktop-markets__tab flex flex-col items-center gap-2"
            >
              <span
                className={
                  'flex max-w-full items-center gap-2 text-base ' +
                  (active ? 'font-bold text-brand' : 'text-ink')
                }
              >
                <StoreIcon />
                <span className="truncate">{market.name}</span>
              </span>
              <span className={'h-1 w-full ' + (active ? 'bg-brand' : '')} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
