import { useTwilight } from '@salla.sa/twilight-theme-engine/providers';

type ShippingSettings = { shipping?: { express_delivery_promise?: string | null } };

/** Express delivery promise for the shopper's market and location ("15 دقيقة"),
 *  already pluralized by the backend. Null when the market has no promise there. */
export function useDeliveryPromise(): string | null {
  const { store } = useTwilight();
  return (store as ShippingSettings | undefined)?.shipping?.express_delivery_promise || null;
}
