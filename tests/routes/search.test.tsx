import React from 'react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

const loader = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
const loaderData = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
  pending: null as Promise<Record<string, unknown>> | null,
  cachedValue: undefined as Record<string, unknown> | undefined,
  cached: undefined as Promise<Record<string, unknown>> | undefined,
}));
const searchParams = vi.hoisted(() => ({ sort: undefined as string | undefined }));
const searchListingSearch = vi.hoisted(() => ({ validateSearch: vi.fn(), loaderDeps: vi.fn() }));

// React 19's use() reads thenable.status. A bare Promise.resolve stays pending
// in this test renderer, so settled listing data is marked fulfilled.
function fulfilled<T extends Record<string, unknown>>(data: T) {
  return Object.assign(Promise.resolve(data), { status: 'fulfilled' as const, value: data });
}

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    options,
    useLoaderData: () => {
      if (!loaderData.pending && loaderData.cachedValue !== loaderData.value) {
        loaderData.cachedValue = loaderData.value;
        loaderData.cached = fulfilled({
          page: { title: 'حليب' },
          query: { sort: 'ourSuggest' },
          ...loaderData.value,
        });
      }
      return { results: loaderData.pending ?? loaderData.cached };
    },
    useSearch: () => ({ q: 'حليب', sort: searchParams.sort }),
    useNavigate: () => navigate,
  }),
  useLocation: ({ select }: { select: (l: { searchStr: string }) => string }) =>
    select({ searchStr: window.location.search }),
}));
vi.mock('@salla.sa/twilight-theme-engine/routes/product-listing', () => ({
  ProductListing: { loader },
  searchListingSearch,
  parseFiltersFromSearch: (search: string) => {
    const out: Record<string, string[]> = {};
    new URLSearchParams(search).forEach((value, key) => {
      const name = key.match(/^filters\[(\w+)\]\[\]$/)?.[1];
      if (name) out[name] = [...(out[name] ?? []), value];
    });
    return Object.keys(out).length ? out : null;
  },
  ProductListPage: () => (
    <div>
      <h1 id="page-main-title">حليب</h1>
      <div>
        <select id="product-sort" aria-label="engine sort" />
      </div>
    </div>
  ),
}));
vi.mock('@salla.sa/twilight-theme-engine/tanstack', () => ({
  withHead:
    (route: { head: (ctx: unknown, data: unknown) => unknown }) => (ctx: { loaderData: unknown }) =>
      route.head(ctx, ctx.loaderData),
}));
vi.mock('@salla.sa/twilight-theme-engine/providers', () => ({
  useTwilight: () => ({ theme: { settings: {} } }),
}));

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
const productSettings = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@salla.sa/twilight-theme-engine/hooks/useStore', () => ({
  useStore: () => ({ settings: { product: productSettings.current } }),
}));
vi.mock('../../app/components/filters/FiltersDrawer', () => ({
  FiltersDrawer: ({ open, filters }: { open: boolean; filters?: Array<{ key: string }> }) =>
    open ? <div role="dialog">{filters?.map((f) => f.key).join(',')}</div> : null,
}));
vi.mock('../../app/components/SearchBar', () => ({
  SearchInput: ({ placeholder }: { placeholder?: string }) => (
    <input aria-label={placeholder ?? 'search'} />
  ),
}));
vi.mock('../../app/components/navigation', () => ({
  BackButton: () => null,
  MobileOnly: () => null,
}));

import { Route } from '../../app/routes/search';

describe('search route', () => {
  beforeEach(() => {
    loaderData.pending = null;
    loaderData.value = {};
  });

  it('shows the search bar and sort while the listing promise is still pending', async () => {
    loaderData.pending = new Promise(() => {});
    searchParams.sort = 'topRated';
    const Component = (Route as unknown as { options: { component: React.FC } }).options.component;
    await act(async () => {
      render(<Component />);
    });

    expect(screen.getByRole('textbox', { name: 'ابحث عن الموز، الخيار وغيره....' })).toBeTruthy();
    expect((screen.getByRole('combobox', { name: 'Sort By' }) as HTMLSelectElement).value).toBe(
      'topRated'
    );
    expect(screen.queryByRole('button', { name: 'الكل' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'engine sort' })).toBeNull();
    searchParams.sort = undefined;
  });

  it('shows the results once the listing resolves and keeps the same search input', async () => {
    let resolve!: (data: Record<string, unknown>) => void;
    loaderData.pending = new Promise((r) => {
      resolve = r;
    });
    const Component = (Route as unknown as { options: { component: React.FC } }).options.component;
    await act(async () => {
      render(<Component />);
    });
    const input = screen.getByRole('textbox', { name: 'ابحث عن الموز، الخيار وغيره....' });
    expect(screen.queryByRole('button', { name: 'الكل' })).toBeNull();

    await act(async () => {
      resolve({
        page: { title: 'حليب' },
        query: { sort: 'ourSuggest' },
        filters: [
          {
            key: 'category_id',
            values: [
              { key: '1', value: 'الحليب' },
              { key: '2', value: 'أطعمة الأطفال' },
            ],
          },
        ],
      });
    });

    expect(await screen.findByRole('button', { name: 'الكل' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'engine sort' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'ابحث عن الموز، الخيار وغيره....' })).toBe(input);
  });

  it.each([undefined, 'bogus'])('falls back to the engine default sort for %s', (sort) => {
    searchParams.sort = sort;
    const Component = (Route as unknown as { options: { component: React.FC } }).options.component;
    render(<Component />);
    expect((screen.getByRole('combobox', { name: 'Sort By' }) as HTMLSelectElement).value).toBe(
      'ourSuggest'
    );
    searchParams.sort = undefined;
  });

  it('puts its own sort above the category chips and sorts through the URL', async () => {
    loaderData.value = {
      filters: [
        {
          key: 'category_id',
          values: [
            { key: '1', value: 'الحليب' },
            { key: '2', value: 'أطعمة الأطفال' },
          ],
        },
      ],
    };
    const Component = (Route as unknown as { options: { component: React.FC } }).options.component;
    render(<Component />);

    const sort = await screen.findByRole('combobox', { name: 'Sort By' });
    const chip = screen.getByRole('button', { name: 'الحليب' });
    expect(sort.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    window.history.replaceState(null, '', '/search?q=حليب&filters[brand_id][]=5');
    fireEvent.change(sort, { target: { value: 'priceFromLowToTop' } });
    // Written through `history`, so the drawer's filters in the address bar survive.
    const params = new URLSearchParams(window.location.search);
    expect(params.get('sort')).toBe('priceFromLowToTop');
    expect(params.getAll('filters[brand_id][]')).toEqual(['5']);
    expect(navigate).not.toHaveBeenCalled();
    loaderData.value = {};
  });

  it('gives the results the products-page desktop grid', async () => {
    const Component = (Route as unknown as { options: { component: React.FC } }).options.component;
    render(<Component />);

    expect(
      (await screen.findByRole('combobox', { name: 'engine sort' })).closest('.products-page')
    ).not.toBeNull();
  });

  it("keeps the engine's search params and hands them to the loader", () => {
    const { options } = Route as unknown as {
      options: {
        validateSearch: unknown;
        loaderDeps: unknown;
        loader: (a: { deps: Record<string, string>; params: { locale?: string } }) => unknown;
      };
    };
    expect(options.validateSearch).toBe(searchListingSearch.validateSearch);
    expect(options.loaderDeps).toBe(searchListingSearch.loaderDeps);

    const pending = Promise.resolve({ query: { sort: 'topRated' } });
    loader.mockReturnValueOnce(pending);
    const result = options.loader({ deps: { q: 'ت', sort: 'topRated' }, params: { locale: 'ar' } });
    expect(loader).toHaveBeenCalledWith({
      params: { source: 'search' },
      search: { q: 'ت', sort: 'topRated' },
      locale: 'ar',
    });
    expect(result).toEqual({ results: pending });
  });

  it('titles the page from the query without waiting for the listing', () => {
    const { options } = Route as unknown as {
      options: { head: (ctx: Record<string, unknown>) => { title: string } };
    };
    const head = options.head({
      location: { search: { q: 'حليب' } },
      loaderData: { results: new Promise(() => {}) },
    });
    expect(head.title).toBe('حليب');
  });
});

describe('search category chips', () => {
  const categories = {
    key: 'category_id',
    type: 'values',
    values: [
      { key: '1302011225', value: 'الحليب', count: 8 },
      { key: '1246465775', value: 'أطعمة الأطفال', count: 8 },
    ],
  };
  const dispatch = vi.fn();
  const listeners = new Map<string, (data?: unknown) => void>();

  beforeEach(() => {
    dispatch.mockClear();
    listeners.clear();
    loaderData.pending = null;
    productSettings.current = {};
    window.salla = {
      event: {
        dispatch,
        on: (event: string, listener: (data?: unknown) => void) => listeners.set(event, listener),
        off: (event: string) => listeners.delete(event),
      },
    } as unknown as typeof window.salla;
    window.history.replaceState(null, '', '/search?q=حليب');
    loaderData.value = { filters: [{ key: 'price', type: 'range' }, categories] };
  });

  const renderSearch = () => {
    const Component = (Route as unknown as { options: { component: React.FC } }).options.component;
    render(<Component />);
  };

  it("filters by the tapped category through the engine's filters event", async () => {
    renderSearch();
    expect((await screen.findByRole('button', { name: 'الكل' })).getAttribute('aria-current')).toBe(
      'true'
    );

    fireEvent.click(screen.getByRole('button', { name: 'أطعمة الأطفال' }));

    expect(dispatch).toHaveBeenCalledWith('salla-filters::changed', {
      category_id: ['1246465775'],
    });
    expect(new URLSearchParams(window.location.search).getAll('filters[category_id][]')).toEqual([
      '1246465775',
    ]);
    expect(screen.getByRole('button', { name: 'أطعمة الأطفال' }).getAttribute('aria-current')).toBe(
      'true'
    );
  });

  it('clears the category with the all chip', async () => {
    window.history.replaceState(null, '', '/search?q=حليب&filters[category_id][]=1302011225');
    renderSearch();
    expect(
      (await screen.findByRole('button', { name: 'الحليب' })).getAttribute('aria-current')
    ).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'الكل' }));

    expect(dispatch).toHaveBeenCalledWith('salla-filters::changed', {});
    expect(window.location.search).not.toContain('filters');
  });

  it('shows no chips when the results span a single category', async () => {
    loaderData.value = { filters: [{ ...categories, values: categories.values.slice(0, 1) }] };
    renderSearch();
    expect(await screen.findByRole('combobox', { name: 'engine sort' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'الكل' })).toBeNull();
  });

  it("keeps the drawer's other filters when a chip is tapped", async () => {
    window.history.replaceState(null, '', '/search?q=حليب&filters[brand_id][]=5');
    renderSearch();

    fireEvent.click(await screen.findByRole('button', { name: 'الحليب' }));

    expect(dispatch).toHaveBeenCalledWith('salla-filters::changed', {
      brand_id: ['5'],
      category_id: ['1302011225'],
    });
  });

  it('follows a category picked in the filters drawer', async () => {
    renderSearch();
    await screen.findByRole('button', { name: 'الكل' });

    await act(async () => {
      listeners.get('salla-filters::changed')?.({ category_id: ['1246465775'] });
    });
    expect(screen.getByRole('button', { name: 'أطعمة الأطفال' }).getAttribute('aria-current')).toBe(
      'true'
    );

    await act(async () => {
      listeners.get('salla-filters::changed')?.({ category_id: ['1246465775', '1302011225'] });
    });
    expect(screen.queryByRole('button', { current: true })).toBeNull();
  });

  it("shows no filters button while the merchant's filters are off", async () => {
    renderSearch();
    await screen.findByRole('button', { name: 'الكل' });
    expect(screen.queryByRole('button', { name: 'تصفية المنتجات' })).toBeNull();
  });

  it("opens the drawer with the listing's filter options", async () => {
    productSettings.current = { filters: { price: true } };
    renderSearch();

    fireEvent.click(await screen.findByRole('button', { name: 'تصفية المنتجات' }));

    // The chips are the category filter; the drawer leaves it out.
    expect((await screen.findByRole('dialog')).textContent).toBe('price');
  });
});
