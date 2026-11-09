import { FlashIcon } from '../icons';
import { lazy, memo, Suspense } from 'react';
import { Image, Link } from '@salla.sa/twilight-theme-engine/common';
import { getCdnImageUrl } from '@salla.sa/twilight-theme-engine/utils/cdn-image';
import { useTwilight } from '@salla.sa/twilight-theme-engine/providers';
import { useMoney } from '@salla.sa/twilight-theme-engine/hooks/useMoney';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import type { Product } from '@salla.sa/twilight-theme-engine/types';
import { AddToCartStepper } from './AddToCartStepper';
import { rememberCardImage } from './cardImage';
import { useDeliveryPromise } from '../../hooks/useDeliveryPromise';
import { useAccentOutlined } from '../../hooks/useAccentStyle';
import { WishlistButton } from './WishlistButton';

/** Matches the 127/120 image box; HTML attrs only, CDN width comes from srcset. */
const PRODUCT_IMAGE_WIDTH = 254;
const PRODUCT_IMAGE_HEIGHT = 240;

/** 1x mobile (~114px), Lighthouse 1.75x, 2x, tablet max, 2x tablet. */
const PRODUCT_IMAGE_SRCSET_WIDTHS = [120, 200, 240, 320, 640] as const;
const PRODUCT_IMAGE_SIZES = '(min-width: 1024px) 25vw, (min-width: 640px) 320px, 120px';

/**
 * Width-only srcset lets a tall photo download ~2.5x taller than its box; send the box height
 * too. Cover crops on the CDN, since scale-down would shrink the width it needs to fill the box.
 */
function boxSrcSet(url: string | undefined, cover: boolean) {
  if (!url) return undefined;
  const entries = PRODUCT_IMAGE_SRCSET_WIDTHS.map((width) => {
    const height = Math.round((width * PRODUCT_IMAGE_HEIGHT) / PRODUCT_IMAGE_WIDTH);
    let src = getCdnImageUrl(url, { width, height });
    if (!src || src === url) return undefined;
    if (cover) src = src.replace('fit=scale-down', 'fit=cover');
    return `${src} ${width}w`;
  });
  return entries.every(Boolean) ? entries.join(', ') : undefined;
}

export { cardImageSrc } from './cardImage';

// Lazy: only out-of-stock cards need it, keep it out of the main bundle.
const SallaProductAvailability = lazy(() =>
  import('@salla.sa/twilight-components-react/product-availability').then((m) => ({
    default: m.SallaProductAvailability,
  }))
);

export interface ProductCardProps {
  product: Product;
  /** Slide/grid sizing from the engine's callers. */
  className?: string;
  imagePriority?: boolean;
  /** `sizes` for callers with a fixed tile width; the default fits the listing grid. */
  imageSizes?: string;
}

export const ProductCard = memo(function ProductCard({
  product,
  className = '',
  imagePriority = false,
  imageSizes = PRODUCT_IMAGE_SIZES,
}: ProductCardProps) {
  const { format } = useMoney();
  const { t } = useTranslation();
  const deliveryPromise = useDeliveryPromise();
  const { store, theme } = useTwilight();
  const outlined = useAccentOutlined();
  const promiseColor = (theme?.settings as Record<string, unknown> | undefined)
    ?.delivery_promise_color as string | undefined;

  // Same rule as Raed's card and add-product button: out-of-stock cards offer "notify me"
  // unless the merchant switched it off or the store has no notify channel (null = feature
  // off); donations can't be restocked.
  const channels = store?.settings?.product?.availability_notify;
  const notifyInCard =
    theme?.settings?.notify_when_available_in_card !== false &&
    Boolean(channels?.email || channels?.sms || channels?.mobile || channels?.whatsapp) &&
    product.is_out_of_stock &&
    product.type !== 'donating' &&
    product.type !== 'financial_support';

  // The merchant's equal-height switch: the backend sends its cover/contain type
  // as fit_type only while it is on, null otherwise.
  const fitType = store?.settings?.product?.fit_type;
  const equalHeight = fitType != null;

  // `null` when the product has no sale price.
  const salePrice = product.sale_price;
  const onSale = product.is_on_sale && salePrice != null && product.regular_price > salePrice;
  const discount =
    onSale && salePrice != null ? Math.round((1 - salePrice / product.regular_price) * 100) : 0;

  return (
    <div
      id={`product-card-${product.id}`}
      className={['s-product-card', equalHeight && 's-product-card-equal-height', className]
        .filter(Boolean)
        .join(' ')}
      data-product-id={product.id}
      onClickCapture={(event) => rememberCardImage(event.currentTarget, String(product.id))}
    >
      <div className="s-product-card-image">
        <Link to={product.url} aria-label={product.image?.alt || product.name}>
          <Image
            src={product.image?.url}
            alt={product.image?.alt ?? product.name}
            width={PRODUCT_IMAGE_WIDTH}
            height={PRODUCT_IMAGE_HEIGHT}
            sizes={imageSizes}
            srcSet={boxSrcSet(product.image?.url, fitType === 'cover')}
            srcSetWidths={PRODUCT_IMAGE_SRCSET_WIDTHS}
            objectFit={fitType || 'contain'}
            priority={imagePriority}
            noWrapper
          />
        </Link>

        {/* List responses send the id as a numeric string; the wishlist holds numbers. */}
        <WishlistButton
          productId={Number(product.id)}
          className="absolute end-2 top-2 z-1 size-8 bg-white shadow-sm"
        />

        {/* The merchant's own label wins over the computed discount seal, as in Raed. */}
        {product.promotion_title ? (
          <div className="s-product-card-promotion-title s-product-card-promotion-title--text">
            {product.promotion_title}
          </div>
        ) : (
          discount > 0 && (
            <div className="s-product-card-promotion-title">
              <span>
                {t('pages.products.discount', 'خصم')}
                <br />
                {/* leading % so bidi renders "٪25" style, % on the visual left */}
                <strong>%{discount}</strong>
              </span>
            </div>
          )
        )}

        {/* Like Raed: notify-me replaces the out-of-stock controls, never both. */}
        {notifyInCard ? (
          <div
            className={`s-product-card-notify-slot${outlined ? ' s-product-card-notify-slot--outlined' : ''}`}
          >
            <Suspense fallback={null}>
              <SallaProductAvailability productId={product.id} className="s-product-card-notify" />
            </Suspense>
          </div>
        ) : (
          <AddToCartStepper product={product} />
        )}
      </div>

      <div className="s-product-card-content">
        {onSale ? (
          // Prices are <p>, not headings: they sit above the card's <h3> title.
          <div className="s-product-card-sale-price">
            <p>{format(salePrice ?? undefined)}</p>
            <span>{format(product.regular_price)}</span>
          </div>
        ) : (
          <p className="s-product-card-price">{format(product.price)}</p>
        )}

        <h3 className="s-product-card-content-title">
          <Link to={product.url}>{product.name}</Link>
        </h3>

        {/* Merchant-written weight ("400 جرام") — not product.weight */}
        {product.subtitle && <p className="s-product-card-content-subtitle">{product.subtitle}</p>}

        {deliveryPromise && (
          <p
            className="flex items-center gap-0.5 text-[11px] font-bold capitalize leading-none text-brand-deep"
            style={promiseColor ? { color: promiseColor } : undefined}
          >
            <FlashIcon size={12} fill={promiseColor || undefined} />
            <span>
              {t('common.delivery.promise_label', '{{time}} ونوصلك', { time: deliveryPromise })}
            </span>
          </p>
        )}
      </div>
    </div>
  );
});
