/** Pathname of an absolute store URL; relative paths pass through. */
export function pathOf(url: string): string {
  if (!url.includes('://')) return url;
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export function withLeadingSlash(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

/** Storefront path without a trailing slash or locale prefix. */
export function storePathOf(url: string): string {
  const normalized = withLeadingSlash(pathOf(url)).replace(/\/$/, '');
  return normalized.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '/';
}

/** Storefront path with the current locale prefix, for SPA navigation. */
export function localizedPath(url: string, locale?: string): string {
  const path = storePathOf(url);
  if (!locale) return path;
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}
