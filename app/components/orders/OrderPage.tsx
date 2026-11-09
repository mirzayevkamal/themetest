import { SallaRatingModal } from '@salla.sa/twilight-components-react/rating-modal';
import { Link } from '@salla.sa/twilight-theme-engine/common';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import {
  ApplePayLogo,
  ChevronDownIcon,
  CreditCardIcon,
  MapPinFillIcon,
  SupportIcon,
} from '../icons';
import { AccountSidebarLayout } from '../account/AccountSidebar';
import { PageHeader } from '../navigation';
import { OrderItemRow } from './OrderItemRow';
import { OrderTotals } from './OrderTotals';
import { StatusHero } from './StatusHero';
import {
  DriverCard,
  isInFlightStatus,
  liveTracking,
  orderPhase,
  TrackingCard,
  useLiveOrder,
  useLiveTrackingEnabled,
  useShipments,
} from './tracking';
import type { ShipmentShipTo, TrackedOrder } from './types';
import { useDarkButtons } from '../../hooks/useAccentStyle';
import { useReorder } from './helpers';

type Receiver = { name?: string; address?: string } | null | undefined;

/** Name and lines from one source, never mixed: the shipment's `ship_to` (order
 *  details often carry no address), else the order receiver. */
export function orderAddress(shipTo?: ShipmentShipTo, receiver?: Receiver) {
  const lines = [shipTo?.address_line, shipTo?.address_line_two]
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line));
  if (lines.length) return { name: shipTo?.name?.trim(), lines };
  const address = receiver?.address?.trim();
  return address ? { name: receiver?.name, lines: [address] } : null;
}

function OrderAddress({ shipTo, receiver }: { shipTo?: ShipmentShipTo; receiver?: Receiver }) {
  const address = orderAddress(shipTo, receiver);
  if (!address) return null;
  return (
    <div className="flex items-start gap-2">
      <MapPinFillIcon className="mt-0.5 shrink-0 text-ink" />
      <div className="flex flex-col gap-0.5">
        {address.name && <p className="text-sm font-bold text-ink">{address.name}</p>}
        {address.lines.map((line) => (
          <p key={line} className="text-xs text-neutral-500">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

/** Order details from Figma: status hero (or live tracking while in flight),
 *  address, payment, items, totals. `onClose` is set inside the desktop drawer. */
export function OrderPage({
  order: loaded,
  onClose,
}: {
  order: TrackedOrder;
  onClose?: () => void;
}) {
  const { t } = useTranslation();
  const dark = useDarkButtons();
  const live = useLiveTrackingEnabled();
  const polled =
    useLiveOrder(loaded.id, { initial: loaded, fromLoader: true, enabled: live }) ?? loaded;
  const active = isInFlightStatus(polled.status.slug);
  // Tracking data and the delivery address live on the shipments endpoint, not
  // the order details, so it is fetched even with live tracking off; it only polls with it on.
  const { data: shipments } = useShipments(loaded.id, {
    active: live && active,
    initial: loaded.shipments,
  });
  const order: TrackedOrder = { ...polled, shipments };
  const { reorder, busy } = useReorder(order.id);

  const { mapUrl, driver, shipTo } = liveTracking(order);
  // The carrier may send the embed link early; the map waits for the delivering stage.
  const showMap = Boolean(
    active && live && mapUrl && orderPhase(polled.status.slug) === 'delivering'
  );
  const method = order.payment.method ?? '';
  const applePay = method === 'apple_pay';
  const showFooter = !active && (order.actions.reorderable || order.actions.rateable);
  const footerButton =
    'flex flex-1 items-center justify-center rounded-xl py-4 text-sm font-bold disabled:opacity-50';

  const page = (
    <div className="flex min-h-full flex-col bg-smoke">
      <PageHeader
        title={`#${order.reference_id}`}
        onClose={onClose}
        action={
          <Link
            to="/account/contact"
            aria-label={t('pages.order.support', 'تواصل مع الدعم')}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-neutral-100 bg-white p-2.5 text-ink"
          >
            <SupportIcon />
          </Link>
        }
      />
      {showMap && (
        <iframe
          src={mapUrl}
          title={t('pages.order.map_title', 'خريطة تتبع الطلب')}
          allow="geolocation"
          className="order-tracking-map w-full shrink-0 border-0"
        />
      )}
      <div
        className={`flex flex-col gap-2 p-4 ${showMap ? 'relative -mt-[88px] rounded-t-xl bg-smoke' : ''}`}
      >
        {active ? (
          <>
            <TrackingCard order={order} />
            {live && <DriverCard driver={driver} />}
          </>
        ) : (
          <StatusHero order={order} />
        )}

        <details open className="group rounded-xl bg-white p-3">
          <summary
            className={`flex list-none items-center gap-2.5 [&::-webkit-details-marker]:hidden ${active ? 'cursor-pointer' : 'pointer-events-none'}`}
          >
            <h2 className="flex-1 text-base font-bold text-brand">
              {t('pages.order.details', 'تفاصيل الطلب')}
            </h2>
            {active && (
              <span className="transition group-open:rotate-180">
                <ChevronDownIcon />
              </span>
            )}
          </summary>
          <div className="mt-6 flex flex-col gap-4 divide-y divide-neutral-100 [&>*+*]:pt-4">
            <OrderAddress shipTo={shipTo} receiver={order.receiver ?? order.shipping?.recipient} />
            {method && (
              <div className="flex items-center gap-2">
                <span className="flex h-[34px] w-14 items-center justify-center rounded-lg border border-neutral-100 text-ink">
                  {applePay ? <ApplePayLogo /> : <CreditCardIcon />}
                </span>
                <p className="text-xs text-neutral-500">
                  {t('pages.order.payment_method', 'طريقة الدفع:')}{' '}
                  <span className="text-sm font-bold text-ink">
                    {applePay ? 'Apple Pay' : method.replace(/_/g, ' ')}
                  </span>
                </p>
              </div>
            )}
            <ul className="flex flex-col gap-4">
              {order.items.map((item) => (
                <OrderItemRow key={item.id} item={item} editable={!active} />
              ))}
            </ul>
            <OrderTotals amounts={order.amounts} />
          </div>
        </details>
      </div>

      {showFooter && (
        <div className="sticky bottom-0 mt-auto flex gap-3 bg-white px-4 py-2 [box-shadow:0_-6px_16px_rgba(0,0,0,0.08)]">
          {order.actions.rateable && (
            <button
              type="button"
              onClick={() => window.salla?.event.dispatch('rating::open')}
              className={`${footerButton} border border-neutral-100 text-ink`}
            >
              {t('pages.orders.rate', 'قيم الطلب')}
            </button>
          )}
          {order.actions.reorderable && (
            <button
              type="button"
              onClick={reorder}
              disabled={busy}
              className={`${footerButton} ${dark ? 'bg-ink text-white' : 'bg-brand text-brand-reverse'}`}
            >
              {t('pages.orders.repeat', 'كرر الطلب')}
            </button>
          )}
        </div>
      )}
      {order.actions.rateable && <SallaRatingModal />}
    </div>
  );
  // The drawer shows the page alone; the route puts the account sidebar beside it.
  return onClose ? page : <AccountSidebarLayout>{page}</AccountSidebarLayout>;
}
