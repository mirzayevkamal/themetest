import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { formatOrderDate, parseStoreTime } from '../helpers';
import type { Shipment } from '../types';

export const POLL_MS = 30_000;

/**
 * Grocery in-flight slugs for the storefront list `status` query (a single
 * comma-separated string). Payment slugs are not accepted here. `completed`
 * is omitted: merchants use it as "تم التنفيذ" / done, parent of delivering.
 */
export const IN_FLIGHT_STATUS_SLUGS = [
  'under_review',
  'in_progress',
  'delivering',
  'shipped',
] as const;

export const ACTIVE_ORDER_STATUS = IN_FLIGHT_STATUS_SLUGS.join(',');

export function isInFlightStatus(slug = '') {
  return (IN_FLIGHT_STATUS_SLUGS as readonly string[]).includes(slug);
}

export type OrderPhase = 'confirmed' | 'preparing' | 'delivering' | 'delivered' | 'cancelled';

/** Grocery tracking stage for the progress bars. Independent of `status.name`. */
export function orderPhase(slug = ''): OrderPhase {
  if (/cancel|reject|refund|restor|payment_failed/.test(slug)) return 'cancelled';
  if (slug === 'delivered') return 'delivered';
  if (/deliver|ship/.test(slug)) return 'delivering';
  if (/progress|prepar|process|ready|completed/.test(slug)) return 'preparing';
  return 'confirmed';
}

/** Map, ETA and driver from the first shipment (`useShipments`). The map prefers
 *  the embeddable live link over the carrier page. Product lines live on order
 *  `items`, not here. */
export function liveTracking(order: { shipments?: Shipment[] }) {
  const shipment = order.shipments?.[0];
  return {
    mapUrl: shipment?.tracking_embed_link || undefined,
    eta: shipment?.estimated_delivery_at || undefined,
    driver: shipment?.driver_info || undefined,
    deliveredAt: shipment?.actual_delivered_at || undefined,
    shipTo: shipment?.ship_to || undefined,
  };
}

/** Whole minutes from `from` to `to`, both store-time strings. Undefined when
 *  either is missing or the span is not positive. */
export function minutesBetween(from?: string, to?: string) {
  if (!from || !to) return undefined;
  const minutes = Math.round(
    (parseStoreTime(to).getTime() - parseStoreTime(from).getTime()) / 60_000
  );
  return minutes > 0 ? minutes : undefined;
}

/** Index of the in-flight stage on the progress track; -1 for terminal phases. */
export const phaseStep = (phase: OrderPhase) =>
  ['confirmed', 'preparing', 'delivering'].indexOf(phase);

/** Fill ratio per progress bar, first bar = order confirmed: completed stages
 *  are full, the current stage fills half its bar, later stages stay empty. */
export function progressFills(phase: OrderPhase, count: number): number[] {
  const step = phaseStep(phase);
  const progress = step <= 0 ? 1 : step + 0.5;
  return Array.from({ length: count }, (_, i) => Math.min(1, Math.max(0, progress - i)));
}

/** Newest-first lists: the first in-flight order is the one to pin. */
export function findActiveOrder<T extends { status?: { slug?: string } }>(
  orders?: T[] | null
): T | undefined {
  return orders?.find((order) => isInFlightStatus(order.status?.slug));
}

/** Title + message for the in-flight stages (banner and tracking card). */
export function usePhaseCopy(phase: OrderPhase) {
  const { t } = useTranslation();
  const copy = {
    confirmed: {
      title: t('pages.order.phase.confirmed_title', 'طلبك قيد التنفيذ...'),
      message: t(
        'pages.order.phase.confirmed_message',
        'جاري التحقق والتأكد من طلبك والعمل عليه بدقة وعناية...'
      ),
    },
    preparing: {
      title: t('pages.order.phase.preparing_title', 'بنحضرلك طلبك بدقة وعناية...'),
      message: t(
        'pages.order.phase.preparing_message',
        'تم تأكيد طلبك وجاري العمل على تحضيره بدقة وعناية...'
      ),
    },
    delivering: {
      title: t('pages.order.phase.delivering_title', 'طلبك جاي بالطريق...'),
      message: t('pages.order.phase.delivering_message', 'جمعنا طلبك بدقة وعناية وهو بطريقه لك'),
    },
  } as const;
  return copy[phase as keyof typeof copy] ?? copy.confirmed;
}

/** Arrival time from the shipment's `estimated_delivery_at`; null until the
 *  merchant or carrier sets one. Shown as a clock time, not a countdown: the value
 *  has no timezone, so it can't be compared with the shopper's clock. */
export function useEtaText(eta: string | undefined) {
  const { t } = useTranslation();
  if (!eta) return null;
  return t('pages.order.eta_at', 'يوصلك الساعة {{time}}', { time: formatOrderDate(eta).time });
}
