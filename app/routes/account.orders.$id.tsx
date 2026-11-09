// Custom order details page. No `@auto-generated` marker: the engine must not overwrite this.
import { createFileRoute, redirect } from '@tanstack/react-router';
import { OrderSingle } from '@salla.sa/twilight-theme-engine/routes/account/orders';
import type { OrderSinglePageProps } from '@salla.sa/twilight-theme-engine/routes/account/orders';
import { getAuthToken } from '@salla.sa/twilight-theme-engine/api/client';
import { withHead } from '@salla.sa/twilight-theme-engine/tanstack';
import { AccountShellSkeleton } from '../components/account/AccountPageSkeleton';
import { OrderPage } from '../components/orders';

export const Route = createFileRoute('/{-$locale}/account/orders/$id')({
  loader: ({ params }): Promise<OrderSinglePageProps> => {
    // Guests land on the list, whose login gate brings them back after signing in.
    if (!getAuthToken()) throw redirect({ to: '/account/orders' });
    return OrderSingle.loader({ params: { id: params.id }, locale: params.locale });
  },
  head: withHead(OrderSingle),
  pendingComponent: AccountShellSkeleton,
  component: OrderRoute,
});

function OrderRoute() {
  const data: OrderSinglePageProps = Route.useLoaderData();
  return <OrderPage {...data} />;
}
