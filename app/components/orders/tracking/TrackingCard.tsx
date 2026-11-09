import type { TrackedOrder } from '../types';
import { liveTracking, orderPhase, useEtaText, usePhaseCopy } from './phase';
import { ProgressBars } from './ProgressBars';

/** ETA, status chip, stage bars and the stage copy for an in-flight order. */
export function TrackingCard({ order }: { order: TrackedOrder }) {
  const phase = orderPhase(order.status.slug);
  const { title, message } = usePhaseCopy(phase);
  const eta = useEtaText(liveTracking(order).eta);

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-white p-3">
      <div className="flex items-start gap-2">
        {eta && <p className="min-w-0 flex-1 text-base font-black text-ink">{eta}</p>}
        <span className="ms-auto shrink-0 rounded bg-brand-reverse px-1.5 py-1 text-xs font-bold text-ink">
          {order.status.name}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <ProgressBars phase={phase} icons />
        <p className="text-sm font-bold text-ink">{title}</p>
        <p className="text-xs text-neutral-500">{message}</p>
      </div>
    </section>
  );
}
