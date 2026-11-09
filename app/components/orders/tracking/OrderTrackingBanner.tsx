import { useSyncExternalStore } from 'react';
import { useUser } from '@salla.sa/twilight-theme-engine/hooks/useUser';
import { ActiveOrderBanner } from './ActiveOrderBanner';
import { useActiveOrders } from './queries';
import { useLiveTrackingEnabled } from './useLiveTrackingEnabled';

// ponytail: the stack shows the 3 newest; add a "+N" affordance if customers juggle more.
const MAX_STACKED_ORDERS = 3;

// Landscape phones: the pinned stack would eat the scroll area, so only the newest order shows.
const SHORT_VIEWPORT_MQ = '(max-height: 500px)';
const isShortViewport = () => window.matchMedia?.(SHORT_VIEWPORT_MQ)?.matches ?? false;
const subscribeShortViewport = (onChange: () => void) => {
  const media = window.matchMedia?.(SHORT_VIEWPORT_MQ);
  media?.addEventListener('change', onChange);
  return () => media?.removeEventListener('change', onChange);
};
const useShortViewport = () =>
  useSyncExternalStore(subscribeShortViewport, isShortViewport, () => false);

/** In-flight orders as a card stack: the newest in front, older ones peeking
 *  their header row above it. Client-only fetch + poll on home and the orders list. */
export function OrderTrackingBanner({ className = '' }: { className?: string }) {
  const { isLoggedIn } = useUser();
  const live = useLiveTrackingEnabled();
  const limit = useShortViewport() ? 1 : MAX_STACKED_ORDERS;
  // Oldest first, so the newest paints in front.
  const stack = useActiveOrders(Boolean(isLoggedIn) && live)
    .slice(0, limit)
    .reverse();
  if (!stack.length) return null;
  return (
    <div className={`order-tracking-banner shrink-0 px-4 py-2 ${className}`}>
      {stack.map((order, index) => (
        <div
          key={order.id}
          className={`relative z-0 ${index < stack.length - 1 ? 'order-tracking-banner__peek h-7' : ''}`}
        >
          <ActiveOrderBanner order={order} />
        </div>
      ))}
    </div>
  );
}
