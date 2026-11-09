import { useSyncExternalStore } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SallaTrustBadges } from '@salla.sa/twilight-components-react/trust-badges';
import { useTwilight } from '@salla.sa/twilight-theme-engine';
import { profile } from '@salla.sa/twilight-theme-engine/api/profile';
import { user as userApi } from '@salla.sa/twilight-theme-engine/api/user';
import { useUser } from '@salla.sa/twilight-theme-engine/hooks/useUser';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { useNativeAppVersion } from '@salla.sa/twilight-theme-engine/native-app';
import type { User } from '@salla.sa/twilight-theme-engine/types';
import { getMobileOS, resolveAppStoreUrl } from '@salla.sa/twilight-theme-engine/utils';
import {
  CallIcon,
  LanguageIcon,
  LogoutIcon,
  MapPinIcon,
  MegaphoneIcon,
  PagesIcon,
  PercentBadgeIcon,
  ShareIcon,
  StarIcon,
  UserOutlineIcon,
} from '../icons';
import { SbcBadge, TaxCertificateLink, hasTrustBadge } from '../common/StoreCredentials';
import { openLocalizationModal } from '../layout/LocalizationModal';
import { PageHeader } from '../navigation';
import { AccountLinks } from './AccountLinks';
import { Row, Section, ToggleRow } from './AccountRows';
import { useDarkButtons } from '../../hooks/useAccentStyle';
import { AccountShell, logout, useOpenAccounts, WalletRow } from './AccountSidebar';

function GuestCard() {
  const { t } = useTranslation();
  const dark = useDarkButtons();
  const { store } = useTwilight();
  return (
    <section className="flex flex-col items-center gap-4 rounded-xl border border-neutral-100 bg-white p-6 text-center">
      {store.logo && <img src={store.logo} alt={store.name} className="h-[34px] object-contain" />}
      <div className="flex flex-col gap-1">
        <p className="text-lg font-bold leading-7 text-ink">
          {t('pages.account.guest_tagline', 'كل مقاضيك واكثر تجيك بدقة وعناية خلال دقائق')}
        </p>
        <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-ink">
          <PercentBadgeIcon size={24} />
          <span>
            <span className="text-discount">{t('pages.account.free_delivery', 'توصيل مجاني')}</span>{' '}
            {t('pages.account.for_first_order', 'لطلبك الاول')}
          </span>
          <PercentBadgeIcon size={24} />
        </p>
      </div>
      <button
        type="button"
        onClick={() => window.salla?.event.dispatch('login::open')}
        className={`w-full rounded-xl py-4 text-sm font-bold text-white ${dark ? 'bg-ink' : 'bg-brand'}`}
      >
        {t('pages.account.login', 'تسجيل دخول')}
      </button>
    </section>
  );
}

function UserHeader({ name, mobile }: { name: string; mobile?: string }) {
  return (
    <header className="mobile-sticky-bar sticky top-0 z-20 flex shrink-0 items-center gap-2 bg-white px-4 py-2 shadow-[0_6px_16px_rgba(0,0,0,0.08)]">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-lg font-bold leading-7 text-ink">{name}</p>
        {mobile && (
          <p className="text-sm leading-5 text-[#666]">
            <bdi>{mobile}</bdi>
          </p>
        )}
      </div>
    </header>
  );
}

// `is_notifiable` is read back as `preferences.notifications_enabled`; flip the cache
// optimistically and restore it if the save fails.
function MarketingRow({ label }: { label: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: currentUser } = useUser();
  const queryKey = userApi.queries.current().queryKey;
  const enabled = currentUser?.preferences?.notifications_enabled ?? false;
  const { mutate, isPending } = useMutation({
    mutationFn: (next: boolean) => profile.updateSettings('is_notifiable', next),
    onMutate: (next) => {
      const previous = queryClient.getQueryData<User | null>(queryKey);
      queryClient.setQueryData<User | null>(queryKey, (old) =>
        old?.preferences
          ? { ...old, preferences: { ...old.preferences, notifications_enabled: next } }
          : old
      );
      return previous;
    },
    onError: (_error, _next, previous) => {
      queryClient.setQueryData(queryKey, previous);
      window.salla?.notify.error(
        t('pages.account.marketing_error', 'تعذر حفظ التفضيل، حاول مرة أخرى')
      );
    },
  });
  return (
    <ToggleRow
      icon={<MegaphoneIcon />}
      label={label}
      checked={enabled}
      disabled={isPending}
      onChange={() => mutate(!enabled)}
    />
  );
}

const noSubscribe = () => () => {};

/** Account hub (`/account/profile`): profile header, wallet, general settings, store info. */
export function AccountPage() {
  const { t, languageName } = useTranslation();
  const { store } = useTwilight();
  const { data: user, isLoggedIn } = useUser();
  const openAccounts = useOpenAccounts();

  // The API sends `[]` when the store has no contact info configured.
  const hasContacts = Object.values(store.contacts ?? {}).some(Boolean);
  // `'other'` on the server and during hydration, the visitor's OS after it.
  const os = useSyncExternalStore(noSubscribe, getMobileOS, () => 'other' as const);
  const appUrl = resolveAppStoreUrl(store.apps, os);
  const multilingual = Boolean(store.settings?.is_multilingual);
  const currenciesEnabled = Boolean(store.settings?.currencies_enabled);
  const showLocalization = multilingual || currenciesEnabled;
  const appVersion = useNativeAppVersion();
  const taxNumber = store.settings?.tax?.number;

  const share = () => {
    const url = appUrl ?? store.url;
    // The app webview has no Web Share API; the SPA shell opens its own sheet (salla-social-share).
    const mobile = window.salla?.mobile as { isSpaWebview?: () => boolean } | undefined;
    if (mobile?.isSpaWebview?.()) window.salla?.event.dispatch('mobile::share.open', { url });
    else if (navigator.share) void navigator.share({ title: store.name, url }).catch(() => {});
    else
      void navigator.clipboard
        ?.writeText(url)
        .then(() =>
          window.salla?.notify.success(t('pages.account.app_link_copied', 'تم نسخ الرابط'))
        );
  };

  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ');

  return (
    <AccountShell
      sidebar={isLoggedIn}
      header={
        isLoggedIn ? (
          <UserHeader name={name} mobile={user?.mobile} />
        ) : (
          <PageHeader title={t('pages.account.title', 'حسابي')} back={false} />
        )
      }
    >
      {isLoggedIn ? (
        <Section title={t('pages.account.title', 'حسابي')}>
          <WalletRow
            className="py-2 desktop-hidden"
            label={t('pages.account.wallet_balance', 'رصيد المحفظة')}
          />
          {/* Web desktop lists these in the sidebar. */}
          <AccountLinks className="py-2 desktop-hidden" />
          <Row
            className="py-2 desktop-hidden"
            icon={<UserOutlineIcon />}
            label={t('pages.account.account_details', 'بيانات الحساب')}
            onClick={() => openAccounts('profile')}
          />
          <Row
            className="py-2 desktop-hidden"
            icon={<MapPinIcon />}
            label={t('pages.account.addresses', 'عناوين التوصيل')}
            onClick={() => openAccounts('profile/addresses')}
          />
          <MarketingRow label={t('pages.account.marketing_messages', 'الرسائل الترويجية')} />
        </Section>
      ) : (
        <GuestCard />
      )}

      <Section title={t('pages.account.general_settings', 'اعدادت عامة')}>
        {showLocalization && (
          <Row
            icon={<LanguageIcon />}
            label={t('pages.account.language', 'اللغة')}
            value={languageName}
            onClick={openLocalizationModal}
          />
        )}
        {hasContacts && (
          <Row
            icon={<CallIcon />}
            label={t('pages.account.contact_us', 'تواصل معنا')}
            to="/account/contact"
          />
        )}
        <Row
          icon={<PagesIcon />}
          label={t('pages.account.pages', 'الصفحات التعريفية')}
          to="/account/pages"
        />
        <Row
          icon={<ShareIcon />}
          label={t('pages.account.share_app', 'مشاركة التطبيق')}
          onClick={share}
        />
        {appUrl && (
          <Row
            icon={<StarIcon />}
            label={t('pages.account.rate_app', 'قيم التجربة')}
            href={appUrl}
          />
        )}
      </Section>

      {isLoggedIn && (
        <Section className="desktop-hidden">
          <Row
            icon={<LogoutIcon />}
            label={t('pages.account.logout', 'تسجيل خروج')}
            onClick={logout}
          />
        </Section>
      )}

      {(appVersion || taxNumber) && (
        <section className="flex items-center gap-4 rounded-xl bg-white p-4 text-xs leading-4">
          {appVersion && (
            <div className="flex flex-1 flex-col gap-2">
              <span className="text-silver">{t('pages.account.version', 'الاصدار')}</span>
              <span className="text-brand" dir="ltr">
                V {appVersion}
              </span>
            </div>
          )}
          {appVersion && taxNumber && (
            <span className="h-6 w-px bg-neutral-100" aria-hidden="true" />
          )}
          {taxNumber && (
            // With an uploaded certificate, the number opens it.
            <TaxCertificateLink
              certificate={store.settings?.tax?.certificate}
              className="flex flex-1 flex-col items-start gap-2 text-start"
            >
              <span className="text-silver">
                {t('pages.account.tax_certificate', 'الشهادة الضريبية')}
              </span>
              <span
                className={`text-brand${store.settings?.tax?.certificate ? ' underline' : ''}`}
                dir="ltr"
              >
                {taxNumber}
              </span>
            </TaxCertificateLink>
          )}
        </section>
      )}

      {/* The phone and app have no footer: the store's other credentials sit here. */}
      {(store.settings?.certificate?.id || hasTrustBadge(store.settings)) && (
        <section className="account-credentials flex flex-wrap items-center gap-6 rounded-xl bg-white p-4 text-ink">
          <SbcBadge id={store.settings?.certificate?.id} />
          {hasTrustBadge(store.settings) && <SallaTrustBadges />}
        </section>
      )}
    </AccountShell>
  );
}
