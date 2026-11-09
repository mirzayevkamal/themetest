import React from 'react';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// Node 25+ ships its own global localStorage and sessionStorage, undefined unless
// Node runs with --localstorage-file, and they shadow jsdom's. Put jsdom's back.
const dom = (globalThis as { jsdom?: { window: Window } }).jsdom;
for (const name of ['localStorage', 'sessionStorage'] as const) {
  if (dom && !globalThis[name]) {
    Object.defineProperty(globalThis, name, {
      value: dom.window[name],
      configurable: true,
      writable: true,
    });
  }
}

vi.mock('@salla.sa/twilight-components-react/slider', () => {
  const SallaSlider = ({
    type,
    id,
    centered,
    autoPlay,
    autoplay,
    showControls,
    controlsOuter,
    slidesPerView,
    sliderConfig,
    className,
    children,
    onSlideChange,
    ...props
  }: Record<string, unknown>) => {
    // Mirror the Stencil wrapper: onSlideChange listens to the element's `slideChange` event.
    const bindEvents = (el: HTMLElement | null) => {
      if (!el || typeof onSlideChange !== 'function') return;
      const handler = onSlideChange as EventListener;
      el.addEventListener('slideChange', handler);
      return () => el.removeEventListener('slideChange', handler);
    };
    const hasAutoplay = autoplay || autoPlay;
    const attrs: Record<string, string> = {};
    if (type) attrs.type = String(type);
    if (id) attrs.id = String(id);
    if (centered) attrs.centered = 'true';
    if (hasAutoplay) attrs['auto-play'] = 'true';
    if (showControls !== undefined) attrs['show-controls'] = String(showControls);
    if (controlsOuter) attrs['controls-outer'] = 'true';
    if (slidesPerView) attrs['slides-per-view'] = String(slidesPerView);
    if (sliderConfig) attrs['slider-config'] = JSON.stringify(sliderConfig);
    if (className) attrs.class = String(className);
    return React.createElement('salla-slider', { ref: bindEvents, ...attrs, ...props }, children);
  };
  // Same element either way; the core just skips the deferred-hydration skeleton.
  return { SallaSlider, SallaSliderCore: SallaSlider };
});

vi.mock('@salla.sa/twilight-components-react/rating-stars', () => ({
  SallaRatingStars: ({ value, size, reviews, withLabel, ...props }: Record<string, unknown>) => {
    const attrs: Record<string, string> = {};
    if (value !== undefined) attrs.value = String(value);
    if (size) attrs.size = String(size);
    if (reviews !== undefined) attrs.reviews = String(reviews);
    if (withLabel) attrs['with-label'] = 'true';
    return React.createElement('salla-rating-stars', { ...attrs, ...props });
  },
}));

// Real one defers hydration behind IntersectionObserver, which jsdom lacks.
// No attributes: nothing asserts on them, unlike the mocks above.
vi.mock('@salla.sa/twilight-components-react/add-product-button', () => ({
  SallaAddProductButton: () => React.createElement('salla-add-product-button'),
}));

// Same deferred hydration as above; the tag and class are what the product page asserts on.
vi.mock('@salla.sa/twilight-components-react/social-share', () => ({
  SallaSocialShare: ({ className }: { className?: string }) =>
    React.createElement('salla-social-share', { className }),
}));
vi.mock('@salla.sa/twilight-components-react/quick-order', () => ({
  SallaQuickOrder: ({ className }: { className?: string }) =>
    React.createElement('salla-quick-order', { className }),
}));

// The ✕ stands in for every way the real modal closes itself (✕, backdrop, Escape).
vi.mock('@salla.sa/twilight-components-react/modal', () => ({
  SallaModal: ({
    visible,
    children,
    onModalVisibilityChanged,
  }: {
    visible?: boolean;
    children?: React.ReactNode;
    onModalVisibilityChanged?: (e: { detail: boolean }) => void;
  }) =>
    visible ? (
      <div role="dialog">
        <button
          type="button"
          aria-label="close"
          onClick={() => onModalVisibilityChanged?.({ detail: false })}
        />
        {children}
      </div>
    ) : null,
}));

vi.mock('@salla.sa/twilight-components-react', () => ({
  ItemsList: ({
    items: initialItems = [],
    loader,
    mode,
    resetKey,
    end,
    empty,
    t,
    children,
    itemsClassName,
  }: {
    items?: unknown[];
    loader?: () => Promise<{ items: unknown[]; next: string | null }>;
    mode?: 'infinite' | 'button' | 'static' | 'once';
    resetKey?: unknown;
    end?: React.ReactNode;
    empty?: React.ReactNode;
    t?: (key: string, fallback?: string) => string;
    children?: (items: unknown[]) => React.ReactNode;
    itemsClassName?: string;
  }) => {
    const [items, setItems] = React.useState(initialItems);
    const paginated = mode === 'button' || mode === 'infinite';
    const [hasMore, setHasMore] = React.useState(paginated);
    const sentinelRef = React.useRef<HTMLDivElement>(null);

    // Mirrors the real component: new `items` replace the list only when the
    // sync trigger changes (resetKey, else the array itself), and only when
    // they are non-empty. Otherwise the first items stay.
    const syncTrigger = resetKey !== undefined ? resetKey : initialItems;
    const previousTrigger = React.useRef(syncTrigger);
    React.useEffect(() => {
      if (previousTrigger.current === syncTrigger) return;
      previousTrigger.current = syncTrigger;
      if (initialItems.length > 0) {
        setItems(initialItems);
        setHasMore(paginated);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [syncTrigger]);

    const loadMore = async () => {
      if (!loader) return;

      const result = await loader();
      setItems((current) => [...current, ...result.items]);
      setHasMore(Boolean(result.next));
    };

    // Infinite mode loads when its sentinel scrolls into view.
    const showSentinel = mode === 'infinite' && hasMore;
    const onSentinelVisible = React.useEffectEvent(() => void loadMore());
    React.useEffect(() => {
      const sentinel = sentinelRef.current;
      if (!showSentinel || !sentinel || typeof IntersectionObserver === 'undefined') return;
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onSentinelVisible();
      });
      observer.observe(sentinel);
      return () => observer.disconnect();
    }, [showSentinel]);

    // Mirrors the real component: once the list is done it renders an end
    // marker with the resolved content — `end=""` trims to nothing and renders
    // none, a missing `end` falls back to the (non-empty) translated label.
    const translate = t ?? ((key: string, fallback?: string) => fallback ?? key);
    const endContent = end ?? translate('common.elements.end_of_content', 'End of content');
    const reachedEnd = items.length > 0 && !hasMore && mode !== 'once';
    const endMarker =
      reachedEnd && typeof endContent === 'string'
        ? endContent.trim()
          ? React.createElement('div', { className: 's-items-list-end' }, endContent)
          : null
        : reachedEnd
          ? endContent
          : null;

    return (
      <div>
        {/* Mirrors the real component: items sit in a wrapper carrying itemsClassName. */}
        {items.length > 0 ? (
          <div className={['s-items-list-items-wrapper', itemsClassName].filter(Boolean).join(' ')}>
            {children?.(items)}
          </div>
        ) : (
          empty
        )}
        {mode === 'button' && hasMore ? (
          <button type="button" onClick={loadMore}>
            Load More
          </button>
        ) : null}
        {showSentinel ? <div ref={sentinelRef} className="s-items-list-sentinel" /> : null}
        {endMarker}
      </div>
    );
  },
  SallaButton: ({
    href,
    children,
    className,
    onClick,
    ariaLabel,
    disabled,
    loading,
    type = 'button',
  }: Record<string, unknown>) =>
    href ? (
      <a
        href={href as string}
        className={className as string}
        onClick={onClick as React.MouseEventHandler<HTMLAnchorElement>}
      >
        {children as React.ReactNode}
      </a>
    ) : (
      <button
        type={type as 'button' | 'submit' | 'reset'}
        className={className as string}
        onClick={onClick as React.MouseEventHandler<HTMLButtonElement>}
        aria-label={ariaLabel as string}
        disabled={disabled as boolean}
        data-loading={loading ? '' : undefined}
      >
        {children as React.ReactNode}
      </button>
    ),
  SallaProductsSlider: ({
    loader,
    children,
    blockTitle,
    sliderProps,
    displayAllUrl,
  }: Record<string, unknown>) => {
    const [items, setItems] = React.useState<unknown[]>([]);
    React.useEffect(() => {
      (loader as () => Promise<{ items: unknown[] }>)().then((result) => {
        setItems(result.items);
      });
    }, [loader]);
    return (
      <div
        data-testid="salla-products-slider"
        data-block-title={blockTitle ?? ''}
        data-slider-id={(sliderProps as Record<string, unknown>)?.id ?? ''}
        data-display-all-url={displayAllUrl ?? ''}
      >
        {items.map((item, index) =>
          (children as (item: unknown, index: number) => React.ReactNode)(item, index)
        )}
      </div>
    );
  },
}));
