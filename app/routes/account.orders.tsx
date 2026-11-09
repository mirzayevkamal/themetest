// Custom orders page. No `@auto-generated` marker: the engine must not overwrite this.
import { createFileRoute } from '@tanstack/react-router';
import { Orders } from '@salla.sa/twilight-theme-engine/routes/account/orders';
import type { OrdersPageProps } from '@salla.sa/twilight-theme-engine/routes/account/orders';
import { getAuthToken } from '@salla.sa/twilight-theme-engine/api/client';
import { withHead } from '@salla.sa/twilight-theme-engine/tanstack';
import { AccountShellSkeleton } from '../components/account/AccountPageSkeleton';
import { OrdersLoginRequired, OrdersPage } from '../components/orders';
import { WITH_ITEMS } from '../components/orders/types';

export const Route = createFileRoute('/{-$locale}/account/orders')({
  validateSearch: (search: Record<string, unknown>) => {
    const status = (search.status as string) || undefined;
    return status ? { status } : {};
  },
  loaderDeps: ({ search }) => ({ status: search.status }),
  loader: async ({ deps, params }): Promise<OrdersPageProps & { guest?: boolean }> => {
    // Guests: the store answers the orders API with 400/401, so gate on the token
    // (cookie on SSR, in-memory after an in-modal login) and render the login gate.
    if (!getAuthToken()) {
      const title = params.locale === 'en' ? 'Orders' : 'الطلبات';
      return { page: { title, slug: 'orders' }, orders: [], guest: true };
    }
    return Orders.loader({
      search: { status: deps.status },
      locale: params.locale,
      ...WITH_ITEMS,
    });
  },
  head: withHead(Orders),
  pendingComponent: AccountShellSkeleton,
  component: OrdersRoute,
});

function OrdersRoute() {
  const data = Route.useLoaderData();
  if (data.guest) return <OrdersLoginRequired />;
  return <OrdersPage key={data.query?.status ?? ''} {...data} />;
}
