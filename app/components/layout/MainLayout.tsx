import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useTwilight } from '@salla.sa/twilight-theme-engine';
import { useLocation } from '@salla.sa/twilight-theme-engine/providers';
import { useUser } from '@salla.sa/twilight-theme-engine/hooks/useUser';
import { PageAdvertisements, type LayoutProps } from '@salla.sa/twilight-theme-engine/layout';
import { useIsNativeApp } from '@salla.sa/twilight-theme-engine/native-app';
import { useIsHomeRoute, useIsOrdersListRoute } from '../../hooks/useMatchedRoute';
import { useBannerSheetPath, useCloseBannerSheet } from '../../hooks/useBannerSheet';
import { closeCartDrawer, useCartDrawerOpen } from '../../hooks/useCartDrawer';
import { closeFiltersDrawer, useFiltersDrawerOpen } from '../../hooks/useFiltersDrawer';
import {
  closeOrderDrawer,
  openOrderDrawer,
  takeOrderDrawerOnArrival,
  useOrderDrawerId,
} from '../../hooks/useOrderDrawer';
import { useProductSheetId, useProductSheetLinks } from '../../hooks/useProductSheet';
import { BottomNav } from '../BottomNav';
import { DesktopFooter } from './DesktopFooter';
import { DesktopHeader } from './DesktopHeader';
import { LocalizationModal } from './LocalizationModal';
import { MarketSwitcher, useMarketSwitchPending } from './MarketSwitcher';
import { HomeSkeleton } from '../home/placeholders';
import { SiteHeader } from './SiteHeader';
import { ProductConsentPrompt } from '../product/ProductConsent';

// The animation library only works while a sheet or drawer is open, and the
// gesture wrappers only mount inside the native app, so none of it belongs in
// the entry chunk. motion/react is shared with the sheet chunks that use it.
const AnimatePresence = lazy(() =>
  import('motion/react').then((m) => ({ default: m.AnimatePresence }))
);
const PullToRefresh = lazy(() =>
  import('./PullToRefresh').then((m) => ({ default: m.PullToRefresh }))
);
const RouteGestureTransition = lazy(() =>
  import('./RouteGestureTransition').then((m) => ({ default: m.RouteGestureTransition }))
);

// Tracking UI + order API stay off the app-shell chunk.
const OrderTrackingBanner = lazy(() =>
  import('../orders/tracking/OrderTrackingBanner').then((m) => ({ default: m.OrderTrackingBanner }))
);

// Lazy like the engine's MasterLayout — keeps the modals out of the main bundle.
const SallaLoginModal = lazy(() =>
  import('@salla.sa/twilight-components-react/login-modal').then((m) => ({
    default: m.SallaLoginModal,
  }))
);
const SallaScopes = lazy(() =>
  import('@salla.sa/twilight-components-react/scopes').then((m) => ({
    default: m.SallaScopes,
  }))
);
const SallaOfferModal = lazy(() =>
  import('@salla.sa/twilight-components-react/offer-modal').then((m) => ({
    default: m.SallaOfferModal,
  }))
);
const CartAddedBar = lazy(() =>
  import('../cart/CartBar').then((m) => ({ default: m.CartAddedBar }))
);
const ProductSheetOverlay = lazy(() =>
  import('../product/ProductSheet').then((m) => ({ default: m.ProductSheetOverlay }))
);
const BannerSheet = lazy(() =>
  import('../home/BannerSheet').then((m) => ({ default: m.BannerSheet }))
);
const BannerSheetContent = lazy(() =>
  import('../home/BannerSheetContent').then((m) => ({ default: m.BannerSheetContent }))
);
const CartDrawer = lazy(() =>
  import('../cart/CartDrawer').then((m) => ({ default: m.CartDrawer }))
);
const OrderDrawer = lazy(() =>
  import('../orders/tracking/OrderDrawer').then((m) => ({ default: m.OrderDrawer }))
);

/**
 * The scrollable region between the pinned header and BottomNav — the window
 * itself never scrolls, so scroll-to-top on navigation is handled here.
 * Pull-to-refresh and swipe-back only mount inside the native app webview.
 */
function ScrollArea({ children, isHome }: { children: React.ReactNode; isHome: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const isNativeApp = useIsNativeApp();

  useEffect(() => {
    ref.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <main
      ref={ref}
      id="main-content"
      role="main"
      className={'min-h-0 flex-1 overflow-y-auto' + (isHome ? ' app-main--home' : '')}
    >
      {isNativeApp ? (
        // Plain children while the gesture chunk loads; the page remounts once at boot.
        <Suspense fallback={children}>
          <PullToRefresh scrollRef={ref}>
            <RouteGestureTransition>{children}</RouteGestureTransition>
          </PullToRefresh>
        </Suspense>
      ) : (
        children
      )}
    </main>
  );
}

/**
 * Custom theme layout, passed to TwilightProvider's `layout` prop in
 * __root.tsx. Replaces the engine's MasterLayout.
 *
 * Mobile (below 768px) and the native app webview keep the fluid app-shell (scroll area +
 * BottomNav). Web desktop drops that shell and shows DesktopHeader /
 * DesktopFooter instead — see desktop.scss (gated on html:not(.mobile-webview)).
 * SiteHeader is home-only on mobile; every other Figma screen owns its header.
 * The offer/login/scopes modals are carried over from MasterLayout.
 */
export function MainLayout({ children }: LayoutProps) {
  const { store } = useTwilight();
  const { isLoggedIn } = useUser();
  const isHome = useIsHomeRoute();
  // The old market's page stays on screen, tappable, until the switch lands; the skeleton
  // covers it, and on the phone home is where the switch goes anyway.
  const switching = useMarketSwitchPending();
  const isOrdersList = useIsOrdersListRoute();
  const sheetProductId = useProductSheetId();
  const closeProductSheet = useProductSheetLinks();
  const bannerPath = useBannerSheetPath();
  const closeBannerSheet = useCloseBannerSheet();
  const cartDrawerOpen = useCartDrawerOpen();
  const orderDrawerId = useOrderDrawerId();
  const filtersDrawerOpen = useFiltersDrawerOpen();
  const drawerOpen = cartDrawerOpen || Boolean(orderDrawerId) || filtersDrawerOpen;
  const { pathname } = useLocation();
  // Also clears a drawer requested before its chunk landed, so it never opens over the next page.
  useEffect(() => {
    closeCartDrawer();
    closeFiltersDrawer();
    const queued = takeOrderDrawerOnArrival();
    if (queued) openOrderDrawer(queued);
    else closeOrderDrawer();
  }, [pathname]);
  const showTrackingBanner = isLoggedIn && (isHome || isOrdersList);
  // Mount the presence wrapper on the first open and keep it, so exit animations
  // still run after the overlay closes.
  const overlayOpen = Boolean(bannerPath || sheetProductId || cartDrawerOpen || orderDrawerId);
  const [overlaysMounted, setOverlaysMounted] = useState(overlayOpen);
  useEffect(() => {
    if (overlayOpen) setOverlaysMounted(true);
  }, [overlayOpen]);

  return (
    <>
      <div
        // Keeps focus and clicks inside an open drawer; the sheets stay interactive with the page.
        inert={drawerOpen || undefined}
        className="app-inner flex h-dvh w-full flex-col bg-white"
      >
        <DesktopHeader />
        <PageAdvertisements />
        {isHome ? <SiteHeader /> : null}
        {isHome ? <MarketSwitcher /> : null}
        <ScrollArea isHome={isHome || switching}>
          {switching ? <HomeSkeleton /> : children}
        </ScrollArea>
        {/* Layout-neutral on the phone; web desktop floats it and stacks the bars. */}
        <div className="bottom-docks contents">
          {!isHome && (
            <Suspense>
              <CartAddedBar />
            </Suspense>
          )}
          {showTrackingBanner && (
            <Suspense>
              <OrderTrackingBanner className={isHome ? 'bg-white' : 'bg-smoke'} />
            </Suspense>
          )}
        </div>
        <BottomNav />
        <DesktopFooter />
      </div>
      {overlaysMounted && (
        <Suspense fallback={null}>
          <AnimatePresence>
            {bannerPath ? (
              <Suspense fallback={null}>
                <BannerSheet key="banner-sheet" onClose={closeBannerSheet}>
                  <BannerSheetContent path={bannerPath} onClose={closeBannerSheet} />
                </BannerSheet>
              </Suspense>
            ) : null}
            {sheetProductId ? (
              <Suspense fallback={null}>
                <ProductSheetOverlay
                  key="product-sheet"
                  id={sheetProductId}
                  onClose={closeProductSheet}
                />
              </Suspense>
            ) : null}
            {cartDrawerOpen ? (
              <Suspense fallback={null}>
                <CartDrawer key="cart-drawer" onClose={closeCartDrawer} />
              </Suspense>
            ) : null}
            {orderDrawerId ? (
              <Suspense fallback={null}>
                <OrderDrawer key="order-drawer" id={orderDrawerId} onClose={closeOrderDrawer} />
              </Suspense>
            ) : null}
          </AnimatePresence>
        </Suspense>
      )}
      <ProductConsentPrompt />
      <LocalizationModal />
      <Suspense>
        <SallaOfferModal />
      </Suspense>
      {!isLoggedIn && (
        <Suspense>
          <SallaLoginModal
            isEmailAllowed={store?.settings?.auth?.email_allowed}
            isMobileAllowed={store?.settings?.auth?.mobile_allowed}
            isEmailRequired={store?.settings?.auth?.is_email_required}
            suppressHydrationWarning
          />
        </Suspense>
      )}
      {store?.scope && (
        <Suspense>
          <SallaScopes
            selection={store?.scope?.display_as === 'popup' ? 'mandatory' : 'optional'}
            suppressHydrationWarning
          />
        </Suspense>
      )}
    </>
  );
}
