import { useState, type ComponentProps, type ReactNode } from 'react';
import { SallaButton } from '@salla.sa/twilight-components-react';
import { useMoney } from '@salla.sa/twilight-theme-engine/hooks/useMoney';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import type { FreeShippingBar } from '@salla.sa/twilight-theme-engine/types';
import { useIsCartRoute } from '../../hooks/useMatchedRoute';
import { useIsWebDesktop } from '../../hooks/useIsWebDesktop';
import { openCartDrawer } from '../../hooks/useCartDrawer';
import { hapticImpact } from '@salla.sa/twilight-theme-engine/native-app';
import { useSallaEvent } from '../../hooks/sdk';
import { ChevronIcon, PercentBadgeIcon } from '../icons';
import { CartBasketSummary } from './CartSavings';
import { useDarkButtons } from '../../hooks/useAccentStyle';
import { amount, AmountTextInline, cartSavings, useCart } from './useCart';

export interface CountableCart {
  count?: number;
  items?: ReadonlyArray<{ quantity?: number }>;
}

export const cartCount = (cart: CountableCart) =>
  cart.count ?? cart.items?.reduce((sum, item) => sum + (item.quantity ?? 0), 0) ?? 0;

type BarCart = Parameters<typeof cartSavings>[0] & {
  count?: number;
  total?: Parameters<typeof amount>[0];
  free_shipping_bar?: Partial<FreeShippingBar> | null;
};

export function FreeShippingProgress({ bar }: { bar: Partial<FreeShippingBar> }) {
  const { t } = useTranslation();
  const { format } = useMoney();
  return (
    <div className="flex flex-col gap-2 bg-brand-reverse px-4 pt-2">
      <div className="flex items-center gap-1">
        <PercentBadgeIcon size={18} />
        <p className="text-sm font-bold leading-none text-ink">
          <AmountTextInline
            template={t('common.cart_dock.add_more', 'اضف :amount واحصل على توصيل مجاني')}
            formattedAmount={format(bar.remaining ?? 0)}
            amountClass="text-brand"
          />
        </p>
      </div>
      <div className="h-[3px] w-full rounded-full bg-brand-tint-hover">
        <div
          className="h-full rounded-full bg-brand transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, bar.percent ?? 0))}%` }}
        />
      </div>
    </div>
  );
}

/** Bottom cart bar shell: basket summary + one primary action. Used both as
 *  the global "item added" dock and the cart page's checkout bar. */
export function CartBar({
  cart,
  className = '',
  showFreeShippingProgress = false,
  children,
  ...button
}: ComponentProps<typeof SallaButton> & {
  cart: BarCart;
  className?: string;
  showFreeShippingProgress?: boolean;
  children: ReactNode;
}) {
  const bar = cart.free_shipping_bar;
  const dark = useDarkButtons();
  return (
    <div
      className={`shrink-0 overflow-hidden rounded-t-2xl [box-shadow:0_-6px_16px_rgba(0,0,0,0.08)]${dark ? ' cta-dark' : ''} ${className}`}
    >
      {showFreeShippingProgress && bar && !bar.has_free_shipping && (
        <FreeShippingProgress bar={bar} />
      )}
      <div className="flex items-center bg-white px-4 py-2">
        <CartBasketSummary
          count={cartCount(cart)}
          total={amount(cart.total)}
          savings={cartSavings(cart)}
          hasFreeShipping={Boolean(bar?.has_free_shipping)}
        />
        <SallaButton
          color="primary"
          size="small"
          className="cta-button flex items-center justify-center h-10.5"
          {...button}
        >
          <span className="flex items-center gap-1">
            {children}
            <ChevronIcon />
          </span>
        </SallaButton>
      </div>
    </div>
  );
}

/** Global "view cart" bar above the BottomNav, shown whenever the cart has items,
 *  on every page except the cart itself (which already owns a CartCheckoutBar). */
export function CartAddedBar() {
  const { t } = useTranslation();
  const cart = useCart();
  const isCart = useIsCartRoute();
  const isWebDesktop = useIsWebDesktop();

  // The storage seed is a bare count; wait for a payload with a total rather than show 0.
  if (!cart || cart.total == null || cartCount(cart) === 0 || isCart) return null;

  // Web desktop shows the cart in a drawer; phones and the app navigate to the page.
  const action = isWebDesktop ? { onClick: openCartDrawer } : { href: '/cart' };

  return (
    <CartBar cart={cart} {...action} showFreeShippingProgress className="cart-added-bar">
      {t('common.cart_dock.view_cart', 'عرض السلة')}
    </CartBar>
  );
}

/** Submits the cart to checkout; `busy` while the SDK is on it. */
export function useCartCheckout() {
  const [busy, setBusy] = useState(false);
  // Guest checkout parks `submit()` on the login modal; dismissing it never settles the promise.
  useSallaEvent('salla-login::closed', () => window.salla?.config.isGuest?.() && setBusy(false));

  const checkout = () => {
    hapticImpact('medium');
    setBusy(true);
    window.salla?.cart
      .submit()
      .catch((error) => window.salla?.logger?.warn?.('cart submit failed', error))
      .finally(() => setBusy(false));
  };
  return { checkout, busy };
}

/** Pinned checkout bar at the bottom of the cart page. */
export function CartCheckoutBar({ cart }: { cart: BarCart }) {
  const { t } = useTranslation();
  const { checkout, busy } = useCartCheckout();

  return (
    <CartBar cart={cart} onClick={checkout} loading={busy}>
      {t('common.cart_dock.checkout', 'وصل طلبي')}
    </CartBar>
  );
}
