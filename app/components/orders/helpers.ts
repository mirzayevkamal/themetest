import { useState } from 'react';
import { useRouter } from '@tanstack/react-router';

/** Figma order action pill; `primary` for the filled "reorder" variant, ink when `dark`. */
export const actionClass = (primary = false, dark = false) =>
  `flex flex-1 items-center justify-center rounded-lg p-2 text-xs leading-4 disabled:opacity-50 ${
    primary
      ? `font-bold ${dark ? 'bg-ink text-white' : 'bg-brand text-brand-reverse'}`
      : 'border border-neutral-100 text-ink'
  }`;

/** "26/07/2026" + "04:30 pm" from the API's `created_at.date`. The time is
 *  wrapped in LTR-isolate characters so RTL layouts keep "04:30 pm" order
 *  instead of flipping the "pm" to the far side of the digits. */
/** Store times carry no zone; read and format them as UTC so the shopper's
 *  timezone (and its DST shifts) never moves the store's wall clock. */
export const parseStoreTime = (date: string) => new Date(`${date.replace(' ', 'T')}Z`);

export function formatOrderDate(date: string) {
  const parsed = parseStoreTime(date);
  return {
    date: parsed.toLocaleDateString('en-GB', { timeZone: 'UTC' }),
    time: `\u2066${parsed.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC',
    })}\u2069`,
  };
}

export const statusClass = (slug = '') =>
  /cancel|reject|refund/.test(slug)
    ? 'bg-discount-tint'
    : /deliver|complet/.test(slug)
      ? 'bg-mint-tint'
      : 'bg-neutral-100';

/** One cart rebuild at a time across every reorder button on the page: a
 *  double-click, or a second card, would otherwise race `createCartFromOrder`
 *  and leave the cart holding a mix of two orders. */
let reordering = false;

/** Same SDK call the engine's order page uses, minus its confirm modal; a
 *  click before the SDK is up waits for it instead of being dropped. */
export function useReorder(orderId: number) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const reorder = () => {
    // Checked and set synchronously, so a double-click or a second card cannot
    // slip past it into a concurrent rebuild.
    if (reordering) return;
    reordering = true;
    setBusy(true);
    Promise.resolve(window.salla?.onReady?.())
      .then(() => window.salla?.order.createCartFromOrder(orderId))
      .then(() => router.navigate({ to: '/cart' }))
      .catch((error) => window.salla?.logger?.warn?.('reorder failed', error))
      .finally(() => {
        reordering = false;
        setBusy(false);
      });
  };

  return { reorder, busy };
}
