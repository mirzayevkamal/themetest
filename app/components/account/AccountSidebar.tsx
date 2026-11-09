import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTwilight } from '@salla.sa/twilight-theme-engine';
import { useMoney } from '@salla.sa/twilight-theme-engine/hooks/useMoney';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { openNativeBrowser } from '@salla.sa/twilight-theme-engine/native-app';
import { Wallet } from '@salla.sa/twilight-theme-engine/routes/account';
import {
  AUTH_TOKEN_COOKIE_NAME,
  extractTokenFromCookies,
} from '@salla.sa/twilight-theme-engine/utils';
import { useIsWebDesktop } from '../../hooks/useIsWebDesktop';
import { LogoutIcon } from '../icons/LogoutIcon';
import { MapPinIcon } from '../icons/MapPinIcon';
import { TaskIcon } from '../icons/TaskIcon';
import { UserOutlineIcon } from '../icons/UserOutlineIcon';
import { WalletAddIcon } from '../icons/WalletAddIcon';
import { AccountLinks } from './AccountLinks';
import { Row } from './AccountRows';

// Profile and addresses live on accounts.salla.com; deep-link with the store id and auth
// token (`info`), read at click time since storage can lag an in-modal login.
export function useOpenAccounts() {
  const { locale } = useTranslation();
  const { store } = useTwilight();
  return (path: string) => {
    const salla = window.salla;
    const params = new URLSearchParams({ store: String(store.id) });
    const token =
      (salla?.storage.get('token') as string | undefined) ||
      extractTokenFromCookies(document.cookie, AUTH_TOKEN_COOKIE_NAME);
    if (token) params.set('info', token);
    const url = `https://accounts.salla.com/${locale}/${path}?${params}`;
    if (!openNativeBrowser(url)) window.open(url, '_blank', 'noopener,noreferrer');
  };
}

export const logout = () =>
  void (window.salla?.auth as { logout?: () => Promise<unknown> } | undefined)?.logout?.();

/** `balance` skips the fetch when the page already loaded it; `enabled` skips it while
 *  the row is not shown. A cached balance is still read either way. */
export function WalletRow({
  label,
  className,
  balance,
  enabled = true,
}: {
  label: string;
  className?: string;
  balance?: number;
  enabled?: boolean;
}) {
  const { format } = useMoney();
  const { data } = useQuery({
    queryKey: ['wallet', 'balance'],
    // The wallet API isn't a public engine subpath; the route loader is.
    queryFn: () => Wallet.loader({ search: { page: 1 } }),
    select: (result) => result.balance,
    enabled: enabled && balance == null,
  });
  const shown = balance ?? data;
  return (
    <Row
      icon={<WalletAddIcon />}
      label={label}
      to="/account/wallet"
      className={className}
      value={shown != null ? <strong className="text-sm">{format(shown)}</strong> : undefined}
    />
  );
}

/** Web-desktop account navigation (Figma 3208:30762). Hidden on mobile by account-desktop.scss. */
export function AccountSidebar({ balance }: { balance?: number }) {
  const { t } = useTranslation();
  const openAccounts = useOpenAccounts();
  const isWebDesktop = useIsWebDesktop();
  return (
    <aside className="account-sidebar shrink-0 flex-col gap-4">
      <nav aria-label={t('pages.account.title', 'حسابي')} className="rounded-xl bg-white p-8">
        <div className="-my-4 divide-y divide-neutral-100">
          <Row
            className="py-4"
            icon={<UserOutlineIcon />}
            label={t('pages.account.account_details', 'بيانات الحساب')}
            onClick={() => openAccounts('profile')}
          />
          <Row
            className="py-4"
            icon={<TaskIcon />}
            label={t('pages.orders.title', 'الطلبات')}
            to="/account/orders"
          />
          <AccountLinks className="py-4" />
          <WalletRow
            className="py-4"
            label={t('pages.account.wallet_balance', 'رصيد المحفظة')}
            balance={balance}
            enabled={isWebDesktop}
          />
          <Row
            className="py-4"
            icon={<MapPinIcon />}
            label={t('pages.account.addresses', 'عناوين التوصيل')}
            onClick={() => openAccounts('profile/addresses')}
          />
        </div>
      </nav>
      <div className="rounded-xl bg-white p-4">
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-2 text-start text-sm text-ink"
        >
          <LogoutIcon />
          {t('pages.account.logout', 'تسجيل خروج')}
        </button>
      </div>
    </aside>
  );
}

/** Account pages: mobile keeps the header and stacked cards; web desktop puts the
 *  sidebar beside them and drops the header (account-desktop.scss). */
export function AccountShell({
  header,
  sidebar = true,
  balance,
  children,
}: {
  header?: ReactNode;
  sidebar?: boolean;
  /** Wallet balance the page already loaded, so the sidebar does not fetch it again. */
  balance?: number;
  children?: ReactNode;
}) {
  return (
    <div className="account-shell flex min-h-full flex-col bg-smoke">
      {header}
      <div className="account-shell__body flex flex-col gap-3 p-4">
        {sidebar && <AccountSidebar balance={balance} />}
        <div className="account-shell__main flex min-w-0 flex-1 flex-col gap-3">{children}</div>
      </div>
    </div>
  );
}

/** For a page that owns its full-bleed phone layout (order details): layout-neutral on
 *  mobile, beside the sidebar with its header kept on web desktop (account-desktop.scss). */
export function AccountSidebarLayout({ children }: { children: ReactNode }) {
  return (
    <div className="account-shell account-shell--page contents">
      <AccountSidebar />
      {children}
    </div>
  );
}
