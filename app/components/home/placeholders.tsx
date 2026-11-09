import { memo } from 'react';
import { useDeliveryPromise } from '../../hooks/useDeliveryPromise';

/** Same rows as ProductCard (price, 2-line name, delivery promise) so loading reserves its height. */
export function ProductCardPlaceholder() {
  const deliveryPromise = useDeliveryPromise();
  return (
    <div className="s-product-card">
      <div className="s-product-card-image">
        <div className="absolute inset-0 shimmer" />
      </div>
      <div className="s-product-card-content">
        <div className="h-[17px] w-12 rounded shimmer" />
        <div className="s-product-card-content-title-skeleton w-full rounded shimmer" />
        {deliveryPromise && <div className="h-3 w-2/3 rounded shimmer" />}
      </div>
    </div>
  );
}

function TitlePulse() {
  return <div className="h-[22px] w-32 rounded shimmer" />;
}

/** Library title row measures 41px; a 22px bar alone collapses it. */
function SliderTitlePlaceholder({ withRightSlot = false }: { withRightSlot?: boolean }) {
  const pulse = <TitlePulse />;
  return (
    <div className="s-slider-block__title min-h-[41px] items-center">
      {withRightSlot ? <div className="s-slider-block__title-right">{pulse}</div> : pulse}
    </div>
  );
}

/** Matches PromotionalBanner's 2.5rem full-bleed bar, as one shimmer block. */
export const PromotionalBannerPlaceholder = memo(function PromotionalBannerPlaceholder() {
  return <div className="h-10 w-full shimmer" />;
});

/** Matches EnhancedSlider. CSS owns the 754/320 card: 242px wide, desktop 364px, highlight 754px. */
export const EnhancedSliderPlaceholder = memo(function EnhancedSliderPlaceholder() {
  return (
    <div className="home-banner-slider">
      <div className="flex items-center gap-2 overflow-hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="home-banner-slider__slide swiper-slide overflow-hidden rounded-lg shimmer"
          />
        ))}
      </div>
    </div>
  );
});

/** Matches ProductsSlider / SallaProductsSlider: title + overflowing card row. */
export const ProductsSliderPlaceholder = memo(function ProductsSliderPlaceholder({
  withTitle = true,
}: {
  withTitle?: boolean;
}) {
  return (
    <div>
      {withTitle ? (
        // The real heading's box (20px mobile / 22px desktop at normal line-height).
        <div className="s-slider-block__title">
          <div className="s-slider-block__title-right">
            <h2 aria-hidden="true" className="w-32 rounded text-transparent shimmer">
              &nbsp;
            </h2>
          </div>
        </div>
      ) : null}
      <div className="flex overflow-hidden">
        {Array.from({ length: 10 }, (_, index) => (
          <div key={index} className="s-products-slider-card shrink-0">
            <ProductCardPlaceholder />
          </div>
        ))}
      </div>
    </div>
  );
});

/** Matches MainLinks: title + 8-tile grid (4-col mobile / 8-col desktop). */
export const MainLinksPlaceholder = memo(function MainLinksPlaceholder() {
  return (
    <div className="container">
      <div className="main-links-slider main-links-grid">
        <SliderTitlePlaceholder />
        <div className="main-links-grid__items">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="main-links-slider__slide">
              <div className="slide--cat-entry main-links-slider__item">
                <span className="main-links-slider__thumb">
                  <span className="block h-full w-full shimmer" />
                </span>
                <span className="h-[34px] w-3/4 rounded shimmer" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

/** Matches Brands: 30px h2 title + 80px rounded logo row. */
export const BrandsPlaceholder = memo(function BrandsPlaceholder() {
  return (
    <div className="container brands-home">
      <div className="s-block__title brands-home__title">
        <div className="h-7.5 w-32 rounded shimmer" />
      </div>
      <div className="brands-home__list">
        {Array.from({ length: 8 }, (_, index) => (
          // Same shrink-0 wrapper as the real link, or flex squeezes the tiles.
          <span key={index} className="brands-home__link">
            <span className="brands-home__item">
              <span className="brands-home__logo block h-full w-full shimmer" />
            </span>
          </span>
        ))}
      </div>
    </div>
  );
});

/** Matches EnhancedSquareBanners: 200px banner stack. */
export const EnhancedSquareBannersPlaceholder = memo(function EnhancedSquareBannersPlaceholder() {
  return (
    <div className="grid grid-flow-row gap-3">
      <div className="banner-entry h-banner">
        <div className="absolute inset-0 shimmer" />
      </div>
    </div>
  );
});

/** Matches SliderProductsWithHeader: 220px bg, cards pulled up 122px, no title row. */
export const SliderProductsWithHeaderPlaceholder = memo(
  function SliderProductsWithHeaderPlaceholder() {
    return (
      <div className="slider-products-with-header">
        <div className="slider-bg shimmer">
          <div className="container relative pt-8 sm:pt-20">
            <TitlePulse />
          </div>
        </div>
        <div className="container relative -mt-[122px] overflow-hidden sm:-mt-62">
          <ProductsSliderPlaceholder withTitle={false} />
        </div>
      </div>
    );
  }
);

/**
 * Client-nav pending shell. Same above-the-fold grocery blocks as a typical
 * homepage so the pending state does not flash the engine's generic grids.
 */
export const HomeSkeleton = memo(function HomeSkeleton() {
  return (
    <>
      <section className="s-block s-block--promotional-banner merge-with-top-component">
        <PromotionalBannerPlaceholder />
      </section>
      <section className="s-block s-block--products-slider">
        <ProductsSliderPlaceholder />
      </section>
      <section className="s-block s-block--main-links">
        <MainLinksPlaceholder />
      </section>
    </>
  );
});
