import { SallaButton } from '@salla.sa/twilight-components-react';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { AccountPageSkeleton } from '../../account/AccountPageSkeleton';
import { Drawer } from '../../layout/Drawer';
import { PageHeader } from '../../navigation/PageHeader';
import { OrderPage } from '../OrderPage';
import type { TrackedOrder } from '../types';
import { useLiveOrderQuery } from './queries';
import { useDarkButtons } from '../../../hooks/useAccentStyle';

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  const dark = useDarkButtons();
  const { t } = useTranslation();
  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center gap-4 px-8 py-20 text-center${dark ? ' cta-dark' : ''}`}
    >
      <p className="text-base font-bold text-ink">
        {t('pages.order.load_failed', 'تعذّر تحميل الطلب')}
      </p>
      <SallaButton
        type="button"
        onClick={onRetry}
        color="primary"
        size="medium"
        className="cta-button"
      >
        {t('pages.order.retry', 'إعادة المحاولة')}
      </SallaButton>
    </div>
  );
}

/** Figma 3203:13744 — the order page in the web-desktop side drawer, opened
 *  from the tracking banner. Shares the details query with the order route. */
export function OrderDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { data, isFetching, refetch } = useLiveOrderQuery(id);
  const order = data?.order as TrackedOrder | undefined;
  const failed = !order && !isFetching;
  return (
    <Drawer onClose={onClose}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {order ? (
          <OrderPage order={order} onClose={onClose} />
        ) : (
          <>
            <PageHeader title={t('pages.order.details', 'تفاصيل الطلب')} onClose={onClose} />
            {failed ? (
              <LoadFailed onRetry={() => void refetch()} />
            ) : (
              <AccountPageSkeleton header={false} />
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}
