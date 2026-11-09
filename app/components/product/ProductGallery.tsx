import { SallaSliderCore as SallaSlider } from '@salla.sa/twilight-components-react/slider';
import { useTwilight } from '@salla.sa/twilight-theme-engine/providers';
import { Image } from '@salla.sa/twilight-theme-engine/components/common';
import { ImageModal } from '@salla.sa/twilight-theme-engine/components/modal';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import type { Product, ProductImage } from '@salla.sa/twilight-theme-engine/types';
import { getCdnImageUrl } from '@salla.sa/twilight-theme-engine/utils/cdn-image';
import { Suspense, useLayoutEffect, useState } from 'react';
import { useIsWebDesktop } from '../../hooks/useIsWebDesktop';
import { useMountedFromServer } from '../../hooks/useMountedFromServer';
import { cardImageSrc } from './cardImage';

type ImagePreview = { src: string; alt: string };
type NativeGalleryBridge = {
  openGallery?: (images: ProductImage[], selected: ProductImage) => void;
};

/**
 * Holds the gallery's box so name and price don't jump. A client open paints the
 * URL already in hand. The server render sizes it for LCP until the slider mounts.
 */
export function ProductGalleryPlaceholder({
  image,
}: {
  image?: { src: string; alt: string; objectFit: 'cover' | 'contain'; plain?: boolean };
} = {}) {
  const fit = image?.objectFit === 'cover' ? 'object-cover' : 'object-contain';
  return (
    <div className="product-details-gallery w-[calc(100%+4px)] shrink-0 overflow-hidden pb-8">
      {image?.plain ? (
        // As-is: <Image> would re-size the URL through the CDN and miss the cache.
        <div className="product-details-gallery__placeholder w-full overflow-hidden rounded-xl bg-white">
          <img
            src={image.src}
            alt={image.alt}
            decoding="sync"
            fetchPriority="high"
            className={`h-full w-full ${fit}`}
          />
        </div>
      ) : image ? (
        <div className="product-details-gallery__placeholder w-full overflow-hidden rounded-xl bg-white">
          <Image
            src={image.src}
            alt={image.alt}
            width={414}
            height={244}
            objectFit={image.objectFit}
            priority
            noWrapper
            className="h-full w-full"
          />
        </div>
      ) : (
        <div className="product-details-gallery__placeholder w-full animate-pulse rounded-xl bg-gray-100" />
      )}
    </div>
  );
}

function firstGalleryUrl(product: Product): string | undefined {
  return product.images?.find((image) => image.url)?.url ?? product.image?.url;
}

/**
 * Show the list-card image in the frame until details exist *and* the first gallery
 * image is decoded, then mount the slider once.
 */
export function ProductGalleryStage({
  product,
  isPreview,
}: {
  product: Product;
  isPreview: boolean;
}) {
  const { theme } = useTwilight();
  const fromServer = useMountedFromServer();
  const desktop = useIsWebDesktop();
  const url = firstGalleryUrl(product);
  const slideSize = desktop ? { width: 560, height: 444 } : { width: 414, height: 244 };
  // The URL the first slide requests, so the slider mounts on a cached image.
  const slideSrc = getCdnImageUrl(url, slideSize);
  // The URL the probe below has decoded. Fetching starts on the list-card product, so
  // the file is usually in before details are; and it is keyed by URL, so when the
  // desktop media query lands after hydration and the slide size changes, the frame
  // keeps the server image until the new size has decoded too.
  const [decodedSrc, setDecodedSrc] = useState<string>();
  // Only the first mount waits for the decode; a size change on an open gallery
  // (window resize, tablet rotation) swaps the image in place and keeps its state.
  const [shown, setShown] = useState(false);
  const target = slideSrc ?? url;

  useLayoutEffect(() => {
    if (!target) return;
    let cancelled = false;
    const img = document.createElement('img');
    const done = () => {
      if (!cancelled) setDecodedSrc(target);
    };
    img.onload = done;
    img.onerror = done;
    img.src = target;
    if (img.complete && img.naturalWidth > 0) done();
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [target]);

  const ready = shown || !target || decodedSrc === target;
  useLayoutEffect(() => {
    if (!isPreview && ready) setShown(true);
  }, [isPreview, ready]);

  if (isPreview || !ready) {
    const cached = fromServer ? undefined : cardImageSrc.get(String(product.id));
    // Server HTML keeps the gallery URL so <Image> can size it for LCP. A client open
    // paints the card's decoded src, else the URL the first slide already requests.
    const src = fromServer && !isPreview && url ? url : (cached ?? slideSrc);
    const image = src
      ? {
          src,
          alt: product.images?.find((i) => i.url)?.alt || product.image?.alt || product.name,
          objectFit: theme.settings.slider_background_size ?? 'contain',
          plain: !fromServer,
        }
      : undefined;
    return <ProductGalleryPlaceholder image={image} />;
  }
  return <ProductGallery product={product} />;
}

export function ProductGallery({ product }: { product: Product }) {
  const { t } = useTranslation();
  const { theme } = useTwilight();
  const objectFit = theme.settings.slider_background_size ?? 'contain';
  const [activeIndex, setActiveIndex] = useState(0);
  const [preview, setPreview] = useState<ImagePreview | null>(null);

  const images: ProductImage[] = product.images?.length
    ? product.images
    : product.image?.url
      ? [product.image]
      : [];
  const desktop = useIsWebDesktop();
  const active = images[activeIndex] ?? images[0];

  const openNativeGallery = (selected: ProductImage) => {
    const mobile = window.salla?.mobile as
      (NonNullable<typeof window.salla>['mobile'] & NativeGalleryBridge) | undefined;
    if (!mobile?.isEnabled?.() || typeof mobile.openGallery !== 'function') return false;
    mobile.openGallery(images, selected);
    return true;
  };

  const slideProps = { product, objectFit, onPreview: setPreview, onNativeOpen: openNativeGallery };

  return (
    <div className="product-details-gallery w-[calc(100%+4px)] shrink-0 overflow-hidden pb-8">
      {desktop && active ? (
        <div className="product-details-gallery__frame">
          <ImageSlide
            key={activeIndex}
            image={active}
            index={activeIndex}
            width={560}
            height={444}
            {...slideProps}
          />
          {images.length > 1 ? (
            <div className="product-details-gallery__thumbs">
              {images.map((image, index) => (
                <button
                  key={image.id ?? index}
                  type="button"
                  className={`product-details-gallery__thumb${
                    index === activeIndex ? ' is-active' : ''
                  }`}
                  aria-pressed={index === activeIndex}
                  aria-label={image.alt || product.name}
                  onClick={() => setActiveIndex(index)}
                >
                  <Image
                    src={image.url ?? product.image?.url}
                    alt=""
                    width={56}
                    height={56}
                    objectFit="contain"
                    noWrapper
                    className="h-full w-full"
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <SallaSlider
          id={`details-slider-${product.id}`}
          className="product-details-gallery__slider image-slider"
          type="carousel"
          loop={false}
          slidesPerView="1"
          showControls={false}
          sliderConfig={{ watchOverflow: true }}
          onSlideChange={(event) => setActiveIndex(event.detail.realIndex ?? 0)}
        >
          {product.promotion_title ? (
            <div className="promotion-title">{product.promotion_title}</div>
          ) : null}

          {product.calories ? (
            <div className="absolute top-4 z-2 flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white shadow-sm rtl:left-4 ltr:right-4">
              <span className="text-xl font-bold leading-none text-red-500">
                {product.calories}
              </span>
              <span className="text-xs text-gray-500">
                {t('pages.products.calories', 'Calories')}
              </span>
            </div>
          ) : null}

          <div slot="items">
            {images.map((image, index) => (
              <ImageSlide
                key={image.url ?? image.three_d_image_url ?? image.video_url ?? image.id}
                image={image}
                index={index}
                {...slideProps}
              />
            ))}
          </div>

          {images.length > 1 ? (
            <output className="product-details-gallery__counter" aria-live="polite" dir="ltr">
              {activeIndex + 1} / {images.length}
            </output>
          ) : null}
        </SallaSlider>
      )}

      <Suspense fallback={null}>
        <ImageModal
          isOpen={Boolean(preview)}
          onClose={() => setPreview(null)}
          src={preview?.src ?? ''}
          alt={preview?.alt}
        />
      </Suspense>
    </div>
  );
}

function ImageSlide({
  image,
  product,
  index,
  objectFit,
  width = 414,
  height = 244,
  onPreview,
  onNativeOpen,
}: {
  image: ProductImage;
  product: Product;
  index: number;
  objectFit: 'cover' | 'contain';
  width?: number;
  height?: number;
  onPreview: (preview: ImagePreview) => void;
  onNativeOpen: (image: ProductImage) => boolean;
}) {
  if (image.three_d_image_url) {
    return (
      <model-viewer
        className="product-details-gallery__slide swiper-slide model-entry"
        loading="lazy"
        camera-controls
        touch-action="pan-y"
        auto-rotate
        poster={image.url || undefined}
        src={image.three_d_image_url}
        shadow-intensity="1"
        alt={image.alt}
        onClick={() => onNativeOpen(image)}
      ></model-viewer>
    );
  }

  const isVideo = Boolean(image.video_url);

  // Swiper stamps role="group" and "n / m" on each slide, which a link can't
  // carry, so the slide is a wrapper and the lightbox link sits inside it.
  return (
    <div className={`product-details-gallery__slide swiper-slide ${isVideo ? 'video-entry' : ''}`}>
      <a
        data-fslightbox={`product_${product.id}`}
        data-img-id={image.id}
        data-slid-index={index}
        {...(isVideo
          ? { 'data-video-src': image.video_url, target: '_blank', rel: 'noopener noreferrer' }
          : {})}
        data-caption={image.alt}
        data-infinite="false"
        data-type={isVideo ? 'youtube' : 'image'}
        href={image.video_url || image.url}
        onClick={(event) => {
          if (onNativeOpen(image)) {
            event.preventDefault();
            return;
          }
          if (isVideo || !image.url) return;
          event.preventDefault();
          onPreview({ src: image.url, alt: image.alt || product.name });
        }}
        aria-label={product.name}
        className="block h-full w-full"
      >
        <Image
          id={String(image.id)}
          src={image.url}
          alt={image.alt || product.name}
          className="h-full w-full"
          objectFit={objectFit}
          width={width}
          height={height}
          priority={index === 0}
          noWrapper
        />
      </a>
    </div>
  );
}
