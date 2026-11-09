import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { Wishlist } from '@salla.sa/twilight-theme-engine/routes/account';
import type { WishlistPageProps } from '@salla.sa/twilight-theme-engine/routes/account';
import { PageHeader } from '../navigation';
import { AccountShell } from './AccountSidebar';

/** The engine's wishlist (cards, add to cart, remove, share, paging) inside the account shell;
 *  `account-wishlist` in user-pages.scss restyles its markup with grocery tokens. */
export function WishlistPage(props: WishlistPageProps) {
  const { t } = useTranslation();
  return (
    <AccountShell header={<PageHeader title={t('common.titles.wishlist', 'المفضلة')} />}>
      <section className="account-wishlist rounded-xl bg-white p-4">
        <Wishlist.Component {...props} />
      </section>
    </AccountShell>
  );
}
