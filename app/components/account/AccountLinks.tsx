import { useTwilight } from '@salla.sa/twilight-theme-engine';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { BellIcon } from '../icons/BellIcon';
import { ClockIcon } from '../icons/ClockIcon';
import { GiftIcon } from '../icons/GiftIcon';
import { HeartIcon } from '../icons/HeartIcon';
import { Row } from './AccountRows';

/** Pending orders, notifications, wishlist and loyalty points: the customer pages Salla's
 *  user menu links to. No counts: the store data and the profile API don't carry them. */
export function AccountLinks({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { store } = useTwilight();

  return (
    <>
      <Row
        className={className}
        icon={<ClockIcon />}
        label={t('common.titles.pending_orders', 'الطلبات المعلقة')}
        to="/account/orders?status=pending"
      />
      <Row
        className={className}
        icon={<BellIcon />}
        label={t('common.titles.notifications', 'الإشعارات')}
        to="/account/notifications"
      />
      <Row
        className={className}
        icon={<HeartIcon />}
        label={t('common.titles.wishlist', 'المفضلة')}
        to="/account/wishlist"
      />
      {store.settings?.is_loyalty_enabled && (
        <Row
          className={className}
          icon={<GiftIcon />}
          label={t('pages.loyalty_program.loyalty_points', 'نقاط الولاء')}
          to="/loyalty"
        />
      )}
    </>
  );
}
