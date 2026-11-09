import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Brands } from '../../../app/components/home/Brands';

// Mock the sub-path exports
vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({
    locale: 'ar',
    direction: 'rtl',
    isRTL: true,
    isLTR: false,
    languageName: 'العربية',
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock('@salla.sa/twilight-theme-engine/common', () => ({
  Link: ({
    to,
    children,
    className,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} className={className} {...props}>
      {children}
    </a>
  ),
  Image: ({
    src,
    alt,
    className,
    objectFit: _objectFit,
    noWrapper: _noWrapper,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { objectFit?: string; noWrapper?: boolean }) => (
    <img src={src} alt={alt} className={className} loading="lazy" {...props} />
  ),
}));

describe('Brands', () => {
  const mockBrands = [
    { id: 1, name: 'Brand 1', logo: 'logo1.png', url: '/brand/1' },
    { id: 2, name: 'Brand 2', logo: 'logo2.png', url: '/brand/2' },
    { id: 3, name: 'Brand 3', logo: 'logo3.png', url: '/brand/3' },
  ];

  it('renders title when provided', () => {
    const { container } = render(<Brands data={{ brands: mockBrands, title: 'Our Brands' }} />);
    expect(container.querySelector('h2')?.textContent).toBe('Our Brands');
  });

  it('renders "View All" link when show_all is true', () => {
    const { container } = render(<Brands data={{ brands: mockBrands, show_all: true }} />);
    const link = container.querySelector('.s-block__display-all');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('/brands');
  });

  it('renders brand items in a horizontal list', () => {
    const { container } = render(<Brands data={{ brands: mockBrands }} />);
    const brandItems = container.querySelectorAll('.brands-home__item');
    expect(container.querySelector('.brands-home__list')).toBeTruthy();
    expect(brandItems.length).toBe(3);
  });

  it('returns null when no brands', () => {
    const { container } = render(<Brands data={{ brands: [] }} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders brand logos as lazy images inside clipped tiles', () => {
    const { container } = render(<Brands data={{ brands: mockBrands }} />);
    const link = container.querySelector('.brands-home__link');
    const tile = link?.querySelector('.brands-home__item');
    const logo = tile?.querySelector('img.brands-home__logo');

    expect(link?.getAttribute('href')).toBe('/brand/1');
    expect(link?.getAttribute('aria-label')).toBe('Brand 1');
    expect(tile).toBeTruthy();
    expect(logo?.getAttribute('src')).toBe('logo1.png');
    expect(logo?.getAttribute('width')).toBe('160');
    expect(logo?.getAttribute('fetchpriority')).toBe('low');
    expect(logo?.getAttribute('height')).toBe('160');
    expect(logo?.getAttribute('loading')).toBe('lazy');
  });
});
