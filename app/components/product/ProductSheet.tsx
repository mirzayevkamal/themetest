import { Suspense, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Link } from '@salla.sa/twilight-theme-engine/common';
import { ProductDetailSkeleton } from '@salla.sa/twilight-theme-engine/skeleton';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { useIsWebDesktop } from '../../hooks/useIsWebDesktop';
import { useMountedFromServer } from '../../hooks/useMountedFromServer';
import { useCartCount } from '../BottomNav';
import { BasketFillIcon, CloseIcon } from '../icons';
import ProductSheetContent from './ProductSheetContent';

const sheetEase = [0.32, 0.72, 0, 1] as const;

/**
 * Figma "Item Page": the product page rises from the bottom as a sheet over a
 * dimmed backdrop, with a close control and cart shortcut in its own header.
 * Same on the web and inside the native app. The body has its own Suspense
 * boundary: the engine's add-to-cart form is lazy, and without it the first
 * open would unmount the whole sheet while that chunk loads.
 */
export function ProductSheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const { t } = useTranslation();
  const cartCount = useCartCount();
  const reducedMotion = useReducedMotion();
  // Phone sheet is a dialog. Web desktop CSS turns the route copy into the page,
  // so the dialog role must not stay on that document.
  const webDesktop = useIsWebDesktop();
  // A server-rendered sheet (direct load) must paint in place: animating in from
  // translateY(100%) keeps the whole page off-screen until hydration.
  const fromServer = useMountedFromServer();
  const sheetTransition = reducedMotion ? { duration: 0 } : { duration: 0.4, ease: sheetEase };
  const fadeTransition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.25, ease: 'easeOut' as const };

  return (
    <div
      role={webDesktop ? undefined : 'dialog'}
      aria-modal={webDesktop ? undefined : true}
      aria-label={webDesktop ? undefined : t('pages.products.details', 'تفاصيل المنتج')}
      className="product-sheet fixed inset-0 z-50 flex justify-center"
    >
      {/* Fade the dimmer only — fading the panel made preview text show through home. */}
      <motion.div
        className="product-sheet__dimmer absolute inset-0 bg-ink/80"
        aria-hidden="true"
        initial={fromServer ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={fadeTransition}
      />
      <div className="product-sheet__column relative mx-auto flex h-full w-full max-w-[480px] flex-col overflow-hidden">
        <button
          type="button"
          aria-label={t('common.elements.close', 'إغلاق')}
          onClick={onClose}
          className="product-sheet__spacer relative h-[calc(40px+var(--app-safe-area-top,0px))] shrink-0"
        />
        <motion.div
          className="product-sheet__panel relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-3xl bg-white pb-[calc(0.5rem+var(--app-safe-area-bottom,0px))]"
          initial={fromServer ? false : { y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={sheetTransition}
          style={{ willChange: 'transform' }}
        >
          <header className="product-sheet__header flex shrink-0 items-center justify-between rounded-t-3xl bg-white px-4 py-2">
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.elements.close', 'إغلاق')}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-neutral-100 bg-white"
            >
              <CloseIcon size={24} />
            </button>
            <Link
              to="/cart"
              aria-label={t('common.nav.cart', 'السلة')}
              className="relative flex size-11 shrink-0 items-center justify-center rounded-xl border border-neutral-100 bg-white text-brand"
            >
              <BasketFillIcon />
              {cartCount > 0 && (
                <span className="absolute end-1.5 top-[9px] flex size-4 items-center justify-center rounded-full bg-discount text-[11px] font-semibold leading-none text-white ring-1 ring-neutral-100">
                  {cartCount}
                </span>
              )}
            </Link>
          </header>
          <div className="product-sheet__body flex min-h-0 flex-1 flex-col overflow-hidden bg-smoke">
            <Suspense fallback={<ProductDetailSkeleton />}>{children}</Suspense>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/** Chrome and body imported together, so the sheet's chunk preloads the body
 * alongside it instead of discovering a second lazy file after it renders. */
export function ProductSheetOverlay({ id, onClose }: { id: string; onClose: () => void }) {
  return (
    <ProductSheet onClose={onClose}>
      <ProductSheetContent id={id} onClose={onClose} />
    </ProductSheet>
  );
}
