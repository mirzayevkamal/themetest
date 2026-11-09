// Replaces the engine block, whose deferred SallaSlider SSRs a skeleton instead of the
// first banner (LCP image missing from the HTML, then a large shift when it appears).
import { memo, useEffect, useEffectEvent, useRef, useState } from 'react';
import { SallaSliderCore as SallaSlider } from '@salla.sa/twilight-components-react/slider';
import { Image, Link } from '@salla.sa/twilight-theme-engine/common';
import { useHydrated } from '../../hooks/useHydrated';

// Width-only CDN requests: the engine's 1200×300 scale-down served a 300px-tall
// file that the full-width slide then stretched.
const SLIDE_SRCSET_WIDTHS = [480, 768, 1200, 1600, 1920] as const;

export interface PhotosSliderItem {
  id?: string | number;
  image?: string;
  url?: string;
}

export interface PhotosSliderProps {
  data: {
    items?: PhotosSliderItem[];
    position?: number;
    priority?: boolean;
    [key: string]: unknown;
  };
}

export const PhotosSlider = memo(function PhotosSlider({ data }: PhotosSliderProps) {
  const hydrated = useHydrated();
  const hostRef = useRef<HTMLDivElement>(null);
  // The static first banner stays until salla-slider has laid out its slides,
  // so the swap neither blanks the banner nor moves it.
  const [sliderReady, setSliderReady] = useState(false);
  const markSliderReady = useEffectEvent(() => setSliderReady(true));
  const items = (data.items ?? []).filter((item) => item.image);

  useEffect(() => {
    if (!hydrated) return;
    const el = hostRef.current?.querySelector('salla-slider');
    // jsdom never registers the element. In the browser Stencil adds `hydrated`
    // once the control has rendered.
    if (!el || !customElements.get('salla-slider') || el.classList.contains('hydrated')) {
      markSliderReady();
      return;
    }
    const observer = new MutationObserver(() => {
      if (!el.classList.contains('hydrated')) return;
      observer.disconnect();
      markSliderReady();
    });
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [hydrated]);

  if (!items.length) return null;

  // As in the Twig block: the image sets the slide height, 1200×300 only until it loads.
  const slides = items.map((item, index) => (
    <div key={item.id ?? `${item.url ?? ''}:${item.image}`} className="swiper-slide">
      <Link to={item.url || '#'}>
        <Image
          src={item.image}
          alt={`image-slider-${index}`}
          width={1200}
          height={300}
          sizes="100vw"
          srcSetWidths={SLIDE_SRCSET_WIDTHS}
          objectFit="contain"
          priority={Boolean(data.priority) && index === 0}
          noWrapper
          className="w-full rounded-md"
        />
      </Link>
    </div>
  ));

  // Twilight defines <salla-slider> before React hydrates and Stencil moves the slot,
  // so the element stays out of the hydrate pass. The static banner uses the classes
  // the control adds, so it sits where Swiper puts the first slide.
  return (
    <div ref={hostRef} className="photos-slider-host">
      {!sliderReady && (
        <div className="home-slider photos-slider photos-slider--static carousel-slider s-slider-wrapper">
          <div className="swiper s-slider-container">
            <div className="swiper-wrapper">{slides[0]}</div>
          </div>
        </div>
      )}
      {hydrated && (
        <SallaSlider
          id={`photos-${data.position ?? 1}-slider`}
          className="home-slider photos-slider"
          aria-hidden={sliderReady ? undefined : 'true'}
          type="carousel"
          centered
          auto-play="true"
          show-controls="false"
          {...(items.length > 1 ? { pagination: true } : {})}
          slider-config={JSON.stringify({ watchOverflow: true })}
        >
          <div slot="items">{slides}</div>
        </SallaSlider>
      )}
    </div>
  );
});
