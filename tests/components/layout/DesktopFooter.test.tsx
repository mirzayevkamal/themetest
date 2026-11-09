import React from 'react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import type { Category, MenuItem } from '@salla.sa/twilight-theme-engine/types';
import { DesktopFooter } from '../../../app/components/layout/DesktopFooter';

const store = {
  name: 'الدكان',
  logo: 'https://cdn.example.com/logo.png',
  contacts: { phone: '920016047' } as { phone?: string; mobile?: string } | unknown[],
  social: [] as Record<string, string> | unknown[],
  apps: { googleplay: 'https://play.example', appstore: 'https://apple.example' } as {
    googleplay?: string;
    appstore?: string;
  },
  settings: undefined as Record<string, unknown> | undefined,
};

let mockCategories: Category[] = [];
let mockFooterPages: MenuItem[] = [];
const queryCalls: Array<{ key: string; enabled?: boolean }> = [];
let footerVisible = true;
// Simulates the engine's lazy RenderWhenVisible chunk still loading.
let listsChunkPending = false;
const pendingChunk = new Promise<never>(() => {});
let mockLocale = 'ar';
let themeSettings: {
  footer_is_dark?: boolean;
  footer_show_payments?: boolean;
  footer_copyright_text?: unknown;
} = {};

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey, enabled }: { queryKey: readonly unknown[]; enabled?: boolean }) => {
    const key = queryKey.map(String).join(',');
    queryCalls.push({ key, enabled });
    if (enabled === false) return { data: undefined, isPending: true };
    if (key.includes('footer') || key.includes('menu')) {
      return { data: mockFooterPages, isPending: false };
    }
    return { data: mockCategories, isPending: false };
  },
}));

vi.mock('@salla.sa/twilight-components-react/social', () => ({
  SallaSocial: ({ className }: { className?: string }) => (
    <ul data-testid="footer-social-list" className={className} />
  ),
}));

vi.mock('@salla.sa/twilight-components-react/payments', () => ({
  SallaPayments: () => <div data-testid="footer-payments-list" />,
}));

vi.mock('@salla.sa/twilight-components-react/trust-badges', () => ({
  SallaTrustBadges: ({ dark }: { dark?: boolean }) => (
    <div data-testid="footer-trust-badges" data-dark={String(Boolean(dark))} />
  ),
}));

vi.mock('@salla.sa/twilight-theme-engine/api/category', () => ({
  category: { queries: { list: () => ({ queryKey: ['categories'] }) } },
}));

vi.mock('@salla.sa/twilight-theme-engine/api/menu', () => ({
  menu: { footer: vi.fn() },
}));

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({
    locale: mockLocale,
    t: (_key: string, fallback: string, vars?: Record<string, unknown>) => {
      if (!vars) return fallback;
      return fallback.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(vars[name] ?? ''));
    },
  }),
}));

// The engine badge hides itself when store.settings.display_copyright is false (tested there).
let madeWithSalla = true;
vi.mock('@salla.sa/twilight-theme-engine/layout', () => ({
  MadeWithSalla: () =>
    madeWithSalla ? <span data-testid="store-footer-salla-badge">Powered by Salla</span> : null,
}));

vi.mock('@salla.sa/twilight-theme-engine/hooks/useStore', () => ({
  useStore: () => store,
}));

vi.mock('@salla.sa/twilight-theme-engine/hooks/useTheme', () => ({
  useTheme: () => ({ settings: themeSettings }),
}));

vi.mock('@salla.sa/twilight-theme-engine/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@salla.sa/twilight-theme-engine/common')>();
  return {
    ...actual,
    RenderWhenVisible: ({
      children,
      className,
      placeholder,
    }: {
      children: React.ReactNode;
      className?: string;
      placeholder?: React.ReactNode;
    }) => {
      if (listsChunkPending) throw pendingChunk;
      return <section className={className}>{footerVisible ? children : placeholder}</section>;
    },
    Image: ({
      src,
      alt,
      width,
      height,
    }: {
      src?: string;
      alt?: string;
      width?: number;
      height?: number;
    }) => <img src={src} alt={alt} width={width} height={height} />,
    Link: ({
      to,
      children,
      className,
    }: {
      to?: string;
      children?: React.ReactNode;
      className?: string;
    }) => (
      <a href={to} className={className}>
        {children}
      </a>
    ),
  };
});

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn(
    () =>
      ({
        matches,
        media: '(min-width: 481px)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList
  );
}

async function renderFooter() {
  const view = render(<DesktopFooter />);
  await act(async () => {});
  return view;
}

// The footer reads the year during render; a frozen clock keeps the expected line stable.
const defaultCopyright = 'جميع الحقوق محفوظة | 2026 الدكان';

describe('DesktopFooter', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
    mockLocale = 'ar';
    queryCalls.length = 0;
    footerVisible = true;
    listsChunkPending = false;
    themeSettings = {};
    madeWithSalla = true;
    mockMatchMedia(true);
    store.apps = { googleplay: 'https://play.example', appstore: 'https://apple.example' };
    store.contacts = { phone: '920016047' };
    store.social = [];
    mockCategories = [
      {
        id: 1,
        name: 'الألبان',
        url: '/dairy',
        sub_categories: [
          { id: 11, name: 'الحليب', url: '/milk' },
          { id: 12, name: 'القهوة', url: '/coffee' },
        ],
      },
    ];
    mockFooterPages = [{ id: 21, title: 'سياسة الاستخدام والخصوصية', url: '/privacy' }];
  });

  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.classList.remove('mobile-webview');
    delete (window as { salla?: unknown }).salla;
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  const classes = (el: Element | null) => [...(el?.classList ?? [])];

  it('is dark with white text by default', async () => {
    const { container } = await renderFooter();
    const footer = classes(container.querySelector('footer'));
    expect(footer).toEqual(expect.arrayContaining(['bg-black', 'text-white']));
    expect(footer).not.toContain('bg-neutral-100');
    expect(footer).not.toContain('text-ink');
  });

  it('turns light with ink text when the footer dark-mode switch is off', async () => {
    themeSettings = { footer_is_dark: false };
    store.social = { instagram: 'https://instagram.com/meed' };
    const { container, getByTestId } = await renderFooter();
    const footer = classes(container.querySelector('footer'));
    expect(footer).toEqual(expect.arrayContaining(['bg-neutral-100', 'text-ink']));
    expect(footer).not.toContain('bg-black');
    expect(footer).not.toContain('text-white');
    // Inner text, social links included, inherits the footer color instead of forcing white.
    expect(classes(getByTestId('footer-social-list'))).not.toContain('text-white');
    expect(container.querySelector('.text-white')).toBeNull();
  });

  it('shows the payment methods by default', async () => {
    const { queryByTestId } = await renderFooter();
    expect(queryByTestId('footer-payments-list')).not.toBeNull();
  });

  it('hides the payment methods when the footer payments switch is off', async () => {
    themeSettings = { footer_show_payments: false };
    const { queryByTestId } = await renderFooter();
    expect(queryByTestId('footer-payments-list')).toBeNull();
  });

  it("keeps the rest of the footer, and the page above it, rendering while the lists' chunk loads", async () => {
    listsChunkPending = true;
    const { getByText, queryByText } = render(
      <React.Suspense fallback={<p>page suspended</p>}>
        <DesktopFooter />
      </React.Suspense>
    );
    await act(async () => {});
    expect(queryByText('page suspended')).toBeNull();
    expect(getByText(defaultCopyright)).toBeTruthy();
  });

  it('renders copyright, store badges and the logo', async () => {
    const { container, getByText, getAllByText } = await renderFooter();
    expect(getByText(defaultCopyright)).toBeTruthy();
    expect(getAllByText('لتجربة شراء وتسوق افضل، حمل التطبيق الان').length).toBe(1);
    expect(container.querySelectorAll('a[href="https://play.example"]').length).toBe(1);
    expect(container.querySelectorAll('a[href="https://apple.example"]').length).toBe(1);
    expect(
      container.querySelector('.desktop-footer__bottom a[href="https://play.example"]')
    ).toBeNull();
    expect(container.querySelector('img[alt="الدكان"]')?.getAttribute('width')).toBe('131');
  });

  it('puts the Made-with-Salla badge beside the copyright line, in the dark and light footers', async () => {
    const dark = await renderFooter();
    const line = dark.getByText(defaultCopyright).parentElement!;
    expect(line.querySelector('[data-testid="store-footer-salla-badge"]')).toBeTruthy();
    expect(classes(dark.container.querySelector('footer'))).toContain('bg-black');
    dark.unmount();

    themeSettings = { footer_is_dark: false };
    const light = await renderFooter();
    expect(
      light
        .getByText(defaultCopyright)
        .parentElement!.querySelector('[data-testid="store-footer-salla-badge"]')
    ).toBeTruthy();
    expect(classes(light.container.querySelector('footer'))).toContain('bg-neutral-100');
  });

  it('shows the merchant copyright text instead of the default line', async () => {
    themeSettings = { footer_copyright_text: 'جميع الحقوق محفوظة لشركة ميد التجارية' };
    const { getByText, queryByText } = await renderFooter();
    const line = getByText('جميع الحقوق محفوظة لشركة ميد التجارية').parentElement!;
    expect(line.querySelector('[data-testid="store-footer-salla-badge"]')).toBeTruthy();
    expect(queryByText(defaultCopyright)).toBeNull();
  });

  it.each([
    ['ar', 'لشركة ميد التجارية', 'Meed Trading Company'],
    ['en', 'Meed Trading Company', 'لشركة ميد التجارية'],
  ])('picks the %s copyright text from a localized setting', async (locale, shown, hidden) => {
    mockLocale = locale;
    themeSettings = {
      footer_copyright_text: { ar: 'لشركة ميد التجارية', en: 'Meed Trading Company' },
    };
    const { getByText, queryByText } = await renderFooter();
    expect(getByText(shown)).toBeTruthy();
    expect(queryByText(hidden)).toBeNull();
  });

  it('falls back to the default copyright line when the setting is blank', async () => {
    themeSettings = { footer_copyright_text: '  ' };
    const { getByText } = await renderFooter();
    expect(getByText(defaultCopyright)).toBeTruthy();
  });

  it('keeps the copyright line alone when the engine hides the badge', async () => {
    madeWithSalla = false;
    const { container, getByText } = await renderFooter();
    const line = getByText(defaultCopyright).parentElement!;
    expect(line.children.length).toBe(1);
    expect(container.querySelector('[data-testid="store-footer-salla-badge"]')).toBeNull();
  });

  it('hides the badges and download copy when the store has no app URLs', async () => {
    store.apps = {};
    const { container, queryByText } = await renderFooter();
    expect(container.querySelectorAll('img[src*="/google-play.png"]').length).toBe(0);
    expect(container.querySelectorAll('img[src*="/app-store.png"]').length).toBe(0);
    expect(queryByText('حمِّل التطبيق')).toBeNull();
    expect(queryByText('لتجربة شراء وتسوق افضل، حمل التطبيق الان')).toBeNull();
  });

  it.each([
    ['with', { googleplay: 'https://play.example', appstore: 'https://apple.example' }],
    ['without', {}],
  ])('shows the store payment methods in the bottom bar %s app URLs', async (_, apps) => {
    store.apps = apps;
    const { container } = await renderFooter();
    expect(
      container.querySelector('.desktop-footer__bottom [data-testid="footer-payments-list"]')
    ).toBeTruthy();
  });

  it('treats an empty apps array as no store URLs', async () => {
    store.apps = [] as unknown as typeof store.apps;
    const { container, queryByText } = await renderFooter();
    expect(container.querySelectorAll('img[src*="/google-play.png"]').length).toBe(0);
    expect(container.querySelectorAll('img[src*="/app-store.png"]').length).toBe(0);
    expect(queryByText('حمِّل التطبيق')).toBeNull();
  });

  it('shows only the Google Play badge when the App Store URL is missing', async () => {
    store.apps = { googleplay: 'https://play.example' };
    const { container } = await renderFooter();
    expect(container.querySelectorAll('a[href="https://play.example"]').length).toBe(1);
    expect(container.querySelectorAll('img[src*="/google-play.png"]').length).toBe(1);
    expect(container.querySelectorAll('img[src*="/app-store.png"]').length).toBe(0);
  });

  it('shows only the App Store badge when the Google Play URL is missing', async () => {
    store.apps = { appstore: 'https://apple.example' };
    const { container } = await renderFooter();
    expect(container.querySelectorAll('a[href="https://apple.example"]').length).toBe(1);
    expect(container.querySelectorAll('img[src*="/app-store.png"]').length).toBe(1);
    expect(container.querySelectorAll('img[src*="/google-play.png"]').length).toBe(0);
  });

  it('lists leaf categories, footer pages and the store phone', async () => {
    const { getByText, queryByText } = await renderFooter();
    expect(getByText('التصنيفات')).toBeTruthy();
    expect(getByText('الحليب')?.closest('a')?.getAttribute('href')).toBe('/milk');
    expect(getByText('القهوة')?.closest('a')?.getAttribute('href')).toBe('/coffee');
    expect(queryByText('الألبان')).toBeNull();
    expect(getByText('روابط مهمة')).toBeTruthy();
    expect(getByText('سياسة الاستخدام والخصوصية')?.closest('a')?.getAttribute('href')).toBe(
      '/privacy'
    );
    expect(getByText('تواصل معنا')).toBeTruthy();
    expect(getByText('920016047')?.closest('a')?.getAttribute('href')).toBe('tel:920016047');
    expect(getByText('حمِّل التطبيق')).toBeTruthy();
  });

  it('caps a long category tree at 29 links and adds مشاهدة الكل', async () => {
    mockCategories = Array.from({ length: 40 }, (_, i) => ({
      id: i + 1,
      name: `تصنيف ${i + 1}`,
      url: `/c${i + 1}`,
    }));
    const { queryByText, getByText } = await renderFooter();
    expect(getByText('تصنيف 1')).toBeTruthy();
    expect(getByText('تصنيف 29')).toBeTruthy();
    expect(queryByText('تصنيف 30')).toBeNull();
    expect(getByText('مشاهدة الكل')?.closest('a')?.getAttribute('href')).toBe('/c1');
  });

  it('does not show مشاهدة الكل when categories fit the cap', async () => {
    mockCategories = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      name: `تصنيف ${i + 1}`,
      url: `/c${i + 1}`,
    }));
    const { queryByText, getByText } = await renderFooter();
    expect(getByText('تصنيف 30')).toBeTruthy();
    expect(queryByText('مشاهدة الكل')).toBeNull();
  });

  it('renders footer pages past 12 in the important-links list', async () => {
    mockFooterPages = Array.from({ length: 13 }, (_, i) => ({
      id: i + 1,
      title: `صفحة ${i + 1}`,
      url: `/p${i + 1}`,
    }));
    const { getByText, container } = await renderFooter();
    expect(getByText('صفحة 1')).toBeTruthy();
    expect(getByText('صفحة 12')).toBeTruthy();
    expect(getByText('صفحة 13')?.closest('a')?.getAttribute('href')).toBe('/p13');
    expect(container.querySelector('.desktop-footer__links--pages')).toBeTruthy();
  });

  it('keeps footer pages to two columns of 12', async () => {
    mockFooterPages = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      title: `صفحة ${i + 1}`,
      url: `/p${i + 1}`,
    }));
    const { getByText, queryByText } = await renderFooter();
    expect(getByText('صفحة 24')).toBeTruthy();
    expect(queryByText('صفحة 25')).toBeNull();
  });

  it('uses a wrapping nav so mid-width desktop does not crush the link columns', async () => {
    const { container } = await renderFooter();
    expect(container.querySelector('.desktop-footer__nav')).toBeTruthy();
    expect(container.querySelector('.desktop-footer__section--categories')).toBeTruthy();
    expect(container.querySelector('.desktop-footer__links--categories')).toBeTruthy();
    expect(container.querySelector('.desktop-footer__bottom')).toBeTruthy();
  });

  it('hides empty columns when the store has no categories, pages or phone', async () => {
    mockCategories = [];
    mockFooterPages = [];
    store.contacts = [];
    const { queryByText, getByText } = await renderFooter();
    expect(queryByText('التصنيفات')).toBeNull();
    expect(queryByText('روابط مهمة')).toBeNull();
    expect(queryByText('تواصل معنا')).toBeNull();
    expect(getByText('حمِّل التطبيق')).toBeTruthy();
  });

  it('shows the social links under contact us, even without a phone', async () => {
    store.contacts = [];
    store.social = { instagram: 'https://instagram.com/meed', twitter: 'https://x.com/meed' };
    const { getByText, getByTestId } = await renderFooter();
    expect(getByText('تواصل معنا')).toBeTruthy();
    expect(getByTestId('footer-social-list')).toBeTruthy();
  });

  it('puts the social links after the phone in the contact column', async () => {
    store.social = { instagram: 'https://instagram.com/meed' };
    const { getByText, getByTestId } = await renderFooter();
    const phone = getByText('920016047');
    const social = getByTestId('footer-social-list');
    expect(phone.closest('.desktop-footer__section--contact')).toBe(
      social.closest('.desktop-footer__section--contact')
    );
    expect(phone.compareDocumentPosition(social) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('skips contact us when WhatsApp is the only social link', async () => {
    store.contacts = [];
    store.social = { whatsapp: 'https://wa.me/966500000000', twitter: '' };
    const { queryByText, queryByTestId } = await renderFooter();
    expect(queryByText('تواصل معنا')).toBeNull();
    expect(queryByTestId('footer-social-list')).toBeNull();
  });

  it('starts category and footer queries on a web desktop viewport', async () => {
    queryCalls.length = 0;
    await renderFooter();
    expect(queryCalls.length).toBeGreaterThan(0);
    expect(queryCalls.every((call) => call.enabled)).toBe(true);
  });

  it('does not create the list queries until the footer scrolls into view', async () => {
    footerVisible = false;
    const { queryByText, getByText } = await renderFooter();
    expect(queryCalls.length).toBe(0);
    expect(queryByText('التصنيفات')).toBeNull();
    expect(getByText(defaultCopyright)).toBeTruthy();
  });

  it('does not start category or footer queries on a phone', async () => {
    mockMatchMedia(false);
    queryCalls.length = 0;
    const { queryByText, getByText } = await renderFooter();
    expect(queryCalls.every((call) => call.enabled === false)).toBe(true);
    expect(queryByText('التصنيفات')).toBeNull();
    expect(queryByText('روابط مهمة')).toBeNull();
    expect(getByText(defaultCopyright)).toBeTruthy();
  });

  it('does not start category or footer queries in the native webview', async () => {
    document.documentElement.classList.add('mobile-webview');
    queryCalls.length = 0;
    const { queryByText } = await renderFooter();
    expect(queryCalls.every((call) => call.enabled === false)).toBe(true);
    expect(queryByText('التصنيفات')).toBeNull();
    expect(queryByText('روابط مهمة')).toBeNull();
  });

  it('does not start category or footer queries inside the native app', async () => {
    window.salla = { mobile: { isEnabled: () => true } } as unknown as typeof window.salla;
    queryCalls.length = 0;
    const { queryByText } = await renderFooter();
    expect(queryCalls.every((call) => call.enabled === false)).toBe(true);
    expect(queryByText('التصنيفات')).toBeNull();
  });

  describe('store credentials', () => {
    afterEach(() => {
      store.settings = undefined;
    });

    it('shows the VAT number, Saudi Business Center badge and trust badge the merchant set', async () => {
      store.settings = {
        tax: { number: '310123456700003', certificate: 'https://cdn.test/vat.png' },
        certificate: { id: '0000123456' },
        commercial_number: '1010123456',
      };
      const { container, getByText, getByRole, getByTestId } = await renderFooter();
      const bottom = container.querySelector('.desktop-footer__bottom')!;
      expect(bottom.textContent).toContain('310123456700003');
      expect(getByText('الرقم الضريبي')).toBeTruthy();
      expect(getByRole('button', { name: 'الشهادة الضريبية' })).toBeTruthy();
      expect(
        bottom.querySelector('a[href*="saudibusiness.gov.sa/certificate-details/0000123456"]')
      ).toBeTruthy();
      // The footer is dark by default; the badge gets its white icons.
      expect(getByTestId('footer-trust-badges').getAttribute('data-dark')).toBe('true');
    });

    it('shows the VAT number as text when no certificate is uploaded', async () => {
      store.settings = { tax: { number: '310123456700003' } };
      const { queryByRole, container } = await renderFooter();
      expect(container.querySelector('.desktop-footer__bottom')?.textContent).toContain(
        '310123456700003'
      );
      expect(queryByRole('button', { name: 'الشهادة الضريبية' })).toBeNull();
    });

    it('shows no credentials when the merchant set none', async () => {
      store.settings = { tax: { number: '' }, certificate: null, commercial_number: null };
      const { queryByText, queryByTestId, container } = await renderFooter();
      expect(queryByText('الرقم الضريبي')).toBeNull();
      expect(queryByTestId('footer-trust-badges')).toBeNull();
      expect(container.querySelector('a[href*="saudibusiness"]')).toBeNull();
    });
  });
});
