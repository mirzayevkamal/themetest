import type {
  OrderSinglePageProps,
  OrdersPageProps,
} from '@salla.sa/twilight-theme-engine/routes/account/orders';

export type Order = OrderSinglePageProps['order'];
export type OrderListItem = OrdersPageProps['orders'][number];

/** Grocery list surfaces opt into engine `order.list` / `Orders.loader` items. */
export const WITH_ITEMS = { with_items: 1 } as const;

export interface ShipmentDriver {
  name: string;
  mobile: string;
  reference_number?: string | null;
}

export interface ShipmentShipTo {
  name?: string | null;
  address_line?: string | null;
  address_line_two?: string | null;
}

export interface ShipmentProduct {
  name: string;
  image: string;
  quantity: number;
}

/** One row of `GET orders/:id/shipments?with_products=true`: the engine's shipment
 *  (courier name/logo, `tracking_url`) plus the branch-shipment tracking fields.
 *  Dates are store-time `Y-m-d H:i:s`; legacy shipments send them as null.
 *  Product lines come from order `items`, not this payload. */
export type Shipment = NonNullable<Order['shipments']>[number] & {
  products?: ShipmentProduct[];
  estimated_delivery_at?: string | null;
  actual_delivered_at?: string | null;
  tracking_embed_link?: string | null;
  driver_info?: ShipmentDriver | null;
  ship_to?: ShipmentShipTo | null;
};

export type TrackedOrder = Omit<Order, 'shipments'> & { shipments?: Shipment[] };
/** List API has no shipments; the banner and details page fetch them per order.
 *  `items` is on the list row when fetched with `WITH_ITEMS`. */
export type OrderCard = OrderListItem & { items?: Order['items']; shipments?: Shipment[] };
