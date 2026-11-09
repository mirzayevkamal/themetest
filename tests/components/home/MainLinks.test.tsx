import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MainLinks, getMainLinksClassName } from '../../../app/components/home/MainLinks';

vi.mock('@salla.sa/twilight-theme-engine/common', () => ({
  Link: ({
    to,
    children,
    className,
    target,
  }: {
    to: string;
    children?: React.ReactNode;
    className?: string;
    target?: string;
  }) => (
    <a href={to} className={className} target={target}>
      {children}
    </a>
  ),
  Image: ({ priority: _p, objectFit: _o, noWrapper: _n, ...props }: Record<string, unknown>) => (
    <img {...props} />
  ),
}));

describe('MainLinks', () => {
  const mockLinks = [
    { url: '/cat1', icon: 'sicon-cat1', title: 'Category 1' },
    { url: '/cat2', icon: 'sicon-cat2', title: 'Category 2' },
  ];

  const mockCategories = [
    { url: '/cat1', name: 'Category 1', icon: 'sicon-cat1' },
    { url: '/cat2', name: 'Category 2', image: 'cat2.jpg' },
  ];

  it('always renders a grid and never a slider', () => {
    const { container } = render(
      <MainLinks data={{ links: mockLinks, position: 1, show_controls: true }} />
    );
    expect(container.querySelector('salla-slider')).toBeNull();
    expect(container.querySelector('.swiper-slide')).toBeNull();
    expect(container.querySelector('.main-links-grid')).toBeTruthy();
    expect(container.querySelector('#main-links-1')).toBeTruthy();
    expect(container.querySelectorAll('.main-links-grid__items > *')).toHaveLength(2);
  });

  it('renders every item, including lists longer than one row', () => {
    const links = Array.from({ length: 9 }, (_, index) => ({
      url: `/cat${index}`,
      icon: 'sicon-cat',
      title: `Category ${index}`,
    }));
    const { container } = render(<MainLinks data={{ links }} />);
    expect(container.querySelectorAll('.main-links-grid__items > *')).toHaveLength(9);
  });

  it('still renders a custom link when the title is empty', () => {
    const { container } = render(
      <MainLinks data={{ links: [{ url: '/untitled', icon: 'sicon-cat' }] }} />
    );
    expect(container.querySelectorAll('.main-links-grid__items > *')).toHaveLength(1);
    expect(container.querySelector('.slide--cat-entry')?.getAttribute('href')).toBe('/untitled');
  });

  it('renders links with icon', () => {
    const { container } = render(<MainLinks data={{ links: mockLinks }} />);
    const icon = container.querySelector('.slide--cat-entry i');
    expect(icon?.className).toBe('sicon-cat1');
  });

  it('renders links with title', () => {
    const { container } = render(<MainLinks data={{ links: mockLinks }} />);
    const title = container.querySelector('.slide--cat-entry h2');
    expect(title?.textContent).toBe('Category 1');
  });

  it('renders categories when show_cats is true', () => {
    const { container } = render(
      <MainLinks data={{ categories: mockCategories, show_cats: true }} />
    );
    const items = container.querySelectorAll('.main-links-slider__slide');
    expect(items.length).toBe(2);
  });

  it('renders category with image', () => {
    const { container } = render(
      <MainLinks data={{ categories: mockCategories, show_cats: true }} />
    );
    const img = container.querySelector('.slide--cat-entry img');
    expect(img?.getAttribute('src')).toBe('cat2.jpg');
    expect(img?.getAttribute('width')).toBe('192');
    expect(img?.getAttribute('height')).toBe('192');
    // Beside the hero on the first screen: the hero's bytes go first.
    expect(img?.getAttribute('fetchpriority')).toBe('low');
  });

  it('leaves the category image unnamed so the link reads its title once', () => {
    const { container } = render(
      <MainLinks data={{ categories: mockCategories, show_cats: true }} />
    );
    const link = container.querySelector('.slide--cat-entry img')?.closest('a');
    expect(link?.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(link?.textContent).toBe('Category 2');
  });

  it('renders the section title', () => {
    const { container } = render(<MainLinks data={{ links: mockLinks, title: 'طازج يومي' }} />);
    expect(container.querySelector('.s-slider-block__title h2')?.textContent).toBe('طازج يومي');
  });

  it('adds the merge class when the merchant enables it', () => {
    expect(getMainLinksClassName({ links: mockLinks })).toBe('s-block s-block--main-links');
    expect(
      getMainLinksClassName({
        links: mockLinks,
        merge_with_top_component: true,
        title: 'طازج يومي',
      })
    ).toBe('s-block s-block--main-links merge-with-top-component');
    expect(getMainLinksClassName({ links: mockLinks, merge_with_top_component: true })).toBe(
      's-block s-block--main-links merge-with-top-component merged-has-no-title'
    );
  });

  it('paints the tiles in the merchant colour, the default wash otherwise', () => {
    const thumb = (data: Parameters<typeof MainLinks>[0]['data']) =>
      render(<MainLinks data={data} />).container.querySelector<HTMLElement>(
        '.main-links-slider__thumb'
      );
    expect(thumb({ links: mockLinks })?.style.backgroundColor).toBe('');
    expect(thumb({ links: mockLinks, tile_background: '#F2FBFF' })?.style.backgroundColor).toBe(
      'rgb(242, 251, 255)'
    );
  });

  it('returns null when no links', () => {
    const { container } = render(<MainLinks data={{ links: [] }} />);
    expect(container.firstChild).toBeNull();
  });
});
