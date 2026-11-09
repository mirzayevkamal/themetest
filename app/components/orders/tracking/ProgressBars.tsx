import { Fragment } from 'react';
import { TrackBasketIcon, TrackCarIcon, TrackCheckIcon, TrackPinIcon } from '../../icons';
import { phaseStep, progressFills, type OrderPhase } from './phase';

const STEP_ICONS = [TrackCheckIcon, TrackBasketIcon, TrackCarIcon, TrackPinIcon];

function StepIcon({ index, phase }: { index: number; phase: OrderPhase }) {
  const step = phaseStep(phase);
  if (index === 0 || index < step) return <TrackCheckIcon className="shrink-0 text-brand" />;
  const Icon = STEP_ICONS[index];
  return <Icon className={`shrink-0 ${index === step ? 'text-black' : 'text-silver'}`} />;
}

/** Confirmed → preparing → on the way → delivered bars; `icons` adds the stage
 *  glyphs between them (order page), the banner shows bars only. */
export function ProgressBars({ phase, icons = false }: { phase: OrderPhase; icons?: boolean }) {
  const fills = progressFills(phase, icons ? 3 : 4);
  return (
    <div className={`flex items-center gap-2.5 px-0.5 ${icons ? 'py-0.5' : ''}`}>
      {fills.map((ratio, i) => (
        <Fragment key={i}>
          {icons && <StepIcon index={i} phase={phase} />}
          <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-neutral-200">
            <span
              className="absolute inset-y-0 start-0 rounded-full bg-brand"
              style={{ width: `${ratio * 100}%` }}
            />
          </span>
        </Fragment>
      ))}
      {icons && <StepIcon index={3} phase={phase} />}
    </div>
  );
}
