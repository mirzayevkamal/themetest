import { useId } from 'react';
import { SallaButton } from '@salla.sa/twilight-components-react';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { useCoupon } from '@salla.sa/twilight-theme-engine/hooks/useCoupon';
import { useStore } from '@salla.sa/twilight-theme-engine/hooks/useStore';

/** Coupon box, as Raed's cart summary has it: hidden only when the merchant turns
 *  coupons off. The SDK fires `cart::updated` after apply and remove, so the
 *  applied code and the totals come back through the cart itself. */
export function CartCoupon({ coupon }: { coupon?: string | null }) {
  const { t } = useTranslation();
  const enabled = useStore()?.settings?.cart?.apply_coupon_enabled;
  const { apply, remove, error, loading } = useCoupon();
  // The drawer can open over `/cart`, so two boxes can be mounted at once.
  const inputId = useId();
  const errorId = `${inputId}-error`;
  if (enabled === false) return null;

  return (
    <form
      // Remount on apply/remove so the field shows the cart's code, or empties.
      key={coupon ?? ''}
      className="flex flex-col gap-2 rounded-xl bg-white px-3 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (coupon) void remove();
        else void apply(String(new FormData(e.currentTarget).get('coupon') ?? ''));
      }}
    >
      <label htmlFor={inputId} className="text-sm font-bold leading-none text-ink">
        {t('pages.cart.have_coupon', 'عندك كوبون خصم؟')}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={inputId}
          name="coupon"
          autoComplete="off"
          enterKeyHint="done"
          defaultValue={coupon ?? ''}
          readOnly={!!coupon}
          placeholder={t('pages.cart.coupon_placeholder', 'أدخل كود الكوبون')}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className="h-10 min-w-0 flex-1 rounded-xl border border-hairline bg-smoke px-3 text-sm text-ink placeholder:text-silver read-only:font-bold"
        />
        <SallaButton
          type="submit"
          color={coupon ? 'danger' : 'primary'}
          fill={coupon ? 'outline' : 'solid'}
          size="medium"
          loading={loading}
          disabled={loading}
        >
          {coupon
            ? t('pages.cart.delete_coupon', 'حذف')
            : t('pages.cart.apply_coupon_btn', 'تطبيق')}
        </SallaButton>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-discount">
          {error}
        </p>
      )}
    </form>
  );
}
