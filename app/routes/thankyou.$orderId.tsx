// Custom thank-you route. No `@auto-generated` marker: the engine must not overwrite this.
import { useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { getAuthToken } from '@salla.sa/twilight-theme-engine/api/client';
import { order } from '@salla.sa/twilight-theme-engine/api/order';
import { AccountPageSkeleton } from '../components/account/AccountPageSkeleton';
import { isWebDesktop } from '../hooks/useIsWebDesktop';
import { openOrderDrawerOnArrival } from '../hooks/useOrderDrawer';

/**
 * Thank-you URLs carry a checkout Hashids hash. GET /store/v1/orders/{hash}
 * decodes that the same way Store ThankYouController does, so find() returns
 * the order and we send the shopper to /account/orders/{id}.
 *
 * Do not `throw redirect()` from the loader. TanStack Start SSR follows that
 * redirect internally and returns 200 of the destination at this URL (the
 * statusCode: 307 never reaches the browser — Salla's edge may follow it too).
 * The client then hydrates the thank-you route against the orders page
 * (React #418, stuck overlay). Render the same skeleton on server and client,
 * then navigate after mount.
 *
 * Web desktop has no order page in the design: a signed-in shopper goes home
 * and the layout opens the tracking drawer, like a click on the order banner.
 * Guests keep the orders path, whose login gate brings them back signed in.
 */
export async function resolveOrderId(hash: string): Promise<string | undefined> {
  if (/^\d+$/.test(hash)) return hash;
  const { order: found } = await order.find(hash);
  return found?.id == null ? undefined : String(found.id);
}

function ordersPath(locale: string | undefined, id: string | undefined): string {
  const prefix = locale ? `/${locale}` : '';
  return `${prefix}/account/orders${id ? `/${id}` : ''}`;
}

export function ThankYouRedirect({ orderId, locale }: { orderId: string; locale?: string }) {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    void resolveOrderId(orderId)
      .catch(() => undefined)
      .then((id) => {
        if (cancelled) return;
        if (isWebDesktop() && getAuthToken()) {
          if (id) openOrderDrawerOnArrival(id);
          void navigate({ to: locale ? `/${locale}` : '/', replace: true });
          return;
        }
        void navigate({ to: ordersPath(locale, id), replace: true });
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, locale, navigate]);

  return <AccountPageSkeleton />;
}

function ThankYouRoute() {
  const { orderId, locale } = Route.useParams();
  return <ThankYouRedirect orderId={orderId} locale={locale} />;
}

export const Route = createFileRoute('/{-$locale}/thankyou/$orderId')({
  pendingComponent: AccountPageSkeleton,
  component: ThankYouRoute,
});
