import {
  memo,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { preload } from 'react-dom';
// Core, not the deferred wrapper: the wrapper SSRs a hero skeleton until the
// slider scrolls into view, which hides the LCP image from the initial HTML.
import { SallaSliderCore as SallaSlider } from '@salla.sa/twilight-components-react/slider';
import { Image } from '@salla.sa/twilight-theme-engine/common';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { getCdnImageSrcSet, getCdnImageUrl } from '@salla.sa/twilight-theme-engine/utils/cdn-image';
import {
  bannerSheetClick,
  useBannerNavigate,
  useOpenBannerSheet,
} from '../../hooks/useBannerSheet';
import { useHydrated } from '../../hooks/useHydrated';

const SLIDE_GAP_PX = 8;

/** Scale applied to the non-active slides in center-highlight mode. */
const SIDE_SLIDE_SCALE = 0.86;

/** Slide width in highlight mode; must match w-[242px] in slider.scss. */
const SLIDE_WIDTH_PX = 242;

/** Layout height from the 754/320 slide aspect-ratio: 242 × 320/754. */
const SLIDE_HEIGHT_PX = 103;

/** 1x, Lighthouse mobile 1.75x, 2x of the 242px slide, plus desktop 364/754. */
const SLIDE_SRCSET_WIDTHS = [242, 364, 424, 484, 754, 1508] as const;

/**
 * Coverflow scales side slides down inside their full-width layout box, leaving
 * half the lost width as extra visual gap on each side. Pulling slides in by
 * that amount keeps the visible gap at SLIDE_GAP_PX.
 */
const SIDE_SLIDE_PULL_PX = ((1 - SIDE_SLIDE_SCALE) * SLIDE_WIDTH_PX) / 2;

/** Long enough that Lighthouse records the first slide, not a later autoplay frame. */
const AUTOPLAY_DELAY_MS = 10000;

/**
 * Two or three 364px cards fit the desktop column, so watchOverflow locks the
 * only snap and rewind cannot advance. Twelve cards still overflow a 3840px window.
 */
const MIN_ROTATING_TRACK_SLIDES = 12;

// slidesPerView stays 'auto' so CSS owns slide widths and hydration doesn't reflow them.
// loop stays false: Swiper 9+ reorders real slides, which moves the first painted frame (CLS).
const BASE_SLIDER_CONFIG = {
  watchOverflow: true,
  slidesPerView: 'auto',
  spaceBetween: SLIDE_GAP_PX,
  loop: false,
  autoplay: { delay: AUTOPLAY_DELAY_MS, disableOnInteraction: false },
} as const;

/** Opt-in look: active card centered at full size, neighbors shrunk beside it. */
const CENTER_HIGHLIGHT_SLIDER_CONFIG = {
  ...BASE_SLIDER_CONFIG,
  centeredSlides: true,
  effect: 'coverflow',
  coverflowEffect: {
    rotate: 0,
    stretch: SIDE_SLIDE_PULL_PX,
    depth: 0,
    modifier: 1,
    scale: SIDE_SLIDE_SCALE,
    slideShadows: false,
  },
} as const;

export interface SliderSlide {
  image?: string;
  url?: string;
  title?: string;
  __hidden?: boolean;
  /** Merchant switch: skip the dark overlay that sits on the image. */
  without_overlay?: boolean;
}

export interface EnhancedSliderProps {
  data: {
    slides?: SliderSlide[];
    /** Merchant switch. CSS shows the nav on web desktop only. */
    show_controls?: boolean;
    highlight_center_slide?: boolean;
    position?: number;
    /** Set by HomeComponentRenderer for the first blocks on the page. */
    priority?: boolean;
    [key: string]: unknown;
  };
}

/** Section class for RenderWhenVisible. Highlight opts into the 320px desktop floor. */
export function getEnhancedSliderClassName(data: EnhancedSliderProps['data']): string {
  return [
    's-block',
    's-block--enhanced-slider',
    Boolean(data.highlight_center_slide) ? 's-block--enhanced-slider--center-highlight' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function hasUsableUrl(url?: string): url is string {
  return typeof url === 'string' && url.trim() !== '' && url !== '#';
}

/** Highlight copies on each end of the track, so a copy that becomes active still has a neighbour. */
const HIGHLIGHT_BOOKENDS = 2;

/** Track positions as indexes into the real slides; a repeated index is a visual copy. */
function buildTrack(realCount: number, highlight: boolean): number[] {
  const track = Array.from({ length: realCount }, (_, index) => index);
  if (realCount < 2) return track;
  // Highlight centres the active slide, so the first and last real slides need neighbours
  // on both sides: the track is [..., last, ...real, first, ...] and starts on the first real
  // slide. Two copies per side, not one: with one, the moment a copy is the active slide the
  // track has nothing beyond it and the edge shows white until the jump below.
  if (highlight) {
    const before = Array.from(
      { length: HIGHLIGHT_BOOKENDS },
      (_, i) => (realCount - HIGHLIGHT_BOOKENDS + i + realCount) % realCount
    );
    const after = Array.from({ length: HIGHLIGHT_BOOKENDS }, (_, i) => i % realCount);
    return [...before, ...track, ...after];
  }
  if (realCount >= 4) return track;
  while (track.length < MIN_ROTATING_TRACK_SLIDES) track.push(...track.slice(0, realCount));
  return track;
}

/**
 * One tab stop per real banner, on the copy nearest the active slide. Slides after the
 * active one are on screen, so a tie goes forward; at the end of the track the nearest
 * copy sits before it. Copies out of view are hidden, never the banner a user can see.
 */
function tabStops(track: number[], activeIndex: number): Set<number> {
  const stops = new Map<number, number>();
  for (let distance = 0; distance < track.length; distance += 1) {
    for (const index of [activeIndex + distance, activeIndex - distance]) {
      const real = track[index];
      if (real !== undefined && !stops.has(real)) stops.set(real, index);
    }
  }
  return new Set(stops.values());
}

type Swiper = {
  activeIndex: number;
  slideTo: (index: number, speed?: number, runCallbacks?: boolean) => void;
  on: (event: string, handler: () => void) => void;
  off: (event: string, handler: () => void) => void;
};

type SallaSliderHost = Element & { sliderInstance?: () => Promise<Swiper | undefined> };

function Slide({
  slide,
  sizes,
  priority,
  copy,
}: {
  slide: SliderSlide;
  sizes: string;
  priority: boolean;
  copy: boolean;
}) {
  const { t } = useTranslation();
  const openBanner = useOpenBannerSheet();
  const navigateBanner = useBannerNavigate();
  const url = slide.url;
  const image = (
    <Image
      src={slide.image}
      alt=""
      width={SLIDE_WIDTH_PX}
      height={SLIDE_HEIGHT_PX}
      sizes={sizes}
      srcSetWidths={SLIDE_SRCSET_WIDTHS}
      priority={priority}
      objectFit="cover"
      noWrapper
      className="h-full w-full rounded-lg"
      // Side slides are on screen in the centred layout, so lazy loading still fetches them
      // at once; low priority leaves the bandwidth to the hero (priority) slide first.
      {...(priority ? {} : { fetchPriority: 'low' as const })}
    />
  );

  return (
    <div
      aria-hidden={copy || undefined}
      className={`home-banner-slider__slide swiper-slide overflow-hidden rounded-lg${
        slide.without_overlay ? '' : ' overlay-bg'
      }`}
    >
      {hasUsableUrl(url) ? (
        <a
          href={url}
          className="block h-full w-full"
          // The image is decorative (alt=""), so an untitled slide still needs a link name.
          aria-label={slide.title?.trim() || t('common.elements.promo_banner', 'بنر ترويجي')}
          tabIndex={copy ? -1 : undefined}
          onClick={(event: ReactMouseEvent<HTMLAnchorElement>) =>
            bannerSheetClick(url, openBanner, event, navigateBanner)
          }
        >
          {image}
        </a>
      ) : (
        image
      )}
    </div>
  );
}

export const EnhancedSlider = memo(function EnhancedSlider({ data }: EnhancedSliderProps) {
  const hydrated = useHydrated();
  const hostRef = useRef<HTMLDivElement>(null);
  // Priority keeps a plain first image until salla-slider upgrades. Revealing earlier
  // makes that image wait on the control, which is the desktop LCP render delay.
  const [sliderReady, setSliderReady] = useState(false);
  const visibleSlides = (data.slides ?? []).filter((slide) => !slide.__hidden);
  const realCount = visibleSlides.length;
  const isPriority = Boolean(data.priority);
  const holdFirstSlide = isPriority && !sliderReady;
  const highlight = Boolean(data.highlight_center_slide);
  const highlightWrapped = highlight && realCount > 1;
  const track = buildTrack(realCount, highlight);
  const hasCopies = track.length > realCount;
  const [activeIndex, setActiveIndex] = useState(0);

  const markSliderReady = useEffectEvent(() => setSliderReady(true));
  // A highlight bookend shows only until the jump below, so its stops stay on the real slides.
  const syncActiveIndex = useEffectEvent((swiper: Swiper) => {
    if (!highlightWrapped) setActiveIndex(swiper.activeIndex);
  });
  // A bookend copy jumps to the real slide it mirrors, one period along; the copies beside
  // it mirror the real slide's neighbours, so the frame looks the same after the jump.
  const settleHighlightEdge = useEffectEvent((swiper: Swiper) => {
    if (!highlightWrapped) return;
    const { activeIndex } = swiper;
    if (activeIndex < HIGHLIGHT_BOOKENDS) swiper.slideTo(activeIndex + realCount, 0, false);
    else if (activeIndex >= HIGHLIGHT_BOOKENDS + realCount)
      swiper.slideTo(activeIndex - realCount, 0, false);
  });

  useEffect(() => {
    if (!isPriority || !hydrated) return;
    const el = hostRef.current?.querySelector('salla-slider');
    // jsdom never registers the element. In the browser Stencil adds `hydrated`
    // after the control has laid the slides out, so the first slide can stay put.
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
  }, [hydrated, isPriority]);

  useEffect(() => {
    if (!hydrated || !hasCopies) return;
    const el = hostRef.current?.querySelector<SallaSliderHost>('salla-slider');
    if (!el) return;
    let swiper: Swiper | undefined;
    let cancelled = false;
    let frame = 0;
    let attempts = 0;
    const onChange = () => swiper && syncActiveIndex(swiper);
    const onEnd = () => swiper && settleHighlightEdge(swiper);
    // Stencil marks the host hydrated, then builds Swiper on the next frame.
    // sliderInstance() is empty until that frame, so keep asking briefly.
    const bind = () => {
      void el.sliderInstance?.().then((instance) => {
        if (cancelled || swiper) return;
        if (instance) {
          swiper = instance;
          swiper.on('slideChange', onChange);
          swiper.on('slideChangeTransitionEnd', onEnd);
        } else if (attempts++ < 60) {
          frame = requestAnimationFrame(bind);
        }
      });
    };

    bind();
    const observer = new MutationObserver(bind);
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      swiper?.off('slideChange', onChange);
      swiper?.off('slideChangeTransitionEnd', onEnd);
    };
  }, [hydrated, hasCopies]);

  if (!realCount) return null;

  // Highlight width is min(754px, the content column inside --home-inline-pad) on desktop,
  // min(585px, the 24px-gutter column) on tablet and min(585px, 62vw) on wide phones.
  // A normal phone card is a fixed 242px.
  const column = 'calc(100vw - 2 * clamp(1.5rem, 10.28vw, 9.25rem))';
  const sizes = highlight
    ? `(min-width: 1024px) min(754px, ${column}), ` +
      `(min-width: 768px) min(585px, calc(100vw - 48px)), ` +
      `(min-width: 481px) min(585px, 62vw), ${SLIDE_WIDTH_PX}px`
    : `(min-width: 768px) 364px, ${SLIDE_WIDTH_PX}px`;
  const first = visibleSlides[0].image;
  if (isPriority) {
    const lcpSrc = getCdnImageUrl(first, { width: SLIDE_WIDTH_PX });
    const lcpSrcSet = getCdnImageSrcSet(first, SLIDE_SRCSET_WIDTHS);
    if (lcpSrc) {
      preload(lcpSrc, {
        as: 'image',
        fetchPriority: 'high',
        ...(lcpSrcSet ? { imageSrcSet: lcpSrcSet, imageSizes: sizes } : {}),
      });
    }
  }

  const sliderConfig = {
    ...(highlight ? CENTER_HIGHLIGHT_SLIDER_CONFIG : BASE_SLIDER_CONFIG),
    rewind: !highlightWrapped && realCount > 1,
    ...(highlightWrapped ? { initialSlide: HIGHLIGHT_BOOKENDS } : {}),
  };
  // Attributes, not wrapper props: the React wrapper only assigns props on the
  // client, so the SSR'd element would run on its defaults until hydration.
  const sliderAttrs: Record<string, string> = {
    // Swiper's autoplay countdown repaints every frame, so a single slide skips it.
    'auto-play': String(realCount > 1),
    'slider-config': JSON.stringify(sliderConfig),
    // Always set it. An omitted attribute uses the element default and mounts arrows.
    'show-controls': String(data.show_controls === true),
  };
  const id = `main-slider-${data.position ?? 1}`;
  const className = highlight
    ? 'home-banner-slider home-banner-slider--center-highlight'
    : 'home-banner-slider ps-4';

  // Real slides in merchant order paint first; copies exist only inside the slider.
  const realSlides = visibleSlides.map((slide, index) => (
    <Slide
      key={index}
      slide={slide}
      sizes={sizes}
      priority={isPriority && index === 0}
      copy={false}
    />
  ));
  const firstTrackIndex = highlightWrapped ? HIGHLIGHT_BOOKENDS : 0;
  // Highlight bookends show only until the settle jump, so the real slides keep the stops.
  const stops = highlightWrapped
    ? new Set(visibleSlides.map((_, index) => index + HIGHLIGHT_BOOKENDS))
    : tabStops(track, activeIndex);
  const trackSlides = track.map((real, index) => (
    <Slide
      key={index}
      slide={visibleSlides[real]}
      sizes={sizes}
      priority={isPriority && index === firstTrackIndex}
      copy={!stops.has(index)}
    />
  ));

  // Twilight defines <salla-slider> before React hydrates and Stencil moves the
  // slot, so the custom element stays out of the hydrate pass. Its className is
  // never set from React: the Stencil wrapper reapplies it and drops `hydrated`.
  return (
    <div ref={hostRef} id={hydrated ? undefined : id} className={className}>
      {holdFirstSlide && (
        <div className="home-banner-slider__static" slot="items">
          {realSlides[0]}
        </div>
      )}
      {hydrated ? (
        <SallaSlider id={id} aria-hidden={holdFirstSlide ? 'true' : undefined} {...sliderAttrs}>
          <div slot="items">{trackSlides}</div>
        </SallaSlider>
      ) : (
        !holdFirstSlide && <div slot="items">{realSlides}</div>
      )}
    </div>
  );
});
