import { createFileRoute, redirect } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { product as productApi } from '@salla.sa/twilight-theme-engine/api/product';
import { Product } from '@salla.sa/twilight-theme-engine/routes/product';
import type { ProductPageProps } from '@salla.sa/twilight-theme-engine/routes/product';
import { ProductDetailSkeleton } from '@salla.sa/twilight-theme-engine/skeleton';
import { withHead } from '@salla.sa/twilight-theme-engine/tanstack';
import { ProductPage } from '../components/product/ProductPage';
import { ProductPreview } from '../components/product/ProductSheetContent';
import { ProductSheet } from '../components/product/ProductSheet';
import { useGoBack } from '../components/navigation/BackButton';

/**
 * Out-of-stock or hidden products 404 at the API; the engine surfaces that as a dead
 * 404 page. Shoppers should land on the home page instead.
 */
export function productLoader({
  params,
}: {
  params: { id: string; locale?: string };
}): Promise<ProductPageProps> {
  return Product.loader({ params: { id: params.id }, locale: params.locale }).catch(() => {
    throw redirect({ to: params.locale ? `/${params.locale}` : '/', replace: true });
  });
}

/**
 * Product route configuration.
 * Loads page data through the engine and renders the theme product page.
 */
export const Route = createFileRoute('/{-$locale}/$slug/p{$id}')({
  loader: ({ params }) => productLoader({ params }),
  head: withHead(Product),
  // Pending components stay in the eager route file by default; this one drags the
  // page's components in, so split it like the component.
  codeSplitGroupings: [['component'], ['pendingComponent']],
  pendingComponent: ProductPending,
  // Lazy children (the engine's add-to-cart form) suspend inside the sheet, not
  // up to the route boundary, so the chrome never remounts.
  component: ProductComponent,
});

/**
 * Product page component.
 * Uses Route.useLoaderData() to access the data loaded by the route loader,
 * following React best practices for data fetching in route components.
 */
function ProductComponent() {
  const data: ProductPageProps = Route.useLoaderData();
  return (
    <RouteSheet>
      <ProductPage {...data} />
    </RouteSheet>
  );
}

/** List-card product if the engine remembered one; the loader still fetches details. */
function ProductPending() {
  const { id } = Route.useParams();
  const { data, isPlaceholderData } = useQuery({
    ...productApi.queries.detail(id),
    enabled: false,
  });
  return (
    <RouteSheet>
      {data ? (
        <ProductPreview product={data} isPreview={isPlaceholderData} />
      ) : (
        <ProductDetailSkeleton />
      )}
    </RouteSheet>
  );
}

/**
 * Phone and native webview: the sheet covers the app shell (deep links included).
 * Web desktop CSS (`#main-content .product-sheet`) drops the sheet chrome so
 * this route is the product page.
 */
function RouteSheet({ children }: { children: React.ReactNode }) {
  const goBack = useGoBack();
  return <ProductSheet onClose={goBack}>{children}</ProductSheet>;
}
