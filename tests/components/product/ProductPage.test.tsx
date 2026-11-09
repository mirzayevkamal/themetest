import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@salla.sa/twilight-theme-engine/types';
import { ProductPage } from '../../../app/components/product/ProductPage';

const breadcrumbSawReferrer = vi.hoisted(() => [] as (string | null)[]);

vi.mock('@salla.sa/twilight-components-react/comments', () => ({
  SallaComments: () => <p>product comments</p>,
}));
vi.mock('@salla.sa/twilight-components-react/offer', () => ({ SallaOffer: () => null }));
const store: { features?: string[]; settings: Record<string, unknown> } = {
  settings: { rating: { show_on_product: true } },
};
vi.mock('@salla.sa/twilight-theme-engine', () => ({
  useTwilight: () => ({ theme: { settings: {} }, store }),
}));
const lazyChunk = vi.hoisted(() => ({ pending: false, promise: new Promise<never>(() => {}) }));
vi.mock('@salla.sa/twilight-theme-engine/components/common', () => ({
  Breadcrumb: () => {
    breadcrumbSawReferrer.push(sessionStorage.getItem('breadcrumb-referrer'));
    return null;
  },
  RenderWhenVisible: ({ children }: { children: React.ReactNode }) => {
    if (lazyChunk.pending) throw lazyChunk.promise;
    return <>{children}</>;
  },
}));
vi.mock('@salla.sa/twilight-theme-engine/components/product', () => ({
  AddToCartForm: () => null,
}));
vi.mock('@salla.sa/twilight-theme-engine/hooks', () => ({
  HookSlot: ({ name }: { name: string }) => <div data-hook-slot={name} />,
  useComments: () => ({ commentsKey: 0 }),
  useProduct: (product: Product) => ({ product }),
}));
// `/home` and `/components/home` resolve to one module, so both mocks need the same exports.
const homeMock = vi.hoisted(() => () => ({
  Testimonials: () => <p>store testimonials</p>,
  PageBlocks: ({ hook, scope }: { hook: string; scope: unknown }) => (
    <div data-page-blocks={hook} data-scope={JSON.stringify(scope)} />
  ),
}));
vi.mock('@salla.sa/twilight-theme-engine/home', homeMock);
vi.mock('@salla.sa/twilight-theme-engine/components/home', homeMock);
const openDeliverySheet = vi.fn(() => Promise.resolve());
vi.mock('../../../app/hooks/useBulletDelivery', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../app/hooks/useBulletDelivery')>()),
  openDeliverySheet: () => openDeliverySheet(),
}));
vi.mock('../../../app/components/product/ProductActionBar', () => ({
  // Its class only: the inline and docked bars mark where the page places them.
  ProductActionBar: ({ className }: { className?: string }) => <div className={className} />,
}));
vi.mock('../../../app/components/product/ProductGallery', () => ({
  ProductGalleryStage: () => null,
}));
vi.mock('../../../app/components/product/ProductInfo', () => ({ ProductInfo: () => null }));
vi.mock('../../../app/components/product/RelatedProducts', () => ({
  RelatedProducts: () => null,
  RelatedProductsSkeleton: () => null,
}));

describe('ProductPage', () => {
  it("renders the merchant's blocks and app hooks at the classic product hooks", () => {
    const { container } = render(<ProductPage product={{ id: 7, name: 'تفاح' } as Product} />);
    const blocks = Array.from(container.querySelectorAll('[data-page-blocks]'));

    expect(blocks.map((el) => el.getAttribute('data-page-blocks'))).toEqual([
      'product.single.before_product_info',
      'product:single.description.end',
      'product.single.before_product_recommendations',
      'product.single.after_product_recommendations',
      'product.single.before_customer_reviews',
    ]);
    expect(new Set(blocks.map((el) => el.getAttribute('data-scope')))).toEqual(
      new Set(['{"product_id":"7"}'])
    );
    expect(
      container.querySelector(
        '.s-blocks-wrapper.s-before-reviews [data-hook-slot="product.single.before_customer_reviews"]'
      )
    ).toBeTruthy();
  });

  it("puts Salla's quick order after the inline buy bar, as Raed and Twig do after the form", () => {
    const { container } = render(<ProductPage product={{ id: 7, name: 'تفاح' } as Product} />);
    const details = container.querySelector('.product-page__details');
    const quickOrder = details?.querySelector('salla-quick-order.product-page__quick-order');
    const inlineBar = details?.querySelector('.product-page__buy--inline');
    expect(quickOrder).toBeTruthy();
    expect(inlineBar).toBeTruthy();
    expect(
      inlineBar!.compareDocumentPosition(quickOrder!) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(details?.lastElementChild).toBe(quickOrder);
  });

  it('keeps one block scope when the details replace the list-card placeholder', () => {
    const { container, rerender } = render(
      <ProductPage product={{ id: 7, name: 'تفاح' } as Product} isPreview />
    );
    const scope = () => container.querySelector('[data-page-blocks]')?.getAttribute('data-scope');
    const before = scope();

    rerender(<ProductPage product={{ id: '7', name: 'تفاح' } as unknown as Product} />);
    expect(scope()).toBe(before);
  });

  it('drops the stored breadcrumb referrer so the trail keeps the product category', () => {
    sessionStorage.setItem(
      'breadcrumb-referrer',
      JSON.stringify({ name: 'البحث عن (حليب)', url: '/search?q=حليب' })
    );
    breadcrumbSawReferrer.length = 0;
    render(<ProductPage product={{ id: 7, name: 'تفاح' } as Product} />);
    // Gone before the breadcrumb's first render, not just after the page mounts.
    expect(breadcrumbSawReferrer.length).toBeGreaterThan(0);
    expect(breadcrumbSawReferrer.every((seen) => seen === null)).toBe(true);
    expect(sessionStorage.getItem('breadcrumb-referrer')).toBeNull();
  });

  it("keeps the page rendering while the engine's lazy RenderWhenVisible chunk loads", () => {
    lazyChunk.pending = true;
    // A rated product renders the comments boundary too, so both lazy sections are covered.
    const { container, queryByText } = render(
      <React.Suspense fallback={<p>page suspended</p>}>
        <ProductPage product={{ id: 7, name: 'تفاح', rating: { count: 3 } } as Product} />
      </React.Suspense>
    );
    lazyChunk.pending = false;
    expect(queryByText('page suspended')).toBeNull();
    expect(container.querySelector('.product-page__details')).toBeTruthy();
  });

  it("shows the product's comments but not the store testimonials", () => {
    render(<ProductPage product={{ id: 7, name: 'تفاح', rating: { count: 3 } } as Product} />);
    expect(screen.getByText('product comments')).toBeTruthy();
    expect(screen.queryByText('store testimonials')).toBeNull();
  });

  // The SDK mounts salla-delivery-promise outside React; its header emits an open event.
  function mountPromiseHeader(container: HTMLElement) {
    const promise = document.createElement('salla-delivery-promise');
    const header = document.createElement('div');
    header.className = 's-delivery-promise-header';
    const componentHandler = vi.fn();
    header.addEventListener('click', componentHandler);
    promise.append(header);
    container.querySelector('.product-page__details')!.append(promise);
    return { header, componentHandler };
  }

  it('opens the theme address sheet from the promise header with Bullet Delivery', () => {
    store.features = ['bullet-delivery-v2'];
    store.settings.bullet_delivery = { enabled: true };
    const { container } = render(<ProductPage product={{ id: 7, name: 'تفاح' } as Product} />);
    expect(container.querySelector('.product-page--bullet-delivery')).toBeTruthy();
    const { header, componentHandler } = mountPromiseHeader(container);

    fireEvent.click(header);
    expect(openDeliverySheet).toHaveBeenCalledTimes(1);
    expect(componentHandler).not.toHaveBeenCalled();
    delete store.features;
    delete store.settings.bullet_delivery;
    openDeliverySheet.mockClear();
  });

  it("leaves the promise header to the component's city picker without Bullet Delivery", () => {
    const { container } = render(<ProductPage product={{ id: 7, name: 'تفاح' } as Product} />);
    expect(container.querySelector('.product-page--bullet-delivery')).toBeNull();
    const { header, componentHandler } = mountPromiseHeader(container);

    fireEvent.click(header);
    expect(componentHandler).toHaveBeenCalledTimes(1);
    expect(openDeliverySheet).not.toHaveBeenCalled();
  });
});
