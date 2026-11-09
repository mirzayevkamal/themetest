import type { ReactNode } from 'react';
import { useMoney } from '@salla.sa/twilight-theme-engine/hooks/useMoney';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import type { Order } from './types';

function TotalRow({ label, value, bold }: { label: string; value: ReactNode; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${bold ? 'text-sm font-bold' : ''}`}>
      <span>{label}</span>
      <span className="flex items-center gap-0.5">{value}</span>
    </div>
  );
}

/** Subtotal, delivery fee, discounts and grand total for one order. */
export function OrderTotals({ amounts }: { amounts: Order['amounts'] }) {
  const { t } = useTranslation();
  const { format } = useMoney();
  const shipping = amounts.shipping_cost?.amount ?? 0;
  const discounts = (amounts.discounts ?? []).reduce(
    (sum, d) => sum + (Number(d.discount) || 0),
    0
  );

  return (
    <div className="flex flex-col gap-3 text-[13px] text-ink">
      <TotalRow
        label={t('pages.order.subtotal', 'مجموع السلة')}
        value={<b>{format(amounts.sub_total.amount)}</b>}
      />
      <TotalRow
        label={t('pages.order.shipping', 'رسوم التوصيل')}
        value={
          shipping === 0 ? (
            <b className="text-brand">{t('pages.order.free_shipping', 'توصيل مجاني')}</b>
          ) : (
            format(shipping)
          )
        }
      />
      {discounts > 0 && (
        <>
          <hr className="border-neutral-100" />
          <TotalRow
            label={t('pages.order.discounts', 'إجمالي الخصومات')}
            value={<b className="text-discount">- {format(discounts)}</b>}
          />
        </>
      )}
      <hr className="border-neutral-100" />
      <TotalRow
        bold
        label={t('pages.order.total', 'مجموع الطلب بعد الخصم')}
        value={format(amounts.total.amount)}
      />
    </div>
  );
}
