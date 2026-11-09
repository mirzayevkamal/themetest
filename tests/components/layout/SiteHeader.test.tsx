import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { SiteHeader } from '../../../app/components/layout/SiteHeader';

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

const themeSettings: Record<string, unknown> = {};
const shipping: { express_delivery_promise?: string | null } = {};
vi.mock('@salla.sa/twilight-theme-engine/providers', () => ({
  useTwilight: () => ({ theme: { settings: themeSettings }, store: { shipping } }),
}));

vi.mock('@salla.sa/twilight-theme-engine/hooks/useStore', () => ({
  useStore: () => ({ name: 'الدكان', logo: 'https://cdn.salla.sa/other/logo.png' }),
}));

vi.mock('@salla.sa/twilight-theme-engine/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@salla.sa/twilight-theme-engine/common')>();
  return {
    ...actual,
    Link: ({ to, children, ...props }: { to?: string; children?: React.ReactNode }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

describe('SiteHeader', () => {
  it('shows the API delivery promise even if the retired theme switch is still saved off', () => {
    shipping.express_delivery_promise = '15 دقيقة';
    themeSettings.show_delivery_promise = false;
    expect(render(<SiteHeader />).container.textContent).toContain('15 دقيقةونوصلك');
    delete themeSettings.show_delivery_promise;
  });

  it('title-cases the delivery promise line', () => {
    shipping.express_delivery_promise = '30 minutes';
    const { container } = render(<SiteHeader />);
    expect(container.querySelector('.mobile-header__promise')?.classList).toContain('capitalize');
  });

  it('hides the delivery promise when the store has none for the location', () => {
    shipping.express_delivery_promise = null;
    expect(render(<SiteHeader />).container.textContent).not.toContain('ونوصلك');
  });

  it('follows the promise when the shopper location changes while mounted', () => {
    shipping.express_delivery_promise = null;
    const { container, rerender } = render(<SiteHeader />);
    expect(container.textContent).not.toContain('ونوصلك');
    shipping.express_delivery_promise = '30 دقيقة';
    rerender(<SiteHeader />);
    expect(container.textContent).toContain('30 دقيقةونوصلك');
    shipping.express_delivery_promise = null;
    rerender(<SiteHeader />);
    expect(container.textContent).not.toContain('ونوصلك');
  });

  it('tags the promise line for the topnav_is_dark styles', () => {
    shipping.express_delivery_promise = '30 دقيقة';
    const { container } = render(<SiteHeader />);
    expect(container.querySelector('.mobile-header__promise')?.textContent).toBe('30 دقيقةونوصلك');
  });

  it('gives the logo explicit dimensions so it cannot shift the header', () => {
    const img = render(<SiteHeader />).container.querySelector('img');
    expect(img?.getAttribute('width')).toBe('105');
    expect(img?.getAttribute('height')).toBe('32');
    expect(img?.getAttribute('fetchPriority')).toBe('low');
  });

  it('serves the logo at 2x and 3x for high-density phones', () => {
    const img = render(<SiteHeader />).container.querySelector('img');
    expect(img?.getAttribute('sizes')).toBe('105px');
    expect(img?.getAttribute('srcset')).toMatch(/width=315\b[^,]* 315w/);
  });

  it('keeps the light bar and logo at the end by default, with no badge', () => {
    const { container } = render(<SiteHeader />);
    const header = container.querySelector('header')!;
    expect(header.className).toContain('bg-brand-reverse');
    expect(header.className).not.toContain('mobile-header--brand');
    expect(container.querySelector('.mobile-header__badge')).toBeNull();
    expect(header.firstElementChild?.lastElementChild?.tagName).toBe('A');
  });

  it('switches to the brand bar', () => {
    shipping.express_delivery_promise = '15 دقيقة';
    themeSettings.header_style = 'brand';
    const { container } = render(<SiteHeader />);
    expect(container.querySelector('header')?.className).toContain('mobile-header--brand bg-brand');
    delete themeSettings.header_style;
  });

  it('paints the promise in the header promise colour, not the card one', () => {
    shipping.express_delivery_promise = '15 دقيقة';
    const color = () =>
      render(<SiteHeader />).container.querySelector<HTMLElement>('.delivery-promise-value')?.style
        .color;
    themeSettings.delivery_promise_color = '#F89817';
    expect(color()).toBe('');
    themeSettings.header_promise_color = '#FFFFFF';
    expect(color()).toBe('rgb(255, 255, 255)');
    themeSettings.header_style = 'brand';
    expect(color()).toBe('rgb(255, 255, 255)');
    delete themeSettings.header_style;
    delete themeSettings.header_promise_color;
    delete themeSettings.delivery_promise_color;
  });

  it('leaves the promise to the dark bar white text when topnav_is_dark is on', () => {
    shipping.express_delivery_promise = '15 دقيقة';
    Object.assign(themeSettings, { topnav_is_dark: true, header_promise_color: '#F89817' });
    const value = render(<SiteHeader />).container.querySelector<HTMLElement>(
      '.delivery-promise-value'
    );
    expect(value?.style.color).toBe('');
    delete themeSettings.topnav_is_dark;
    delete themeSettings.header_promise_color;
  });

  it('puts the optional badge opposite the logo', () => {
    themeSettings.header_badge_image = 'https://cdn.salla.sa/badge.png';
    const row = () => render(<SiteHeader />).container.querySelector('header')!.firstElementChild!;

    let r = row();
    expect(r.querySelector('.mobile-header__badge')).toBe(r.children[1]);
    expect(r.lastElementChild?.tagName).toBe('A');

    themeSettings.header_logo_position = 'start';
    r = row();
    expect(r.children[1].tagName).toBe('A');
    expect(r.lastElementChild?.classList.contains('mobile-header__badge')).toBe(true);

    delete themeSettings.header_badge_image;
    delete themeSettings.header_logo_position;
  });
});
