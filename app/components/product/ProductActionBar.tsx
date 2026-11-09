import { useEffect, useRef, useState } from 'react';
import { SallaButton } from '@salla.sa/twilight-components-react';
import { useMoney } from '@salla.sa/twilight-theme-engine/hooks/useMoney';
import { useTwilight } from '@salla.sa/twilight-theme-engine/providers';
import { hapticImpact } from '@salla.sa/twilight-theme-engine/native-app';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import type { Product } from '@salla.sa/twilight-theme-engine/types';
import { amount } from '../cart/useCart';
import { useDarkButtons } from '../../hooks/useAccentStyle';
import { OWN_FLOW_TYPES, ProductLineStepper } from './AddToCartStepper';
import { useProductConsent } from './ProductConsent';

interface LivePrice {
  price: number;
  regular_price: number;
  is_on_sale: boolean;
}

// The SDK's price.updated payload carries price/regular_price/has_sale_price
// (no sale_price), so track those three directly instead of via useProduct —
// which also only subscribes if the CDN SDK already exists when it mounts.
function useLivePrice(product: Product): LivePrice {
  const [live, setLive] = useState<LivePrice | null>(null);

  useEffect(() => {
    setLive(null);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onUpdate = (res: unknown) => {
      const d = (res as { data?: Record<string, unknown> } | undefined)?.data;
      if (cancelled || !d) return;
      setLive({
        price: amount(d.price as number),
        regular_price: amount(d.regular_price as number),
        is_on_sale: Boolean(d.has_sale_price),
      });
    };
    const start = () => {
      const sdk = window.salla;
      if (cancelled) return;
      if (!sdk?.onReady) {
        timer = setTimeout(start, 250);
        return;
      }
      sdk.onReady(() => {
        if (!cancelled) sdk.event.on('product::price.updated', onUpdate);
      });
    };
    start();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.salla?.event.off('product::price.updated', onUpdate);
    };
  }, [product.id]);

  return (
    live ?? {
      price: amount(product.price),
      regular_price: product.regular_price,
      is_on_sale: product.is_on_sale,
    }
  );
}

// The engine's product page owns the real add-to-cart form (options,
// quantity, SDK submit handler); the bar just submits it.
const submitProductForm = () => {
  hapticImpact('medium');
  document.querySelector<HTMLFormElement>('form.product-form')?.requestSubmit();
};

// ProductInfo's chips (or Salla's options component) are inputs named `options[{id}]`, and
// `options[{id}][]` for multi-select, inside that form; the bar sits outside the route
// tree, so it reads them from the DOM.
function useSelectedOptionNames(product: Product): string[] {
  const [names, setNames] = useState<string[]>([]);
  const productOptions = product.options;

  useEffect(() => {
    const options = productOptions ?? [];
    const read = () =>
      setNames(
        options.flatMap((option) => {
          const field = `form.product-form input[name="options[${option.id}]`;
          const checked = document.querySelectorAll<HTMLInputElement>(
            `${field}"]:checked, ${field}[]"]:checked`
          );
          return Array.from(checked).flatMap((input) => {
            const detail = option.details?.find((d) => String(d.id) === input.value);
            return detail ? [detail.name] : [];
          });
        })
      );
    read();
    document.addEventListener('change', read);
    return () => document.removeEventListener('change', read);
  }, [productOptions]);

  return names;
}

// The SDK's add-product button renders this widget for quick buy, but grocery hides the
// engine form's button (product.scss), so the bar renders it itself with the same gates:
// quick purchase on, in stock, and not a booking/donation flow.
function BuyNowButton({ product }: { product: Product }) {
  const { t, locale } = useTranslation();
  const { store } = useTwilight();
  const widgetRef = useRef<(HTMLElement & { config?: unknown }) | null>(null);
  const consent = useProductConsent(product);

  // Mini-checkout prefills the signed-in customer. The SDK may still be loading on a
  // fresh page, so read it once `onReady` resolves (the engine stub's wait, as in sdk.ts).
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve(window.salla?.onReady?.()).then(() => {
      const el = widgetRef.current;
      if (cancelled || !el) return;
      el.config = { user: window.salla?.config?.get('user'), failure_url: window.location.href };
    });
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  if (!store?.settings?.buy_now || product.status !== 'sale' || OWN_FLOW_TYPES.has(product.type)) {
    return null;
  }
  return (
    <span className="contents" onClickCapture={consent.onClickCapture}>
      <salla-mini-checkout-widget
        ref={widgetRef}
        language={locale}
        store-id={String(store.id)}
        api={store.api}
        products={JSON.stringify([product.id])}
        // Attributes the engine's ambient typing for the widget leaves out.
        {...{ 'form-selector': 'form.product-form', outline: true }}
        className="product-page__buy-now"
        data-testid="product-action-bar-buy-now"
      >
        <span slot="widget-label" className="flex items-center gap-1.5 whitespace-nowrap text-sm">
          <WalletIcon />
          {t('pages.products.buy_now', 'اشتر الآن')}
        </span>
      </salla-mini-checkout-widget>
    </span>
  );
}

function WalletIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 7.5A2.5 2.5 0 0 1 5.5 5h11A2.5 2.5 0 0 1 19 7.5V9h-3a3 3 0 0 0 0 6h3v1.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 3 16.5v-9Zm13 3.5h5v2h-5a1 1 0 1 1 0-2Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Price and add-to-cart. The phone sheet pins it at the bottom; the web-desktop
 * details column shows a second copy styled by `.product-page__buy--inline`.
 */
export function ProductActionBar({
  product,
  className = '',
}: {
  product: Product;
  className?: string;
}) {
  const { t } = useTranslation();
  const { format } = useMoney();
  const { price, regular_price, is_on_sale } = useLivePrice(product);
  const selected = useSelectedOptionNames(product);
  const dark = useDarkButtons();
  const consent = useProductConsent(product);

  const onSale = is_on_sale && regular_price > price;
  const discount = onSale ? Math.round((1 - price / regular_price) * 100) : 0;

  // The stepper's "+" sends no options and skips the status check, so only
  // in-stock products without options swap to it once they are in the cart.
  const quickAdjustable =
    product.status === 'sale' && !product.options?.length && !OWN_FLOW_TYPES.has(product.type);
  const addButton = (
    <SallaButton
      onClick={() => consent.guard(submitProductForm)}
      disabled={product.status === 'out'}
      color="primary"
      size="small"
      className="cta-button flex h-10 items-center justify-center"
    >
      {product.add_to_cart_label || t('pages.products.add_to_cart', 'أضف للسلة')}
    </SallaButton>
  );

  return (
    <div
      className={`z-10 flex shrink-0 items-center gap-3 bg-white px-4 py-2 [box-shadow:0_-6px_16px_rgba(0,0,0,0.08)]${dark ? ' cta-dark' : ''} ${className}`}
    >
      <div className="flex min-w-0 flex-1 flex-col items-start">
        <div className="flex items-center gap-1 whitespace-nowrap">
          <span className="product-page__price text-base font-bold text-ink">{format(price)}</span>
          {onSale && (
            <span className="text-sm text-neutral-500 line-through">{format(regular_price)}</span>
          )}
          {discount > 0 && (
            <span className="flex h-5 w-[59px] items-center justify-center gap-0.5 product-page__discount-tag pb-[3px] text-[11px] leading-none text-white">
              <span className="font-semibold">{t('pages.products.discount', 'خصم')}</span>
              <strong className="font-black">%{discount}</strong>
            </span>
          )}
        </div>
        {selected.length > 0 && (
          <p className="text-[11px] leading-none text-silver">{selected.join(' · ')}</p>
        )}
      </div>
      <BuyNowButton product={product} />
      {quickAdjustable ? (
        <ProductLineStepper productId={product.id} fallback={addButton} />
      ) : (
        addButton
      )}
    </div>
  );
}
