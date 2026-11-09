import { useCallback, useRef, useState } from 'react';
import { SallaRatingModal } from '@salla.sa/twilight-components-react/rating-modal';
import { ItemsList } from '@salla.sa/twilight-components-react';
import { order as orderApi } from '@salla.sa/twilight-theme-engine/api/order';
import { Link } from '@salla.sa/twilight-theme-engine/common';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import type { OrdersPageProps } from '@salla.sa/twilight-theme-engine/routes/account/orders';
import { AccountShell } from '../account/AccountSidebar';
import { TaskIcon } from '../icons/TaskIcon';
import { WalletEmptyBadgeIcon } from '../icons/WalletEmptyBadgeIcon';
import { PageHeader } from '../navigation';
import { OrderCard } from './OrderCard';
import { useDarkButtons } from '../../hooks/useAccentStyle';
import { WITH_ITEMS, type OrderCard as OrderCardData } from './types';

/** `filtered`: a status filter matched nothing, which says nothing about the order history. */
function OrdersEmpty({ filtered }: { filtered: boolean }) {
  const { t } = useTranslation();
  const dark = useDarkButtons();
  return (
    <div className="flex w-full flex-col gap-4 rounded-xl bg-white p-4">
      <div className="flex flex-col items-center gap-0.5 text-center">
        <span className="relative flex size-14 items-center justify-center rounded-full bg-brand-reverse text-brand">
          <TaskIcon size={30} />
          <span className="absolute bottom-0 right-0">
            <WalletEmptyBadgeIcon />
          </span>
        </span>
        <p className="text-base font-black text-ink">{t('pages.orders.empty', 'لا توجد طلبات')}</p>
        {!filtered && (
          <p className="text-sm text-neutral-500">
            {t(
              'pages.orders.empty_description',
              'لا يوجد لديك طلبات مسبقة، تسوق وقم بانشاء اول طلب لك واحصل علي توصيل مجاني'
            )}
          </p>
        )}
      </div>
      <Link
        to={filtered ? '/account/orders' : '/'}
        className={`orders-empty__cta rounded-xl py-4 text-center text-sm font-bold ${dark ? 'bg-ink text-white' : 'bg-brand text-brand-reverse'}`}
      >
        {filtered
          ? t('pages.orders.view_all', 'عرض كل الطلبات')
          : t('pages.orders.shop_now', 'تسوق الان')}
      </Link>
    </div>
  );
}

/** Orders list from Figma: one card per order, paginated by infinite scroll.
 *  `ItemsList` owns the cursor state, the in-flight guard and the sentinel. */
export function OrdersPage({ orders, cursor, query }: OrdersPageProps) {
  const { t } = useTranslation();
  const nextCursor = useRef(cursor?.next ?? null);
  // The SDK modal caches the first order it loads, so each order gets its own instance (key).
  const [rateId, setRateId] = useState<number | null>(null);
  const pendingOpen = useRef(false);
  const rating = useRef<HTMLSallaRatingModalElement | null>(null);
  const openRating = (el: HTMLSallaRatingModalElement) =>
    void el.componentOnReady().then((ready) => ready.open());
  const onRate = useCallback((id: number) => {
    // Same order again: the instance is mounted, so open it right here.
    if (rating.current?.orderId === id) return openRating(rating.current);
    pendingOpen.current = true;
    setRateId(id);
  }, []);
  // The Stencil wrapper attaches the ref after the first commit, so a new instance is
  // opened from the ref callback once the element exists.
  const ratingRef = useCallback((el: HTMLSallaRatingModalElement | null) => {
    rating.current = el;
    if (el && pendingOpen.current) {
      pendingOpen.current = false;
      openRating(el);
    }
  }, []);

  const loadMore = useCallback(async () => {
    const res = await orderApi.list({
      cursor: nextCursor.current,
      status: query?.status,
      ...WITH_ITEMS,
    });
    nextCursor.current = res.cursor?.next ?? null;
    return { items: res.data as OrderCardData[], next: nextCursor.current };
  }, [query?.status]);

  return (
    <AccountShell header={<PageHeader title={t('pages.orders.title', 'الطلبات')} />}>
      <ItemsList<OrderCardData>
        items={orders as OrderCardData[]}
        loader={loadMore}
        mode={cursor?.next ? 'infinite' : 'static'}
        resetKey={query?.status ?? ''}
        itemsClassName="flex flex-col gap-3"
        empty={<OrdersEmpty filtered={Boolean(query?.status)} />}
        t={(key, fallback) => t(key, fallback || key)}
        ariaLabel={t('pages.orders.title', 'الطلبات')}
      >
        {(items) =>
          items.map((order) => <OrderCard key={order.id} order={order} onRate={onRate} />)
        }
      </ItemsList>
      {rateId != null && <SallaRatingModal key={rateId} orderId={rateId} ref={ratingRef} />}
    </AccountShell>
  );
}
