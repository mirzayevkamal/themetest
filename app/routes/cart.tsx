// Custom cart page. No `@auto-generated` marker: the engine must not overwrite this.
import { createFileRoute } from '@tanstack/react-router';
import { Cart } from '@salla.sa/twilight-theme-engine/routes/cart';
import type { CartPageProps } from '@salla.sa/twilight-theme-engine/routes/cart';
import { CartSkeleton } from '@salla.sa/twilight-theme-engine/skeleton';
import { withHead } from '@salla.sa/twilight-theme-engine/tanstack';
import { CartView } from '../components/cart/CartView';

export const Route = createFileRoute('/{-$locale}/cart')({
  loader: ({ params }): Promise<CartPageProps> => Cart.loader({ locale: params.locale }),
  head: withHead(Cart),
  pendingComponent: () => <CartSkeleton />,
  component: CartRoute,
});

function CartRoute() {
  const { cart, page } = Route.useLoaderData();
  return <CartView initialCart={cart} page={page} />;
}
