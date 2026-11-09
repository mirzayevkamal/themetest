import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SallaPayments } from '@salla.sa/twilight-components-react/payments';
import { SallaTrustBadges } from '@salla.sa/twilight-components-react/trust-badges';
import { category } from '@salla.sa/twilight-theme-engine/api/category';
import { menu } from '@salla.sa/twilight-theme-engine/api/menu';
import { Image, Link, RenderWhenVisible } from '@salla.sa/twilight-theme-engine/common';
import { useStore } from '@salla.sa/twilight-theme-engine/hooks/useStore';
import { useTheme } from '@salla.sa/twilight-theme-engine/hooks/useTheme';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { MadeWithSalla } from '@salla.sa/twilight-theme-engine/layout';
import type {
  Category,
  MenuItem,
  StoreApps,
  StoreContacts,
  StoreSocial as StoreSocialLinks,
} from '@salla.sa/twilight-theme-engine/types';
import { useIsWebDesktop } from '../../hooks/useIsWebDesktop';
import {
  SbcBadge,
  TAX_ICON_URL,
  TaxCertificateLink,
  hasTrustBadge,
} from '../common/StoreCredentials';
import { localizedSetting } from '../../lib/localizedSetting';
import { StoreSocial, hasSocial } from './StoreSocial';
import appStore from '../../styles/images/app-store.png?no-inline';
import googlePlay from '../../styles/images/google-play.png?no-inline';

function StoreBadge({ href, src, alt }: { href: string; src: string; alt: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="shrink-0">
      <Image
        src={src}
        alt={alt}
        width={135}
        height={40}
        fetchPriority="low"
        noWrapper
        objectFit="contain"
        className="h-10 w-[135px]"
      />
    </a>
  );
}

/** API sends `[]` when the store has no app URLs; configured stores send `{ googleplay, appstore }`. */
function storeApps(apps: StoreApps | unknown[] | undefined): StoreApps {
  if (!apps || Array.isArray(apps)) return {};
  return { googleplay: apps.googleplay, appstore: apps.appstore };
}

function StoreBadges({ apps }: { apps: StoreApps }) {
  const { t } = useTranslation();
  if (!apps.googleplay && !apps.appstore) return null;
  return (
    <div className="flex items-center gap-3" dir="ltr">
      {apps.googleplay && (
        <StoreBadge
          href={apps.googleplay}
          src={googlePlay}
          alt={t('common.footer.google_play', 'Google Play')}
        />
      )}
      {apps.appstore && (
        <StoreBadge
          href={apps.appstore}
          src={appStore}
          alt={t('common.footer.app_store', 'App Store')}
        />
      )}
    </div>
  );
}

const CATEGORY_LIMIT = 30;
const PAGE_COLUMN_SIZE = 12;
const PAGE_COLUMN_COUNT = 2;
const PAGE_LIMIT = PAGE_COLUMN_SIZE * PAGE_COLUMN_COUNT;

function leafCategories(categories: Category[]): Category[] {
  return categories.flatMap((cat) => (cat.sub_categories?.length ? cat.sub_categories : [cat]));
}

function flattenMenu(items: MenuItem[]): MenuItem[] {
  return items.flatMap((item) => (item.children?.length ? item.children : [item]));
}

function storePhone(contacts: StoreContacts | StoreContacts[] | undefined): string | undefined {
  if (!contacts || Array.isArray(contacts)) return undefined;
  return contacts.phone || contacts.mobile;
}

const linkClass = 'max-w-full break-words text-sm leading-normal hover:opacity-80';
const titleClass = 'w-full text-start text-lg font-bold leading-7';
const sectionClass = 'desktop-footer__section flex flex-col items-start gap-6';

function FooterNav({
  phone,
  social,
  apps,
  hasApps,
}: {
  phone?: string;
  social: StoreSocialLinks | unknown[] | undefined;
  apps: StoreApps;
  hasApps: boolean;
}) {
  const { t } = useTranslation();
  // CSS hides the footer on phones, so it never intersects there; the viewport gate
  // keeps the fetch off in the native webview and in tests, where CSS does not run.
  const webDesktop = useIsWebDesktop();
  const { data: categories = [] } = useQuery({
    ...category.queries.list(),
    enabled: webDesktop,
  });
  const { data: footerPages = [] } = useQuery({
    queryKey: ['menu', 'footer'],
    queryFn: menu.footer,
    enabled: webDesktop,
  });

  const allCategories = leafCategories(categories);
  const showAllTo = categories[0]?.url;
  const showAll = allCategories.length > CATEGORY_LIMIT && Boolean(showAllTo);
  const categoryItems = showAll ? allCategories.slice(0, CATEGORY_LIMIT - 1) : allCategories;
  const pageItems = flattenMenu(footerPages).slice(0, PAGE_LIMIT);

  return (
    <div className="desktop-footer__nav">
      {categoryItems.length > 0 && (
        <div className={`${sectionClass} desktop-footer__section--categories`}>
          <p className={titleClass}>{t('common.footer.categories', 'التصنيفات')}</p>
          <div className="desktop-footer__links desktop-footer__links--categories">
            {categoryItems.map((cat) => (
              <Link key={cat.id} to={cat.url} className={linkClass}>
                {cat.name}
              </Link>
            ))}
            {showAll && (
              <Link to={showAllTo} className={`${linkClass} whitespace-nowrap underline`}>
                {t('common.footer.show_all', 'مشاهدة الكل')}
              </Link>
            )}
          </div>
        </div>
      )}

      {pageItems.length > 0 && (
        <div className={`${sectionClass} desktop-footer__section--pages`}>
          <p className={titleClass}>{t('common.footer.important_links', 'روابط مهمة')}</p>
          <div className="desktop-footer__links desktop-footer__links--pages">
            {pageItems.map((page) => (
              <Link key={page.id} to={page.url} className={linkClass}>
                {page.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      {(phone || hasSocial(social)) && (
        <div className={`${sectionClass} desktop-footer__section--contact`}>
          <p className={titleClass}>{t('common.footer.contact_us', 'تواصل معنا')}</p>
          {phone && (
            <a
              href={`tel:${phone.replace(/\s/g, '')}`}
              className={`${linkClass} whitespace-nowrap`}
            >
              {phone}
            </a>
          )}
          <StoreSocial social={social} />
        </div>
      )}

      {hasApps && (
        <div className={`${sectionClass} desktop-footer__section--apps`}>
          <p className={titleClass}>{t('common.footer.download_app', 'حمِّل التطبيق')}</p>
          <div className="flex flex-col items-start gap-3">
            <p className="text-start text-base leading-[22px]">
              {t('common.footer.get_app', 'لتجربة شراء وتسوق افضل، حمل التطبيق الان')}
            </p>
            <StoreBadges apps={apps} />
          </div>
        </div>
      )}
    </div>
  );
}

/** The merchant's VAT registration, Saudi Business Center certificate and commercial register
 *  or freelance badge, each only when the merchant entered it (as in Twig grocery's footer). */
function FooterCredentials({ dark }: { dark: boolean }) {
  const { settings } = useStore();
  const { t } = useTranslation();
  const taxNumber = settings?.tax?.number;
  const trustBadge = hasTrustBadge(settings);
  if (!taxNumber && !settings?.certificate?.id && !trustBadge) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      {taxNumber && (
        <TaxCertificateLink
          certificate={settings?.tax?.certificate}
          className="flex items-center gap-2 text-start transition-opacity hover:opacity-80"
        >
          {settings?.tax?.certificate && (
            <img
              src={TAX_ICON_URL}
              alt=""
              width={24}
              height={30}
              loading="lazy"
              decoding="async"
              className="w-6 rounded-sm"
            />
          )}
          <span className="flex flex-col gap-1 leading-none">
            <span className="text-xs opacity-60">
              {t('common.elements.tax_number', 'الرقم الضريبي')}
            </span>
            <b className="text-sm" dir="ltr">
              {taxNumber}
            </b>
          </span>
        </TaxCertificateLink>
      )}
      <SbcBadge id={settings?.certificate?.id} />
      {trustBadge && <SallaTrustBadges {...(dark ? { dark: true } : {})} />}
    </div>
  );
}

/** Figma 3208:37426 — web-desktop footer. Hidden on mobile / native via CSS. */
export function DesktopFooter() {
  const store = useStore();
  const { t, locale } = useTranslation();
  const year = new Date().getFullYear();
  const phone = storePhone(store.contacts);
  const apps = storeApps(store.apps);
  const hasApps = Boolean(apps.googleplay || apps.appstore);
  // The merchant's "dark mode" footer switch; dark (the Figma look) unless turned off.
  const settings = useTheme().settings as Record<string, unknown> | undefined;
  const dark = settings?.footer_is_dark !== false;
  const showPayments = settings?.footer_show_payments !== false;
  const copyright = localizedSetting(settings?.footer_copyright_text, locale);

  return (
    <footer
      className={`desktop-footer w-full shrink-0 flex-col items-center gap-11 py-4 ${
        dark ? 'bg-black text-white' : 'border-t border-hairline bg-neutral-100 text-ink'
      }`}
    >
      {/* Lists sit below the fold: mount (and fetch) only once the footer is near the viewport.
          The engine's RenderWhenVisible is React.lazy: without this boundary, hydrating the
          layout (on every page) suspends at the root and renders the whole shell twice. */}
      <Suspense fallback={<div />}>
        <RenderWhenVisible className="w-full" estimatedHeight="360px" placeholder={<div />}>
          <FooterNav phone={phone} social={store.social} apps={apps} hasApps={hasApps} />
        </RenderWhenVisible>
      </Suspense>

      <div className="desktop-footer__bottom">
        {store.logo ? (
          <Image
            src={store.logo}
            alt={store.name}
            width={131}
            height={40}
            fetchPriority="low"
            noWrapper
            objectFit="contain"
            className="h-10 w-auto max-w-[131px] shrink-0"
          />
        ) : (
          <span className="shrink-0 text-sm font-bold">{store.name}</span>
        )}

        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-3">
          {showPayments && <SallaPayments />}
          <FooterCredentials dark={dark} />
        </div>

        <p className="flex shrink-0 flex-wrap items-center justify-center gap-x-2 text-center text-sm leading-[22px]">
          <span>
            {copyright ||
              t('common.footer.copyright', 'جميع الحقوق محفوظة | {{year}} {{store}}', {
                year,
                store: store.name,
              })}
          </span>
          <MadeWithSalla />
        </p>
      </div>
    </footer>
  );
}
