import { useState } from 'react';
import { SallaSocialShare } from '@salla.sa/twilight-components-react/social-share';
import { Image, Link } from '@salla.sa/twilight-theme-engine/common';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { useTwilight } from '@salla.sa/twilight-theme-engine/providers';
import { useMoney } from '@salla.sa/twilight-theme-engine/hooks/useMoney';
import { useIsNativeApp } from '@salla.sa/twilight-theme-engine/native-app';
import type {
  Product,
  ProductOption,
  ProductOptionDetail,
  ProductSku,
} from '@salla.sa/twilight-theme-engine/types';
import { useHydrated } from '../../hooks/useHydrated';
import { ChevronDownIcon, MapPinIcon } from '../icons';
import { WishlistButton } from './WishlistButton';

// Grocery's chips draw plain pick-one lists. Every other type (text, date, upload, colour
// swatches, multi-select…) and the merchant's "show when" rules are drawn by Salla's
// component, whose rules only watch inputs inside it. So one option outside the chips
// hands the product's whole set to the component, as Twig grocery did for every product.
const CHIP_TYPES = new Set(['single-option', 'radio']);

export function fitsChips(options: ProductOption[]): boolean {
  return options.every(
    (option) =>
      (!option.type || CHIP_TYPES.has(option.type)) &&
      !(option as { visibility_condition?: unknown }).visibility_condition
  );
}

// Pick-one and multi-select values as buttons, the chips' shape, instead of a dropdown.
const BUTTON_OPTIONS = JSON.stringify({
  'single-option': { type: 'button' },
  'multiple-option': { type: 'button' },
});

/**
 * Product name, option chips and clamped description —
 * the Figma details card. Chips are native radios named `options[{id}]`,
 * so they must render inside the add-to-cart form (via formStartSlot) for
 * price refresh and cart submission to keep working.
 */
export function ProductInfo({ product }: { product: Product }) {
  const options = product.options ?? [];
  const skus = product.skus ?? [];
  const { theme } = useTwilight();
  const { t } = useTranslation();
  const tags = theme?.settings?.show_tags !== false ? (product.tags ?? []) : [];

  return (
    <section className="product-info flex flex-col gap-6 rounded-xl bg-white p-3">
      <div className="flex flex-col gap-5">
        {product.brand?.logo && (
          <Link to={product.brand.url || '#'} className="w-12" aria-label={product.brand.name}>
            <Image
              src={product.brand.logo}
              alt={product.brand.name ?? ''}
              width={48}
              height={48}
              objectFit="contain"
              noWrapper
            />
          </Link>
        )}
        <div className="flex flex-col gap-1">
          <div className="flex items-start gap-3">
            <h1 className="flex-1 text-lg font-bold leading-tight text-ink">{product.name}</h1>
            {/* Share and wishlist beside the title, as Raed's title actions and Twig's; the
                same row on the phone sheet and the desktop page. */}
            <div className="flex shrink-0 items-center gap-2">
              <SallaSocialShare
                className="product-info__share"
                aria-label={t('blocks.header.share', 'مشاركة')}
              />
              <WishlistButton
                productId={Number(product.id)}
                className="size-9 bg-smoke"
                size={18}
              />
            </div>
          </div>
          {product.is_taxable && (
            <p className="text-xs text-silver">
              {t('pages.products.tax_included', 'السعر شامل الضريبة')}
            </p>
          )}
        </div>

        {fitsChips(options) ? (
          options.map((option) => (
            <div key={option.id} className="flex flex-col gap-3">
              <h2 className="text-sm font-bold leading-none text-ink">{option.name}</h2>
              <div className="flex flex-wrap gap-2 pt-3">
                {option.details?.map((detail) => (
                  <OptionChip
                    key={detail.id}
                    option={option}
                    detail={detail}
                    // Per-chip prices come from the variant SKUs; with several
                    // options a detail alone doesn't determine a variant.
                    sku={
                      options.length === 1
                        ? skus.find((s) => s.related_option_values.includes(detail.id))
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          <SallaOptions product={product} />
        )}
      </div>

      <hr className="border-neutral-100" />

      <ProductDescription product={product} />

      <ProductFacts product={product} />

      <Installments product={product} />

      <ProductCustomFields product={product} />

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-x-2 gap-y-1 text-sm">
          {tags.map((tag) => (
            <Link key={tag.name} to={tag.url} className="text-neutral-500 underline">
              {tag.name}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/** Stock, codes and branch availability, each only when the merchant set it (as in Twig
 *  grocery). The wrapper hides itself when none of them renders. */
function ProductFacts({ product }: { product: Product }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 text-sm empty:hidden">
      <StockCounts product={product} />
      <CodeRow label={t('pages.products.sku', 'رمز المنتج')} value={product.sku} />
      <CodeRow label={t('pages.products.barcode', 'الباركود')} value={product.barcode} />
      <BranchAvailability product={product} />
    </div>
  );
}

/** Sold count (above 0) and stock left (when the merchant shows it). */
function StockCounts({ product }: { product: Product }) {
  const { t } = useTranslation();
  const sold = product.sold_quantity ?? 0;
  const left = product.can_show_remained_quantity ? (product.quantity ?? 0) : 0;
  if (sold <= 0 && left <= 0) return null;
  return (
    <p className="flex flex-wrap gap-x-4 gap-y-1 font-bold text-discount">
      {sold > 0 && (
        <span>{t('pages.products.sold_count', 'بيع منه {{count}}', { count: sold })}</span>
      )}
      {left > 0 && (
        <span>{t('pages.products.left_count', 'متبقي {{count}} فقط', { count: left })}</span>
      )}
    </p>
  );
}

function CodeRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <p className="flex gap-2 text-neutral-500">
      {label}:<span dir="ltr">{value}</span>
    </p>
  );
}

/** Opens Salla's branch list read-only: it shows the product's stock per branch and never
 *  changes the delivery branch, so Bullet Delivery is unaffected. The list is mounted only
 *  for stores with branches or markets (MainLayout). */
function BranchAvailability({ product }: { product: Product }) {
  const { t } = useTranslation();
  const { store } = useTwilight();
  // TODO(engine): inside the app's SPA webview, <salla-scopes> hands every `scopes::open` to
  // `salla.mobile.openScopes()` without the mode or product id, so the app opens its own
  // branch / delivery picker instead of the availability list. Raed has the same bug. Fix it
  // in the engine (and salla-scopes) so the app gets an availability view, then drop this gate.
  const inApp = useIsNativeApp();
  if (!product.show_availability || !store?.scope || inApp) return null;
  const open = () =>
    window.salla?.event?.dispatch('scopes::open', {
      mode: 'availability',
      product_id: String(product.id),
    });
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="flex items-center gap-1.5 text-neutral-500">
        <MapPinIcon />
        {t('pages.products.availability', 'التوفر في الفروع')}
      </span>
      <button type="button" className="font-bold text-brand" onClick={open}>
        {t('pages.products.select_branch', 'اختر الفرع')}
      </button>
    </div>
  );
}

/** `[]`, `{}` and `''` all mean no installment provider (and an empty array is truthy). */
export function hasInstallments(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return Boolean(value);
}

/** Tabby / Tamara: Salla's widget, only when the store has a provider on. Mounted after
 *  hydration, like the options component, since it renders its own children. */
function Installments({ product }: { product: Product }) {
  const { store } = useTwilight();
  const hydrated = useHydrated();
  if (!hydrated || !hasInstallments(store?.settings?.installments)) return null;
  const price =
    typeof product.base_currency_price === 'object'
      ? product.base_currency_price.amount
      : product.base_currency_price;
  return <salla-installment className="product-info__installment" price={price} />;
}

/** The merchant's product custom fields (the dashboard's "custom fields"), as Twig grocery
 *  showed them: Salla's component fetches the values and draws a box per section, or nothing.
 *  The product id is passed, since the SDK's `page.id` can lag an in-app navigation. Mounted
 *  after hydration, like the options component, since it renders its own children. */
function ProductCustomFields({ product }: { product: Product }) {
  const hydrated = useHydrated();
  if (!hydrated || !product.has_metadata) return null;
  return (
    <salla-metadata
      key={product.id}
      className="product-info__metadata empty:hidden"
      // Attribute the engine's ambient typing for the element leaves out.
      {...{ 'entity-id': product.id }}
    />
  );
}

/** Salla's options component, inside the add-to-cart form like the chips. Its inputs keep
 *  the `options[{id}]` names, so price refresh, the action bar and cart submit still work.
 *  Mounted after hydration: the element is defined before React runs and renders its own
 *  children, which the server HTML can't match. */
function SallaOptions({ product }: { product: Product }) {
  const hydrated = useHydrated();
  if (!hydrated) return null;
  return (
    <salla-product-options
      key={product.id}
      className="product-info__options"
      options={JSON.stringify(product.options)}
      product-id={product.id}
      // Attribute the engine's ambient typing for the element leaves out.
      {...{ config: BUTTON_OPTIONS }}
    />
  );
}

/** One `options[{id}]` radio chip. Structural props so the cart row can
 *  feed it cart-item options (which carry `is_selected` instead of
 *  `is_default`). */
export function OptionChip({
  option,
  detail,
  sku,
  defaultChecked = detail.is_default === 1,
  compact = false,
}: {
  option: Pick<ProductOption, 'id'> & { required?: boolean };
  detail: Pick<ProductOptionDetail, 'id'> &
    Partial<Pick<ProductOptionDetail, 'name' | 'is_out' | 'additional_price'>> & {
      is_default?: number | boolean;
    };
  sku?: ProductSku;
  defaultChecked?: boolean;
  /** Cart rows: shorter chip, smaller text. */
  compact?: boolean;
}) {
  const { format } = useMoney();
  const { t } = useTranslation();

  const onSale = !!sku?.has_special_price && sku.regular_price.amount > sku.price.amount;
  const discount =
    onSale && sku ? Math.round((1 - sku.price.amount / sku.regular_price.amount) * 100) : 0;

  return (
    <label
      className={`relative flex cursor-pointer flex-col items-center justify-center gap-1 border border-neutral-100 bg-white has-[:checked]:border-brand has-[:checked]:bg-brand-tint has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-40 ${
        compact ? 'h-8 rounded-md px-2' : 'h-12 rounded-lg px-2.5'
      }`}
    >
      <input
        type="radio"
        className="sr-only"
        name={`options[${option.id}]`}
        value={detail.id}
        defaultChecked={defaultChecked}
        required={option.required !== false}
        disabled={detail.is_out}
      />
      <span className={`${compact ? 'text-[11px]' : 'text-xs'} font-bold leading-none text-ink`}>
        {detail.name}
      </span>
      {sku ? (
        <span className="flex items-center gap-1 text-sm leading-none">
          {onSale && <s className="text-silver">{format(sku.regular_price.amount)}</s>}
          <span className={`font-bold ${onSale ? 'text-discount' : 'text-ink'}`}>
            {format(sku.price.amount)}
          </span>
        </span>
      ) : (
        !!detail.additional_price &&
        detail.additional_price > 0 && (
          <span className="text-sm font-bold leading-none text-ink">
            +{format(detail.additional_price)}
          </span>
        )
      )}
      {discount > 0 && (
        <span className="absolute -top-3 start-0 rounded-[4px] bg-discount px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
          {t('pages.products.discount', 'خصم')}%{discount}
        </span>
      )}
    </label>
  );
}

/** Any tag; quoted values may hold `>` or a literal `<iframe>` that must not be rewritten. */
const HTML_TAG = /<\/?[a-z](?:[^>"']|"[^"]*"|'[^']*')*>/gi;

/** Embedded players and maps load when scrolled near, unless the merchant set `loading`. */
export function lazyIframes(html: string): string {
  return html.replace(HTML_TAG, (tag) =>
    !/^<iframe\b/i.test(tag) || /\sloading\s*=/i.test(tag.replace(/"[^"]*"|'[^']*'/g, '""'))
      ? tag
      : tag.replace(/^<iframe/i, '<iframe loading="lazy"')
  );
}

function ProductDescription({ product }: { product: Product }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(!product.has_read_more);
  if (!product.description) return null;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-bold leading-none text-ink">
        {t('pages.products.details', 'تفاصيل المنتج')}
      </h2>
      <article
        className={`article text-sm leading-normal text-neutral-500 ${expanded ? '' : 'line-clamp-2'}`}
        dangerouslySetInnerHTML={{ __html: lazyIframes(product.description) }}
      />
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1 self-start text-xs text-ink"
        >
          {t('pages.products.full_description', 'الوصف كامل')}
          <ChevronDownIcon />
        </button>
      )}
    </div>
  );
}
