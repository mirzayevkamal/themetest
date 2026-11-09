import { type MouseEvent, type ReactNode } from 'react';
import { useRouter } from '@tanstack/react-router';
import { Link } from '@salla.sa/twilight-theme-engine/common';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { CalendarIcon, TaskDoneIcon, TimeIcon } from '../icons';
import { actionClass, formatOrderDate, statusClass, useReorder } from './helpers';
import { useDarkButtons } from '../../hooks/useAccentStyle';
import type { OrderCard as OrderCardData } from './types';

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      {icon}
      {children}
    </span>
  );
}

export function OrderCard({
  order,
  onRate,
}: {
  order: OrderCardData;
  onRate: (id: number) => void;
}) {
  const { t } = useTranslation();
  const dark = useDarkButtons();
  const { reorder, busy } = useReorder(order.id);
  const { date, time } = formatOrderDate(order.created_at.date);
  const items = order.items ?? [];
  const thumbs = items.slice(0, 3);
  const extra = items.length - thumbs.length;
  const detailsTo = `/account/orders/${order.id}`;
  const router = useRouter();
  // The action buttons/links keep their own targets; only the rest of the card opens details.
  const openDetails = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('a, button')) return;
    router.navigate({ to: detailsTo });
  };

  return (
    <article
      onClick={openDetails}
      // Not `cursor-pointer`: common.scss turns off pointer events under it, which
      // would send every tap on the action buttons to the card instead.
      className="order-card flex flex-col gap-3 rounded-xl border border-neutral-100 bg-white px-3 py-4 hover:cursor-pointer"
    >
      <div className="flex min-h-11 items-center gap-2.5">
        {thumbs.length > 0 && (
          <div className="flex items-center">
            {thumbs.map((item, i) =>
              item.thumbnail ? (
                <img
                  key={i}
                  src={item.thumbnail}
                  alt={item.name}
                  style={{ zIndex: thumbs.length - i }}
                  className={`relative size-11 rounded-xl border border-neutral-100 bg-white object-cover ${i ? '-ms-2' : ''}`}
                />
              ) : (
                <span
                  key={i}
                  style={{ zIndex: thumbs.length - i }}
                  className={`relative size-11 rounded-xl border border-neutral-100 bg-neutral-100 ${i ? '-ms-2' : ''}`}
                />
              )
            )}
            {extra > 0 && (
              <span className="-ms-2 flex size-11 items-center justify-center rounded-xl border border-neutral-100 bg-white text-[13px] text-neutral-500">
                +{extra}
              </span>
            )}
          </div>
        )}
        <span
          className={`ms-auto rounded px-1.5 py-0.5 text-xs font-bold text-ink ${statusClass(order.status.slug)}`}
        >
          {order.status.name}
        </span>
      </div>

      <div className="flex items-center gap-4 text-[13px] text-neutral-500">
        <Meta icon={<TaskDoneIcon />}>{order.reference_id}</Meta>
        <Meta icon={<CalendarIcon />}>{date}</Meta>
        <Meta icon={<TimeIcon />}>{time}</Meta>
      </div>

      <div className="flex gap-3">
        {order.actions.reorderable && (
          <button
            type="button"
            onClick={reorder}
            disabled={busy}
            className={actionClass(true, dark)}
          >
            {t('pages.orders.repeat', 'كرر الطلب')}
          </button>
        )}
        {order.actions.rateable ? (
          <button type="button" onClick={() => onRate(order.id)} className={actionClass()}>
            {t('pages.orders.rate', 'قيم الطلب')}
          </button>
        ) : (
          <Link to="/account/contact" className={actionClass()}>
            {t('pages.orders.help', 'احتاج مساعدة')}
          </Link>
        )}
        <Link to={detailsTo} className={actionClass()}>
          {t('pages.orders.details', 'تفاصيل الطلب')}
        </Link>
      </div>
    </article>
  );
}
