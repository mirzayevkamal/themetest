import { CloseIcon, FlashIcon } from '../icons';
import { Image, Link } from '@salla.sa/twilight-theme-engine/common';
import { useStore } from '@salla.sa/twilight-theme-engine/hooks/useStore';
import { useTwilight } from '@salla.sa/twilight-theme-engine/providers';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { useNativeStatusBarColor } from '@salla.sa/twilight-theme-engine/native-app';
import { SearchTrigger } from '../SearchBar';
import { useDeliveryPromise } from '../../hooks/useDeliveryPromise';
import { AddressBar } from './AddressBar';

/** App-shell header: delivery promise, address, and an inline salla-search. */
export function SiteHeader() {
  const store = useStore();
  const { t } = useTranslation();
  const deliveryPromise = useDeliveryPromise();
  const headerRef = useNativeStatusBarColor<HTMLElement>();
  // Theme-specific keys (twilight.json) the engine's ThemeSettings type doesn't list.
  const settings = useTwilight().theme?.settings as Record<string, unknown> | undefined;
  // topnav_is_dark still wins: its body.topnav-is-dark rules outrank these classes.
  const brand = settings?.header_style === 'brand';
  const logoAtStart = settings?.header_logo_position === 'start';
  const badgeImage = (settings?.header_badge_image as string | undefined) || null;
  // Same header promise colour as DesktopHeader; the dark bar keeps its white text.
  const promiseColor =
    settings?.topnav_is_dark === true
      ? undefined
      : (settings?.header_promise_color as string | undefined);

  const logo = (
    <Link to="/" className="shrink-0">
      {store.logo && (
        <Image
          src={store.logo}
          alt={store.name}
          width={105}
          height={32}
          sizes="105px"
          srcSetWidths={[105, 210, 315]}
          fetchPriority="low"
          noWrapper
          objectFit="contain"
          className="h-8 w-auto max-w-[105px]"
        />
      )}
    </Link>
  );
  // Optional merchant badge (a "24/7" seal, an award…) on the side opposite the logo.
  const badge = badgeImage ? (
    <Image
      src={badgeImage}
      alt=""
      width={36}
      height={36}
      sizes="36px"
      srcSetWidths={[36, 72, 108]}
      fetchPriority="low"
      noWrapper
      objectFit="cover"
      className="mobile-header__badge size-9 shrink-0 rounded-full"
    />
  ) : null;

  return (
    <header
      ref={headerRef}
      className={`mobile-header -mt-[var(--app-safe-area-top,0px)] flex shrink-0 flex-col gap-3 px-4 pb-2 pt-[calc(0.5rem+var(--app-safe-area-top,0px))] ${
        brand ? 'mobile-header--brand bg-brand' : 'bg-brand-reverse'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* TODO: hidden until business confirms the close behavior; wire it to the native shell then. */}
        <button
          type="button"
          aria-label="إغلاق"
          className="hidden rounded-lg border border-neutral-100 bg-white p-1"
        >
          <CloseIcon />
        </button>
        {logoAtStart ? logo : badge}
        <div className="flex min-w-0 flex-1 flex-col">
          {deliveryPromise && (
            <p className="mobile-header__promise flex items-center gap-0.5 font-bold capitalize leading-none">
              <FlashIcon />
              <span
                className="delivery-promise-value text-brand"
                style={promiseColor ? { color: promiseColor } : undefined}
              >
                {deliveryPromise}
              </span>
              <span className="text-sm leading-none text-ink">
                {t('common.delivery.promise_tail', 'ونوصلك')}
              </span>
            </p>
          )}
          <AddressBar className="mobile-header__address gap-0.5 text-[12px]" />
        </div>
        {logoAtStart ? badge : logo}
      </div>
      <SearchTrigger
        label={t('common.search.placeholder', 'ابحث عن ارز, حليب, مسحوق غسيل....')}
        className="shadow-[0px_4px_11.5px_rgba(0,0,0,0.04)]"
      />
    </header>
  );
}
