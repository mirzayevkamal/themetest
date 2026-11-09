import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { EnhancedSquareBanners } from '../../../app/components/home/EnhancedSquareBanners';

// Mock the sub-path exports
vi.mock('@salla.sa/twilight-theme-engine/common', () => ({
  Link: ({
    to,
    children,
    className,
    'aria-label': ariaLabel,
    style,
  }: {
    to: string;
    children?: React.ReactNode;
    className?: string;
    'aria-label'?: string;
    style?: React.CSSProperties;
  }) => (
    <a href={to} className={className} aria-label={ariaLabel} style={style}>
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

describe('EnhancedSquareBanners', () => {
  const mockBanners = [
    { image: 'banner1.jpg', url: '/url1', title: 'Banner 1', description: 'Desc 1' },
    { image: 'banner2.jpg', url: '/url2', title: 'Banner 2', description: 'Desc 2' },
    { image: 'banner3.jpg', url: '/url3' },
  ];

  it('renders banner items', () => {
    const { container } = render(<EnhancedSquareBanners data={{ banners: mockBanners }} />);
    const banners = container.querySelectorAll('.banner-entry');
    expect(banners.length).toBe(3);
  });

  it('adds has-overlay class when title exists', () => {
    const { container } = render(<EnhancedSquareBanners data={{ banners: mockBanners }} />);
    const banner = container.querySelector('.banner-entry');
    expect(banner?.className).toContain('has-overlay');
  });

  it('renders banner title', () => {
    const { container } = render(<EnhancedSquareBanners data={{ banners: mockBanners }} />);
    const title = container.querySelector('.banner__title');
    expect(title?.textContent).toBe('Banner 1');
  });

  it('uses h-banner for any banner count', () => {
    const { container: few } = render(<EnhancedSquareBanners data={{ banners: mockBanners }} />);
    expect(few.querySelector('.banner-entry')?.className).toContain('h-banner');
    expect(few.querySelector('.banner-entry')?.className).not.toContain('h-lg-banner');

    const { container: many } = render(
      <EnhancedSquareBanners
        data={{
          banners: [
            ...mockBanners,
            { image: 'banner4.jpg', url: '/url4' },
            { image: 'banner5.jpg', url: '/url5' },
          ],
        }}
      />
    );
    expect(many.querySelector('.banner-entry')?.className).toContain('h-banner');
    expect(many.querySelector('.banner-entry')?.className).not.toContain('h-lg-banner');
  });

  it('renders a lazy image filling the link', () => {
    const { container } = render(<EnhancedSquareBanners data={{ banners: mockBanners }} />);
    const img = container.querySelector('.banner-entry img');
    expect(img?.getAttribute('src')).toBe('banner1.jpg');
    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(img?.className).toContain('absolute');
  });

  it('returns null when no banners', () => {
    const { container } = render(<EnhancedSquareBanners data={{ banners: [] }} />);
    expect(container.firstChild).toBeNull();
  });
});
