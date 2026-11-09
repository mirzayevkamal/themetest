import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

const promise = vi.hoisted(() => ({ value: null as string | null }));
vi.mock('../../../app/hooks/useDeliveryPromise', () => ({
  useDeliveryPromise: () => promise.value,
}));
import {
  BrandsPlaceholder,
  EnhancedSliderPlaceholder,
  EnhancedSquareBannersPlaceholder,
  HomeSkeleton,
  MainLinksPlaceholder,
  ProductsSliderPlaceholder,
  PromotionalBannerPlaceholder,
  SliderProductsWithHeaderPlaceholder,
} from '../../../app/components/home/placeholders';

describe('homepage placeholders', () => {
  beforeEach(() => {
    promise.value = null;
  });

  it('gives each product card skeleton the real rows: price, 2-line name, promise only when sent', () => {
    const rows = () =>
      [...container().querySelectorAll('.s-product-card-content')][0].children.length;
    let view = render(<ProductsSliderPlaceholder />);
    const container = () => view.container;
    expect(rows()).toBe(2);
    expect(
      container().querySelector('.s-product-card-content > .s-product-card-content-title-skeleton')
    ).toBeTruthy();
    view.unmount();

    promise.value = '15 دقيقة';
    view = render(<ProductsSliderPlaceholder />);
    expect(rows()).toBe(3);
  });

  it('sizes the products slider skeleton title like the real heading, hidden from assistive tech', () => {
    const { container } = render(<ProductsSliderPlaceholder />);
    const heading = container.querySelector('.s-slider-block__title-right h2');
    expect(heading?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.min-h-\\[41px\\]')).toBeNull();
  });

  it('matches the promotional banner bar', () => {
    const { container } = render(<PromotionalBannerPlaceholder />);
    // One full-width block: the real bar's tinted background would show through a text-only bar.
    expect(container.querySelector('.promotional-banner')).toBeNull();
    expect(container.querySelector('.shimmer')?.className).toContain('h-10');
    expect(container.querySelector('.animate-pulse')).toBeNull();
  });

  it('matches enhanced-slider slides so desktop CSS can size them', () => {
    const { container } = render(<EnhancedSliderPlaceholder />);
    expect(container.querySelector('.home-banner-slider')).toBeTruthy();
    expect(container.querySelectorAll('.home-banner-slider__slide')).toHaveLength(4);
  });

  it('matches the products slider title and grocery cards', () => {
    const { container } = render(<ProductsSliderPlaceholder />);
    expect(container.querySelector('.s-slider-block__title')).toBeTruthy();
    expect(container.querySelectorAll('.s-products-slider-card')).toHaveLength(10);
    expect(container.querySelectorAll('.s-product-card')).toHaveLength(10);
    expect(container.querySelector('.s-product-card-image')).toBeTruthy();
    expect(container.querySelector('.s-product-card-content')).toBeTruthy();
  });

  it('can omit the products slider title for the header-overlap block', () => {
    const { container } = render(<ProductsSliderPlaceholder withTitle={false} />);
    expect(container.querySelector('.s-slider-block__title')).toBeNull();
    expect(container.querySelectorAll('.s-product-card')).toHaveLength(10);
  });

  it('matches main-links title and eight tiles', () => {
    const { container } = render(<MainLinksPlaceholder />);
    expect(container.querySelector('.main-links-grid')).toBeTruthy();
    expect(container.querySelector('.s-slider-block__title')).toBeTruthy();
    expect(container.querySelectorAll('.main-links-grid__items > *')).toHaveLength(8);
    expect(container.querySelector('.main-links-slider__thumb')).toBeTruthy();
  });

  it('matches brands logo row', () => {
    const { container } = render(<BrandsPlaceholder />);
    expect(container.querySelector('.brands-home__list')).toBeTruthy();
    expect(container.querySelectorAll('.brands-home__item')).toHaveLength(8);
  });

  it('wraps each brand tile in the shrink-0 link so flex keeps them 80px squares', () => {
    const { container } = render(<BrandsPlaceholder />);
    expect(
      container.querySelectorAll('.brands-home__list > .brands-home__link > .brands-home__item')
    ).toHaveLength(8);
    expect(container.querySelector('.brands-home__title > .h-7\\.5')).toBeTruthy();
  });

  it('matches a 200px square banner', () => {
    const { container } = render(<EnhancedSquareBannersPlaceholder />);
    expect(container.querySelector('.banner-entry.h-banner')).toBeTruthy();
  });

  it('matches slider-products-with-header background plus overlapping cards', () => {
    const { container } = render(<SliderProductsWithHeaderPlaceholder />);
    expect(container.querySelector('.slider-products-with-header')).toBeTruthy();
    expect(container.querySelector('.slider-bg')).toBeTruthy();
    expect(container.querySelector('.s-slider-block__title')).toBeNull();
    expect(container.querySelectorAll('.s-product-card')).toHaveLength(10);
  });

  it('HomeSkeleton is the above-the-fold grocery blocks, not the engine grids', () => {
    const { container } = render(<HomeSkeleton />);
    expect(container.querySelector('.s-block--promotional-banner')).toBeTruthy();
    expect(container.querySelector('.s-block--products-slider')).toBeTruthy();
    expect(container.querySelector('.s-block--main-links')).toBeTruthy();
    expect(container.querySelector('.skeleton-block-hero')).toBeNull();
    expect(container.querySelector('.s-skeleton-products-slider')).toBeNull();
  });
});
