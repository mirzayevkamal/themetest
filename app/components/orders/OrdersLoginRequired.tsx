import { useEffect } from 'react';
import { useRouter } from '@tanstack/react-router';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { openLoginThen } from '../../hooks/sdk';
import { PageHeader } from '../navigation';

/** Guest view of /account/orders: nothing but the login modal, which reloads
 *  the route (now authenticated in-memory) once the SDK reports the login. */
export function OrdersLoginRequired() {
  const { t } = useTranslation();
  const router = useRouter();

  useEffect(() => openLoginThen(() => void router.invalidate()), [router]);

  return (
    <div className="flex min-h-full flex-col bg-smoke">
      <PageHeader title={t('pages.orders.title', 'الطلبات')} />
    </div>
  );
}
