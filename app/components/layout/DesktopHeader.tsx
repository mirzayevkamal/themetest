import { useEffect, useRef } from 'react';
import { useParams, useRouter, useRouterState } from '@tanstack/react-router';
import { Image, Link } from '@salla.sa/twilight-theme-engine/common';
import { useStore } from '@salla.sa/twilight-theme-engine/hooks/useStore';
import { useTheme } from '@salla.sa/twilight-theme-engine/hooks/useTheme';
import { useUser } from '@salla.sa/twilight-theme-engine/hooks/useUser';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { BasketFillIcon, FlashIcon, SearchIcon } from '../icons';
import { AddressBar } from './AddressBar';
import { HeaderMenu } from './HeaderMenu';
import { SearchInput } from '../SearchBar';
import { SEARCH_ROUTE_ID, useMatchedRouteId } from '../../hooks/useMatchedRoute';
import { openCartDrawer, useCartDrawerOpen } from '../../hooks/useCartDrawer';
import { useCartCount } from '../cart/useCart';
import { useDeliveryPromise } from '../../hooks/useDeliveryPromise';
import { openLocalizationModal } from './LocalizationModal';

function openLogin() {
  window.salla?.event.dispatch('login::open');
}

/** The header's search field: typing opens /search and keeps its results live. */
function HeaderSearch({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const { locale } = useParams({ strict: false }) as { locale?: string };
  const onSearchPage = useMatchedRouteId() === SEARCH_ROUTE_ID;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // History position of the page the search was opened from (null: opened by a link).
  const origin = useRef<number | null>(null);
  // A search session ends when the shopper leaves the results; a later linked search starts fresh.
  useEffect(() => {
    if (!onSearchPage) origin.current = null;
  }, [onSearchPage]);
  const q = useRouterState({
    select: (s) => String((s.location.search as { q?: unknown }).q ?? ''),
  });
  const searchPath = router.buildLocation({ to: SEARCH_ROUTE_ID, params: { locale } }).pathname;
  const search = (query: string) => {
    // Read the URL as it is now, not as it was at the keystroke: text typed while
    // the results open continues that search (same entry, same start page).
    const here = router.latestLocation.pathname;
    const onResults = here === searchPath;
    // Typed on a page the shopper has since left for somewhere else.
    if (here !== pathname && !onResults) return;
    if (!onResults && !query.trim()) return;
    if (!onResults) origin.current = router.history.location.state.__TSR_index;
    // One history entry for the search, not one per word typed.
    void router.navigate({
      to: SEARCH_ROUTE_ID,
      params: { locale },
      search: { q: query },
      replace: onResults,
    });
  };

  // Clearing the search leaves it, past any sort or query steps, to where it started.
  const leaveSearch = () => {
    const from = origin.current;
    const here = router.history.location.state.__TSR_index;
    origin.current = null;
    if (from !== null && from < here) router.history.go(from - here);
    else void router.navigate({ to: '/{-$locale}/', params: { locale } });
  };

  return (
    <SearchInput
      autoFocus={false}
      initialQuery={onSearchPage ? q : ''}
      placeholder={placeholder}
      onSearch={search}
      onClear={onSearchPage ? leaveSearch : undefined}
      className="desktop-header__search-field desktop-header__control h-12 rounded-xl border border-control-line bg-control"
      inputClassName="h-full w-full rounded-xl border-0 bg-transparent pe-3 ps-9 text-sm text-ink placeholder:text-neutral-500 focus:ring-0"
    />
  );
}

/** Figma 2667:7628 — web-desktop chrome. Hidden on mobile / native via CSS. */
export function DesktopHeader() {
  const store = useStore();
  const { t, locale } = useTranslation();
  const { isLoggedIn } = useUser();
  const deliveryPromise = useDeliveryPromise();
  const cartOpen = useCartDrawerOpen();
  const cartCount = useCartCount();
  const multilingual = Boolean(store.settings?.is_multilingual);
  const currenciesEnabled = Boolean(store.settings?.currencies_enabled);
  const showLocalization = multilingual || currenciesEnabled;
  const otherLanguage = locale === 'ar' ? 'English' : 'العربية';
  // The merchant's header switches: pinned unless turned off, light (the Figma look) unless dark.
  const settings = useTheme().settings;
  const sticky = settings?.header_is_sticky !== false;
  // Dark styling lives in body.topnav-is-dark (desktop.scss); these classes stay as merchant CSS hooks.
  const dark = settings?.topnav_is_dark === true;
  // Theme-specific key (twilight.json) the engine's ThemeSettings type doesn't list.
  const promiseColor = dark
    ? undefined
    : ((settings as Record<string, unknown> | undefined)?.header_promise_color as
        string | undefined);
  const searchLabel = t('common.search.placeholder', 'ابحث عن ارز, حليب, مسحوق غسيل....');

  // Pinned controls clear the real header height (desktop-pages.scss), even when the menu wraps.
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const header = headerRef.current;
    if (!header || typeof ResizeObserver === 'undefined') return;
    const sync = () =>
      document.body.style.setProperty('--desktop-header-h', `${header.offsetHeight}px`);
    const observer = new ResizeObserver(sync);
    observer.observe(header);
    return () => {
      observer.disconnect();
      document.body.style.removeProperty('--desktop-header-h');
    };
  }, []);

  return (
    <header
      ref={headerRef}
      className={`desktop-header z-50 shrink-0 flex-col px-11 py-4 shadow-[0px_4px_12px_rgba(0,0,0,0.08)] ${
        sticky ? 'sticky top-0' : 'desktop-header--static relative'
      } ${dark ? 'desktop-header--dark bg-black text-white' : 'bg-white'}`}
    >
      <div className="desktop-header__row flex w-full items-center gap-6">
        <Link to="/" className="desktop-header__brand shrink-0">
          {store.logo ? (
            <Image
              src={store.logo}
              alt={store.name}
              width={131}
              height={40}
              sizes="131px"
              srcSetWidths={[131, 262, 393]}
              fetchPriority="low"
              noWrapper
              objectFit="contain"
              className="h-10 w-auto max-w-[131px]"
            />
          ) : (
            <span className="text-lg font-bold text-ink">{store.name}</span>
          )}
        </Link>

        <div className="desktop-header__delivery flex min-w-0 shrink-0 flex-col items-start gap-1.5">
          {deliveryPromise && (
            <p className="flex items-center gap-0.5 font-bold capitalize leading-none">
              <FlashIcon size={16} />
              <span
                className="desktop-header__promise text-base text-brand"
                style={promiseColor ? { color: promiseColor } : undefined}
              >
                {deliveryPromise}
              </span>
              <span className="desktop-header__tail text-base leading-none text-ink">
                {t('common.delivery.promise_tail', 'ونوصلك')}
              </span>
            </p>
          )}
          <AddressBar className="gap-0.5 text-xs" />
        </div>

        <HeaderSearch placeholder={searchLabel} />
        {/* Tablet: no room for the field, so an icon to the /search page and its own field. */}
        <Link
          to="/search"
          className="desktop-header__search desktop-header__control h-12 shrink-0 items-center gap-3 rounded-xl border border-control-line bg-control px-2.5 text-sm text-neutral-500"
        >
          <span className="shrink-0 text-neutral-400">
            <SearchIcon size={24} />
          </span>
          <span className="desktop-header__label truncate">{searchLabel}</span>
        </Link>

        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={cartOpen}
          onClick={openCartDrawer}
          className="desktop-header__control flex h-12 shrink-0 items-center gap-2 rounded-xl border border-control-line bg-control p-3 text-sm text-control-text"
        >
          <span className="relative">
            <BasketFillIcon className="text-brand" />
            {cartCount > 0 && (
              <span className="desktop-header__cart-count absolute -end-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-discount font-semibold leading-none text-white ring-1 ring-neutral-100">
                {cartCount}
              </span>
            )}
          </span>
          <span className="desktop-header__label">{t('common.nav.cart', 'السلة')}</span>
        </button>

        {isLoggedIn ? (
          <Link
            to="/account/profile"
            className="flex h-12 shrink-0 items-center rounded-xl bg-brand px-4 text-sm font-bold text-white"
          >
            {t('common.nav.account', 'حسابي')}
          </Link>
        ) : (
          <button
            type="button"
            onClick={openLogin}
            className="flex h-12 shrink-0 items-center rounded-xl bg-brand px-4 text-sm font-bold text-white"
          >
            {t('pages.account.login', 'تسجيل دخول')}
          </button>
        )}

        {showLocalization && (
          <button
            type="button"
            onClick={openLocalizationModal}
            className="desktop-header__control flex h-12 shrink-0 items-center gap-2 rounded-xl border border-control-line bg-control p-3 text-sm text-control-text"
          >
            <span className="desktop-header__label">{otherLanguage}</span>
            <Image
              src="/images/desktop/globe.svg"
              alt=""
              width={24}
              height={24}
              fetchPriority="low"
              noWrapper
              objectFit="contain"
              className="size-6"
            />
          </button>
        )}
      </div>
      <HeaderMenu />
    </header>
  );
}
