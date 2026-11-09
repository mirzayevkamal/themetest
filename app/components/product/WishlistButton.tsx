import { useWishlist } from '@salla.sa/twilight-theme-engine/hooks/useWishlist';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { useThemeSettings } from '../../hooks/useAccentStyle';
import { useHydrated } from '../../hooks/useHydrated';
import { HeartIcon } from '../icons/HeartIcon';

/** Add to / remove from the wishlist, as Twig grocery's heart on the card and product page.
 *  Only when the merchant turns on `show_wishlist` (off by default: grocery keeps its cards
 *  clean); the account wishlist link and page stay either way. The SDK handles guests (login
 *  prompt). The server can't know the customer's list, so the
 *  heart shows as added only after hydration. `data-id`, like Twig and Raed: wishlist apps
 *  find the button by it. */
export function WishlistButton({
  productId,
  className = '',
  size = 16,
}: {
  productId: number;
  className?: string;
  size?: number;
}) {
  const { t } = useTranslation();
  const hydrated = useHydrated();
  const wishlist = useWishlist();
  // Theme-specific key (twilight.json) the engine's ThemeSettings type doesn't list.
  const enabled = useThemeSettings()?.show_wishlist === true;
  const added = hydrated && wishlist.has(productId);

  if (!enabled) return null;

  return (
    <button
      type="button"
      data-id={productId}
      aria-label={t('pages.products.add_to_wishlist', 'أضف للمفضلة')}
      aria-pressed={added}
      onClick={() => wishlist.toggle(productId)}
      className={`grid shrink-0 place-items-center rounded-full ${added ? 'text-brand' : 'text-neutral-500'} ${className}`}
    >
      <HeartIcon size={size} filled={added} />
    </button>
  );
}
