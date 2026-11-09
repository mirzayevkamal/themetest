import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  PromotionalBanner,
  getPromotionalBannerClassName,
} from '../../../app/components/home/PromotionalBanner';

vi.mock('@salla.sa/twilight-theme-engine/common', () => ({
  Link: ({
    to,
    className,
    children,
  }: {
    to: string;
    className?: string;
    children?: React.ReactNode;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

const messages = [
  {
    icon_image: 'https://cdn.example.com/promotion.svg',
    highlight_text: 'توصيل مجاني',
    text: 'لطلبك الاول',
    url: '/offers',
  },
  { highlight_text: 'خصم 25%', text: 'على الخضروات الطازجة' },
];

describe('PromotionalBanner', () => {
  it('returns null without visible message content', () => {
    const { container } = render(
      <PromotionalBanner data={{ messages: [{ text: ' ', highlight_text: ' ' }] }} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders a single message as a static banner', () => {
    const { container } = render(<PromotionalBanner data={{ messages: [messages[0]] }} />);

    expect(container.querySelector('salla-slider')).toBeNull();
    expect(container.querySelector('.promotional-banner__message')?.textContent).toBe(
      'توصيل مجاني لطلبك الاول'
    );
  });

  it('renders the configured image on both sides of the message', () => {
    const { container } = render(<PromotionalBanner data={{ messages: [messages[0]] }} />);
    const icons = container.querySelectorAll('.promotional-banner__icon');

    expect(icons).toHaveLength(2);
    expect(icons[0].getAttribute('src')).toBe('https://cdn.example.com/promotion.svg');
    expect(icons[0].getAttribute('alt')).toBe('');
    expect(icons[0].getAttribute('width')).toBe('24');
    expect(icons[0].getAttribute('height')).toBe('24');
  });

  it('renders no image when the merchant leaves the image field empty', () => {
    const { container } = render(
      <PromotionalBanner data={{ messages: [{ text: 'رسالة بدون أيقونة' }] }} />
    );

    expect(container.querySelector('.promotional-banner__icon')).toBeNull();
  });

  it('renders the highlighted text separately from the remaining message', () => {
    const { container } = render(<PromotionalBanner data={{ messages: [messages[0]] }} />);

    expect(container.querySelector('.promotional-banner__highlight')?.textContent).toBe(
      'توصيل مجاني'
    );
    expect(container.querySelector('.promotional-banner__text')?.textContent).toBe(
      'توصيل مجاني لطلبك الاول'
    );
  });

  it('auto-rotates when more than one message is configured', () => {
    const { container } = render(
      <PromotionalBanner data={{ messages, position: 2, show_controls: true }} />
    );
    const slider = container.querySelector('salla-slider');

    expect(slider?.getAttribute('id')).toBe('promotional-banner-2');
    expect(slider?.getAttribute('slides-per-view')).toBe('1');
    expect(slider?.getAttribute('auto-play')).toBe('true');
    expect(slider?.getAttribute('show-controls')).toBe('false');
    // Config travels as an attribute so the SSR'd element boots with it.
    expect(JSON.parse(slider?.getAttribute('slider-config') ?? '{}')).toMatchObject({
      loop: true,
      watchOverflow: true,
    });
  });

  it('repeats short rotating lists so Swiper can loop without empty slides', () => {
    const { container } = render(<PromotionalBanner data={{ messages }} />);

    expect(container.querySelectorAll('.promotional-banner__slide')).toHaveLength(4);
  });

  it('applies the configured full-banner background color', () => {
    const { container } = render(
      <PromotionalBanner data={{ messages: [messages[0]], background_color: '#E7FFFA' }} />
    );

    expect(
      (container.querySelector('.promotional-banner') as HTMLElement).style.backgroundColor
    ).toBe('rgb(231, 255, 250)');
  });

  it('applies the configured highlight color and keeps the CSS default when unset', () => {
    const { container, rerender } = render(
      <PromotionalBanner data={{ messages: [messages[0]] }} />
    );
    const banner = () => container.querySelector('.promotional-banner') as HTMLElement;

    expect(banner().style.getPropertyValue('--promotional-banner-highlight')).toBe('');

    rerender(
      <PromotionalBanner data={{ messages: [messages[0]], highlight_color: '#00AA55' }} />
    );

    expect(banner().style.getPropertyValue('--promotional-banner-highlight')).toBe('#00AA55');
  });

  it('links the complete message only when it has a usable URL', () => {
    const { container } = render(<PromotionalBanner data={{ messages: [messages[0]] }} />);

    expect(container.querySelector('a')?.getAttribute('href')).toBe('/offers');
    expect(container.querySelectorAll('a')).toHaveLength(1);
  });

  it('adds the merge class only when the merchant enables it', () => {
    expect(getPromotionalBannerClassName({ merge_with_top_component: false })).toBe(
      's-block s-block--promotional-banner'
    );
    expect(getPromotionalBannerClassName({ merge_with_top_component: true })).toBe(
      's-block s-block--promotional-banner merge-with-top-component'
    );
  });
});
