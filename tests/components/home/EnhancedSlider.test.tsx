import React, { act } from 'react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import {
  EnhancedSlider,
  getEnhancedSliderClassName,
} from '../../../app/components/home/EnhancedSlider';

const desktopMocks = vi.hoisted(() => ({ webDesktop: true }));
const openBanner = vi.fn();
const navigateBanner = vi.fn();

const sliderConfig = (container: HTMLElement) =>
  JSON.parse(container.querySelector('salla-slider')?.getAttribute('slider-config') ?? '{}');
const slideSources = (container: HTMLElement) =>
  [...container.querySelectorAll('.home-banner-slider__slide img')].map((img) =>
    img.getAttribute('src')
  );
/** Link labels of the slides in the tab order; null for a visual copy. */
const tabStops = (container: HTMLElement) =>
  [...container.querySelectorAll('.home-banner-slider__slide')].map((slide) => {
    const link = slide.querySelector('a');
    return link?.getAttribute('tabindex') === '-1' ? null : link?.getAttribute('aria-label');
  });

/** Stencil exposes sliderInstance() and marks the host hydrated once Swiper exists. */
async function attachSwiper(container: HTMLElement, activeIndex: number) {
  const handlers: Record<string, () => void> = {};
  const swiper = {
    activeIndex,
    slideTo: vi.fn((index: number) => {
      swiper.activeIndex = index;
    }),
    on: (event: string, fn: () => void) => {
      handlers[event] = fn;
    },
    off: (event: string) => {
      delete handlers[event];
    },
  };
  const el = container.querySelector('salla-slider')!;
  Object.assign(el, { sliderInstance: () => Promise.resolve(swiper) });
  await act(async () => {
    el.classList.add('hydrated');
    await Promise.resolve();
  });
  return {
    swiper,
    fire: (event: string, index: number) => {
      swiper.activeIndex = index;
      act(() => handlers[event]?.());
    },
  };
}

vi.mock('../../../app/hooks/useIsWebDesktop', () => ({
  isWebDesktop: () => desktopMocks.webDesktop,
  useIsWebDesktop: () => desktopMocks.webDesktop,
}));

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

vi.mock('../../../app/hooks/useBannerSheet', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../app/hooks/useBannerSheet')>();
  return {
    ...actual,
    useOpenBannerSheet: () => openBanner,
    useBannerNavigate: () => navigateBanner,
  };
});

describe('EnhancedSlider', () => {
  beforeEach(() => {
    desktopMocks.webDesktop = true;
  });

  const mockSlides = [
    { image: 'slide1.jpg', __hidden: false, without_overlay: false, title: '', description: '' },
    { image: 'slide2.jpg', __hidden: false, without_overlay: false, title: '', description: '' },
  ];

  it('renders slider element with correct attributes', () => {
    const { container } = render(<EnhancedSlider data={{ slides: mockSlides, position: 1 }} />);
    const slider = container.querySelector('salla-slider');
    expect(slider?.getAttribute('id')).toBe('main-slider-1');
    expect(slider?.getAttribute('auto-play')).toBe('true');
  });

  it('adds the desktop 320px floor class only for a highlight banner', () => {
    expect(getEnhancedSliderClassName({ slides: mockSlides })).toBe(
      's-block s-block--enhanced-slider'
    );
    expect(getEnhancedSliderClassName({ slides: mockSlides, highlight_center_slide: false })).toBe(
      's-block s-block--enhanced-slider'
    );
    expect(getEnhancedSliderClassName({ slides: mockSlides, highlight_center_slide: true })).toBe(
      's-block s-block--enhanced-slider s-block--enhanced-slider--center-highlight'
    );
  });

  it('does not highlight the center slide unless the setting is true', () => {
    for (const data of [
      { slides: mockSlides },
      { slides: mockSlides, highlight_center_slide: false },
    ]) {
      const { container } = render(<EnhancedSlider data={data} />);
      expect(
        container
          .querySelector('.home-banner-slider')
          ?.classList.contains('home-banner-slider--center-highlight')
      ).toBe(false);
      expect(sliderConfig(container).effect).toBeUndefined();
    }
    const { container } = render(<EnhancedSlider data={{ slides: mockSlides }} />);
    const config = sliderConfig(container);
    expect(config.watchOverflow).toBe(true);
    expect(config.slidesPerView).toBe('auto');
    expect(config.spaceBetween).toBe(8);
    expect(config.loop).toBe(false);
    expect(config.rewind).toBe(true);
    // 12 cards so a fitted 2-slide row still has a next snap. The first stays slide 1.
    expect(slideSources(container)).toEqual(
      Array.from({ length: 12 }, (_, index) => `slide${(index % 2) + 1}.jpg`)
    );
  });

  it('sizes images to the 754/320 card in both modes so a 1508×640 upload is not cropped', () => {
    const imageSize = (highlight: boolean) => {
      const { container } = render(
        <EnhancedSlider data={{ slides: mockSlides, highlight_center_slide: highlight }} />
      );
      const image = container.querySelector('.home-banner-slider__slide img');
      return [image?.getAttribute('width'), image?.getAttribute('height')];
    };
    expect(imageSize(true)).toEqual(['242', '103']);
    expect(imageSize(false)).toEqual(['242', '103']);
  });

  it('uses center slide highlight config when enabled', () => {
    const slides = [{ image: 'slide1.jpg' }, { image: 'slide2.jpg' }, { image: 'slide3.jpg' }];
    const { container } = render(
      <EnhancedSlider data={{ slides, highlight_center_slide: true }} />
    );
    const config = sliderConfig(container);
    expect(
      container
        .querySelector('.home-banner-slider')
        ?.classList.contains('home-banner-slider--center-highlight')
    ).toBe(true);
    expect(config.centeredSlides).toBe(true);
    expect(config.slidesPerView).toBe('auto');
    expect(config.effect).toBe('coverflow');
    expect(config.coverflowEffect.scale).toBe(0.86);
    expect(config.loop).toBe(false);
    expect(config.rewind).toBe(false);
    // Bookend copies keep the real first slide centered with a card on both sides.
    expect(config.initialSlide).toBe(2);
    expect(slideSources(container)).toEqual([
      'slide2.jpg',
      'slide3.jpg',
      'slide1.jpg',
      'slide2.jpg',
      'slide3.jpg',
      'slide1.jpg',
      'slide2.jpg',
    ]);
  });

  it('jumps from a highlight copy back to the same real slide', async () => {
    const slides = [
      { image: 'a.jpg', url: '/a', title: 'أول' },
      { image: 'b.jpg', url: '/b', title: 'ثان' },
      { image: 'c.jpg', url: '/c', title: 'ثالث' },
    ];
    const { container } = render(
      <EnhancedSlider data={{ slides, highlight_center_slide: true }} />
    );
    const { swiper, fire } = await attachSwiper(container, 2);

    // Track: [ثان, ثالث, أول, ثان, ثالث, أول, ثان]; a copy jumps one period to its real slide.
    fire('slideChange', 1);
    fire('slideChangeTransitionEnd', 1);
    expect(swiper.slideTo).toHaveBeenCalledWith(4, 0, false);
    // Bookends never become stops, even while one is the active slide.
    expect(tabStops(container)).toEqual([null, null, 'أول', 'ثان', 'ثالث', null, null]);
    fire('slideChangeTransitionEnd', 5);
    expect(swiper.slideTo).toHaveBeenCalledWith(2, 0, false);
    fire('slideChangeTransitionEnd', 6);
    expect(swiper.slideTo).toHaveBeenCalledWith(3, 0, false);
    fire('slideChangeTransitionEnd', 3);
    expect(swiper.slideTo).toHaveBeenCalledTimes(3);
  });

  it('gives an end copy a neighbour on both sides, so the edge never shows empty track', () => {
    const slides = [{ image: 'a.jpg' }, { image: 'b.jpg' }, { image: 'c.jpg' }];
    const { container } = render(
      <EnhancedSlider data={{ slides, highlight_center_slide: true }} />
    );
    expect(slideSources(container)).toEqual([
      'b.jpg',
      'c.jpg',
      'a.jpg',
      'b.jpg',
      'c.jpg',
      'a.jpg',
      'b.jpg',
    ]);
    expect(sliderConfig(container).initialSlide).toBe(2);
  });

  it('builds the same periodic track for two highlight slides', () => {
    const slides = [{ image: 'a.jpg' }, { image: 'b.jpg' }];
    const { container } = render(
      <EnhancedSlider data={{ slides, highlight_center_slide: true }} />
    );
    expect(slideSources(container)).toEqual(['a.jpg', 'b.jpg', 'a.jpg', 'b.jpg', 'a.jpg', 'b.jpg']);
  });

  it('paints the real first highlight slide before the slider mounts', () => {
    const html = renderToString(
      <EnhancedSlider
        data={{
          slides: [{ image: 'slide1.jpg' }, { image: 'slide2.jpg' }, { image: 'slide3.jpg' }],
          highlight_center_slide: true,
        }}
      />
    );
    expect(html.indexOf('slide1.jpg')).toBeGreaterThan(-1);
    expect(html.indexOf('slide1.jpg')).toBeLessThan(html.indexOf('slide3.jpg'));
    expect(html).not.toContain('salla-slider');
  });

  it('repeats three normal slides so a wide desktop can still advance', () => {
    const slides = [{ image: 'slide1.jpg' }, { image: 'slide2.jpg' }, { image: 'slide3.jpg' }];
    const { container } = render(<EnhancedSlider data={{ slides }} />);
    expect(slideSources(container)).toEqual(
      Array.from({ length: 12 }, (_, index) => `slide${(index % 3) + 1}.jpg`)
    );
    const config = sliderConfig(container);
    expect(config.loop).toBe(false);
    expect(config.rewind).toBe(true);
    expect(config.watchOverflow).toBe(true);
  });

  it('keeps repeated banner links out of the tab order', () => {
    navigateBanner.mockClear();
    const slides = [
      { image: 'slide1.jpg', url: '/offers', title: 'عروض' },
      { image: 'slide2.jpg', url: '/new', title: 'جديد' },
    ];
    const { container } = render(<EnhancedSlider data={{ slides }} />);
    const slideEls = [...container.querySelectorAll('.home-banner-slider__slide')];
    const tabbable = slideEls
      .map((slide) => slide.querySelector('a'))
      .filter((link) => link?.getAttribute('tabindex') !== '-1');
    expect(tabbable.map((link) => link?.getAttribute('aria-label'))).toEqual(['عروض', 'جديد']);
    expect(slideEls[0].getAttribute('aria-hidden')).toBeNull();

    const copy = slideEls[2];
    expect(copy.getAttribute('aria-hidden')).toBe('true');
    const copyLink = copy.querySelector('a');
    expect(copyLink?.getAttribute('tabindex')).toBe('-1');
    expect(copyLink?.getAttribute('href')).toBe('/offers');
    fireEvent.click(copyLink!);
    expect(navigateBanner).toHaveBeenCalledWith('/offers');
  });

  it('moves the tab stops onto the copies that scrolled into view', async () => {
    const slides = [
      { image: 'slide1.jpg', url: '/offers', title: 'عروض' },
      { image: 'slide2.jpg', url: '/new', title: 'جديد' },
    ];
    const { container } = render(<EnhancedSlider data={{ slides }} />);
    const { fire } = await attachSwiper(container, 0);
    expect(tabStops(container).slice(0, 2)).toEqual(['عروض', 'جديد']);

    fire('slideChange', 5);
    const stops = tabStops(container);
    expect(stops.filter(Boolean)).toEqual(['جديد', 'عروض']);
    expect(stops.slice(5, 7)).toEqual(['جديد', 'عروض']);
    expect(
      container.querySelectorAll('.home-banner-slider__slide')[0].getAttribute('aria-hidden')
    ).toBe('true');

    // End of the track: the other banner's visible copy is the one just before it.
    fire('slideChange', 11);
    expect(tabStops(container).filter(Boolean)).toEqual(['عروض', 'جديد']);
    expect(tabStops(container).slice(10)).toEqual(['عروض', 'جديد']);
    expect(tabStops(container)[0]).toBeNull();
  });

  it('hides highlight bookend copies from the tab order', () => {
    const slides = [
      { image: 'slide1.jpg', url: '/a', title: 'أول' },
      { image: 'slide2.jpg', url: '/b', title: 'ثان' },
      { image: 'slide3.jpg', url: '/c', title: 'ثالث' },
    ];
    const { container } = render(
      <EnhancedSlider data={{ slides, highlight_center_slide: true }} />
    );
    const slideEls = [...container.querySelectorAll('.home-banner-slider__slide')];

    expect(tabStops(container)).toEqual([null, null, 'أول', 'ثان', 'ثالث', null, null]);
    for (const copy of [0, 1, 5, 6])
      expect(slideEls[copy].getAttribute('aria-hidden')).toBe('true');
    expect(slideEls[2].getAttribute('aria-hidden')).toBeNull();
  });

  it('does not repeat once there are enough slides', () => {
    const slides = Array.from({ length: 4 }, (_, index) => ({ image: `slide${index}.jpg` }));
    const { container } = render(<EnhancedSlider data={{ slides }} />);
    expect(container.querySelectorAll('.home-banner-slider__slide')).toHaveLength(4);
  });

  it('does not loop or repeat a single slide', () => {
    const { container } = render(
      <EnhancedSlider data={{ slides: [mockSlides[0]], highlight_center_slide: true }} />
    );
    const config = sliderConfig(container);
    expect(config.loop).toBe(false);
    expect(config.rewind).toBe(false);
    expect(config.initialSlide).toBeUndefined();
    expect(container.querySelectorAll('.home-banner-slider__slide')).toHaveLength(1);
  });

  it('does not autoplay a single slide, so Swiper stops repainting its countdown', () => {
    const { container } = render(<EnhancedSlider data={{ slides: [mockSlides[0]] }} />);
    expect(container.querySelector('salla-slider')?.getAttribute('auto-play')).toBe('false');
  });

  it('darkens slides unless without_overlay is set', () => {
    const slides = [
      { image: 'with-overlay.jpg', without_overlay: false },
      { image: 'no-overlay.jpg', without_overlay: true },
    ];
    const { container } = render(<EnhancedSlider data={{ slides }} />);
    const slideEls = container.querySelectorAll('.home-banner-slider__slide');

    expect(slideEls[0].classList.contains('overlay-bg')).toBe(true);
    expect(slideEls[1].classList.contains('overlay-bg')).toBe(false);
  });

  it('applies the overlay when without_overlay is omitted', () => {
    const { container } = render(<EnhancedSlider data={{ slides: [{ image: 'slide1.jpg' }] }} />);
    expect(
      container.querySelector('.home-banner-slider__slide')?.classList.contains('overlay-bg')
    ).toBe(true);
  });

  it('filters hidden slides', () => {
    const slides = [...mockSlides, { image: 'slide3.jpg', __hidden: true }];
    const { container } = render(<EnhancedSlider data={{ slides }} />);
    expect(slideSources(container)).not.toContain('slide3.jpg');
  });

  it('passes show_controls through as a string without consulting the viewport', () => {
    desktopMocks.webDesktop = false;
    for (const [show_controls, expected] of [
      [true, 'true'],
      [false, 'false'],
      [undefined, 'false'],
    ] as const) {
      const { container } = render(<EnhancedSlider data={{ slides: mockSlides, show_controls }} />);
      expect(container.querySelector('salla-slider')?.getAttribute('show-controls')).toBe(expected);
    }
  });

  it('eager-loads the first slide so it can be the LCP image', () => {
    const { container } = render(
      <EnhancedSlider data={{ slides: mockSlides, position: 1, priority: true }} />
    );
    const images = container.querySelectorAll('img');
    expect(images[0]?.getAttribute('loading')).not.toBe('lazy');
    expect(images[1]?.getAttribute('loading')).toBe('lazy');
  });

  it('fetches the other slides at low priority so the hero image loads first', () => {
    const { container } = render(
      <EnhancedSlider data={{ slides: mockSlides, position: 1, priority: true }} />
    );
    const images = container.querySelectorAll('img');
    expect(images[0]?.getAttribute('fetchpriority')).toBe('high');
    expect(images[1]?.getAttribute('fetchpriority')).toBe('low');
  });

  it('delays autoplay so a later slide cannot steal LCP', () => {
    const { container } = render(<EnhancedSlider data={{ slides: mockSlides }} />);
    expect(sliderConfig(container).autoplay.delay).toBe(10000);
  });

  it('preloads the first CDN slide at the same sized URL as the img', () => {
    const src = 'https://cdn.files.salla.network/homepage/banner.webp';
    const { container } = render(
      <EnhancedSlider data={{ slides: [{ image: src }], priority: true }} />
    );
    const img = container.querySelector('img');
    const imgSrc = img?.getAttribute('src') ?? '';
    const srcSet = img?.getAttribute('srcset') ?? '';
    expect(imgSrc).toContain('/cdn-cgi/image/');
    expect(imgSrc).not.toContain('quality=');
    expect(imgSrc).toContain('width=242');
    expect(srcSet).toContain('width=242');
    expect(srcSet).toContain('width=364');
    expect(srcSet).toContain('width=424');
    expect(srcSet).toContain('width=484');
    expect(srcSet).toContain('width=754');
    const sizes = '(min-width: 768px) 364px, 242px';
    expect(img?.getAttribute('sizes')).toBe(sizes);
    const preload = [...document.querySelectorAll('link[rel="preload"][as="image"]')].find(
      (link) =>
        link.getAttribute('href') === imgSrc ||
        (link.getAttribute('imagesrcset') ?? '').includes('homepage/banner.webp')
    );
    expect(preload).toBeTruthy();
    expect(preload?.getAttribute('imagesrcset')).toContain('width=424');
    expect(preload?.getAttribute('imagesizes')).toBe(sizes);
  });

  it('asks the center-highlight slide for the content column, capped at 754px on desktop and 585px on tablet', () => {
    const src = 'https://cdn.files.salla.network/homepage/highlight.webp';
    const { container } = render(
      <EnhancedSlider
        data={{ slides: [{ image: src }], priority: true, highlight_center_slide: true }}
      />
    );
    const sizes =
      '(min-width: 1024px) min(754px, calc(100vw - 2 * clamp(1.5rem, 10.28vw, 9.25rem))), ' +
      '(min-width: 768px) min(585px, calc(100vw - 48px)), (min-width: 481px) min(585px, 62vw), 242px';
    expect(container.querySelector('img')?.getAttribute('sizes')).toBe(sizes);
    const preload = [...document.querySelectorAll('link[rel="preload"][as="image"]')].find((link) =>
      (link.getAttribute('imagesrcset') ?? '').includes('homepage/highlight.webp')
    );
    expect(preload?.getAttribute('imagesizes')).toBe(sizes);
  });

  it('does not prioritize slides when the block is below the fold', () => {
    const src = 'https://cdn.files.salla.network/homepage/below-fold.webp';
    const { container } = render(
      <EnhancedSlider data={{ slides: [{ image: src }, mockSlides[1]] }} />
    );
    const images = container.querySelectorAll('img');
    expect(images[0]?.getAttribute('loading')).toBe('lazy');
    expect(
      [...document.querySelectorAll('link[rel="preload"][as="image"]')].some((link) =>
        (link.getAttribute('imagesrcset') ?? link.getAttribute('href') ?? '').includes(
          'homepage/below-fold.webp'
        )
      )
    ).toBe(false);
  });

  it('paints a priority slide outside salla-slider on the server', () => {
    const html = renderToString(
      <EnhancedSlider data={{ slides: mockSlides, priority: true, highlight_center_slide: true }} />
    );

    expect(html).toContain('home-banner-slider__static');
    expect(html).toContain('slide1.jpg');
    expect(html).not.toContain('slide2.jpg');
    expect(html).not.toContain('salla-slider');
  });

  it('leaves the priority slide in place until salla-slider upgrades', async () => {
    const original = customElements.get.bind(customElements);
    const get = vi.spyOn(customElements, 'get').mockImplementation((name) => {
      if (name === 'salla-slider') return HTMLElement as unknown as CustomElementConstructor;
      return original(name);
    });
    try {
      const { container } = render(
        <EnhancedSlider data={{ slides: mockSlides, priority: true }} />
      );
      const slider = container.querySelector('salla-slider');

      expect(container.querySelector('.home-banner-slider__static img')?.getAttribute('src')).toBe(
        'slide1.jpg'
      );
      expect(slider?.getAttribute('aria-hidden')).toBe('true');

      await act(async () => {
        slider?.classList.add('hydrated');
      });

      await waitFor(() => {
        expect(container.querySelector('.home-banner-slider__static')).toBeNull();
      });
      expect(container.querySelector('salla-slider')?.getAttribute('aria-hidden')).toBeNull();
      expect(slideSources(container)[0]).toBe('slide1.jpg');
    } finally {
      get.mockRestore();
    }
  });

  it('returns null when no slides', () => {
    const { container } = render(<EnhancedSlider data={{ slides: [] }} />);
    expect(container.firstChild).toBeNull();
  });

  it('wraps a slide in a link when the merchant set a url', () => {
    const { container } = render(
      <EnhancedSlider
        data={{
          slides: [{ image: 'slide1.jpg', url: '/offers', title: 'عروض الأسبوع' }],
        }}
      />
    );
    const link = container.querySelector('.home-banner-slider__slide a');

    expect(link?.getAttribute('href')).toBe('/offers');
    expect(link?.getAttribute('aria-label')).toBe('عروض الأسبوع');
    expect(link?.querySelector('img')?.getAttribute('src')).toBe('slide1.jpg');
  });

  it('names an untitled banner link so screen readers can announce it', () => {
    const { container } = render(
      <EnhancedSlider data={{ slides: [{ image: 'slide1.jpg', url: '/offers', title: '' }] }} />
    );
    const link = container.querySelector('.home-banner-slider__slide a');

    expect(link?.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(link?.getAttribute('aria-label')).toBe('بنر ترويجي');
  });

  it('opens the in-page sheet instead of navigating for store listing urls on mobile', () => {
    desktopMocks.webDesktop = false;
    openBanner.mockClear();
    navigateBanner.mockClear();
    const { container } = render(
      <EnhancedSlider data={{ slides: [{ image: 'slide1.jpg', url: '/offers' }] }} />
    );
    const link = container.querySelector('.home-banner-slider__slide a');
    fireEvent.click(link!);

    expect(openBanner).toHaveBeenCalledWith('/offers');
    expect(navigateBanner).not.toHaveBeenCalled();
  });

  it('SPA-navigates category urls on desktop instead of opening the sheet', () => {
    openBanner.mockClear();
    navigateBanner.mockClear();
    const { container } = render(
      <EnhancedSlider data={{ slides: [{ image: 'slide1.jpg', url: '/fruit/c9' }] }} />
    );
    const link = container.querySelector('.home-banner-slider__slide a');
    fireEvent.click(link!);

    expect(openBanner).not.toHaveBeenCalled();
    expect(navigateBanner).toHaveBeenCalledWith('/fruit/c9');
  });

  it('opens other-origin urls in a new window on desktop', () => {
    openBanner.mockClear();
    navigateBanner.mockClear();
    const originalOpen = window.open;
    const openWindow = vi.fn();
    window.open = openWindow;
    try {
      const { container } = render(
        <EnhancedSlider
          data={{ slides: [{ image: 'slide1.jpg', url: 'https://example.com/sale' }] }}
        />
      );
      const link = container.querySelector('.home-banner-slider__slide a');
      fireEvent.click(link!);

      expect(openBanner).not.toHaveBeenCalled();
      expect(navigateBanner).not.toHaveBeenCalled();
      expect(openWindow).toHaveBeenCalledWith(
        'https://example.com/sale',
        '_blank',
        'noopener,noreferrer'
      );
    } finally {
      window.open = originalOpen;
    }
  });

  it('does not wrap a slide when the url is missing or a placeholder', () => {
    const { container } = render(
      <EnhancedSlider
        data={{
          slides: [
            { image: 'no-url.jpg' },
            { image: 'hash.jpg', url: '#' },
            { image: 'blank.jpg', url: '   ' },
          ],
        }}
      />
    );

    expect(container.querySelectorAll('.home-banner-slider__slide a')).toHaveLength(0);
  });
});
