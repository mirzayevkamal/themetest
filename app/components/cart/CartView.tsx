import { useRef } from 'react';
import { Breadcrumb } from '@salla.sa/twilight-theme-engine/components/common';
import { SallaButton } from '@salla.sa/twilight-components-react';
import { SallaCartItemOffers } from '@salla.sa/twilight-components-react/cart-item-offers';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { useMoney } from '@salla.sa/twilight-theme-engine/hooks/useMoney';
import { CartSkeleton } from '@salla.sa/twilight-theme-engine/skeleton';
import type { CartPageProps } from '@salla.sa/twilight-theme-engine/routes/cart';
import { CartLineStepper } from '../product/AddToCartStepper';
import { OptionChip } from '../product/ProductInfo';
import { DockBasketIcon, FlashIcon } from '../icons';
import { useDeliveryPromise } from '../../hooks/useDeliveryPromise';
import { useAccentOutlined, useDarkButtons, useThemeSettings } from '../../hooks/useAccentStyle';
import { productHref, ProductSheetLink } from '../../hooks/useProductSheet';
import { CartCheckoutBar } from './CartBar';
import { CartCoupon } from './CartCoupon';
import { CartDesktopPage } from './CartDesktopPage';
import { CartHeader } from './CartHeader';
import { useIsWebDesktop } from '../../hooks/useIsWebDesktop';
import {
  amount,
  AmountTextInline,
  cartAwaitingLines,
  cartLineUnitPrice,
  cartSavings,
  useCart,
  type SdkCart,
  type SdkCartItem,
} from './useCart';

type LoaderCart = NonNullable<CartPageProps['cart']>;
export type DisplayCart = SdkCart | LoaderCart;
export type DisplayCartItem = SdkCartItem | LoaderCart['items'][number];
/** Order-level option products (`cart.options`): the engine types only id/quantity,
 *  the API also sends the product-option list and a price, like Twig's `product_option`. */
type OrderOption = SdkCart['options'][number] & {
  price?: Parameters<typeof amount>[0];
  options?: unknown[];
};

function SavingsBanner({ cart }: { cart: DisplayCart }) {
  const { t } = useTranslation();
  const { format } = useMoney();
  const deliveryPromise = useDeliveryPromise();
  const outlined = useAccentOutlined();
  const promiseColor = useThemeSettings()?.delivery_promise_color as string | undefined;
  const promiseStyle = promiseColor ? { color: promiseColor } : undefined;

  const savings = cartSavings(cart);
  const freeShipping = cart.free_shipping_bar?.has_free_shipping ?? false;
  const hasSavingsNote = savings > 0 || freeShipping;
  if (!hasSavingsNote && !deliveryPromise) return null;

  return (
    <div
      className={`sticky top-0 z-10 flex items-center justify-between gap-6 rounded-xl border-t ${outlined ? 'border-brand' : 'border-brand-tint-hover'} bg-brand-reverse p-3 before:pointer-events-none before:absolute before:inset-x-0 before:-top-2 before:h-2 before:bg-smoke before:content-[''] after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-2 after:h-2 after:bg-smoke after:content-['']`}
    >
      {hasSavingsNote && (
        <p className="min-w-0 flex-1 text-sm font-medium text-ink">
          {'🎉🎉 '}
          {savings > 0 && (
            <AmountTextInline
              template={t('common.cart_dock.saved', 'وفرت :amount')}
              formattedAmount={format(savings)}
            />
          )}
          {savings > 0 && freeShipping && ' + '}
          {freeShipping && t('common.cart_dock.free_delivery', 'توصيل مجاني')}
        </p>
      )}
      {deliveryPromise && (
        <p className="flex shrink-0 items-center gap-0.5 font-bold capitalize leading-none">
          <FlashIcon fill={promiseColor || undefined} />
          <span className="text-base leading-none text-brand" style={promiseStyle}>
            {deliveryPromise}
          </span>
          <span className="text-base leading-none text-brand" style={promiseStyle}>
            {t('common.delivery.promise_tail', 'ونوصلك')}
          </span>
        </p>
      )}
    </div>
  );
}

/** Cart-item options as `options[{id}]` form fields: the product page's
 *  chips for choice options (pre-checked from `is_selected`), hidden inputs
 *  for the rest, so the update request always carries the full selection. */
export function CartItemOptions({ item }: { item: DisplayCartItem }) {
  const options = item.options ?? [];
  if (!options.length) return null;
  return (
    <div className="mt-1 flex flex-col gap-2 border-t border-neutral-100 pt-2">
      {options.map((option) => {
        if ('type' in option && option.type === 'splitter') return null;
        const details = 'details' in option ? option.details : undefined;
        if (details?.length) {
          return (
            <div key={option.id} className="flex flex-col gap-1.5">
              <h3 className="text-[11px] font-bold leading-none text-silver">{option.name}</h3>
              <div className="flex flex-wrap gap-1.5">
                {details.map((detail) => (
                  <OptionChip
                    key={detail.id}
                    option={option}
                    detail={detail}
                    defaultChecked={!!detail.is_selected}
                    compact
                  />
                ))}
              </div>
            </div>
          );
        }
        if (option.value == null || option.value === '') return null;
        return (
          <input
            key={option.id}
            type="hidden"
            name={`options[${option.id}]`}
            value={String(option.value)}
          />
        );
      })}
    </div>
  );
}

/** Option fields as the SDK component expects them off the cart page (the
 *  drawer): `details` always present, and placeholders that arrive as raw
 *  translation keys (`common.elements.choose`) resolved by the theme. */
function orderOptionFields(options: unknown[], t: ReturnType<typeof useTranslation>['t']) {
  return options.map((raw) => {
    const option = raw as { placeholder?: unknown; details?: unknown[] };
    const { placeholder } = option;
    return {
      ...option,
      placeholder:
        typeof placeholder === 'string' && /^[a-z_]+(\.[a-z_]+)+$/.test(placeholder)
          ? t(placeholder, placeholder)
          : placeholder,
      details: option.details ?? [],
    };
  });
}

/** "خيارات الطلب": one `cart.updateItem` form per option product. */
export function CartOrderOptions({ options }: { options: ReadonlyArray<OrderOption> }) {
  const { t } = useTranslation();
  const { format } = useMoney();
  if (!options.length) return null;
  return (
    <section className="flex flex-col gap-4 rounded-xl bg-white px-3 py-4">
      <h2 className="text-sm font-bold leading-none text-ink">
        {t('pages.order.order_options', 'خيارات الطلب')}
      </h2>
      {options.map((option) => {
        const fields = option.options?.length
          ? JSON.stringify(orderOptionFields(option.options, t))
          : null;
        return (
          <form
            key={option.id}
            className="relative"
            onChange={(e) => window.salla?.form.onChange('cart.updateItem', e)}
          >
            <input type="hidden" name="id" value={option.id} />
            <input type="hidden" name="quantity" value={option.quantity ?? 1} />
            {amount(option.price) > 0 && (
              <span className="absolute end-0 top-0 text-xs font-bold text-ink">
                {format(amount(option.price))}
              </span>
            )}
            {fields && (
              // Raw element: the CDN build reads `options` before its first load, so it
              // never fetches the option product; the wrapper sets it too late.
              // `data-cart-mode` opts it into the cart store's componentDidLoad hook.
              <salla-product-options
                key={fields}
                options={fields}
                product-id={option.id}
                data-cart-mode=""
              />
            )}
          </form>
        );
      })}
    </section>
  );
}

function CartItemRow({ item }: { item: DisplayCartItem }) {
  const { format } = useMoney();
  const price = amount(item.price);
  // Like Twig grocery and Raed: an offer line strikes its pre-offer price, a sale line the regular one.
  const productPrice = cartLineUnitPrice(item);
  const struck = item.offer ? productPrice : amount(item.original_price);
  const hasDiscount = !!item.has_discount && struck > price;
  const formRef = useRef<HTMLFormElement>(null);
  const href = productHref(item.url, item.product_id);
  const thumbClass =
    'h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-neutral-100 bg-white';
  const thumb = item.product_image ? (
    <img
      src={item.product_image}
      alt={item.product_name ?? ''}
      className="h-full w-full object-cover"
      loading="lazy"
    />
  ) : null;

  return (
    <form ref={formRef} className="flex items-start gap-2" onSubmit={(e) => e.preventDefault()}>
      {href ? (
        <ProductSheetLink to={href} className={thumbClass}>
          {thumb}
        </ProductSheetLink>
      ) : (
        <span className={thumbClass}>{thumb}</span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {href ? (
          <ProductSheetLink to={href} className="text-[13px] font-medium leading-normal text-ink">
            {item.product_name}
          </ProductSheetLink>
        ) : (
          <p className="text-[13px] font-medium leading-normal text-ink">{item.product_name}</p>
        )}
        {item.weight_label && <p className="text-[11px] text-silver">{item.weight_label}</p>}
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="flex items-center gap-1">
            <span
              className={
                hasDiscount
                  ? 'text-[13px] font-bold text-discount'
                  : 'text-[13px] font-bold text-ink'
              }
            >
              {format(price)}
            </span>
            {hasDiscount && (
              <span className="text-[11px] text-silver line-through">{format(struck)}</span>
            )}
          </p>
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
    </form>
  );
}

function EmptyCart({ onClose }: { onClose?: () => void }) {
  const dark = useDarkButtons();
  const { t } = useTranslation();
  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center gap-4 px-8 py-20 text-center${dark ? ' cta-dark' : ''}`}
    >
      <DockBasketIcon />
      <p className="text-base font-bold text-ink">{t('pages.cart.empty', 'سلتك فارغة')}</p>
      <SallaButton
        href={onClose ? undefined : '/'}
        onClick={onClose}
        color="primary"
        size="medium"
        className="cta-button"
      >
        {t('pages.cart.continue_shopping', 'ابدأ التسوق')}
      </SallaButton>
    </div>
  );
}

/** Cart screen: header and checkout stay pinned; only the lines scroll. */
export function CartView({
  initialCart,
  page,
  onClose,
}: {
  initialCart?: LoaderCart;
  /** Route page data; the web-desktop page shows its breadcrumb. */
  page?: CartPageProps['page'];
  onClose?: () => void;
} = {}) {
  const cart = useCart() ?? initialCart;
  const items = cart?.items ?? [];
  // Summary-only payloads have a count but no lines — keep the skeleton until
  // details() (or a later event with items) arrives, instead of flashing empty
  // while the bottom-nav badge still shows the stored count.
  const awaitingLines = cartAwaitingLines(cart);
  const isWebDesktop = useIsWebDesktop();

  // The web-desktop page is Raed's two-column layout; the drawer keeps the phone screen.
  if (isWebDesktop && !onClose && cart && !awaitingLines && items.length > 0) {
    return (
      <div className="cart-desktop">
        {page && <Breadcrumb page={page} className="cart-desktop__crumbs" />}
        <CartDesktopPage cart={cart} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-smoke">
      <CartHeader onClose={onClose} />
      {!cart || awaitingLines ? (
        <CartSkeleton />
      ) : items.length === 0 ? (
        <EmptyCart onClose={onClose} />
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-none px-2 py-4">
            <SavingsBanner cart={cart} />
            <div className="flex flex-col gap-4 rounded-xl bg-white px-3 py-4">
              {items.map((item) => (
                <CartItemRow key={String(item.id ?? item.product_id)} item={item} />
              ))}
            </div>
            <CartOrderOptions options={cart.options ?? []} />
            <CartCoupon coupon={cart.coupon} />
          </div>
          <CartCheckoutBar cart={cart} />
        </>
      )}
    </div>
  );
}
