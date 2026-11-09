import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category } from '@salla.sa/twilight-theme-engine/types';

const list = vi.hoisted(() => vi.fn());
const loadMore = vi.hoisted(() => vi.fn());
const intersections: Array<{
  callback: IntersectionObserverCallback;
  target?: Element;
}> = [];

class IntersectionObserverMock {
  readonly root = null;
  readonly rootMargin = '0px';
  readonly thresholds = [0.01];
  private readonly intersection: (typeof intersections)[number];

  constructor(callback: IntersectionObserverCallback) {
    this.intersection = { callback };
    intersections.push(this.intersection);
  }

  observe(target: Element) {
    this.intersection.target = target;
  }

  disconnect() {}
  unobserve() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);

// Like the engine, the list key ends with the active scope; SSR has none.
const activeScope = vi.hoisted(() => ({ current: null as { id: number } | null }));

vi.mock('@salla.sa/twilight-theme-engine/api/product', () => ({
  product: {
    list: (params: unknown) => loadMore(params),
    queries: {
      list: (params: unknown) => ({
        queryKey: ['products', 'list', params, { scope: activeScope.current }],
        queryFn: () => list(params),
      }),
    },
  },
}));

const returning = vi.hoisted(() => ({ value: false }));
vi.mock('../../../app/lib/scrollRestoration', () => ({
  returningInHistory: () => returning.value,
}));

const themeSettings: Record<string, unknown> = {};
vi.mock('@salla.sa/twilight-theme-engine/providers', () => ({
  useTwilight: () => ({ theme: { settings: themeSettings } }),
}));

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

const lazyChunk = vi.hoisted(() => ({ pending: false, promise: new Promise<never>(() => {}) }));

vi.mock('@salla.sa/twilight-theme-engine/common', () => ({
  Link: ({
    to,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  NoContent: ({ icon, message }: { icon: string; message: string }) => (
    <div className="no-content-placeholder">
      <i className={`${icon} icon`} />
      <p>{message}</p>
    </div>
  ),
  RenderWhenVisible: (props: {
    children: React.ReactNode;
    id: string;
    className: string;
    placeholder: React.ReactNode;
    renderOnMount?: boolean;
    estimatedHeight?: string;
  }) => {
    if (lazyChunk.pending) throw lazyChunk.promise;
    return <MockRenderWhenVisible {...props} />;
  },
}));

function MockRenderWhenVisible({
  children,
  id,
  className,
  placeholder,
  renderOnMount = false,
  estimatedHeight = '400px',
}: {
  children: React.ReactNode;
  id: string;
  className: string;
  placeholder: React.ReactNode;
  renderOnMount?: boolean;
  estimatedHeight?: string;
}) {
  const ref = React.useRef<HTMLElement>(null);
  const [visible, setVisible] = React.useState(renderOnMount);
  // Like the engine's: turning renderOnMount on later mounts the section too.
  if (renderOnMount && !visible) setVisible(true);

  React.useEffect(() => {
    const element = ref.current;
    if (!element || renderOnMount) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible(true);
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    // The engine's floor until hydration, which jsdom tests never leave.
    <section ref={ref} id={id} className={className} style={{ minHeight: estimatedHeight }}>
      {visible ? children : placeholder}
    </section>
  );
}

vi.mock('@salla.sa/twilight-theme-engine/home', () => ({
  PageBlocks: ({ hook, scope }: { hook: string; scope: unknown }) => (
    <div data-page-blocks={hook} data-scope={JSON.stringify(scope)} />
  ),
}));
vi.mock('@salla.sa/twilight-theme-engine/hooks', () => ({
  HookSlot: ({ name }: { name: string }) => <div data-hook-slot={name} />,
}));

vi.mock('../../../app/components/product', () => ({
  ProductCard: ({
    product,
    imageSizes,
    imagePriority,
  }: {
    product: { name: string };
    imageSizes?: string;
    imagePriority?: boolean;
  }) => (
    <article data-image-sizes={imageSizes} data-image-priority={imagePriority ? '' : undefined}>
      {product.name}
    </article>
  ),
}));

vi.mock('@salla.sa/twilight-theme-engine/routes/product-listing', () => ({
  parseFiltersFromSearch: (search: string) => {
    const min = new URLSearchParams(search).get('filters[price][min]');
    return min ? { price: { min } } : null;
  },
}));

const storeSettings = vi.hoisted(() => ({ product: {} as Record<string, unknown> }));
vi.mock('@salla.sa/twilight-theme-engine/hooks/useStore', () => ({
  useStore: () => ({ settings: storeSettings }),
}));

vi.mock('../../../app/components/filters/FiltersDrawer', () => ({
  FiltersDrawer: ({ open, filters }: { open: boolean; filters?: Array<{ key: string }> }) =>
    open ? (
      <div role="dialog">{filters ? filters.map((f) => f.key).join(',') : 'loading'}</div>
    ) : null,
}));

import { CategoryListPage } from '../../../app/components/categories/CategoryListPage';
import { resetFiltersDrawerForTests } from '../../../app/hooks/useFiltersDrawer';

const subcategory = {
  id: 'rice',
  id_: 653986054,
  name: 'Rice and Pasta',
  url: '/rice/c653986054',
  sub_categories: [],
} as Category;

const secondSubcategory = {
  id: 'pasta',
  id_: 653986055,
  name: 'Pasta',
  url: '/pasta/c653986055',
  sub_categories: [],
} as Category;

const parentCategory = {
  id: 'pantry',
  id_: 100,
  name: 'Pantry',
  url: '/pantry/c100',
  sub_categories: [subcategory, secondSubcategory],
} as Category;

// One section, so the next section's on-mount fetch stays out of single-list assertions.
const singleSectionParent = { ...parentCategory, sub_categories: [subcategory] } as Category;

function showSection(category: Category) {
  const target = document.getElementById(`category-section-${category.id}`);
  const intersection = intersections.find((item) => item.target === target);

  if (!target) throw new Error(`Missing section for ${category.name}`);
  // The landing section renders on mount and never gets an observer.
  if (!intersection) return;

  act(() => {
    intersection.callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
  });
}

// Scrolls a section's infinite-scroll sentinel into view, or back out of it.
async function reachListEnd(index = 0, inView = true) {
  await waitFor(() =>
    expect(document.querySelectorAll('.s-items-list-sentinel')[index]).toBeTruthy()
  );
  const target = document.querySelectorAll('.s-items-list-sentinel')[index];
  const intersection = intersections.find((item) => item.target === target);

  act(() => {
    intersection?.callback(
      [
        {
          isIntersecting: inView,
          intersectionRatio: inView ? 1 : 0,
          target,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver
    );
  });
}

function renderPage({ hideHeader = false, parent = parentCategory } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <CategoryListPage
        page={{ title: parent.name, slug: 'category' }}
        categories={[parent]}
        activeParent={parent}
        hideHeader={hideHeader}
      />
    </QueryClientProvider>
  );
}

// jsdom has no layout: growth above a section moves it down by hand.
let sectionTop = 0;
Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
  configurable: true,
  get: () => sectionTop,
});
// The mounted sections' first pages are in: no placeholder left.
const sectionsLoaded = () =>
  waitFor(() =>
    expect(document.querySelector('[id^="category-section-"] .animate-pulse')).toBeNull()
  );
// Lets a mocked fetch settle.
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));
const growAbove = (resize: () => void) =>
  act(() => {
    sectionTop += 100;
    resize();
  });

describe('CategoryListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    intersections.length = 0;
    activeScope.current = null;
  });

  it("renders the category's merchant blocks and app hooks above and below the products", () => {
    list.mockResolvedValue({ items: [], next: null });
    const { container } = renderPage();
    const blocks = Array.from(container.querySelectorAll('[data-page-blocks]'));

    expect(blocks.map((el) => el.getAttribute('data-page-blocks'))).toEqual([
      'product.index.before_products_group_with_filter',
      'product.index.after_products_group_with_filter',
    ]);
    expect(blocks.map((el) => el.getAttribute('data-scope'))).toEqual([
      '{"category_id":100}',
      '{"category_id":100}',
    ]);
    expect(
      container.querySelector(
        '.s-blocks-wrapper.s-after-products-list [data-hook-slot="product.index.after_products_group_with_filter"]'
      )
    ).toBeTruthy();
  });

  it('keeps the sections reachable by the desktop chip-jump offset selector', () => {
    list.mockResolvedValue({ items: [], next: null });
    const { container } = renderPage();
    const sections = container.querySelectorAll(
      '.category-page > .category-toolbar ~ .container > *'
    );

    expect(sections.length).toBe(parentCategory.sub_categories!.length);
    expect(sections[0].id).toBe(`category-section-${subcategory.id}`);
  });

  it('spaces the mobile grid like Figma: 16px page gutter, 16px rows, 8px columns', async () => {
    list.mockResolvedValue({ items: [{ id: 2, name: 'Jasmine Rice' }], next: null });
    const { container } = renderPage();

    // Skeleton while the products load.
    const skeleton = container.querySelector('.category-products-grid');
    expect(skeleton?.className).toContain('gap-x-2');
    expect(skeleton?.className).toContain('gap-y-4');

    // The loaded grid, holding the product.
    const grid = (await screen.findAllByText('Jasmine Rice'))[0].closest('.category-products-grid');
    expect(grid?.className).toContain('gap-x-2');
    expect(grid?.className).toContain('gap-y-4');
    expect(grid?.className).not.toMatch(/(^|\s)gap-2(\s|$)/);

    const containers = [...container.querySelectorAll('.category-page .container')];
    expect(containers.length).toBeGreaterThan(0);
    containers.forEach((el) => expect(el.className).toContain('px-4'));
  });

  describe('keeping the active chip in view', () => {
    let restore: () => void;
    const scrollBy = vi.fn();

    beforeEach(() => {
      scrollBy.mockClear();
      Element.prototype.scrollIntoView = vi.fn();
      (Element.prototype as { scrollBy: unknown }).scrollBy = scrollBy;
      // The active chip sits past the row's visible edge.
      const rect = vi
        .spyOn(Element.prototype, 'getBoundingClientRect')
        .mockImplementation(function (this: Element) {
          if (this.getAttribute('aria-current') === 'true') return new DOMRect(-200, 0, 100, 30);
          return new DOMRect(0, 0, 300, 30);
        });
      restore = () => rect.mockRestore();
    });
    afterEach(() => restore());

    const renderDeepLink = () =>
      render(
        <QueryClientProvider client={new QueryClient()}>
          <CategoryListPage
            page={{ title: parentCategory.name, slug: 'category' }}
            categories={[parentCategory]}
            activeParent={parentCategory}
            activeSub={secondSubcategory}
          />
        </QueryClientProvider>
      );

    it('brings a deep-linked chip into view on load', () => {
      list.mockReturnValue(new Promise(() => {}));
      renderDeepLink();
      expect(scrollBy).toHaveBeenCalledTimes(1);
    });

    it('leaves a row the shopper scrolled before load where it is, then follows the chip', () => {
      list.mockReturnValue(new Promise(() => {}));
      const scrolled = vi.spyOn(Element.prototype, 'scrollLeft', 'get').mockReturnValue(-120);
      try {
        renderDeepLink();
        expect(scrollBy).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Rice and Pasta' }));
        expect(scrollBy).toHaveBeenCalledTimes(1);
      } finally {
        scrolled.mockRestore();
      }
    });
  });

  it('scopes the blocks to the deep-linked sub-category', () => {
    list.mockResolvedValue({ items: [], next: null });
    Element.prototype.scrollIntoView = vi.fn();
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <CategoryListPage
          page={{ title: parentCategory.name, slug: 'category' }}
          categories={[parentCategory]}
          activeParent={parentCategory}
          activeSub={secondSubcategory}
        />
      </QueryClientProvider>
    );

    expect(container.querySelector('[data-page-blocks]')?.getAttribute('data-scope')).toBe(
      '{"category_id":653986055}'
    );
  });

  it("keeps the page rendering while the engine's lazy RenderWhenVisible chunk loads", () => {
    list.mockResolvedValue({ items: [], next: null });
    lazyChunk.pending = true;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container, queryByText } = render(
      <React.Suspense fallback={<p>page suspended</p>}>
        <QueryClientProvider client={queryClient}>
          <CategoryListPage
            page={{ title: parentCategory.name, slug: 'category' }}
            categories={[parentCategory]}
            activeParent={parentCategory}
          />
        </QueryClientProvider>
      </React.Suspense>
    );
    lazyChunk.pending = false;
    expect(queryByText('page suspended')).toBeNull();
    expect(container.querySelector('.category-toolbar')).toBeTruthy();
    expect(container.querySelector(`#category-section-${subcategory.id}`)).toBeTruthy();
  });

  it('names the page with a visually hidden h1, left to the host sheet when headerless', () => {
    list.mockReturnValue(new Promise(() => {}));
    const { unmount } = renderPage();
    const heading = screen.getByRole('heading', { level: 1, name: 'Pantry' });
    expect(heading.className).toBe('sr-only');
    unmount();

    renderPage({ hideHeader: true });
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('marks the active tab and chip per accent_style, brand text by default', () => {
    list.mockReturnValue(new Promise(() => {}));
    const { unmount } = renderPage();
    expect(screen.getByRole('link', { name: 'Pantry' }).className).toContain('text-brand');
    expect(screen.getByRole('button', { name: 'Rice and Pasta' }).className).toContain(
      'text-brand-deep'
    );
    unmount();

    themeSettings.accent_style = 'outlined';
    renderPage();
    const tab = screen.getByRole('link', { name: 'Pantry' }).className;
    expect(tab).toContain('border-brand text-ink');
    const chip = screen.getByRole('button', { name: 'Rice and Pasta' }).className;
    expect(chip).toContain('border-brand text-ink');
    expect(chip).not.toContain('text-brand-deep');
    delete themeSettings.accent_style;
  });

  it("borders the other chips with a faint tint of the merchant's brand colour", () => {
    list.mockReturnValue(new Promise(() => {}));
    renderPage();
    const chip = screen.getByRole('button', { name: 'Pasta' }).className;
    expect(chip).toContain('bg-white border-brand-tint text-ink');
    expect(chip).not.toContain('mint');
  });

  it('keeps the SSR cards while the scoped client query refetches them', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const params = { source: 'categories', sourceValue: subcategory.id_, perPage: 32 };
    // What the server dehydrated: fetched before the SDK supplied a scope.
    queryClient.setQueryData(['products', 'list', params, { scope: null }], {
      items: [{ id: 1, name: 'Basmati Rice' }],
      next: null,
    });
    activeScope.current = { id: 7 };
    list.mockReturnValue(new Promise(() => {}));

    render(
      <QueryClientProvider client={queryClient}>
        <CategoryListPage
          page={{ title: parentCategory.name, slug: 'category' }}
          categories={[singleSectionParent]}
          activeParent={singleSectionParent}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('Basmati Rice')).toBeTruthy();
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Basmati Rice')).toBeTruthy();
  });

  it('replaces the SSR cards with the scoped result once it lands', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const params = { source: 'categories', sourceValue: subcategory.id_, perPage: 32 };
    queryClient.setQueryData(['products', 'list', params, { scope: null }], {
      items: [{ id: 1, name: 'Basmati Rice' }],
      next: null,
    });
    activeScope.current = { id: 7 };
    list.mockResolvedValue({ items: [{ id: 2, name: 'Jasmine Rice' }], next: null });

    render(
      <QueryClientProvider client={queryClient}>
        <CategoryListPage
          page={{ title: parentCategory.name, slug: 'category' }}
          categories={[parentCategory]}
          activeParent={parentCategory}
        />
      </QueryClientProvider>
    );

    const rice = document.getElementById('category-section-rice')!;
    expect(within(rice).getByText('Basmati Rice')).toBeTruthy();
    expect(await within(rice).findByText('Jasmine Rice')).toBeTruthy();
    expect(within(rice).queryByText('Basmati Rice')).toBeNull();
  });

  it('shows the empty state when the scoped result has no products', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const params = { source: 'categories', sourceValue: subcategory.id_, perPage: 32 };
    queryClient.setQueryData(['products', 'list', params, { scope: null }], {
      items: [{ id: 1, name: 'Basmati Rice' }],
      next: null,
    });
    activeScope.current = { id: 7 };
    list.mockResolvedValue({ items: [], next: null });

    render(
      <QueryClientProvider client={queryClient}>
        <CategoryListPage
          page={{ title: parentCategory.name, slug: 'category' }}
          categories={[parentCategory]}
          activeParent={parentCategory}
        />
      </QueryClientProvider>
    );

    expect(await screen.findByText('No products found in this category')).toBeTruthy();
    expect(screen.queryByText('Basmati Rice')).toBeNull();
  });

  it('jumps to the deep-linked sub-category section once on load', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const page = (sub: Category) => (
      <QueryClientProvider client={queryClient}>
        <CategoryListPage
          page={{ title: parentCategory.name, slug: 'category' }}
          categories={[parentCategory]}
          activeParent={parentCategory}
          activeSub={sub}
        />
      </QueryClientProvider>
    );

    // The lazy sections must observe the viewport only once it is at the target section.
    const order: string[] = [];
    scrollIntoView.mockImplementation(() => order.push('jump'));
    const observe = vi
      .spyOn(IntersectionObserverMock.prototype, 'observe')
      .mockImplementation(() => order.push('observe'));

    const { rerender } = render(page(secondSubcategory));
    observe.mockRestore();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    // html scrolls smoothly, so 'auto' would animate; the jump must land before paint.
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'instant', block: 'start' });
    expect(order[0]).toBe('jump');
    expect(order).toContain('observe');
    expect(screen.getByRole('button', { name: 'Pasta' }).className).toContain('font-bold');

    rerender(page({ ...secondSubcategory }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('keeps the deep-linked section under the toolbar while sections above it grow', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    let resize: () => void = () => {};
    const resizeObserver = globalThis.ResizeObserver;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      }
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <CategoryListPage
          page={{ title: parentCategory.name, slug: 'category' }}
          categories={[parentCategory]}
          activeParent={parentCategory}
          activeSub={secondSubcategory}
        />
      </QueryClientProvider>
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    // A section above swaps its skeleton for products: the target is re-pinned, instantly.
    growAbove(resize);
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'instant', block: 'start' });

    // Once the shopper scrolls, later growth above must not yank the page back.
    fireEvent.wheel(window);
    growAbove(resize);
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    vi.stubGlobal('ResizeObserver', resizeObserver);
  });

  it('lets go of the pin when the page is reused for the parent or reached through history', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    let resize: () => void = () => {};
    const resizeObserver = globalThis.ResizeObserver;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      }
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const page = (sub?: Category) => (
      <QueryClientProvider client={queryClient}>
        <CategoryListPage
          page={{ title: parentCategory.name, slug: 'category' }}
          categories={[parentCategory]}
          activeParent={parentCategory}
          activeSub={sub}
        />
      </QueryClientProvider>
    );

    // Sub-category, then its parent tab on the same page: growth no longer pulls it back.
    const { rerender } = render(page(secondSubcategory));
    rerender(page(undefined));
    growAbove(resize);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    // Back to the sub-category: the jump runs, but the router's saved position must stay.
    returning.value = true;
    rerender(page(secondSubcategory));
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    growAbove(resize);
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    returning.value = false;
    vi.stubGlobal('ResizeObserver', resizeObserver);
  });

  it('lands a chip jump on its section while the sections it passes grow', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    let resize: () => void = () => {};
    const resizeObserver = globalThis.ResizeObserver;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      }
    );
    list.mockResolvedValue({ items: [], next: null });
    renderPage();
    const pasta = document.getElementById(`category-section-${secondSubcategory.id}`);
    await sectionsLoaded();

    fireEvent.click(screen.getByRole('button', { name: 'Pasta' }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' });

    // A passed section reports its size without moving the target, or renders in place a
    // pixel taller than its placeholder: no restart from rest, the landing absorbs it.
    act(() => resize());
    act(() => {
      sectionTop += 1;
      resize();
    });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    // A passed section loads its next page mid-flight: the animation is re-aimed, not cut.
    growAbove(resize);
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' });

    // The jump ends: one exact landing, then later growth above still holds it in place.
    act(() => {
      window.dispatchEvent(new Event('scrollend'));
    });
    expect(scrollIntoView).toHaveBeenCalledTimes(3);
    expect(scrollIntoView.mock.instances[2]).toBe(pasta);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'instant', block: 'start' });
    growAbove(resize);
    expect(scrollIntoView).toHaveBeenCalledTimes(4);

    // The shopper scrolls on: growth no longer pulls the page back.
    fireEvent.touchStart(window);
    growAbove(resize);
    expect(scrollIntoView).toHaveBeenCalledTimes(4);
    vi.stubGlobal('ResizeObserver', resizeObserver);
  });

  it('jumps at once, without waiting, to a chip whose passed sections have not loaded', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    list.mockReturnValue(new Promise(() => {}));
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Pasta' }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'instant', block: 'start' });
    expect(document.querySelector('[data-jumping]')).toBeNull();
  });

  it('ends a chip jump when the page stops scrolling, not partway through a long flight', async () => {
    vi.useFakeTimers();
    try {
      const scrollIntoView = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoView;
      list.mockResolvedValue({ items: [], next: null });
      renderPage();
      await act(() => vi.advanceTimersByTimeAsync(50));

      fireEvent.click(screen.getByRole('button', { name: 'Pasta' }));
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' });
      // Passed lists hide their loading row while it flies.
      expect(document.querySelector('[data-jumping]')).not.toBeNull();

      // Two seconds of smooth scrolling: no snap while it is still moving.
      for (let i = 0; i < 10; i++) {
        await act(() => vi.advanceTimersByTimeAsync(200));
        act(() => {
          window.dispatchEvent(new Event('scroll'));
        });
      }
      expect(scrollIntoView).toHaveBeenCalledTimes(1);

      // Quiet without a scrollend (Safari before 26): one exact landing.
      await act(() => vi.advanceTimersByTimeAsync(300));
      expect(scrollIntoView).toHaveBeenCalledTimes(2);
      expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'instant', block: 'start' });
      expect(document.querySelector('[data-jumping]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves a short server-rendered section its own height, with no reserved space below', () => {
    list.mockReturnValue(new Promise(() => {}));
    renderPage();

    const rice = document.getElementById(`category-section-${subcategory.id}`)!;
    expect(rice.style.minHeight).toBe('0px');
  });

  it('holds a full first page of placeholders for a section still loading', () => {
    list.mockReturnValue(new Promise(() => {}));
    renderPage();

    const pasta = document.getElementById(`category-section-${secondSubcategory.id}`)!;
    expect(pasta.querySelectorAll('.category-products-grid > *')).toHaveLength(32);
    // One pulse for the whole placeholder, not one per bar.
    expect(pasta.querySelectorAll('.animate-pulse')).toHaveLength(1);
  });

  it('loads every first page on mount, so the first chip tapped flies over sized placeholders', async () => {
    const third = { ...secondSubcategory, id: 'flour', id_: 653986056, name: 'Flour' };
    const parent = { ...parentCategory, sub_categories: [subcategory, secondSubcategory, third] };
    list.mockImplementation(async ({ sourceValue }: { sourceValue: number }) => ({
      items: [{ id: sourceValue, name: `Product ${sourceValue}` }],
      next: null,
    }));
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderPage({ parent });
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ sourceValue: third.id_ }));
    await settle();

    // Flour never reached the viewport: its placeholder holds its one card, not a page.
    const flour = document.getElementById(`category-section-${third.id}`)!;
    await waitFor(() =>
      expect(flour.querySelectorAll('.category-products-grid > *')).toHaveLength(1)
    );
    expect(screen.queryByText(`Product ${third.id_}`)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Flour' }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('keeps a section the jump flies past on its placeholder until it is back in view', async () => {
    const third = { ...secondSubcategory, id: 'flour', id_: 653986056, name: 'Flour' };
    const fourth = { ...secondSubcategory, id: 'sugar', id_: 653986057, name: 'Sugar' };
    const parent = {
      ...parentCategory,
      sub_categories: [subcategory, secondSubcategory, third, fourth],
    };
    list.mockImplementation(async ({ sourceValue }: { sourceValue: number }) => ({
      items: [{ id: sourceValue, name: `Product ${sourceValue}` }],
      next: null,
    }));
    Element.prototype.scrollIntoView = vi.fn();
    renderPage({ parent });
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Sugar' }));
    showSection(third);
    const flour = document.getElementById(`category-section-${third.id}`)!;
    expect(screen.queryByText(`Product ${third.id_}`)).toBeNull();
    expect(flour.querySelectorAll('.category-products-grid > *')).toHaveLength(1);

    // The flight carries on past Flour: it leaves the viewport.
    const flourInView = (isIntersecting: boolean) => {
      const own = intersections.find((item) => item.target && item.target.parentElement === flour);
      act(() => {
        own?.callback(
          [{ isIntersecting, target: own.target } as IntersectionObserverEntry],
          {} as IntersectionObserver
        );
      });
    };
    flourInView(false);

    // Landed past it: Flour stays a placeholder, nothing renders on landing.
    act(() => {
      window.dispatchEvent(new Event('scrollend'));
    });
    await settle();
    expect(screen.queryByText(`Product ${third.id_}`)).toBeNull();

    // The shopper scrolls back up to it: it renders in place.
    flourInView(true);
    expect(await screen.findByText(`Product ${third.id_}`)).toBeTruthy();
  });

  it('holds the next page of a section a chip jump passes until the jump ends', async () => {
    const third = { ...secondSubcategory, id: 'flour', id_: 653986056, name: 'Flour' };
    const parent = { ...parentCategory, sub_categories: [subcategory, secondSubcategory, third] };
    list.mockImplementation(async ({ sourceValue }: { sourceValue: number }) => ({
      items: [{ id: sourceValue, name: `Product ${sourceValue}` }],
      next: `https://api.example.test/products?cursor=${sourceValue}-2`,
    }));
    loadMore.mockImplementation(async ({ cursor }: { cursor: string }) => ({
      items: [{ id: cursor, name: `Page ${cursor}` }],
      next: null,
    }));
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderPage({ parent });
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Pasta' }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });

    // Flying past Rice's end: no page. Pasta, the target, still pages.
    await reachListEnd(0);
    await reachListEnd(1);
    expect(await screen.findByText(`Page ${secondSubcategory.id_}-2`)).toBeTruthy();
    expect(loadMore).toHaveBeenCalledTimes(1);

    // The jump lands; the shopper scrolls back up to Rice's end, and it pages.
    act(() => {
      window.dispatchEvent(new Event('scrollend'));
    });
    await reachListEnd(0, false);
    await reachListEnd(0);
    expect(await screen.findByText(`Page ${subcategory.id_}-2`)).toBeTruthy();
    expect(loadMore).toHaveBeenCalledTimes(2);
  });

  it('selects the first chip of a newly opened parent tab', () => {
    Element.prototype.scrollIntoView = vi.fn();
    const otherParent = {
      id: 'dairy',
      id_: 200,
      name: 'Dairy',
      url: '/dairy/c200',
      sub_categories: [
        { id: 'milk', id_: 201, name: 'Milk', url: '/milk/c201', sub_categories: [] },
        { id: 'cheese', id_: 202, name: 'Cheese', url: '/cheese/c202', sub_categories: [] },
      ],
    } as Category;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const page = (parent: Category) => (
      <QueryClientProvider client={queryClient}>
        <CategoryListPage
          page={{ title: parent.name, slug: 'category' }}
          categories={[parentCategory, otherParent]}
          activeParent={parent}
        />
      </QueryClientProvider>
    );

    const { rerender } = render(page(parentCategory));
    fireEvent.click(screen.getByRole('button', { name: 'Pasta' }));
    rerender(page(otherParent));

    expect(screen.getByRole('button', { name: 'Milk' }).className).toContain('font-bold');
    expect(screen.getByRole('button', { name: 'Cheese' }).className).not.toContain('font-bold');
  });

  it('sizes the tab and chip rows to their content so the end padding scrolls into view', () => {
    list.mockReturnValue(new Promise(() => {}));
    renderPage();

    const rows = [
      screen.getByRole('navigation'),
      screen.getByRole('button', { name: 'Pasta' }).parentElement!,
    ];
    for (const row of rows) {
      expect(row.className).toMatch(/\bw-max\b/);
      expect(row.className).toMatch(/\bmin-w-full\b/);
      expect(row.className).toMatch(/\bmax-w-none\b/);
    }
  });

  describe('scroll-spy', () => {
    const tops: Record<string, number> = {};
    let restore: () => void;

    beforeEach(() => {
      Element.prototype.scrollIntoView = vi.fn();
      const rect = vi
        .spyOn(Element.prototype, 'getBoundingClientRect')
        .mockImplementation(function (this: Element) {
          const top = tops[this.id] ?? 0;
          const bottom = this.classList.contains('category-toolbar') ? 160 : top;
          return new DOMRect(0, top, 0, bottom - top);
        });
      const frame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        cb(0);
        return 0;
      });
      restore = () => {
        rect.mockRestore();
        frame.mockRestore();
      };
    });

    afterEach(() => restore());

    const scrollTo = (riceTop: number, pastaTop: number) => {
      tops[`category-section-${subcategory.id}`] = riceTop;
      tops[`category-section-${secondSubcategory.id}`] = pastaTop;
      act(() => {
        document.body.dispatchEvent(new Event('scroll'));
      });
    };
    const isActive = (name: string) =>
      screen.getByRole('button', { name }).getAttribute('aria-current') === 'true';

    it('activates the chip of the section that reaches the toolbar, in any scroller', () => {
      list.mockReturnValue(new Promise(() => {}));
      renderPage();

      scrollTo(-300, 180);
      expect(isActive('Pasta')).toBe(true);

      scrollTo(100, 600);
      expect(isActive('Rice and Pasta')).toBe(true);
    });

    it('keeps the tapped chip while its smooth jump passes other sections', async () => {
      list.mockResolvedValue({ items: [], next: null });
      renderPage();
      await settle();
      scrollTo(-300, 180);

      fireEvent.click(screen.getByRole('button', { name: 'Rice and Pasta' }));
      await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
      scrollTo(-100, 400);
      expect(isActive('Rice and Pasta')).toBe(true);

      act(() => {
        window.dispatchEvent(new Event('scrollend'));
      });
      scrollTo(-300, 180);
      expect(isActive('Pasta')).toBe(true);
    });

    it("does not let an earlier jump's quiet timer release a later jump", async () => {
      vi.useFakeTimers();
      try {
        list.mockResolvedValue({ items: [], next: null });
        renderPage();
        await act(() => vi.advanceTimersByTimeAsync(50));

        fireEvent.click(screen.getByRole('button', { name: 'Rice and Pasta' }));
        await act(() => vi.advanceTimersByTimeAsync(200));
        fireEvent.click(screen.getByRole('button', { name: 'Pasta' }));
        await act(() => vi.advanceTimersByTimeAsync(150));
        scrollTo(100, 600);
        expect(isActive('Pasta')).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('activates a short last section once the scroller reaches its end', () => {
      list.mockReturnValue(new Promise(() => {}));
      renderPage();
      const metrics = { scrollTop: 500, clientHeight: 700, scrollHeight: 1200 };
      for (const [key, value] of Object.entries(metrics)) {
        Object.defineProperty(document.body, key, { configurable: true, value });
      }
      try {
        scrollTo(-300, 400);
        expect(isActive('Pasta')).toBe(true);
      } finally {
        for (const key of Object.keys(metrics)) Reflect.deleteProperty(document.body, key);
      }
    });
  });

  describe('auto-hiding the search bar', () => {
    let restore: () => void;

    beforeEach(() => {
      Element.prototype.scrollIntoView = vi.fn();
      const frame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        cb(0);
        return 0;
      });
      const height = vi
        .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
        .mockImplementation(function (this: HTMLElement) {
          return this.classList.contains('category-page-header') ? 57 : 0;
        });
      restore = () => {
        frame.mockRestore();
        height.mockRestore();
        Reflect.deleteProperty(document.body, 'scrollTop');
        delete themeSettings.category_header_auto_hide;
      };
    });

    afterEach(() => restore());

    const scrollPage = (top: number) => {
      Object.defineProperty(document.body, 'scrollTop', { configurable: true, value: top });
      act(() => {
        document.body.dispatchEvent(new Event('scroll'));
      });
    };
    const shift = (container: HTMLElement) =>
      container.querySelector<HTMLElement>('.category-toolbar')!.style.transform;

    it('slides the search bar away on scroll down and brings it back on scroll up', () => {
      list.mockReturnValue(new Promise(() => {}));
      const { container } = renderPage();

      scrollPage(400);
      expect(shift(container)).toBe('translateY(-57px)');

      scrollPage(300);
      expect(shift(container)).toBe('');
    });

    it('keeps the search bar while the page is within its height of the top', () => {
      list.mockReturnValue(new Promise(() => {}));
      const { container } = renderPage();

      scrollPage(40);
      expect(shift(container)).toBe('');
    });

    it('brings the search bar back when a chip is tapped, so the section lands under it', async () => {
      list.mockResolvedValue({ items: [], next: null });
      const { container } = renderPage();
      await settle();
      scrollPage(400);
      expect(shift(container)).toBe('translateY(-57px)');

      fireEvent.click(screen.getByRole('button', { name: 'Pasta' }));
      expect(shift(container)).toBe('');
    });

    it('keeps the search bar in place when the merchant turns the setting off', () => {
      themeSettings.category_header_auto_hide = false;
      list.mockReturnValue(new Promise(() => {}));
      const { container } = renderPage();

      scrollPage(400);
      expect(shift(container)).toBe('');
    });
  });

  it('marks only the routed page for the desktop header offsets, not the banner sheet', () => {
    list.mockReturnValue(new Promise(() => {}));
    const { container, unmount } = renderPage();
    expect(container.querySelector('.category-page > .category-toolbar')).not.toBeNull();
    unmount();
    const sheet = renderPage({ hideHeader: true });
    expect(sheet.container.querySelector('.category-page')).toBeNull();
  });

  it('loads every first page on mount, once each, and fetches nothing more as they show', async () => {
    list.mockResolvedValue({ items: [], next: null });
    const third = { ...secondSubcategory, id: 'flour', id_: 653986056, name: 'Flour' };
    const parent = { ...parentCategory, sub_categories: [subcategory, secondSubcategory, third] };
    // The engine's client keeps a page fresh for a minute.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <CategoryListPage
          page={{ title: parent.name, slug: 'category' }}
          categories={[parent]}
          activeParent={parent}
        />
      </QueryClientProvider>
    );

    await waitFor(() => expect(list).toHaveBeenCalledTimes(3));
    for (const section of [subcategory, secondSubcategory, third]) {
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ sourceValue: section.id_, perPage: 32 })
      );
    }

    showSection(third);
    await settle();
    expect(list).toHaveBeenCalledTimes(3);
  });

  it('lands on the deep-linked sub-category: it renders on mount, the first does not', async () => {
    list.mockResolvedValue({ items: [], next: null });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <CategoryListPage
          page={{ title: parentCategory.name, slug: 'category' }}
          categories={[parentCategory]}
          activeParent={parentCategory}
          activeSub={secondSubcategory}
        />
      </QueryClientProvider>
    );

    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({ sourceValue: secondSubcategory.id_ })
      )
    );
    // The first section's page is preloaded, but it is not rendered: still a placeholder.
    await settle();
    const rice = document.getElementById(`category-section-${subcategory.id}`)!;
    expect(rice.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('marks only the first row of the landing section as priority images', async () => {
    const names = (prefix: string) =>
      ['1', '2', '3', '4'].map((n, i) => ({ id: `${prefix}${i}`, name: `${prefix}${n}` }));
    list.mockImplementation(({ sourceValue }: { sourceValue: number }) =>
      Promise.resolve({ items: names(sourceValue === subcategory.id_ ? 'A' : 'B'), next: null })
    );

    renderPage();

    const priority = async (name: string) =>
      (await screen.findByText(name)).closest('article')?.hasAttribute('data-image-priority');
    expect(await priority('A1')).toBe(true);
    expect(await priority('A3')).toBe(true);
    expect(await priority('A4')).toBe(false);
    // The second section is in the HTML too, but its images must not compete with the landing row.
    for (const name of ['B1', 'B2', 'B3', 'B4']) expect(await priority(name)).toBe(false);
  });

  it('shows neither chips nor a section heading for a parent without sub-categories', async () => {
    list.mockResolvedValue({ items: [], next: null });
    const leafParent = { ...parentCategory, sub_categories: [] } as Category;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <CategoryListPage
          page={{ title: leafParent.name, slug: 'category' }}
          categories={[leafParent]}
          activeParent={leafParent}
        />
      </QueryClientProvider>
    );
    showSection(leafParent);

    expect(await screen.findByText('No products found in this category')).toBeTruthy();
    expect(screen.getByRole('link', { name: leafParent.name })).toBeTruthy();
    expect(screen.queryByRole('button', { name: leafParent.name })).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: leafParent.name })).toBeNull();
    expect(document.getElementById(`category-section-${leafParent.id}`)?.className).not.toContain(
      'scroll-mt-44'
    );
  });

  it('keeps the chip and heading for a parent with a single sub-category', async () => {
    list.mockResolvedValue({ items: [], next: null });
    const oneChild = { ...parentCategory, sub_categories: [subcategory] } as Category;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <CategoryListPage
          page={{ title: oneChild.name, slug: 'category' }}
          categories={[oneChild]}
          activeParent={oneChild}
        />
      </QueryClientProvider>
    );
    showSection(subcategory);

    expect(await screen.findByText('No products found in this category')).toBeTruthy();
    expect(screen.getByRole('button', { name: subcategory.name })).toBeTruthy();
    const heading = screen.getByRole('heading', { name: subcategory.name });
    expect(heading.className).toContain('h-6');
    expect(heading.className).toContain('truncate');
  });

  it('shows the standard category empty state when a category has no products', async () => {
    list.mockResolvedValue({ items: [], next: null });

    renderPage();
    showSection(subcategory);

    expect(await screen.findByText('No products found in this category')).toBeTruthy();
    expect(document.querySelector('.sicon-shopping-bag.icon')).toBeTruthy();
    expect(screen.getByRole('heading', { name: subcategory.name })).toBeTruthy();
  });

  it('renders product cards without the empty state when products are available', async () => {
    list.mockResolvedValue({ items: [{ id: 1, name: 'Basmati Rice' }], next: null });

    renderPage();
    showSection(subcategory);

    expect(await screen.findByText('Basmati Rice')).toBeTruthy();
    expect(screen.queryByText('No products found in this category')).toBeNull();
  });

  it('sizes card images for the widest card above the phone: the 148px app-webview column', async () => {
    list.mockResolvedValue({ items: [{ id: 1, name: 'Basmati Rice' }], next: null });

    renderPage();
    showSection(subcategory);

    const card = (await screen.findByText('Basmati Rice')).closest('article');
    expect(card?.getAttribute('data-image-sizes')).toBe('(min-width: 481px) 148px, 33vw');
  });

  it('fetches no next page from the server cursor before the scoped result lands', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const params = { source: 'categories', sourceValue: subcategory.id_, perPage: 32 };
    queryClient.setQueryData(['products', 'list', params, { scope: null }], {
      items: [{ id: 1, name: 'Basmati Rice' }],
      next: 'https://api.example.test/products?cursor=server-page-2',
    });
    activeScope.current = { id: 7 };
    let landScoped: (value: unknown) => void = () => {};
    list.mockReturnValue(new Promise((resolve) => (landScoped = resolve)));
    loadMore.mockResolvedValue({ items: [{ id: 3, name: 'Brown Rice' }], next: null });

    render(
      <QueryClientProvider client={queryClient}>
        <CategoryListPage
          page={{ title: parentCategory.name, slug: 'category' }}
          categories={[singleSectionParent]}
          activeParent={singleSectionParent}
        />
      </QueryClientProvider>
    );

    // The server cards may reach the list end, but must not page with their cursor.
    await reachListEnd();
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    expect(loadMore).not.toHaveBeenCalled();

    landScoped({
      items: [{ id: 2, name: 'Jasmine Rice' }],
      next: 'https://api.example.test/products?cursor=scoped-page-2',
    });
    expect(await screen.findByText('Jasmine Rice')).toBeTruthy();

    await reachListEnd();
    await waitFor(() =>
      expect(loadMore).toHaveBeenCalledWith(expect.objectContaining({ cursor: 'scoped-page-2' }))
    );
    expect(await screen.findByText('Brown Rice')).toBeTruthy();
  });

  it('loads and appends the next product page on scroll, with no Load More button', async () => {
    list.mockResolvedValue({
      items: [{ id: 1, name: 'Basmati Rice' }],
      next: 'https://api.example.test/products?cursor=category-page-2',
    });
    loadMore.mockResolvedValue({
      items: [{ id: 2, name: 'Brown Rice' }],
      next: null,
    });

    renderPage({ parent: singleSectionParent });
    showSection(subcategory);

    expect(await screen.findByText('Basmati Rice')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Load More' })).toBeNull();
    await reachListEnd();

    await waitFor(() =>
      expect(loadMore).toHaveBeenCalledWith({
        source: 'categories',
        sourceValue: subcategory.id_,
        perPage: 32,
        cursor: 'category-page-2',
      })
    );
    expect(await screen.findByText('Brown Rice')).toBeTruthy();
    expect(screen.getByText('Basmati Rice')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Load More' })).toBeNull();
    expect(document.querySelector('.s-items-list-end')).toBeNull();
  });
});

describe('CategoryListPage load more setting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    intersections.length = 0;
    activeScope.current = null;
    themeSettings.category_load_more_button = true;
  });
  afterEach(() => {
    delete themeSettings.category_load_more_button;
  });

  it('pages a section from the Load More button, not on scroll, when the merchant turns it on', async () => {
    list.mockResolvedValue({
      items: [{ id: 1, name: 'Basmati Rice' }],
      next: 'https://api.example.test/products?cursor=category-page-2',
    });
    loadMore.mockResolvedValue({ items: [{ id: 2, name: 'Brown Rice' }], next: null });
    renderPage({ parent: singleSectionParent });

    expect(await screen.findByText('Basmati Rice')).toBeTruthy();
    await reachListEnd().catch(() => {});
    expect(loadMore).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Load More' }));
    expect(await screen.findByText('Brown Rice')).toBeTruthy();
    expect(loadMore).toHaveBeenCalledWith(expect.objectContaining({ cursor: 'category-page-2' }));
    expect(screen.queryByRole('button', { name: 'Load More' })).toBeNull();
  });

  it('gives the Load More button the outlined look when the accent style is outlined', async () => {
    themeSettings.accent_style = 'outlined';
    list.mockResolvedValue({
      items: [{ id: 1, name: 'Basmati Rice' }],
      next: 'https://api.example.test/products?cursor=category-page-2',
    });
    renderPage({ parent: singleSectionParent });

    const button = await screen.findByRole('button', { name: 'Load More' });
    expect(button.closest('.load-more-outlined')).not.toBeNull();
    delete themeSettings.accent_style;
  });

  it('keeps the Load More button soft by default, whatever the primary button style', async () => {
    themeSettings.primary_button_style = 'dark';
    list.mockResolvedValue({
      items: [{ id: 1, name: 'Basmati Rice' }],
      next: 'https://api.example.test/products?cursor=category-page-2',
    });
    renderPage({ parent: singleSectionParent });

    const button = await screen.findByRole('button', { name: 'Load More' });
    expect(button.closest('.load-more-outlined')).toBeNull();
    expect(button.closest('.cta-dark')).toBeNull();
    delete themeSettings.primary_button_style;
  });
});

describe('CategoryListPage sort and filters', () => {
  const dispatch = vi.fn();
  const listeners = new Map<string, (data?: unknown) => void>();
  const sectionCalls = (key: string) =>
    list.mock.calls
      .map(([params]) => params as Record<string, unknown>)
      .filter((params) => key in params && !('cursor' in params) && params.perPage !== 1)
      .map((params) => params.sourceValue);

  beforeEach(() => {
    vi.clearAllMocks();
    intersections.length = 0;
    activeScope.current = null;
    listeners.clear();
    storeSettings.product = { filters: { price: true, brand_id: true, category_id: true } };
    window.history.replaceState(null, '', '/pantry/c100');
    window.salla = {
      event: {
        dispatch,
        on: (event: string, listener: (data?: unknown) => void) => listeners.set(event, listener),
        off: (event: string) => listeners.delete(event),
      },
    } as unknown as typeof window.salla;
    // Under a filter only Rice (653986054) keeps products.
    // The options and visibility requests ask for one product; the sections ask for a page.
    list.mockImplementation(async (params: { perPage?: number; filters?: unknown }) =>
      params.perPage === 1
        ? {
            items: [],
            next: null,
            filters: [
              {
                key: 'category_id',
                values: params.filters
                  ? [{ key: '653986054' }]
                  : [{ key: '653986054' }, { key: '653986055' }],
              },
              { key: 'price' },
              { key: 'brand_id' },
            ],
          }
        : params.filters
          ? { items: [{ id: 2, name: 'Filtered rice' }], next: null }
          : { items: [{ id: 1, name: 'Rice' }], next: null }
    );
  });

  afterEach(() => {
    storeSettings.product = {};
    resetFiltersDrawerForTests();
    window.history.replaceState(null, '', '/');
  });

  it("offers the sort but no filters button while the merchant's filters are off", () => {
    storeSettings.product = {};
    renderPage();
    expect(screen.getByRole('combobox', { name: 'Sort By' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'تصفية المنتجات' })).toBeNull();
  });

  it("fetches the parent tab's filter options, without the category one, once the drawer opens", async () => {
    renderPage();
    await screen.findAllByText('Rice');
    expect(list).not.toHaveBeenCalledWith(expect.objectContaining({ filterable: true }));

    fireEvent.click(screen.getByRole('button', { name: 'تصفية المنتجات' }));

    expect((await screen.findByRole('dialog')).textContent).toBe('price,brand_id');
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'categories', sourceValue: 100, filterable: true })
    );
  });

  it('sorts every section and keeps the sections and chips', async () => {
    renderPage();
    await screen.findAllByText('Rice');

    fireEvent.change(screen.getByRole('combobox', { name: 'Sort By' }), {
      target: { value: 'priceFromLowToTop' },
    });

    await waitFor(() => expect(sectionCalls('sort')).toEqual([653986054, 653986055]));
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ sort: 'priceFromLowToTop' }));
    expect(new URLSearchParams(window.location.search).get('sort')).toBe('priceFromLowToTop');
    expect(screen.getByRole('button', { name: 'Pasta' })).toBeTruthy();
    expect(document.getElementById('category-section-rice')).toBeTruthy();
  });

  it("filters the sections by the drawer's selection, minus the category, and drops the empty ones", async () => {
    renderPage();
    await screen.findAllByText('Rice');
    expect(screen.getByRole('button', { name: 'Pasta' })).toBeTruthy();

    await act(async () => {
      listeners.get('salla-filters::changed')?.({
        price: { min: '1', max: '9' },
        category_id: ['653986055'],
      });
    });

    await screen.findByText('Filtered rice');
    // One request for the parent says which sub-categories still have products.
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceValue: 100,
        perPage: 1,
        filterable: true,
        filters: { price: { min: '1', max: '9' } },
      })
    );
    expect(sectionCalls('filters')).toEqual([653986054]);
    expect(screen.queryByRole('button', { name: 'Pasta' })).toBeNull();
    expect(document.getElementById('category-section-pasta')).toBeNull();
    expect(screen.getByRole('button', { name: 'Rice and Pasta' })).toBeTruthy();
  });

  it('preloads a tab opened from a filtered one once its filter reset lands', async () => {
    const dairy = {
      id: 'dairy',
      id_: 200,
      name: 'Dairy',
      url: '/dairy/c200',
      sub_categories: [
        { id: 'milk', id_: 201, name: 'Milk', url: '/milk/c201', sub_categories: [] },
        { id: 'cheese', id_: 202, name: 'Cheese', url: '/cheese/c202', sub_categories: [] },
        { id: 'butter', id_: 203, name: 'Butter', url: '/butter/c203', sub_categories: [] },
      ],
    } as Category;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const page = (parent: Category) => (
      <QueryClientProvider client={queryClient}>
        <CategoryListPage
          page={{ title: parent.name, slug: 'category' }}
          categories={[parentCategory, dairy]}
          activeParent={parent}
        />
      </QueryClientProvider>
    );
    const { rerender } = render(page(parentCategory));
    await screen.findAllByText('Rice');
    await act(async () => {
      listeners.get('salla-filters::changed')?.({ price: { min: '1', max: '9' } });
    });
    await screen.findByText('Filtered rice');

    // Dairy opens still carrying Pantry's filter; its reset then lands.
    window.history.replaceState(null, '', '/dairy/c200');
    rerender(page(dairy));

    // Butter is below the fold and never shown, yet its first page is preloaded.
    await waitFor(() =>
      expect(list).toHaveBeenCalledWith(expect.objectContaining({ sourceValue: 203, perPage: 32 }))
    );
    expect(list).not.toHaveBeenCalledWith(
      expect.objectContaining({ sourceValue: 203, filters: expect.anything() })
    );
  });

  describe('preloading the sections of a filtered tab', () => {
    const flour = { ...secondSubcategory, id: 'flour', id_: 653986056, name: 'Flour' };
    const pantry = { ...parentCategory, sub_categories: [subcategory, secondSubcategory, flour] };
    const flourPages = () =>
      list.mock.calls
        .map(([params]) => params as Record<string, unknown>)
        .filter((params) => params.sourceValue === flour.id_ && params.perPage === 32);

    it('does not preload unfiltered pages before a filtered address is read', async () => {
      window.history.replaceState(null, '', '/pantry/c100?filters[price][min]=1');
      renderPage({ parent: pantry });

      await screen.findByText('Filtered rice');
      await settle();
      expect(flourPages()).toEqual([]);
    });

    it('preloads again once the filters clear, in the sort chosen meanwhile', async () => {
      renderPage({ parent: pantry });
      await waitFor(() => expect(flourPages()).toHaveLength(1));

      await act(async () => {
        listeners.get('salla-filters::changed')?.({ price: { min: '1', max: '9' } });
      });
      await screen.findByText('Filtered rice');
      fireEvent.change(screen.getByRole('combobox', { name: 'Sort By' }), {
        target: { value: 'priceFromLowToTop' },
      });
      await settle();
      expect(flourPages()).toHaveLength(1);

      await act(async () => {
        listeners.get('salla-filters::changed')?.({});
      });
      await waitFor(() =>
        expect(flourPages()).toContainEqual(expect.objectContaining({ sort: 'priceFromLowToTop' }))
      );
      expect(flourPages().some((params) => 'filters' in params)).toBe(false);
    });
  });

  it('ignores the query params the filters component passes off as filters', async () => {
    renderPage();
    await screen.findAllByText('Rice');

    vi.useFakeTimers();
    await act(async () => {
      listeners.get('salla-filters::changed')?.({
        scope: '1340997901',
        allocation_id: '956663531',
        allocation_type: 'address',
      });
    });
    // Anything the event would have started runs within this window.
    await act(() => vi.advanceTimersByTimeAsync(100));
    vi.useRealTimers();

    expect(list).not.toHaveBeenCalledWith(expect.objectContaining({ filterable: true }));
    expect(
      screen.queryByRole('button', { name: 'تصفية المنتجات' })!.querySelector('span')
    ).toBeNull();
    expect(screen.getByRole('button', { name: 'Pasta' })).toBeTruthy();

    await act(async () => {
      listeners.get('salla-filters::changed')?.({ scope: '1340997901', brand_id: ['5'] });
    });
    await screen.findByText('Filtered rice');
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ filters: { brand_id: ['5'] } }));
  });

  it('holds the refetch of a section scrolled out of view until it is back', async () => {
    renderPage({ parent: singleSectionParent });
    await screen.findAllByText('Rice');
    const section = document.getElementById('category-section-rice')!;
    // The section's own observer, inside the RenderWhenVisible wrapper.
    const own = intersections.find(
      (item) => item.target && item.target !== section && section.contains(item.target)
    )!;
    const seen = (visible: boolean) =>
      act(() => {
        own.callback(
          [{ isIntersecting: visible, target: own.target! } as IntersectionObserverEntry],
          {} as IntersectionObserver
        );
      });

    seen(false);
    vi.useFakeTimers();
    await act(async () => {
      listeners.get('salla-filters::changed')?.({ brand_id: ['5'] });
    });
    // The parent's answer lands and settles the filter within this window.
    await act(() => vi.advanceTimersByTimeAsync(100));
    vi.useRealTimers();
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ perPage: 1, filters: { brand_id: ['5'] } })
    );
    expect(sectionCalls('filters')).toEqual([]);

    seen(true);
    await screen.findByText('Filtered rice');
    expect(sectionCalls('filters')).toEqual([653986054]);
  });

  it('shows one no-matches message with the way out when no sub-category is left', async () => {
    list.mockImplementation(async (params: { perPage?: number }) =>
      params.perPage === 1
        ? { items: [], next: null, filters: [{ key: 'category_id', values: [] }] }
        : { items: [{ id: 1, name: 'Rice' }], next: null }
    );
    renderPage();
    await screen.findAllByText('Rice');

    await act(async () => {
      listeners.get('salla-filters::changed')?.({ brand_id: ['5'] });
    });

    expect(await screen.findByText('لا توجد منتجات تطابق التصفية المختارة')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pasta' })).toBeNull();
    expect(document.querySelector('[id^="category-section-"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'مسح الكل' }));
    expect(dispatch).toHaveBeenCalledWith('salla-filters::changed', {});
  });

  it('says a section has no matching products and clears the sort and filters from it', async () => {
    window.history.replaceState(null, '', '/pantry/c100?sort=topRated&filters[price][min]=1');
    // Rice still counts under the filter, yet its page comes back empty.
    list.mockImplementation(async (params: { perPage?: number }) =>
      params.perPage === 1
        ? {
            items: [],
            next: null,
            filters: [{ key: 'category_id', values: [{ key: '653986054' }] }],
          }
        : { items: [], next: null }
    );
    renderPage({ parent: singleSectionParent });

    expect(await screen.findByText('لا توجد منتجات تطابق التصفية المختارة')).toBeTruthy();
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'topRated', filters: { price: { min: '1' } } })
    );
    fireEvent.click(screen.getByRole('button', { name: 'مسح الكل' }));

    expect(dispatch).toHaveBeenCalledWith('salla-filters::changed', {});
    expect(window.location.search).toBe('');
  });
});
