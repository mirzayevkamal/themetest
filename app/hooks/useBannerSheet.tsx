import { useCallback, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { useParams, useRouter, useRouterState } from '@tanstack/react-router';
import type { ProductsListSource } from '@salla.sa/twilight-theme-engine/api/product';
import { isProductSheetHash } from './useProductSheet';
import { isWebDesktop } from './useIsWebDesktop';
import { localizedPath, storePathOf } from './storePath';

// Same sacrificial leading `-` as the product sheet: TanStack drops the first
// character of a stored hash.
const HASH_PREFIX = '-banner-';
const BANNER_HASH = /^-?banner-(.+)$/;

export type BannerTarget =
  | { kind: 'product'; id: string }
  | { kind: 'category'; id: string }
  | { kind: 'listing'; source: ProductsListSource; sourceValue?: string }
  | { kind: 'brands-index' };

export function parseBannerTarget(url: string): BannerTarget | null {
  const path = storePathOf(url);
  let match: RegExpExecArray | null;

  if ((match = /(?:\/p|\/product\/)(\d+)$/.exec(path))) {
    return { kind: 'product', id: match[1] };
  }
  // Blog `/c-{id}` must not be treated as a storefront category.
  if (path === '/blog' || path.startsWith('/blog/')) return null;
  // `/$slug/c{$id}` — require the slug segment so `/cart` is not a category.
  if ((match = /\/[^/]+\/c([^/]+)$/.exec(path))) {
    return { kind: 'category', id: match[1] };
  }
  if ((match = /\/tag-([^/]+)$/.exec(path)) || (match = /\/tags\/([^/]+)$/.exec(path))) {
    return { kind: 'listing', source: 'tags', sourceValue: match[1] };
  }
  if (path === '/brands') return { kind: 'brands-index' };
  if ((match = /\/brand-([^/]+)$/.exec(path)) || (match = /\/brands\/([^/]+)$/.exec(path))) {
    return { kind: 'listing', source: 'brands', sourceValue: match[1] };
  }
  if (path === '/offers') return { kind: 'listing', source: 'offers' };
  if (path === '/latest-products') return { kind: 'listing', source: 'latest' };
  if (path === '/most-sales-products') return { kind: 'listing', source: 'sales' };

  return null;
}

export function isExternalBannerUrl(url: string): boolean {
  if (!url.includes('://')) return false;
  if (typeof window === 'undefined') return false;
  try {
    return new URL(url).origin !== window.location.origin;
  } catch {
    return true;
  }
}

/** Same-app destinations the sheet knows how to render. */
export function canOpenBannerSheet(url: string): boolean {
  if (isExternalBannerUrl(url)) return false;
  return parseBannerTarget(url) != null;
}

function pathFromBannerHash(hash: string): string | null {
  const encoded = BANNER_HASH.exec(hash)?.[1];
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

/**
 * Destination path from `#-banner-{encoded}`. Kept while a product sheet is
 * stacked on top so the listing does not unmount when the hash becomes
 * `#-sheet-{id}`.
 */
export function useBannerSheetPath(): string | null {
  const hash = useRouterState({ select: (s) => s.location.hash });
  const fromHash = pathFromBannerHash(hash);
  const stackedPath = useRef<string | null>(null);

  if (fromHash) {
    stackedPath.current = fromHash;
  } else if (!isProductSheetHash(hash)) {
    stackedPath.current = null;
  }

  return fromHash ?? stackedPath.current;
}

function openBannerSheet(router: ReturnType<typeof useRouter>, url: string): void {
  const path = storePathOf(url);
  if (!parseBannerTarget(path)) return;
  void router.navigate({
    hash: `${HASH_PREFIX}${encodeURIComponent(path)}`,
    search: true,
    hashScrollIntoView: false,
    replace: BANNER_HASH.test(router.state.location.hash),
  });
}

export function useOpenBannerSheet(): (url: string) => void {
  const router = useRouter();
  return useCallback((url: string) => openBannerSheet(router, url), [router]);
}

/** Same-tab SPA navigation for desktop banner destinations. */
export function useBannerNavigate(): (url: string) => void {
  const router = useRouter();
  const { locale } = useParams({ strict: false }) as { locale?: string };

  return useCallback(
    (url: string) => {
      void router.navigate({ to: localizedPath(url, locale) });
    },
    [router, locale]
  );
}

export function useCloseBannerSheet(): () => void {
  const router = useRouter();
  return useCallback(() => {
    void router.navigate({
      to: '/',
      hash: '',
      search: true,
      replace: true,
    });
  }, [router]);
}

/**
 * Mobile: store listing/category/product urls open the in-page sheet.
 * Web desktop: same-app urls SPA-navigate in place; other-origin urls open a new window.
 */
export function bannerSheetClick(
  url: string,
  open: (url: string) => void,
  event: ReactMouseEvent<HTMLAnchorElement>,
  navigate: (url: string) => void
): void {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  if (isWebDesktop()) {
    event.preventDefault();
    event.stopPropagation();
    if (isExternalBannerUrl(url)) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(url);
    return;
  }

  if (!canOpenBannerSheet(url)) return;
  event.preventDefault();
  event.stopPropagation();
  open(url);
}
