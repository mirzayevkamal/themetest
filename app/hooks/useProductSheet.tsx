import { useCallback, useEffect, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { useParams, useRouter, useRouterState } from '@tanstack/react-router';
import { PRODUCT_ROUTE_ID, useMatchedRouteId } from './useMatchedRoute';
import { isWebDesktop } from './useIsWebDesktop';
import { localizedPath, pathOf, withLeadingSlash } from './storePath';
import { rememberCardImage } from '../components/product/cardImage';

// The leading `-` is sacrificial: TanStack's parser drops the first character
// of a masked location's stored hash (it assumes a leading `#`). `#sheet-{id}`
// must not collide with ProductPage's `id="product-{id}"` or the sheet jumps
// while it is sliding up.
const HASH_PREFIX = '-sheet-';
const SHEET_HASH = /^-?(?:sheet|product)-(\d+)$/;

/** True while a product sheet hash is on the location (with or without the leading `-`). */
export function isProductSheetHash(hash: string): boolean {
  return SHEET_HASH.test(hash);
}
// `/slug/p123` (theme) or `/product/123` (some order/cart payloads). `/product/` first.
const PRODUCT_PATH = /(?:\/product\/|\/p)(\d+)\/?$/;
const PRODUCT_ROUTE_PATH = /^\/(?:[a-z]{2}\/)?[^/]+\/p\d+$/;

export function productIdIn(url: string): string | undefined {
  return PRODUCT_PATH.exec(pathOf(url))?.[1];
}

/** Path the `/$slug/p{$id}` route (and the sheet mask) can match. */
function sheetMaskPath(path: string, id: string): string {
  const normalized = withLeadingSlash(pathOf(path)).replace(/\/$/, '');
  return PRODUCT_ROUTE_PATH.test(normalized) ? normalized : `/product/p${id}`;
}

/** In-app product path the sheet interceptor can read, or `/product/p{id}` from an id. */
export function productHref(url?: string | null, id?: number | string | null): string | undefined {
  if (url) {
    const path = withLeadingSlash(pathOf(url));
    const parsed = productIdIn(path);
    if (parsed) return sheetMaskPath(path, parsed);
  }
  if (id != null && String(id) !== '') return `/product/p${id}`;
  return undefined;
}

/** Order/cart lines send `product` as `{id,url}`, a bare id, or `product_id`. */
export function productHrefFromItem(item: {
  url?: string | null;
  product_url?: string | null;
  product_id?: number | string | null;
  productId?: number | string | null;
  product?: unknown;
}): string | undefined {
  const p = item.product;
  let url: string | null | undefined = item.product_url;
  let id: number | string | null | undefined = item.product_id ?? item.productId ?? null;
  if (typeof p === 'number' || typeof p === 'string') {
    id = id ?? p;
  } else if (p && typeof p === 'object') {
    const rec = p as { id?: number | string | null; url?: string | null };
    url = rec.url ?? url;
    if (rec.id != null && rec.id !== '') id = rec.id;
  }
  return productHref(url ?? item.url, id);
}

function openProductSheet(router: ReturnType<typeof useRouter>, href: string): void {
  const id = productIdIn(href);
  if (!id) return;
  // Warm the sheet chunk (chrome and preview). Failures are ignored; lazy() loads it on open.
  void import('../components/product/ProductSheet').catch(() => {});
  void import('../components/product/ProductPage').catch(() => {});
  void router.navigate({
    hash: `${HASH_PREFIX}${id}`,
    search: true,
    hashScrollIntoView: false,
    replace: SHEET_HASH.test(router.state.location.hash),
    mask: { to: sheetMaskPath(href, id), unmaskOnReload: true },
  });
}

/** Product id from the `#sheet-{id}` hash that opens the in-page sheet. */
export function useProductSheetId(): string | null {
  const hash = useRouterState({ select: (s) => s.location.hash });
  return SHEET_HASH.exec(hash)?.[1] ?? null;
}

/**
 * Phone shell: open the in-page sheet (back closes it).
 * Web desktop: go to the product route.
 */
export function useOpenProductSheet(): (href: string, from?: Element) => void {
  const router = useRouter();
  const onProductPage = useMatchedRouteId() === PRODUCT_ROUTE_ID;
  const { locale } = useParams({ strict: false }) as { locale?: string };

  return useCallback(
    (href: string, from?: Element) => {
      if (onProductPage) return;
      // `from` is the tapped row or button: its loaded thumbnail opens the product frame.
      const id = from && productIdIn(href);
      if (id) rememberCardImage(from, id);
      if (isWebDesktop()) {
        void router.navigate({ to: localizedPath(href, locale) });
        return;
      }
      openProductSheet(router, href);
    },
    [router, onProductPage, locale]
  );
}

/**
 * On the phone shell, product links open as a sheet over the current page:
 * a hash history entry (back closes it) masked with the product URL (share/copy
 * still work). Returns the close action.
 *
 * Web desktop leaves the click alone so the link opens the product route.
 * On that page, links navigate normally: a second add-to-cart form would
 * break the action bar.
 */
export function useProductSheetLinks(): () => void {
  const router = useRouter();
  const onProductPage = useMatchedRouteId() === PRODUCT_ROUTE_ID;

  useEffect(() => {
    if (onProductPage) return;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      // Engine/theme links only; their href may carry the store domain in dev.
      const anchor = (event.target as Element | null)?.closest?.('a[data-spa-link][href]');
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank') return;
      const url = new URL(anchor.href, window.location.origin);
      const id = productIdIn(url.pathname);
      if (!id) return;

      rememberCardImage(anchor, id);
      // Wide browser: the engine link interceptor opens the product route.
      if (isWebDesktop()) return;

      event.preventDefault();
      openProductSheet(router, url.pathname);
    };

    // window capture runs before the engine's document-capture link interceptor,
    // which honours defaultPrevented.
    window.addEventListener('click', onClick, true);
    return () => window.removeEventListener('click', onClick, true);
  }, [router, onProductPage]);

  return useCallback(() => {
    if (router.history.canGoBack()) {
      router.history.back();
      return;
    }
    void router.navigate({ hash: '', search: true, replace: true });
  }, [router]);
}

/** Link that opens the in-page sheet on the phone shell. Web desktop follows `to`. */
export function ProductSheetLink({
  to,
  className,
  children,
}: {
  to: string;
  className?: string;
  children: ReactNode;
}) {
  const open = useOpenProductSheet();
  const onProductPage = useMatchedRouteId() === PRODUCT_ROUTE_ID;
  const href = withLeadingSlash(to);
  const id = productIdIn(href);

  const onClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (onProductPage || !id || isWebDesktop()) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    event.stopPropagation();
    open(href);
  };

  return (
    <a href={href} data-spa-link="" className={className} onClick={onClick}>
      {children}
    </a>
  );
}
