import { useBulletDeliveryEnabled } from '../../../hooks/useBulletDelivery';

/** Live order tracking (banner, map, driver, polling) runs only in a market with Bullet
 *  Delivery on. Not `scope.display_as`: it is store-wide, so a market with delivery
 *  switched off still reports `delivery_pickup`. */
export function useLiveTrackingEnabled(): boolean {
  return useBulletDeliveryEnabled();
}
