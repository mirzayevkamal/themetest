import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { CancelBadgeIcon, CheckBadgeIcon, OrderBasketIcon } from '../icons';
import { liveTracking } from './tracking';
import { minutesBetween } from './tracking/phase';
import type { TrackedOrder } from './types';

export function StatusHero({ order }: { order: TrackedOrder }) {
  const { t } = useTranslation();
  const slug = order.status.slug ?? '';
  const minutes = minutesBetween(order.created_at?.date, liveTracking(order).deliveredAt);
  const cancelled = /cancel|reject|refund|restor/.test(slug);
  const delivered = slug === 'delivered';
  const [before, after] = minutes
    ? t('pages.order.delivered_in', 'وصلنا طلبك بدقة وعناية بنجاح في {{duration}}').split(
        '{{duration}}'
      )
    : [];

  return (
    <section className="flex flex-col items-center gap-0.5 rounded-xl bg-white p-3 text-center">
      <span className="relative flex size-14 items-center justify-center rounded-full bg-brand-reverse text-brand">
        <OrderBasketIcon />
        <span className="absolute left-[29px] top-[29px]">
          {cancelled ? <CancelBadgeIcon /> : <CheckBadgeIcon />}
        </span>
      </span>
      <p className="text-base font-black text-ink">
        {cancelled
          ? t('pages.order.cancelled_title', 'تم الغاء الطلب')
          : delivered
            ? t('pages.order.delivered_title', 'تم توصيل طلبك')
            : order.status.name}
      </p>
      <p className="text-xs text-neutral-500">
        {cancelled ? (
          t(
            'pages.order.cancelled_message',
            'نعتذر منك على الغاء طلبك، يمكنك تكراره او انشاء طلب اخر'
          )
        ) : delivered && minutes ? (
          <>
            {before}
            <b className="text-brand">{t('pages.order.minutes', '{{n}} دقيقة', { n: minutes })}</b>
            {after}
          </>
        ) : delivered ? (
          t('pages.order.delivered_message', 'وصلنا طلبك بدقة وعناية بنجاح')
        ) : (
          t('pages.order.completed_message', 'تم تنفيذ طلبك بدقة وعناية')
        )}
      </p>
    </section>
  );
}
