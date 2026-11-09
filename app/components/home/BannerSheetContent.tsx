import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ItemsList } from '@salla.sa/twilight-components-react';
import { brand } from '@salla.sa/twilight-theme-engine/api/brands';
import { category } from '@salla.sa/twilight-theme-engine/api/category';
import { product, type ProductsListSource } from '@salla.sa/twilight-theme-engine/api/product';
import { Image, Link, NoContent } from '@salla.sa/twilight-theme-engine/common';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import type { Category, Product } from '@salla.sa/twilight-theme-engine/types';
import { parseBannerTarget } from '../../hooks/useBannerSheet';
import { CategoryListPage, CategoryListSkeleton } from '../categories/CategoryListPage';
import { PRODUCTS_PER_PAGE } from '../categories/sectionQuery';
import { ProductCard } from '../product';
import ProductSheetContent from '../product/ProductSheetContent';

const matchesCategory = (cat: Category, id: string) =>
  String(cat.id) === id || (cat.id_ != null && String(cat.id_) === id);

export function BannerSheetContent({ path, onClose }: { path: string; onClose: () => void }) {
  const target = parseBannerTarget(path);

  if (!target) return null;

  if (target.kind === 'product') {
    return <ProductSheetContent id={target.id} onClose={onClose} />;
  }

  if (target.kind === 'category') {
    return <BannerCategory id={target.id} />;
  }

  if (target.kind === 'brands-index') {
    return <BannerBrandsIndex />;
  }

  return <BannerListing source={target.source} sourceValue={target.sourceValue} />;
}

function BannerCategory({ id }: { id: string }) {
  const { data: categories, isPending } = useQuery(category.queries.list());
  const loaded = useMemo(() => {
    if (!categories) return null;
    for (const parent of categories) {
      if (matchesCategory(parent, id)) {
        return {
          page: { title: parent.name, slug: 'category' },
          categories,
          activeParent: parent,
        };
      }
      const sub = parent.sub_categories?.find((item) => matchesCategory(item, id));
      if (sub) {
        return {
          page: { title: sub.name, slug: 'category' },
          categories,
          activeParent: parent,
          activeSub: sub,
        };
      }
    }
    return null;
  }, [categories, id]);

  if (isPending) return <CategoryListSkeleton hideHeader />;
  if (!loaded) return <BannerEmpty />;

  return <CategoryListPage {...loaded} hideHeader />;
}

function BannerListing({
  source,
  sourceValue,
}: {
  source: ProductsListSource;
  sourceValue?: string;
}) {
  const { t } = useTranslation();
  const { data, isPending } = useQuery(
    product.queries.list({
      source,
      sourceValue,
      perPage: PRODUCTS_PER_PAGE,
    })
  );
  const products = data?.items ?? [];

  if (isPending) {
    return (
      <div className="container py-4">
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="aspect-[127/120] animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <ItemsList<Product>
        items={products}
        mode="static"
        itemsClassName="grid grid-cols-3 gap-2"
        empty={
          <NoContent
            icon="sicon-shopping-bag"
            message={t('pages.categories.no_products', 'No products found in this category')}
          />
        }
        t={(key, fallback) => t(key, fallback || key)}
      >
        {(items) => items.map((item) => <ProductCard key={item.id} product={item} />)}
      </ItemsList>
    </div>
  );
}

function BannerEmpty() {
  const { t } = useTranslation();
  return (
    <NoContent icon="sicon-warning" message={t('common.errors.not_found', 'المحتوى غير موجود')} />
  );
}

function BannerPulse() {
  return (
    <div className="container py-4">
      <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
    </div>
  );
}

function BannerBrandsIndex() {
  const { t } = useTranslation();
  const { data, isPending, isError } = useQuery(brand.queries.list());
  const brands = useMemo(() => (data ? Object.values(data).flat() : []), [data]);

  if (isPending) return <BannerPulse />;
  if (isError) return <BannerEmpty />;

  if (!brands.length) {
    return (
      <NoContent icon="sicon-store" message={t('common.errors.not_found', 'المحتوى غير موجود')} />
    );
  }

  return (
    <div className="container grid grid-cols-3 gap-2 py-4">
      {brands.map((item) => (
        <Link
          key={item.id}
          to={item.url}
          className="flex aspect-square items-center justify-center rounded-xl bg-white p-3"
          aria-label={item.name}
        >
          <Image
            src={item.logo}
            alt=""
            width={80}
            height={80}
            objectFit="contain"
            noWrapper
            className="max-h-full max-w-full"
          />
        </Link>
      ))}
    </div>
  );
}
