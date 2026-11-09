import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { useMoney } from '@salla.sa/twilight-theme-engine/hooks/useMoney';
import { DockBasketIcon } from '../icons';
import { AmountTextInline } from './useCart';

/** Total + struck-through original + the "you saved / free delivery" line. */
export function CartSavings({
  total,
  savings,
  hasFreeShipping,
}: {
  total: number;
  savings: number;
  hasFreeShipping: boolean;
}) {
  const { t } = useTranslation();
  const { format } = useMoney();

  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5">
      <div className="flex items-center gap-1">
        <span className="text-base font-bold text-ink">{format(total)}</span>
        {savings > 0 && (
          <span className="text-sm text-neutral-500 line-through">{format(total + savings)}</span>
        )}
      </div>
      {(savings > 0 || hasFreeShipping) && (
        <p className="flex items-center gap-1 whitespace-nowrap text-[13px] leading-none text-ink">
          <span aria-hidden>🎉</span>
          {savings > 0 && (
            <AmountTextInline
              template={t('common.cart_dock.saved', 'وفرت :amount')}
              formattedAmount={format(savings)}
            />
          )}
          {savings > 0 && hasFreeShipping && <span>+</span>}
          {hasFreeShipping && (
            <span className="font-bold">{t('common.cart_dock.free_delivery', 'توصيل مجاني')}</span>
          )}
        </p>
      )}
    </div>
  );
}

/** Basket icon with the item-count badge next to the totals — the start side
 *  of both bottom bars. */
export function CartBasketSummary({
  count,
  total,
  savings,
  hasFreeShipping,
}: {
  count: number;
  total: number;
  savings: number;
  hasFreeShipping: boolean;
}) {
  return (
    <div className="flex flex-1 items-center gap-2">
      <span className="relative shrink-0 text-brand-deep">
        <DockBasketIcon />
        <span className="absolute end-0 top-0 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-discount text-[13px] font-semibold text-white ring-1 ring-hairline">
          {count}
        </span>
      </span>
      <CartSavings total={total} savings={savings} hasFreeShipping={hasFreeShipping} />
    </div>
  );
}
