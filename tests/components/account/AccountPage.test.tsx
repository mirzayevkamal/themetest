import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { AccountPage } from '../../../app/components/account/AccountPage';
import { LocalizationModal } from '../../../app/components/layout/LocalizationModal';

let mockLoggedIn = false;
let mockStore: Record<string, unknown> = {};
let logout = vi.fn();
let mockNotifiable = true;
let mockAppVersion: string | null = null;
const updateSettings = vi.fn();
const setQueryData = vi.fn();

const themeSettings: Record<string, unknown> = {};
vi.mock('@salla.sa/twilight-theme-engine/providers', () => ({
  useTwilight: () => ({ theme: { settings: themeSettings } }),
}));

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ history: { back: vi.fn(), canGoBack: () => true }, navigate: vi.fn() }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ select }: { select?: (r: unknown) => unknown }) => ({
    data: select?.({ balance: 15 }),
  }),
  useQueryClient: () => ({ getQueryData: vi.fn(), setQueryData }),
  useMutation: ({
    mutationFn,
    onMutate,
  }: {
    mutationFn: (v: boolean) => Promise<void>;
    onMutate: (v: boolean) => void;
  }) => ({
    isPending: false,
    mutate: (v: boolean) => {
      onMutate(v);
      void mutationFn(v);
    },
  }),
}));

vi.mock('@salla.sa/twilight-theme-engine/api/profile', () => ({
  profile: { updateSettings: (...args: unknown[]) => updateSettings(...args) },
}));

vi.mock('@salla.sa/twilight-theme-engine/api/user', () => ({
  user: { queries: { current: () => ({ queryKey: ['user'] }) } },
}));

vi.mock('@salla.sa/twilight-theme-engine', () => ({
  useTwilight: () => ({ store: mockStore, currency: { code: 'SAR' } }),
}));

vi.mock('@salla.sa/twilight-theme-engine/routes/account', () => ({
  Wallet: { loader: vi.fn() },
}));

vi.mock('@salla.sa/twilight-theme-engine/utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  AUTH_TOKEN_COOKIE_NAME: 'token',
  extractTokenFromCookies: () => 'cookie-token',
}));

vi.mock('@salla.sa/twilight-theme-engine/hooks/useUser', () => ({
  useUser: () => ({
    isLoggedIn: mockLoggedIn,
    data: mockLoggedIn
      ? {
          type: 'user',
          first_name: 'عبد الرحمن',
          last_name: 'الغامدي',
          mobile: '+966551173969',
          preferences: { notifications_enabled: mockNotifiable },
        }
      : null,
  }),
}));

vi.mock('@salla.sa/twilight-theme-engine/native-app', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useNativeAppVersion: () => mockAppVersion,
}));

vi.mock('@salla.sa/twilight-theme-engine/hooks/useMoney', () => ({
  useMoney: () => ({ format: (n: number) => `${n} SAR` }),
}));

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    locale: 'ar',
    languageName: 'العربية',
  }),
}));

vi.mock('@salla.sa/twilight-theme-engine/common', () => ({
  Link: ({ to, children, className }: { to: string; children: unknown; className?: string }) => (
    <a href={to} className={className}>
      {children as React.ReactNode}
    </a>
  ),
}));

vi.mock('@salla.sa/twilight-components-react/trust-badges', () => ({
  SallaTrustBadges: () => <div data-testid="account-trust-badges" />,
}));

vi.mock('@salla.sa/twilight-components-react/localization-modal', () => ({
  SallaLocalizationModal: () => <salla-localization-modal data-testid="localization-modal" />,
}));

beforeEach(() => {
  mockLoggedIn = false;
  mockNotifiable = true;
  mockAppVersion = null;
  updateSettings.mockReset();
  setQueryData.mockReset();
  mockStore = {
    id: 42,
    name: 'Dukan',
    url: 'https://dukan.test',
    logo: 'https://cdn.test/logo.png',
    contacts: { whatsapp: '+966 500 000 000' },
    apps: { appstore: 'https://apps.apple.com/x' },
    settings: { is_multilingual: true, tax: { number: '3010893492000003' } },
  };
  logout = vi.fn();
  window.salla = {
    event: { dispatch: vi.fn() },
    auth: { logout },
    storage: { get: () => undefined },
  } as never;
  window.open = vi.fn();
});

describe('AccountPage', () => {
  it('shows the native app version inside the app', () => {
    mockAppVersion = '5.4.19';
    const { getByText } = render(<AccountPage />);

    expect(getByText('الاصدار')).toBeTruthy();
    expect(getByText('V 5.4.19')).toBeTruthy();
    expect(getByText('3010893492000003')).toBeTruthy();
  });

  it('has no version row in a browser, and keeps the tax number', () => {
    const { queryByText, getByText } = render(<AccountPage />);

    expect(queryByText('الاصدار')).toBeNull();
    expect(getByText('3010893492000003')).toBeTruthy();
  });

  it('drops the store info card when there is neither a version nor a tax number', () => {
    const withCard = render(<AccountPage />).container.querySelectorAll('section').length;
    cleanup();
    mockStore = { ...mockStore, settings: { is_multilingual: true } };
    const { queryByText, container } = render(<AccountPage />);

    expect(container.querySelectorAll('section')).toHaveLength(withCard - 1);
    expect(queryByText('الاصدار')).toBeNull();
    expect(queryByText('الشهادة الضريبية')).toBeNull();
  });

  it('opens the uploaded VAT certificate from the tax number', async () => {
    mockStore = {
      ...mockStore,
      settings: {
        is_multilingual: true,
        tax: { number: '3010893492000003', certificate: 'https://cdn.test/vat.png' },
      },
    };
    const { getByRole, findByRole, queryByRole } = render(<AccountPage />);
    expect(queryByRole('img', { name: 'الشهادة الضريبية' })).toBeNull();

    const button = getByRole('button', { name: 'الشهادة الضريبية' });
    expect(button.textContent).toContain('3010893492000003');
    fireEvent.click(button);
    const image = await findByRole('img', { name: 'الشهادة الضريبية' });
    expect(image.getAttribute('src')).toBe('https://cdn.test/vat.png');
  });

  it('lists the Saudi Business Center and trust badges, which phones have no footer for', () => {
    mockStore = {
      ...mockStore,
      settings: {
        is_multilingual: true,
        certificate: { id: '0000123456' },
        commercial_number: '1010123456',
      },
    };
    const { container, getByTestId } = render(<AccountPage />);

    const credentials = container.querySelector('.account-credentials');
    expect(
      credentials?.querySelector('a[href*="saudibusiness.gov.sa/certificate-details/0000123456"]')
    ).toBeTruthy();
    expect(credentials?.contains(getByTestId('account-trust-badges'))).toBe(true);
  });

  it('has no credentials card when the merchant set no certificate or register number', () => {
    const { container } = render(<AccountPage />);
    expect(container.querySelector('.account-credentials')).toBeNull();
  });

  it('shows the guest card and opens the login modal', () => {
    const { getByText, container, queryByText } = render(<AccountPage />);

    fireEvent.click(getByText('تسجيل دخول'));
    expect(window.salla?.event.dispatch).toHaveBeenCalledWith('login::open');
    expect(container.querySelector('a[href="/account/contact"]')).toBeTruthy();
    expect(container.querySelector('a[href="/account/pages"]')).toBeTruthy();
    expect(container.querySelector('a[href="https://apps.apple.com/x"]')).toBeTruthy();
    expect(getByText('3010893492000003')).toBeTruthy();
    expect(queryByText('تسجيل خروج')).toBeNull();
  });

  it('paints the guest login button ink under primary_button_style dark', () => {
    themeSettings.primary_button_style = 'dark';
    const { getByText } = render(<AccountPage />);
    expect(getByText('تسجيل دخول').className).toContain('bg-ink');
    delete themeSettings.primary_button_style;
  });

  it('shows the profile header, wallet balance and logout when logged in', async () => {
    mockLoggedIn = true;
    const { getByText, getAllByText, container } = render(
      <>
        <LocalizationModal />
        <AccountPage />
      </>
    );

    expect(getByText('عبد الرحمن الغامدي')).toBeTruthy();
    expect(container.querySelector('a[href="/account/wallet"]')?.textContent).toContain('15 SAR');
    // The web-desktop sidebar repeats the account rows and logout.
    expect(container.querySelector('.account-sidebar a[href="/account/orders"]')).toBeTruthy();
    expect(container.querySelector('a[href="/account/edit"]')).toBeNull();

    fireEvent.click(getByText('اللغة'));
    await waitFor(() => {
      expect(window.salla?.event.dispatch).toHaveBeenCalledWith('localization::open');
    });

    for (const button of getAllByText('تسجيل خروج')) fireEvent.click(button);
    expect(logout).toHaveBeenCalledTimes(2);
  });

  it('toggles promotional messages through the profile settings endpoint', () => {
    mockLoggedIn = true;
    const { getByRole, queryByRole, rerender } = render(<AccountPage />);

    const toggle = getByRole('switch', { name: 'الرسائل الترويجية' });
    expect(toggle.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(toggle);
    expect(updateSettings).toHaveBeenCalledWith('is_notifiable', false);
    expect(setQueryData).toHaveBeenCalledWith(['user'], expect.any(Function));

    mockNotifiable = false;
    rerender(<AccountPage />);
    expect(getByRole('switch').getAttribute('aria-checked')).toBe('false');

    mockLoggedIn = false;
    rerender(<AccountPage />);
    expect(queryByRole('switch')).toBeNull();
  });

  it('opens the addresses page on accounts.salla.com with the store id and token', () => {
    mockLoggedIn = true;
    const { getAllByText } = render(<AccountPage />);

    for (const row of getAllByText('عناوين التوصيل')) fireEvent.click(row);
    expect(window.open).toHaveBeenCalledTimes(2);
    expect(window.open).toHaveBeenCalledWith(
      'https://accounts.salla.com/ar/profile/addresses?store=42&info=cookie-token',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('opens the profile page on accounts.salla.com with the store id and token', () => {
    mockLoggedIn = true;
    const { getAllByText } = render(<AccountPage />);

    fireEvent.click(getAllByText('بيانات الحساب')[0]);
    expect(window.open).toHaveBeenCalledWith(
      'https://accounts.salla.com/ar/profile?store=42&info=cookie-token',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('hands the addresses link to the native bridge inside the app', () => {
    mockLoggedIn = true;
    const openBrowser = vi.fn();
    (window.salla as { mobile?: unknown }).mobile = { isEnabled: () => true, openBrowser };
    const { getAllByText } = render(<AccountPage />);

    fireEvent.click(getAllByText('عناوين التوصيل')[0]);
    expect(openBrowser).toHaveBeenCalledWith(expect.stringContaining('/profile/addresses'));
    expect(window.open).not.toHaveBeenCalled();
  });

  it('hides language, contact and rating rows the store cannot back', () => {
    // The API sends `[]`, not `{}`, when nothing is configured.
    mockStore = { ...mockStore, contacts: [], apps: [], settings: {} };
    const { queryByText, queryByTestId } = render(<AccountPage />);

    expect(queryByText('اللغة')).toBeNull();
    expect(queryByText('تواصل معنا')).toBeNull();
    expect(queryByText('قيم التجربة')).toBeNull();
    expect(queryByTestId('localization-modal')).toBeNull();
  });

  it('opens the shared localization modal from the account language row', async () => {
    mockStore = {
      ...mockStore,
      settings: { is_multilingual: false, currencies_enabled: true },
    };
    const { getByText, queryByTestId, findByTestId } = render(
      <>
        <LocalizationModal />
        <AccountPage />
      </>
    );

    expect(queryByTestId('localization-modal')).toBeNull();
    fireEvent.click(getByText('اللغة'));
    expect(await findByTestId('localization-modal')).toBeTruthy();
    await waitFor(() => {
      expect(window.salla?.event.dispatch).toHaveBeenCalledWith('localization::open');
    });
    expect(document.querySelectorAll('salla-localization-modal').length).toBe(1);
  });

  describe('share the app', () => {
    const androidUA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile';
    const setUA = (ua: string) =>
      Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
    const original = navigator.userAgent;

    beforeEach(() => {
      mockStore = {
        ...mockStore,
        apps: { appstore: 'https://apps.apple.com/x', googleplay: 'https://play.google.com/x' },
      };
      (window.salla as { notify?: unknown }).notify = { success: vi.fn() };
    });

    afterEach(() => {
      setUA(original);
      delete (navigator as { share?: unknown }).share;
      delete (navigator as { clipboard?: unknown }).clipboard;
    });

    it('shares the Google Play link and rates on Google Play on Android', () => {
      setUA(androidUA);
      const share = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { share });
      const { getByText, container } = render(<AccountPage />);

      fireEvent.click(getByText('مشاركة التطبيق'));
      expect(share).toHaveBeenCalledWith({ title: 'Dukan', url: 'https://play.google.com/x' });
      expect(container.querySelector('a[href="https://play.google.com/x"]')).toBeTruthy();
    });

    it('hands sharing to the native sheet in the SPA webview', () => {
      setUA(androidUA);
      const share = vi.fn();
      Object.assign(navigator, { share });
      (window.salla as { mobile?: unknown }).mobile = {
        isEnabled: () => true,
        isSpaWebview: () => true,
      };
      const { getByText } = render(<AccountPage />);

      fireEvent.click(getByText('مشاركة التطبيق'));
      expect(window.salla?.event.dispatch).toHaveBeenCalledWith('mobile::share.open', {
        url: 'https://play.google.com/x',
      });
      expect(share).not.toHaveBeenCalled();
    });

    it('falls back to the other store when the device store has no link', () => {
      setUA(androidUA);
      mockStore = { ...mockStore, apps: { appstore: 'https://apps.apple.com/x' } };
      const share = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { share });
      const { getByText } = render(<AccountPage />);

      fireEvent.click(getByText('مشاركة التطبيق'));
      expect(share).toHaveBeenCalledWith({ title: 'Dukan', url: 'https://apps.apple.com/x' });
    });

    it('copies the store URL and confirms when there is no app and no share sheet', async () => {
      mockStore = { ...mockStore, apps: [] };
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      const { getByText } = render(<AccountPage />);

      fireEvent.click(getByText('مشاركة التطبيق'));
      expect(writeText).toHaveBeenCalledWith('https://dukan.test');
      await waitFor(() =>
        expect(window.salla?.notify.success).toHaveBeenCalledWith('تم نسخ الرابط')
      );
    });
  });
});

describe('AccountPage customer links', () => {
  const hrefs = (container: HTMLElement) =>
    [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));

  it('links pending orders, notifications and the wishlist', () => {
    mockLoggedIn = true;
    const { container, getAllByText } = render(<AccountPage />);

    expect(hrefs(container)).toEqual(
      expect.arrayContaining([
        '/account/orders?status=pending',
        '/account/notifications',
        '/account/wishlist',
      ])
    );
    expect(getAllByText('الطلبات المعلقة').length).toBeGreaterThan(0);
    expect(hrefs(container)).not.toContain('/loyalty');
  });

  it('links loyalty points only when the store runs a loyalty program', () => {
    mockLoggedIn = true;
    mockStore = { ...mockStore, settings: { is_loyalty_enabled: true } };
    const { container } = render(<AccountPage />);
    expect(hrefs(container)).toContain('/loyalty');
  });

  it('has no customer links for a guest', () => {
    const { container } = render(<AccountPage />);
    expect(hrefs(container)).not.toContain('/account/wishlist');
  });
});
