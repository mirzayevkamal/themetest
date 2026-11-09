import { BasketIcon, OrdersIcon, UserIcon } from './icons';
import { Link } from '@salla.sa/twilight-theme-engine/common';
import { useRouter } from '@tanstack/react-router';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { useStore } from '@salla.sa/twilight-theme-engine/hooks/useStore';
import { CART_ROUTE_ID, HOME_ROUTE_ID, useMatchedRouteId } from '../hooks/useMatchedRoute';
import { useCartCount } from './cart/useCart';
import { StoreIcon } from './icons/StoreIcon';
import { hrefWithMarket, useMarkets } from './layout/MarketSwitcher';

export { useCartCount } from './cart/useCart';

type TabProps = {
  label: string;
  active: boolean;
  children: React.ReactNode;
} & ({ to: string; onClick?: never } | { to?: never; onClick: () => void });

function Tab({ to, label, active, children, onClick }: TabProps) {
  const className =
    'flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-full py-1.5 transition-colors ' +
    (active ? 'bg-neutral-100 font-bold text-ink shadow-light' : 'text-neutral-300');
  const content = (
    <>
      {/* SVG icons fill with currentColor; the store logo is an image and keeps its colors. */}
      <span className={`flex h-6 w-6 items-center justify-center${active ? ' text-brand' : ''}`}>
        {children}
      </span>
      <span className="max-w-full truncate text-[11px] leading-none">{label}</span>
    </>
  );
  // An action, not a link: on the store's own domain the engine's document-level link
  // handler would navigate an <a> to home before this click handler runs.
  return onClick ? (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  ) : (
    <Link to={to} className={className}>
      {content}
    </Link>
  );
}

/**
 * Pinned app-shell footer. Content scrolls in <main> between header and this
 * bar. Safe-area insets are intentionally omitted — the native app shell
 * will provide them later via events.
 */
export function BottomNav() {
  const { t } = useTranslation();
  const store = useStore();
  const cartCount = useCartCount();
  const { markets, activeId, switchTo } = useMarkets();
  const router = useRouter();

  const routeId = useMatchedRouteId();
  const isHome = routeId === HOME_ROUTE_ID;
  const isOrders = routeId.includes('/account/orders') || routeId.includes('/pending-orders');
  const isAccount = routeId.includes('/account/') && !isOrders;

  return (
    <nav className="app-bottom-nav flex shrink-0 items-center justify-between gap-1 border-t border-neutral-100 bg-white px-4 py-1 [box-shadow:0_-6px_16px_rgba(0,0,0,0.08)]">
      {/* A multi-market store gets one home tab per market; tapping another switches to it. */}
      {markets.length ? (
        markets.map((market) =>
          String(market.id) === activeId ? (
            <Tab key={market.id} to="/" label={market.name} active={isHome}>
              <StoreIcon />
            </Tab>
          ) : (
            <Tab
              key={market.id}
              label={market.name}
              active={false}
              onClick={() => {
                // Go home only once the switch has landed, so home loads the new market,
                // and not if the shopper went somewhere else in the meantime. The switch
                // itself puts the market in the URL, so that address still counts as here.
                // Already home: the switch is still reloading it in the background, and
                // another navigation would drop that reload and keep the old market's blocks.
                const from = router.state.location.href;
                const switchedHere = hrefWithMarket(from, market.id);
                void switchTo(market).then((switched) => {
                  const href = router.state.location.href;
                  if (switched && !isHome && (href === from || href === switchedHere)) {
                    void router.navigate({ to: '/' });
                  }
                });
              }}
            >
              <StoreIcon />
            </Tab>
          )
        )
      ) : (
        <Tab to="/" label={store.name || t('common.titles.home', 'Home')} active={isHome}>
          <StoreIcon />
        </Tab>
      )}
      <Tab to="/cart" label={t('common.nav.cart', 'Cart')} active={routeId === CART_ROUTE_ID}>
        <span className="relative">
          <BasketIcon />
          {cartCount > 0 && (
            <span className="absolute end-[13px] top-0 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-discount text-[13px] font-semibold not-italic text-white ring-1 ring-hairline">
              {cartCount}
            </span>
          )}
        </span>
      </Tab>
      <Tab to="/account/orders" label={t('common.nav.orders', 'Orders')} active={isOrders}>
        <OrdersIcon />
      </Tab>
      <Tab to="/account/profile" label={t('common.nav.account', 'Account')} active={isAccount}>
        <UserIcon />
      </Tab>
    </nav>
  );
}
