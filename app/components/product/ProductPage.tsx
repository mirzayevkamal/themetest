import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  SallaComments,
  type SallaCommentsProps,
} from '@salla.sa/twilight-components-react/comments';
import { SallaOffer } from '@salla.sa/twilight-components-react/offer';
import { SallaQuickOrder } from '@salla.sa/twilight-components-react/quick-order';
import { useTwilight } from '@salla.sa/twilight-theme-engine';
import { Breadcrumb, RenderWhenVisible } from '@salla.sa/twilight-theme-engine/components/common';
import { AddToCartForm } from '@salla.sa/twilight-theme-engine/components/product';
import { HookSlot, useComments, useProduct } from '@salla.sa/twilight-theme-engine/hooks';
import { PageBlocks } from '@salla.sa/twilight-theme-engine/home';
import type { ProductPageProps } from '@salla.sa/twilight-theme-engine/routes/product';
import type { Page } from '@salla.sa/twilight-theme-engine/types';
import { BlockHookSlot } from '../common/BlockHookSlot';
import { isBulletDeliveryOn, openDeliverySheet } from '../../hooks/useBulletDelivery';
import { ProductActionBar } from './ProductActionBar';
import { ProductGalleryStage } from './ProductGallery';
import { ProductInfo } from './ProductInfo';
import { RelatedProducts, RelatedProductsSkeleton } from './RelatedProducts';

export function ProductPage({
  product: initialProduct,
  page,
  isPreview = false,
}: Pick<ProductPageProps, 'product'> & { page?: Page | null; isPreview?: boolean }) {
  const { theme, store } = useTwilight();
  const { product } = useProduct(initialProduct, { isPreview });
  const { commentsKey } = useComments();
  const bulletDelivery = isBulletDeliveryOn(store);
  // The list-card placeholder and the details response type the id differently; one key for both.
  const blockScope = useMemo(() => ({ product_id: String(product.id) }), [product.id]);

  const pageRef = useRef<HTMLDivElement>(null);

  // The engine breadcrumb swaps the product's category crumb for the last page visited (a
  // stored referrer, e.g. "البحث عن (حليب)"). Drop it before <Breadcrumb> mounts and reads it,
  // so the trail stays Home › Category › Product. As in Raed; `window` is absent during SSR.
  useState(() => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.removeItem('breadcrumb-referrer');
    } catch {
      // sessionStorage unavailable (private mode)
    }
  });

  // With Bullet Delivery, the SDK delivery promise's "deliver to …" header is the phone's
  // only place picker on this page. Its own handler emits an event the SDK's (moved,
  // listener-less) sheet may miss, so route the tap to the theme's sheet, as AddressBar does.
  // The page div remounts per product (its key), so the listener follows the product id.
  useEffect(() => {
    const pageEl = pageRef.current;
    if (!bulletDelivery || !pageEl) return;
    const onTap = (event: Event) => {
      const target = event.target as Element;
      if (!target.closest('salla-delivery-promise .s-delivery-promise-header')) return;
      event.stopPropagation();
      openDeliverySheet().catch(() => {
        // A failed mount leaves the cart's address bar as the way in.
      });
    };
    pageEl.addEventListener('click', onTap, true);
    return () => pageEl.removeEventListener('click', onTap, true);
  }, [bulletDelivery, product.id]);

  return (
    <div
      key={product.id}
      className={`product-page flex h-full min-h-0 flex-col${
        bulletDelivery ? ' product-page--bullet-delivery' : ''
      }`}
      ref={pageRef}
    >
      <div className="product-page__scroll min-h-0 flex-1 overflow-y-auto">
        <BlockHookSlot
          name="product.single.before_product_info"
          wrapper="s-before-product-info"
          scope={blockScope}
        />
        <div className="container">
          <HookSlot name="product:start" />

          <div
            className="product-page__hero flex flex-col items-start"
            id={`product-${product.id}`}
          >
            <ProductGalleryStage product={product} isPreview={isPreview} />

            <div className="product-page__details main-content w-full">
              {theme.settings.product_show_breadcrumbs !== false ? (
                <Suspense fallback={null}>
                  <Breadcrumb page={page} className="product-page__crumbs" />
                </Suspense>
              ) : null}
              <HookSlot name="product:details.start" />
              <HookSlot name="product:single.form.start" />
              {/* The engine form is lazy; keep the details visible while its chunk
                  loads instead of suspending the whole sheet back to a skeleton. */}
              <Suspense fallback={<ProductInfo product={product} />}>
                <AddToCartForm
                  // The Figma chips in ProductInfo are this form's option inputs;
                  // empty options here so SallaProductOptionsCore doesn't render a
                  // second, conflicting set of fields.
                  product={{ ...product, options: [] }}
                  stickyAddToCart={theme.settings.sticky_add_to_cart}
                  formStartSlot={
                    <>
                      <HookSlot name="product:single.description.start" context={{ product }} />
                      <ProductInfo product={product} />
                      <HookSlot name="product:single.description" context={{ product }} />
                      <HookSlot name="product:single.description.end" context={{ product }} />
                      <HookSlot name="product:details.end" />
                    </>
                  }
                />
              </Suspense>
              <HookSlot name="product:single.form.end" />
              {/* Like Twig, the merchant's description-end blocks come after the form. */}
              <PageBlocks hook="product:single.description.end" scope={blockScope} />
              <ProductActionBar product={product} className="product-page__buy--inline" />
              {/* Salla's quick order, after the form as in Raed and Twig; renders nothing
                  unless the merchant turned quick order on. */}
              <SallaQuickOrder className="product-page__quick-order block" />
            </div>
          </div>

          <div className="product-page__offer">
            <SallaOffer />
          </div>
          <BlockHookSlot
            name="product.single.before_product_recommendations"
            wrapper="s-before-related"
            scope={blockScope}
          />
          <HookSlot name="product:related.start" />
          {/* RenderWhenVisible is React.lazy (engine); its own boundary keeps the page from
              suspending while that chunk loads. */}
          <Suspense fallback={<RelatedProductsSkeleton />}>
            <RenderWhenVisible
              placeholder={<RelatedProductsSkeleton />}
              estimatedHeight="0px"
              rootMargin="200px"
            >
              <RelatedProducts productId={product.id} />
            </RenderWhenVisible>
          </Suspense>
          <HookSlot name="product:related.end" />
          <BlockHookSlot
            name="product.single.after_product_recommendations"
            wrapper="s-after-related"
            scope={blockScope}
          />
        </div>

        <BlockHookSlot
          name="product.single.before_customer_reviews"
          wrapper="s-before-reviews"
          scope={blockScope}
        />

        <div className="product-page__extras">
          {store.settings?.rating?.show_on_product && product.rating?.count ? (
            <Suspense fallback={null}>
              <RenderWhenVisible>
                <SallaComments
                  itemId={product.id}
                  type={'product' as SallaCommentsProps['type']}
                  key={commentsKey}
                />
              </RenderWhenVisible>
            </Suspense>
          ) : null}
        </div>
        <HookSlot name="product:end" />
      </div>
      <ProductActionBar product={product} className="product-page__buy--dock" />
    </div>
  );
}
