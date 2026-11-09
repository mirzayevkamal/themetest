import { useQuery } from '@tanstack/react-query';
import { api } from '@salla.sa/twilight-theme-engine/api/client';
import { order as orderApi } from '@salla.sa/twilight-theme-engine/api/order';
import { WITH_ITEMS, type OrderCard, type Shipment, type TrackedOrder } from '../types';
import { ACTIVE_ORDER_STATUS, findActiveOrder, isInFlightStatus, POLL_MS } from './phase';

/** The engine's `order.shipments` can't ask for `with_products`, so this calls the endpoint itself. */
export async function listShipments(orderId: string | number): Promise<Shipment[]> {
  const res = await api
    .get(`orders/${orderId}/shipments?with_products=true`)
    .json<{ data?: Shipment[] }>();
  return res.data ?? [];
}

/** Tracking extras the order-details payload does not carry: courier, map link,
 *  and ETA/driver once the shipments API sends them. Polls while the order is
 *  in flight; `active` is in the key so landing fetches once more and
 *  `actual_delivered_at` is not lost to the last poll. `initial` shows until
 *  the first response. */
export function useShipments(
  id: string | number | undefined,
  {
    enabled = true,
    active = true,
    initial,
  }: { enabled?: boolean; active?: boolean; initial?: Shipment[] } = {}
) {
  const orderId = String(id ?? '');
  return useQuery({
    queryKey: ['orders', 'shipments', orderId, { with_products: true, active }],
    queryFn: () => listShipments(orderId),
    enabled: Boolean(id) && enabled,
    staleTime: POLL_MS,
    placeholderData: (previous) => previous ?? initial,
    refetchInterval: active ? POLL_MS : false,
    refetchIntervalInBackground: false,
  });
}

/** In-flight orders for the home / orders-list banner stack, newest first. */
export function useActiveOrders(enabled = true) {
  const params = { status: ACTIVE_ORDER_STATUS, ...WITH_ITEMS };
  const { data } = useQuery({
    queryKey: ['orders', 'active', params],
    queryFn: () => orderApi.list(params),
    enabled: enabled && !import.meta.env.SSR,
    staleTime: (query) => (findActiveOrder(query.state.data?.data) ? POLL_MS : 0),
    refetchInterval: (query) => (findActiveOrder(query.state.data?.data) ? POLL_MS : false),
    refetchIntervalInBackground: false,
  });
  return ((data?.data ?? []) as OrderCard[]).filter((order) =>
    isInFlightStatus(order.status?.slug)
  );
}

type LiveOrderOptions = { enabled?: boolean; initial?: TrackedOrder; fromLoader?: boolean };

/** Polls `order.queries.find` in the query cache so a tracking tick does not
 *  re-run route loaders (or refetch the whole list).
 *  `fromLoader` seeds the cache with SSR data so details skip a duplicate fetch. */
export function useLiveOrderQuery(
  id: string | number | undefined,
  { enabled = true, initial, fromLoader = false }: LiveOrderOptions = {}
) {
  const orderId = String(id ?? '');
  const findQuery = orderApi.queries.find(orderId);
  return useQuery({
    ...findQuery,
    enabled: Boolean(id) && enabled,
    staleTime: POLL_MS,
    refetchOnMount: !fromLoader,
    refetchInterval: (query) => {
      const slug = (query.state.data?.order ?? initial)?.status?.slug;
      return isInFlightStatus(slug) ? POLL_MS : false;
    },
    refetchIntervalInBackground: false,
    ...(fromLoader && initial
      ? { initialData: { order: initial } }
      : initial
        ? { placeholderData: { order: initial } }
        : {}),
  });
}

/** The polled order, or `initial` until the first response lands. */
export function useLiveOrder(id: string | number | undefined, options: LiveOrderOptions = {}) {
  const { data } = useLiveOrderQuery(id, options);
  return (data?.order as TrackedOrder | undefined) ?? options.initial;
}
