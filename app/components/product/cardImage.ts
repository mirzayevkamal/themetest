/** Last tapped card's loaded image URL, by product id: the product frame shows it from cache. */
export const cardImageSrc = new Map<string, string>();

/** Remember the image the shopper already has on screen, before navigation paints the product. */
export function rememberCardImage(from: Element, id: string): void {
  const root = from.matches('[data-product-id]')
    ? from
    : (from.closest('[data-product-id]') ?? from);
  const img = root.querySelector('img');
  if (!img) return;
  // Only the candidate the browser chose; `src` is the width-only fallback nobody fetched.
  const src = img.currentSrc;
  if (!src) return;
  cardImageSrc.clear();
  cardImageSrc.set(id, src);
}
