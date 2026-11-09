// The core (un-deferred) slider: the wrapped SallaSlider SSRs a hero-image
// skeleton until it scrolls into view, which is the wrong shape for a 40px
// text ticker and shifts the layout. The core renders the messages directly.
import type { CSSProperties } from 'react';
import { SallaSliderCore as SallaSlider } from '@salla.sa/twilight-components-react/slider';
import { Link } from '@salla.sa/twilight-theme-engine/common';
import { useHydrated } from '../../hooks/useHydrated';

const MIN_ITEMS_FOR_LOOP = 4;

// `loop` lives here rather than as an attribute: the wrapper treats `loop` as
// an element property (client-only), and the element only reads props at init.
const SLIDER_CONFIG = {
  watchOverflow: true,
  loop: true,
} as const;

// Attributes, not wrapper props: the React wrapper only assigns props on the
// client, so the SSR'd element would run on its defaults (controls on) until
// hydration. The element parses these attributes itself.
const SLIDER_ATTRS: Record<string, string> = {
  'slides-per-view': '1',
  'auto-play': 'true',
  'show-controls': 'false',
  'slider-config': JSON.stringify(SLIDER_CONFIG),
};

export interface PromotionalBannerItem {
  id?: string | number;
  icon_image?: string;
  text?: string;
  highlight_text?: string;
  url?: string;
}

export interface PromotionalBannerData {
  messages?: PromotionalBannerItem[];
  background_color?: string;
  highlight_color?: string;
  merge_with_top_component?: boolean;
  position?: number;
  [key: string]: unknown;
}

export interface PromotionalBannerProps {
  data: PromotionalBannerData;
}

function repeatItemsForLoop<T>(items: T[]): T[] {
  if (items.length < 2 || items.length >= MIN_ITEMS_FOR_LOOP) return items;

  const copies = Math.ceil(MIN_ITEMS_FOR_LOOP / items.length);
  return Array.from({ length: copies * items.length }, (_, index) => items[index % items.length]);
}

function hasUsableUrl(url?: string): url is string {
  return typeof url === 'string' && url.trim() !== '' && url !== '#';
}

function BannerIcon({ src }: { src?: string }) {
  if (!src?.trim()) return null;

  return (
    <img
      src={src}
      alt=""
      width="24"
      height="24"
      className="promotional-banner__icon"
      loading="lazy"
      decoding="async"
    />
  );
}

function BannerMessage({ message }: { message: PromotionalBannerItem }) {
  const content = (
    <>
      <BannerIcon src={message.icon_image} />
      <span className="promotional-banner__text" dir="auto">
        {message.highlight_text && (
          <span className="promotional-banner__highlight">{message.highlight_text}</span>
        )}
        {message.highlight_text && message.text ? ' ' : null}
        {message.text}
      </span>
      <BannerIcon src={message.icon_image} />
    </>
  );

  return hasUsableUrl(message.url) ? (
    <Link to={message.url} className="promotional-banner__message">
      {content}
    </Link>
  ) : (
    <span className="promotional-banner__message">{content}</span>
  );
}

export function getPromotionalBannerClassName(data: PromotionalBannerData): string {
  return [
    's-block',
    's-block--promotional-banner',
    data.merge_with_top_component ? 'merge-with-top-component' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function RotatingBannerMessages({
  hydrated,
  position,
  messages,
}: {
  hydrated: boolean;
  position: number;
  messages: PromotionalBannerItem[];
}) {
  const id = `promotional-banner-${position}`;
  const slides = (
    <div slot="items">
      {repeatItemsForLoop(messages).map((message, index) => (
        <div
          key={`${message.id ?? message.url ?? message.text ?? 'message'}-${index}`}
          className="promotional-banner__slide swiper-slide"
        >
          <BannerMessage message={message} />
        </div>
      ))}
    </div>
  );

  if (!hydrated) {
    return (
      <div id={id} className="promotional-banner__slider">
        {slides}
      </div>
    );
  }

  return (
    <SallaSlider id={id} className="promotional-banner__slider" {...SLIDER_ATTRS}>
      {slides}
    </SallaSlider>
  );
}

export function PromotionalBanner({ data }: PromotionalBannerProps) {
  const hydrated = useHydrated();
  const {
    messages = [],
    background_color: backgroundColor,
    highlight_color: highlightColor,
    position = 1,
  } = data;
  const visibleMessages = messages.filter(
    (message) => message.text?.trim() || message.highlight_text?.trim()
  );

  if (!visibleMessages.length) return null;

  const style =
    backgroundColor || highlightColor
      ? ({
          ...(backgroundColor ? { backgroundColor } : {}),
          ...(highlightColor ? { '--promotional-banner-highlight': highlightColor } : {}),
        } as CSSProperties)
      : undefined;
  const shouldRotate = visibleMessages.length > 1;

  return (
    <div className="promotional-banner" style={style}>
      <div className="promotional-banner__inner">
        {shouldRotate ? (
          <RotatingBannerMessages
            hydrated={hydrated}
            position={position}
            messages={visibleMessages}
          />
        ) : (
          <BannerMessage message={visibleMessages[0]} />
        )}
      </div>
    </div>
  );
}
