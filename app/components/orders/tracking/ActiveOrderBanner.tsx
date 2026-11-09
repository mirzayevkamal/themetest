import type { MouseEvent } from 'react';
import { Link } from '@salla.sa/twilight-theme-engine/common';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { isWebDesktop } from '../../../hooks/useIsWebDesktop';
import { openOrderDrawer } from '../../../hooks/useOrderDrawer';
import { TrackBasketIcon } from '../../icons';
import type { OrderCard } from '../types';
import { liveTracking, orderPhase, useEtaText } from './phase';
import { ProgressBars } from './ProgressBars';
import { useShipments } from './queries';

/** Card for the newest in-flight order: pinned under the list on the phone,
 *  floating bottom-center on web desktop (desktop.scss), where it opens the
 *  tracking drawer instead of the order route. */
export function ActiveOrderBanner({ order }: { order: OrderCard }) {
  const { t } = useTranslation();
  const phase = orderPhase(order.status.slug);
  const { data: shipments } = useShipments(order.id, { initial: order.shipments });
  const { eta } = liveTracking({ shipments: shipments ?? order.shipments });
  const etaText = useEtaText(eta);
  const items = order.items ?? [];
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const thumb = items[0]?.thumbnail;
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isWebDesktop() || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openOrderDrawer(order.id);
  };

  return (
    <Link
      to={`/account/orders/${order.id}`}
      onClick={onClick}
      className="order-tracking-banner__card flex items-start gap-2 rounded-xl border-0.5 border-brand bg-white p-2"
    >
      <span className="flex shrink-0 items-center">
        <span className="relative z-1 flex size-11 items-center justify-center rounded-full border border-neutral-100 bg-white">
          <TrackBasketIcon size={30} className="text-brand" />
          {count > 0 && (
            <span className="absolute -end-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full border border-hairline bg-discount text-[13px] font-semibold text-white">
              {count}
            </span>
          )}
        </span>
        {items[0] &&
          (thumb ? (
            <img
              src={thumb}
              alt=""
              className="-ms-[19px] size-11 rounded-full border border-neutral-100 object-cover"
            />
          ) : (
            <span className="-ms-[19px] size-11 rounded-full border border-neutral-100 bg-neutral-100" />
          ))}
      </span>
      {/* Line boxes are taller than the cap-height text boxes in the design, so the gaps are tighter. */}
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-col">
          <span className="flex items-center gap-2.5">
            {etaText && (
              <span className="min-w-0 flex-1 truncate text-sm font-black text-ink">{etaText}</span>
            )}
            <span className="ms-auto shrink-0 rounded bg-brand-reverse px-1.5 py-0.5 text-xs font-bold text-ink">
              {order.status.name}
            </span>
          </span>
          <span className="truncate text-[13px] leading-5 text-neutral-500">
            {t('pages.order.banner_title', 'بنحضرلك طلبك بدقة وعناية...')}
          </span>
        </span>
        <ProgressBars phase={phase} />
      </span>
    </Link>
  );
}
