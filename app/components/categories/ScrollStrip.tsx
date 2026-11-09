import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';

/**
 * Horizontal strip with the desktop slider arrows (Figma 3203:10503). The
 * strip is the native overflow scroller on every viewport; desktop.scss shows
 * the arrows on web desktop only, using the same classes as the home sliders.
 */
export function ScrollStrip({
  className,
  children,
  start,
}: {
  className: string;
  children: ReactNode;
  /** Pinned before the strip, outside its scroll and clear of the desktop arrows. */
  start?: ReactNode;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Once per frame, when the browser lays out anyway: read in every scroll event, the widths
    // force a layout of the whole page while it changes under a chip jump.
    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = el.scrollWidth - el.clientWidth;
        const pos = Math.abs(el.scrollLeft);
        const start = pos <= 1;
        const end = pos >= max - 1;
        // Unchanged edges keep the same state: no re-render per scroll frame.
        setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
      });
    };
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync);
    observer?.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', sync);
      observer?.disconnect();
    };
  }, []);

  const scroll = (toEnd: boolean) => {
    const el = ref.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === 'rtl';
    const step = el.clientWidth * 0.8 * (toEnd === rtl ? -1 : 1);
    el.scrollBy({ left: step, behavior: 'smooth' });
  };

  const locked = edges.start && edges.end;
  const arrowClass = (disabled: boolean) =>
    `s-slider-nav-arrow${disabled ? ' swiper-button-disabled' : ''}${locked ? ' swiper-button-lock' : ''}`;

  return (
    <div className={`scroll-strip flex items-center ${className}`}>
      {start}
      {/* The arrows hang off this box, not the strip, so `start` stays clickable. */}
      <div className="relative min-w-0 flex-1">
        <div ref={ref} className="overflow-x-auto overflow-y-hidden no-scrollbar">
          {children}
        </div>
        {/* Same markup as the engine's SliderArrows: dir=rtl keeps prev on the visual right. */}
        <div className="s-slider-block__title-nav" dir="rtl">
          <button
            type="button"
            aria-label={t('common.elements.previous', 'Previous')}
            className={`s-slider-prev ${arrowClass(edges.start)}`}
            disabled={edges.start}
            onClick={() => scroll(false)}
          >
            <span className="s-slider-button-icon" />
          </button>
          <button
            type="button"
            aria-label={t('common.elements.next', 'Next')}
            className={`s-slider-next ${arrowClass(edges.end)}`}
            disabled={edges.end}
            onClick={() => scroll(true)}
          >
            <span className="s-slider-button-icon" />
          </button>
        </div>
      </div>
    </div>
  );
}
