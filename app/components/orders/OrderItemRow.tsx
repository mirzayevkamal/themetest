import { useQuery } from '@tanstack/react-query';
import {
  product as productApi,
  rememberProductPreview,
} from '@salla.sa/twilight-theme-engine/api/product';
import { useMoney } from '@salla.sa/twilight-theme-engine/hooks/useMoney';
import type { Product } from '@salla.sa/twilight-theme-engine/types';
import {
  productHref,
  productHrefFromItem,
  productIdIn,
  useOpenProductSheet,
} from '../../hooks/useProductSheet';
import { ProductLineStepper } from '../product/AddToCartStepper';
import type { Order } from './types';

function matchedProductForLine(
  found: Product[],
  item: { name: string; thumbnail?: string | null }
): Product | undefined {
  const exact = found.find((product) => product.name === item.name);
  if (exact) return exact;
  const file = item.thumbnail?.split('/').pop();
  return found.find((product) =>
    Boolean(file && product.image?.url?.includes(file.split('-')[0] ?? ''))
  );
}

/** Storefront order lines often omit `product`/`product_id`; resolve via search.
 *  The link may fall back to the top result, but only the line's own id or a
 *  name/image match drives the cart stepper. */
function useOrderLineProduct(item: Order['items'][number]): {
  href?: string;
  productId?: string;
} {
  const fromLine = productHrefFromItem(item);
  const query = item.sku || item.name;
  const { data } = useQuery({
    ...productApi.queries.list({ source: 'search', sourceValue: query, perPage: 8 }),
    enabled: !fromLine && Boolean(query),
    staleTime: 60_000,
  });
  if (fromLine) return { href: fromLine, productId: productIdIn(fromLine) };
  const found = data?.items ?? [];
  const matched = matchedProductForLine(found, item);
  const listed = matched ?? found[0];
  if (!listed) return {};
  rememberProductPreview(listed);
  return {
    href: productHref(listed.url, listed.id),
    productId: matched ? String(matched.id) : undefined,
  };
}

export function OrderItemRow({
  item,
  editable,
}: {
  item: Order['items'][number];
  editable: boolean;
}) {
  const { format } = useMoney();
  const openSheet = useOpenProductSheet();
  const original = item.amounts.original_price?.amount ?? 0;
  const price = item.amounts.total.amount;
  const discounted = original > price;
  const { href, productId } = useOrderLineProduct(item);

  const thumb = (
    <span
      className={`relative size-14 shrink-0 rounded-xl border border-neutral-100 ${item.thumbnail ? 'bg-white' : 'bg-neutral-100'}`}
    >
      {item.thumbnail && (
        <img src={item.thumbnail} alt="" className="size-full rounded-xl object-contain" />
      )}
      {editable && (
        <span className="absolute bottom-1 end-1 flex size-7 items-center justify-center rounded-lg bg-neutral-50 text-xs font-semibold text-ink">
          x{item.quantity}
        </span>
      )}
    </span>
  );
  const details = (
    <div className="flex min-w-0 flex-1 flex-col gap-1 self-stretch">
      <p className="text-[13px] font-medium text-ink">{item.name}</p>
      {item.options?.[0] && <p className="text-[11px] text-silver">{item.options[0].value}</p>}
      <p className="mt-auto flex items-center gap-1 text-[13px] font-bold">
        {discounted && (
          <span className="text-[11px] font-normal text-silver line-through">
            {format(original)}
          </span>
        )}
        <span className={discounted ? 'text-discount' : 'text-ink'}>{format(price)}</span>
      </p>
    </div>
  );

  return (
    <li className="flex items-end gap-2" data-product-sheet={href ?? ''}>
      {href ? (
        <button
          type="button"
          onClick={(event) => openSheet(href, event.currentTarget)}
          className="flex min-w-0 flex-1 cursor-pointer items-end gap-2 text-start"
        >
          {thumb}
          {details}
        </button>
      ) : (
        <>
          {thumb}
          {details}
        </>
      )}
      {editable ? (
        productId && <ProductLineStepper productId={productId} />
      ) : (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-neutral-50 text-xs font-semibold text-ink">
          {item.quantity}
        </span>
      )}
    </li>
  );
}
