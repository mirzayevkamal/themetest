import { useState, useEffect, useEffectEvent, useRef } from 'react';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { Link } from '@salla.sa/twilight-theme-engine/common';
import { useMoney } from '@salla.sa/twilight-theme-engine/hooks/useMoney';
import type { Money } from '@salla.sa/twilight-theme-engine/types';
import { useSallaEvent } from '../../hooks/sdk';
import { openCartDrawer } from '../../hooks/useCartDrawer';
import { isWebDesktop } from '../../hooks/useIsWebDesktop';
import { cartDetails, type SdkCartItem } from './useCart';

interface ToastProduct {
  id: number;
  name: string;
  image: string;
  price: number | Money;
  originalPrice?: number | Money;
  hasDiscount?: boolean;
  isOnSale?: boolean;
  quantity: number;
  url: string;
  options: Array<{ name: string; value: string; hideValue?: boolean }>;
}

interface CartAnalyticsItem {
  cart_item_id?: number;
}

type CartOption = NonNullable<SdkCartItem['options']>[number];

const TOAST_DURATION = 5000;
const UPDATE_INTERVAL = 50;
const EMPTY_OPTIONS: ToastProduct['options'] = [];

// The card stepper gives its own inline feedback, so it suppresses this toast
// for a short window around its add call (the SDK may still fire
// 'Product Added' for quick-adds).
let suppressUntil = 0;

export function suppressAddProductToast(ms = 1500) {
  suppressUntil = Date.now() + ms;
}

function extractOptions(options: CartOption[] | undefined): ToastProduct['options'] {
  if (!options?.length) return EMPTY_OPTIONS;

  return options.reduce<ToastProduct['options']>((result, option) => {
    if (option.type === 'splitter') return result;

    if (option.details?.length) {
      const selected = option.details.filter((d) => d.is_selected);

      if (selected.length > 0) {
        result.push({
          name: option.name ?? '',
          value: selected.flatMap((d) => d.name ?? []).join(', '),
        });
      }
    } else if (option.value) {
      const hideValue = ['image', 'file', 'map'].includes(option.type ?? '');
      result.push({ name: option.name ?? '', value: String(option.value), hideValue });
    }

    return result;
  }, []);
}

export function AddProductToast() {
  const { t, isRTL } = useTranslation();
  const { format } = useMoney();

  const [product, setProduct] = useState<ToastProduct | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [progressPercent, setProgressPercent] = useState(100);
  const [isPaused, setIsPaused] = useState(false);

  const remainingTimeRef = useRef(TOAST_DURATION);

  const close = () => {
    setIsVisible(false);
    setTimeout(() => setProduct(null), 300);
  };

  const tick = useEffectEvent(() => {
    remainingTimeRef.current = Math.max(0, remainingTimeRef.current - UPDATE_INTERVAL);
    setProgressPercent((remainingTimeRef.current / TOAST_DURATION) * 100);
    if (remainingTimeRef.current <= 0) close();
  });

  // No interval while hovered: the remaining time waits in the ref until the
  // pointer leaves and the effect re-runs.
  useEffect(() => {
    if (!isVisible || isPaused) return;
    const id = setInterval(tick, UPDATE_INTERVAL);
    return () => clearInterval(id);
  }, [isVisible, isPaused]);

  useSallaEvent('Product Added', async (analyticsData: unknown) => {
    if (Date.now() < suppressUntil) return;
    try {
      const items = analyticsData as CartAnalyticsItem[];
      if (!items?.length) return;

      const cartItemId = items[0].cart_item_id;
      if (!cartItemId) return;

      const cartResponse = await cartDetails(null, ['options']);
      if (!cartResponse?.data?.cart?.items) return;

      const cartItem = cartResponse.data.cart.items.find((item) => Number(item.id) === cartItemId);
      if (!cartItem) return;

      const toastProduct: ToastProduct = {
        id: cartItem.product_id,
        name: cartItem.product_name,
        image: cartItem.product_image,
        price: cartItem.total,
        originalPrice: cartItem.original_price
          ? typeof cartItem.original_price === 'number'
            ? cartItem.original_price * cartItem.quantity
            : cartItem.original_price
          : undefined,
        hasDiscount: cartItem.has_discount,
        isOnSale: cartItem.is_on_sale,
        quantity: cartItem.quantity,
        url: cartItem.url,
        options: extractOptions(cartItem.options),
      };

      setProduct(toastProduct);
      setIsPaused(false);
      remainingTimeRef.current = TOAST_DURATION;
      setProgressPercent(100);
      setIsVisible(true);
    } catch (error) {
      window.salla?.logger?.warn?.('Error processing product added event:', error);
    }
  });

  const handleCheckout = () => {
    window.salla?.cart.submit();
    close();
  };

  const handleMouseEnter = () => setIsPaused(true);
  const handleMouseLeave = () => setIsPaused(false);

  if (!isVisible || !product) {
    return null;
  }

  const visibleOptions = product.options.slice(0, 3);
  const showMoreButton = product.options.length > 3;
  const salla = window.salla as {
    url?: {
      get?: (key: string) => string | undefined;
      asset?: (path: string) => string | undefined;
    };
  };
  const cartUrl = salla?.url?.get?.('cart') || '/cart';
  // Web desktop shows the cart in a drawer instead of leaving the page.
  const showCart = (e: React.MouseEvent) => {
    if (!isWebDesktop()) return;
    e.preventDefault();
    close();
    openCartDrawer();
  };
  const checkIconUrl = salla?.url?.asset?.('images/check.svg') || '/images/check.svg';

  const formatMoney = (value: number | Money): React.ReactNode => {
    return typeof value === 'object' && value.formatted
      ? value.formatted
      : format(typeof value === 'object' ? value.amount : value);
  };

  const priceDisplay = formatMoney(product.price);
  const originalPriceDisplay = product.originalPrice ? formatMoney(product.originalPrice) : null;

  return (
    <div
      className={`s-add-product-toast ${isVisible ? 's-add-product-toast--visible' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="s-add-product-toast__progress">
        <div
          className="s-add-product-toast__progress-bar"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="s-add-product-toast__header">
        <div className="s-add-product-toast__header-content">
          <img
            src={checkIconUrl}
            alt="Success"
            width={16}
            height={16}
            className="s-add-product-toast__icon"
          />
          <span className="s-add-product-toast__title">
            {t('pages.cart.added_to_cart', 'Added to Cart')}
          </span>
        </div>
        <button
          type="button"
          className="s-add-product-toast__close"
          aria-label="Close"
          onClick={close}
        >
          <i className="sicon-cancel" />
        </button>
      </div>

      <div className="s-add-product-toast__divider" />

      <div className="s-add-product-toast__body">
        <Link to={product.url} className="s-add-product-toast__image">
          <img src={product.image} alt={product.name} loading="lazy" />
        </Link>
        <div className="s-add-product-toast__details">
          <Link to={product.url} className="s-add-product-toast__name">
            {product.name}
          </Link>
          {visibleOptions.length > 0 && (
            <div className="s-add-product-toast__options">
              {visibleOptions.map((opt, idx) => (
                <span key={idx}>{opt.hideValue ? opt.name : `${opt.name}: ${opt.value}`}</span>
              ))}
              {showMoreButton && (
                <Link to={cartUrl} onClick={showCart} className="s-add-product-toast__show-more">
                  {t('pages.checkout.show_more', 'Show more')}
                </Link>
              )}
            </div>
          )}
        </div>
        <div className="s-add-product-toast__price">
          {(product.hasDiscount || product.isOnSale) && originalPriceDisplay ? (
            <>
              <div className="s-add-product-toast__price-sale">{priceDisplay}</div>
              <div className="s-add-product-toast__price-original">{originalPriceDisplay}</div>
            </>
          ) : (
            <div>{priceDisplay}</div>
          )}
        </div>
      </div>

      <div className="s-add-product-toast__actions">
        <button
          type="button"
          className="s-add-product-toast__button s-add-product-toast__button--primary"
          onClick={handleCheckout}
        >
          <span>{t('pages.cart.complete_order', 'Complete Order')}</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M2 12C2 8.46252 2 6.69377 3.0528 5.5129C3.22119 5.32403 3.40678 5.14935 3.60746 4.99087C4.86213 4 6.74142 4 10.5 4H13.5C17.2586 4 19.1379 4 20.3925 4.99087C20.5932 5.14935 20.7788 5.32403 20.9472 5.5129C22 6.69377 22 8.46252 22 12C22 15.5375 22 17.3062 20.9472 18.4871C20.7788 18.676 20.5932 18.8506 20.3925 19.0091C19.1379 20 17.2586 20 13.5 20H10.5C6.74142 20 4.86213 20 3.60746 19.0091C3.40678 18.8506 3.22119 18.676 3.0528 18.4871C2 17.3062 2 15.5375 2 12Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M10 16H11.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeMiterlimit="10"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M14.5 16L18 16"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeMiterlimit="10"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M2 9H22" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </button>
        <Link
          to={cartUrl}
          onClick={showCart}
          className="s-add-product-toast__button s-add-product-toast__button--outline"
        >
          <span>{t('pages.cart.view_cart', 'View Cart')}</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M3.06164 14.4413L3.42688 12.2985C3.85856 9.76583 4.0744 8.49951 4.92914 7.74975C5.78389 7 7.01171 7 9.46734 7H14.5327C16.9883 7 18.2161 7 19.0709 7.74975C19.9256 8.49951 20.1414 9.76583 20.5731 12.2985L20.9384 14.4413C21.5357 17.946 21.8344 19.6983 20.9147 20.8491C19.995 22 18.2959 22 14.8979 22H9.1021C5.70406 22 4.00504 22 3.08533 20.8491C2.16562 19.6983 2.4643 17.946 3.06164 14.4413Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M7.5 9L7.71501 5.98983C7.87559 3.74176 9.7462 2 12 2C14.2538 2 16.1244 3.74176 16.285 5.98983L16.5 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}
