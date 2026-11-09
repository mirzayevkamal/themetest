import { useRef, type ReactNode } from 'react';
import { SallaButton } from '@salla.sa/twilight-components-react';
import { SallaCartItemOffers } from '@salla.sa/twilight-components-react/cart-item-offers';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { useMoney } from '@salla.sa/twilight-theme-engine/hooks/useMoney';
import { CartLineStepper } from '../product/AddToCartStepper';
import { useDarkButtons } from '../../hooks/useAccentStyle';
import { productHref, ProductSheetLink } from '../../hooks/useProductSheet';
import { FreeShippingProgress, useCartCheckout } from './CartBar';
import { CartCoupon } from './CartCoupon';
import { CartSavings } from './CartSavings';
import {
  CartItemOptions,
  CartOrderOptions,
  type DisplayCart,
  type DisplayCartItem,
} from './CartView';
import { amount, cartLineUnitPrice, cartSavings } from './useCart';

function DesktopRow({ item }: { item: DisplayCartItem }) {
  const { format } = useMoney();
  const price = amount(item.price);
  const productPrice = cartLineUnitPrice(item);
  const struck = item.offer ? productPrice : amount(item.original_price);
  const hasDiscount = !!item.has_discount && struck > price;
  const lineTotal = amount((item as { total?: number }).total ?? price * item.quantity);
  const formRef = useRef<HTMLFormElement>(null);
  const href = productHref(item.url, item.product_id);
  const thumbClass =
    'h-20 w-24 shrink-0 overflow-hidden rounded-xl border border-neutral-100 bg-white';
  const thumb = item.product_image ? (
    <img
      src={item.product_image}
      alt={item.product_name ?? ''}
      className="h-full w-full object-cover"
      loading="lazy"
    />
  ) : null;

  return (
    <form
      ref={formRef}
      className="flex items-start gap-8 border-b border-neutral-100 py-5 last:border-b-0"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="flex min-w-0 flex-1 items-start gap-4">
        {href ? (
          <ProductSheetLink to={href} className={thumbClass}>
            {thumb}
          </ProductSheetLink>
        ) : (
          <span className={thumbClass}>{thumb}</span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {href ? (
            <ProductSheetLink to={href} className="text-base font-bold leading-normal text-ink">
              {item.product_name}
            </ProductSheetLink>
          ) : (
            <p className="text-base font-bold leading-normal text-ink">{item.product_name}</p>
          )}
          <p className="flex items-center gap-1">
            <span
              className={
                hasDiscount ? 'text-sm font-bold text-discount' : 'text-sm font-bold text-ink'
              }
            >
              {format(price)}
            </span>
            {hasDiscount && (
              <span className="text-xs text-silver line-through">{format(struck)}</span>
            )}
          </p>
          {item.weight_label && <p className="text-xs text-silver">{item.weight_label}</p>}
          {item.id != null && !!item.detailed_offers?.length && (
            <SallaCartItemOffers
              itemId={String(item.id)}
              quantity={item.quantity}
              productPrice={productPrice}
              offers={JSON.stringify(item.detailed_offers)}
            />
          )}
          <CartItemOptions item={item} />
        </div>
      </div>
      <div className="flex w-32 shrink-0 justify-center">
        {item.id != null && (
          <CartLineStepper
            productId={item.product_id}
            itemId={item.id}
            quantity={item.quantity}
            maxQuantity={item.max_quantity}
            formRef={formRef}
          />
        )}
      </div>
      <p className="w-24 shrink-0 text-end text-sm font-bold text-ink">{format(lineTotal)}</p>
    </form>
  );
}

function SummaryRow({
  label,
  value,
  className = '',
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-silver">{label}</span>
      <span className={`font-bold ${className}`}>{value}</span>
    </div>
  );
}

/** Raed's cart page shape on web desktop: item rows under a column-heading row,
 *  and a sticky order summary beside them. Styled with the theme tokens. */
export function CartDesktopPage({ cart }: { cart: DisplayCart }) {
  const { t } = useTranslation();
  const { format } = useMoney();
  const dark = useDarkButtons();
  const { checkout, busy } = useCartCheckout();
  const items = cart.items ?? [];
  const bar = cart.free_shipping_bar;
  const freeShipping = Boolean(bar?.has_free_shipping);
  const savings = cartSavings(cart);
  const discount = amount(cart.discount);
  const optionsTotal = amount((cart as { options_total?: number }).options_total);

  return (
    <div className="cart-desktop__body flex items-start gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <section className="rounded-xl bg-white px-6 py-2">
          <div className="flex items-center gap-8 border-b border-neutral-100 py-4 text-sm font-bold text-ink">
            <span className="flex-1">
              {t('blocks.cart.products', 'المنتجات')} ({items.length})
            </span>
            <span className="w-32 text-center">{t('pages.products.quantity', 'الكمية')}</span>
            <span className="w-24 text-end">{t('blocks.cart.item_total', 'المجموع')}</span>
          </div>
          {items.map((item) => (
            <DesktopRow key={String(item.id ?? item.product_id)} item={item} />
          ))}
        </section>
        <CartOrderOptions options={cart.options ?? []} />
      </div>

      <aside
        className={`cart-desktop__summary sticky flex w-96 shrink-0 flex-col gap-4${dark ? ' cta-dark' : ''}`}
      >
        <section className="flex flex-col gap-4 rounded-xl bg-white p-6">
          <h2 className="text-base font-bold leading-none text-ink">
            {t('pages.cart.summary', 'ملخص الطلب')}
          </h2>
          <SummaryRow
            label={t('pages.cart.items_total', 'مجموع المنتجات')}
            value={format(amount(cart.sub_total))}
            className="text-ink"
          />
          {optionsTotal > 0 && (
            <SummaryRow
              label={t('pages.cart.order_options_total', 'مجموع خيارات الطلب')}
              value={format(optionsTotal)}
              className="text-ink"
            />
          )}
          {discount > 0 && (
            <SummaryRow
              label={t('pages.cart.discount', 'الخصم')}
              value={<>- {format(discount)}</>}
              className="text-discount"
            />
          )}
          <div className="flex items-start justify-between gap-4 border-t border-neutral-100 pt-4">
            <span className="text-sm text-silver">{t('pages.cart.final_total', 'الإجمالي')}</span>
            <CartSavings
              total={amount(cart.total)}
              savings={savings}
              hasFreeShipping={freeShipping}
            />
          </div>
          {bar && !freeShipping && (
            <div className="-mx-4 overflow-hidden rounded-xl pb-2">
              <FreeShippingProgress bar={bar} />
            </div>
          )}
          <SallaButton
            color="primary"
            size="medium"
            width="wide"
            loading={busy}
            onClick={checkout}
            className="cta-button w-full"
          >
            {t('pages.cart.complete_order', 'إتمام الطلب')}
          </SallaButton>
        </section>
        <CartCoupon coupon={cart.coupon} />
      </aside>
    </div>
  );
}
