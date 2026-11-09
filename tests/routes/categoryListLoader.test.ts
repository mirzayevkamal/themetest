import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

const tree = vi.hoisted(() => [
  {
    id: 'abc',
    id_: 111,
    name: 'Fruits & Vegetables',
    url: '/ar/fruits/c111',
    sub_categories: [
      { id: 'sub1', id_: 222, name: 'Apples', url: '/ar/apples/c222' },
      { id: 'sub2', id_: 444, name: 'Pears', url: '/ar/pears/c444' },
      { id: 'sub3', id_: 555, name: 'Plums', url: '/ar/plums/c555' },
    ],
  },
  { id: 'def', id_: 333, name: 'Dairy', url: '/ar/dairy/c333', sub_categories: [] },
]);

vi.mock('@salla.sa/twilight-theme-engine/api/category', () => ({
  category: {
    queries: { list: () => ({ queryKey: ['categories'], queryFn: () => tree }) },
  },
}));

vi.mock('@salla.sa/twilight-theme-engine/api/product', () => ({
  product: {
    queries: {
      list: (params: unknown) => ({ queryKey: ['products', params], queryFn: () => [] }),
    },
  },
}));

// Stands in for the router context: resolves the mocked query options directly.
const ensureQueryData = vi.fn((opts: { queryFn: () => unknown }) =>
  Promise.resolve(opts.queryFn())
);
const context = { queryClient: { ensureQueryData } } as never;

const productsPrefetch = (sourceValue: number) =>
  expect.objectContaining({
    queryKey: ['products', expect.objectContaining({ source: 'categories', sourceValue })],
  });

// The route module pulls in the page component; stub its heavy deps.
vi.mock('../../app/components/categories/CategoryListPage', () => ({
  CategoryListPage: () => null,
  CategoryListSkeleton: () => null,
}));

// withHead drags in TanStack Start virtual modules that don't exist in vitest.
vi.mock('@salla.sa/twilight-theme-engine/tanstack', () => ({
  withHead: () => () => ({}),
}));

import { categoryListLoader } from '../../app/routes/$slug.c$id';

// Resolves the tree, holds every products prefetch until `release` is called.
const holdProducts = () => {
  let release!: () => void;
  const held = new Promise<unknown[]>((resolve) => {
    release = () => resolve([]);
  });
  ensureQueryData.mockImplementation((opts: { queryKey: unknown[]; queryFn: () => unknown }) =>
    opts.queryKey[0] === 'categories' ? Promise.resolve(opts.queryFn()) : held
  );
  return release;
};

const settled = (promise: Promise<unknown>) =>
  Promise.race([promise.then(() => true), Promise.resolve().then(() => false)]);

describe('categoryListLoader', () => {
  beforeEach(() => {
    ensureQueryData.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    ensureQueryData.mockImplementation((opts) => Promise.resolve(opts.queryFn()));
  });

  it('resolves a parent category by hashed id and prefetches its first section', async () => {
    const data = await categoryListLoader({ params: { id: 'abc' }, context });
    expect(data.activeParent.name).toBe('Fruits & Vegetables');
    expect(data.activeSub).toBeUndefined();
    expect(data.page.title).toBe('Fruits & Vegetables');
    expect(data.categories).toHaveLength(2);
    expect(ensureQueryData).toHaveBeenCalledWith(productsPrefetch(222));
  });

  it('also prefetches the section after the landing one, and no further', async () => {
    await categoryListLoader({ params: { id: 'abc' }, context });
    expect(ensureQueryData).toHaveBeenCalledWith(productsPrefetch(444));
    expect(ensureQueryData).not.toHaveBeenCalledWith(productsPrefetch(555));
    ensureQueryData.mockClear();
    await categoryListLoader({ params: { id: '444' }, context });
    expect(ensureQueryData).toHaveBeenCalledWith(productsPrefetch(555));
    ensureQueryData.mockClear();
    await categoryListLoader({ params: { id: '555' }, context });
    expect(ensureQueryData).toHaveBeenCalledTimes(2);
  });

  it('prefetches the parent itself when it has no sub-categories', async () => {
    await categoryListLoader({ params: { id: 'def' }, context });
    expect(ensureQueryData).toHaveBeenCalledWith(productsPrefetch(333));
  });

  it('resolves a sub-category by numeric id, keeps its parent active and prefetches it', async () => {
    const data = await categoryListLoader({ params: { id: '222' }, context });
    expect(data.activeParent.name).toBe('Fruits & Vegetables');
    expect(data.activeSub?.name).toBe('Apples');
    expect(data.page.title).toBe('Apples');
    expect(ensureQueryData).toHaveBeenCalledWith(productsPrefetch(222));
  });

  it('still resolves when the products prefetch fails', async () => {
    ensureQueryData.mockImplementationOnce((opts) => Promise.resolve(opts.queryFn()));
    ensureQueryData.mockImplementationOnce(() => Promise.reject(new Error('api down')));
    const data = await categoryListLoader({ params: { id: 'abc' }, context });
    expect(data.activeParent.name).toBe('Fruits & Vegetables');
  });

  it('returns before the first-screen sections settle on a client navigation', async () => {
    vi.stubEnv('SSR', false);
    holdProducts();
    const data = await categoryListLoader({ params: { id: 'abc' }, context });
    expect(data.activeParent.name).toBe('Fruits & Vegetables');
    expect(ensureQueryData).toHaveBeenCalledWith(productsPrefetch(222));
  });

  it('waits for the first-screen sections on the server', async () => {
    vi.stubEnv('SSR', true);
    const release = holdProducts();
    const loading = categoryListLoader({ params: { id: 'abc' }, context });
    await Promise.resolve();
    expect(await settled(loading)).toBe(false);
    release();
    expect((await loading).activeParent.name).toBe('Fruits & Vegetables');
  });

  it('throws notFound for an unknown id', async () => {
    await expect(categoryListLoader({ params: { id: 'nope' }, context })).rejects.toBeTruthy();
  });
});
