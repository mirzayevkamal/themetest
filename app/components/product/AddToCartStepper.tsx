import { MinusIcon, PlusIcon, TrashIcon } from '../icons';
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import type { Product } from '@salla.sa/twilight-theme-engine/types';
import { SallaButton } from '@salla.sa/twilight-components-react';
import { SallaAddProductButton } from '@salla.sa/twilight-components-react/add-product-button';
import { suppressAddProductToast } from '../cart/AddProductToast';
import { useProductConsent } from './ProductConsent';
import { useAccentOutlined, useThemeSettings } from '../../hooks/useAccentStyle';
import { hapticImpact } from '@salla.sa/twilight-theme-engine/native-app';
import {
  cartDetails,
  cartItemOptionValues,
  type CartItemOptionValues,
  type SdkCart,
  type SdkCartItem,
} from '../cart/useCart';

interface CartLine {
  itemId: string;
  quantity: number;
  maxQuantity?: number;
  /** Selection captured from details(); used when no form is attached. */
  options?: CartItemOptionValues;
  /** Cart-row form holding the customer's *current* option choice. */
  form?: () => HTMLFormElement | null;
  /** Cart lines this product spans (one per option choice); cards drive only one. */
  lineCount?: number;
}

let serverLines: ReadonlyMap<number, CartLine> = new Map();
const listeners = new Set<() => void>();
let started = false;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

/** Same shape theme-grocery writes to `salla.storage` key `cart.items`. */
interface StoredCartItem {
  cartItemId?: string | number;
  quantity?: number;
  maxQuantity?: number;
  optimistic?: boolean;
  options?: CartItemOptionValues;
  lineCount?: number;
}

function persist() {
  const stored: Record<string, StoredCartItem> = {};
  serverLines.forEach((line, pid) => {
    stored[String(pid)] = {
      cartItemId: line.itemId,
      quantity: line.quantity,
      maxQuantity: line.maxQuantity,
      options: line.options,
      lineCount: line.lineCount,
    };
  });
  window.salla?.storage?.set('cart.items', stored);
}

function applyLines(next: ReadonlyMap<number, CartLine>) {
  serverLines = next;
  persist();
  listeners.forEach((cb) => cb());
}

type LineSource = Parameters<typeof cartItemOptionValues>[0] & {
  id: string | number;
  product_id: string | number;
  quantity: number;
  max_quantity?: number;
  /** Already-resolved values, as restored from storage. */
  optionValues?: CartItemOptionValues;
  lineCount?: number;
};

// Number() both here and in useCartLine: the cart API sends product_id as
// a number while the engine's Product.id is a string at runtime.
function linesFrom(items: ReadonlyArray<LineSource>): Map<number, CartLine> {
  const lines = new Map<number, CartLine>();
  for (const item of items) {
    const pid = Number(item.product_id);
    lines.set(pid, {
      itemId: String(item.id),
      quantity: item.quantity,
      maxQuantity: item.max_quantity,
      options: item.optionValues ?? cartItemOptionValues(item),
      lineCount: (lines.get(pid)?.lineCount ?? 0) + (item.lineCount ?? 1),
    });
  }
  return lines;
}

function seedFromStorage() {
  const stored = window.salla?.storage?.get('cart.items');
  if (!stored || typeof stored !== 'object') return;
  const next = linesFrom(
    Object.entries(stored as Record<string, StoredCartItem | null>).flatMap(([pid, entry]) =>
      !entry || entry.optimistic || entry.cartItemId == null
        ? []
        : [
            {
              id: entry.cartItemId,
              product_id: pid,
              quantity: Number(entry.quantity) || 0,
              max_quantity: entry.maxQuantity,
              optionValues: entry.options,
              lineCount: entry.lineCount,
            },
          ]
    )
  );
  if (next.size) {
    serverLines = next;
    listeners.forEach((cb) => cb());
  }
}

function applyDetails(items?: SdkCartItem[]) {
  if (items) applyLines(linesFrom(items));
}

/** updateItem is the raw form endpoint: a line with options must resend
 *  them alongside id + quantity or the server rejects the update. */
function lineFormData(line: CartLine, quantity: number): FormData {
  // The row form wins so a re-chosen option is what gets saved.
  const form = line.form?.();
  const formData = form ? new FormData(form) : new FormData();
  formData.set('id', line.itemId);
  formData.set('quantity', String(quantity));
  if (!form) {
    for (const [id, value] of Object.entries(line.options ?? {})) {
      if (Array.isArray(value)) value.forEach((v) => formData.append(`options[${id}][]`, v));
      else formData.append(`options[${id}]`, value);
    }
  }
  return formData;
}

async function refresh() {
  // A direct refresh supersedes any event-scheduled one — the SDK fires
  // cart::updated before the mutation promise resolves, so without this every
  // stepper sync would hit details() twice.
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  try {
    const res = await cartDetails(null, ['options']);
    applyDetails(res?.data?.cart?.items);
  } catch (error) {
    window.salla?.logger?.warn?.('cart lines refresh failed', error);
  }
}

// One shared, debounced details() refetch after any cart event.
function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refresh, 250);
}

// The SDK script loads async from the CDN, so window.salla usually doesn't
// exist yet while React hydrates — poll until it shows up.
function start() {
  const salla = window.salla;
  if (!salla?.onReady) {
    setTimeout(start, 250);
    return;
  }
  salla.onReady(() => {
    // theme-grocery's loadCartItemsMap(): paint from storage before details()
    // so a first tap cannot quickAdd on top of a line we already know about.
    seedFromStorage();
    refresh();
    for (const event of ['cart::updated', 'cart::item.updated']) {
      window.salla?.event.on(event, scheduleRefresh);
    }
    // latest.fetched already carries the full cart — consume it instead of
    // refetching (details() dispatches this event, so refetching here looped).
    window.salla?.event.on('cart::latest.fetched', (d: unknown) =>
      applyDetails((d as { data?: { cart?: SdkCart } } | undefined)?.data?.cart?.items)
    );
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!started) {
    started = true;
    start();
  }
  return () => {
    listeners.delete(cb);
  };
}

function useCartLine(productId: number | string): CartLine | undefined {
  return useSyncExternalStore(
    subscribe,
    () => serverLines.get(Number(productId)),
    () => undefined
  );
}

const SYNC_DELAY = 600;

// Serialized so a follow-up burst can't race a first-add that has no cart
// item id yet — each sync reads fresh server state when its turn comes.
let syncQueue: Promise<void> = Promise.resolve();

// Bumped on remove so a sync that already entered the queue (but has not
// finished) is treated as stale. Needed when the first add is queued and
// there is no server line to delete yet.
type SyncKey = number | string;
const syncEpoch = new Map<SyncKey, number>();

function epochOf(key: SyncKey): number {
  return syncEpoch.get(key) ?? 0;
}

function invalidateSync(key: SyncKey) {
  syncEpoch.set(key, epochOf(key) + 1);
}

/** Clears or seeds the shared cart-line store. Used by unit tests between cases. */
export function seedCartLinesFromStorageForTests() {
  seedFromStorage();
}

export function resetCartLinesForTests(
  items: Array<{
    id: string | number;
    product_id: number;
    quantity: number;
    max_quantity?: number;
  }> = []
) {
  serverLines = linesFrom(items);
  syncQueue = Promise.resolve();
  syncEpoch.clear();
  listeners.forEach((cb) => cb());
}

/** Parks the shared sync queue so a later enqueue stays pending. Test-only. */
export function parkSyncQueueForTests(): () => void {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  syncQueue = syncQueue.then(() => gate);
  return release;
}

// ok=false (mutation failed or was superseded) still clears the matching
// pending value but must not confirm the target as reached.
function finish(done: (ok: boolean) => void) {
  return async (ok: boolean) => {
    try {
      await refresh();
    } finally {
      done(ok);
    }
  };
}

/** Runs `mutate` after every earlier sync, then refreshes the lines and calls
 *  `done`. `mutate` returns a boolean when it sent nothing: `done` gets that
 *  value right away, with no refresh. */
function enqueue(done: (ok: boolean) => void, mutate: () => Promise<boolean | void>) {
  const settled = finish(done);
  syncQueue = syncQueue.then(async () => {
    try {
      const skipped = await mutate();
      if (typeof skipped === 'boolean') {
        done(skipped);
        return;
      }
      await settled(true);
    } catch (error) {
      window.salla?.logger?.warn?.('cart stepper sync failed', error);
      notifyCartError(error);
      await settled(false);
    }
  });
}

// withoutNotifier also mutes the SDK's own 422 alert, so surface the backend's
// first field message (e.g. "product already in cart") ourselves, like theme-grocery.
function notifyCartError(error: unknown) {
  const data = (
    error as {
      response?: {
        data?: { error?: { message?: string; fields?: Record<string, string | string[]> } };
      };
    }
  )?.response?.data?.error;
  const message = Object.values(data?.fields ?? {}).flat()[0] ?? data?.message;
  if (message) window.salla?.notify.error(message);
}

function enqueueSync(
  productId: number | string,
  fromQty: number,
  target: number,
  done: (ok: boolean) => void,
  exactLine?: CartLine
) {
  const pid = Number(productId);
  const key = exactLine?.itemId ?? pid;
  const epoch = epochOf(key);
  enqueue(done, async () => {
    if (epochOf(key) !== epoch) return false;
    const delta = target - fromQty;
    // An exact line always syncs: the row form's options may have changed
    // even when the quantity did not.
    if (delta === 0 && !exactLine) return true;
    const salla = window.salla;
    if (!exactLine && delta > 0) {
      // quickAdd adds `delta` to the line (creates it when missing).
      // withoutNotifier + suppressAddProductToast keep the card silent.
      suppressAddProductToast();
      const res = await salla?.api.withoutNotifier(() =>
        salla.cart.api.addItem({ id: pid, quantity: delta, endpoint: 'quickAdd' })
      );
      // Consume the response's cart payload (when present) so the created
      // line's id is known even if every follow-up details() fails —
      // otherwise a queued reconcile-delete has nothing to delete and the
      // removed product resurfaces on the next successful refresh.
      applyDetails((res as { data?: { cart?: SdkCart } } | undefined)?.data?.cart?.items);
      return;
    }
    const line = exactLine ?? serverLines.get(pid);
    if (!line) return false;
    const formData = lineFormData(line, target);
    await salla?.api.withoutNotifier(() => salla.cart.api.updateItem(formData));
  });
}

/** Deletes the line if a first-add that was already in flight created one. */
function enqueueReconcileDelete(productId: number | string, done: (ok: boolean) => void) {
  const pid = Number(productId);
  enqueue(done, async () => {
    // The in-flight add's refresh may have failed, leaving serverLines
    // without the line it created — refetch before concluding it's absent.
    if (!serverLines.has(pid)) await refresh();
    const itemId = serverLines.get(pid)?.itemId;
    if (!itemId) return false;
    const salla = window.salla;
    await salla?.api.withoutNotifier(() => salla.cart.api.deleteItem(itemId));
  });
}

function enqueueDelete(itemId: string, done: (ok: boolean) => void) {
  enqueue(done, async () => {
    const salla = window.salla;
    await salla?.api.withoutNotifier(() => salla.cart.api.deleteItem(itemId));
  });
}

const collapsedClasses =
  'absolute bottom-1 end-1 z-1 flex size-7.5 items-center justify-center ' +
  'rounded-lg border bg-brand-reverse shadow-[0_4px_4px_rgba(0,0,0,0.04)]';
// `accent_style`: soft (brand "+" on a faint border) or outlined (full brand border, ink "+").
const softClasses = 'border-brand-tint-hover text-brand';
const outlinedClasses = 'border-brand text-ink';

// Figma's out-of-stock chip, in the image's top-end corner. When the merchant shows the
// wishlist heart, that corner is the heart's: the chip moves to the bottom row, level with the
// disabled "+" and clipped before it, as Salla's card puts its out-of-stock badge at the bottom.
const outOfStockBadgeClasses =
  'pointer-events-none absolute z-1 whitespace-nowrap rounded-lg bg-light-grey p-1 ' +
  'text-xxs font-normal leading-3 text-silver-dark';
const outOfStockBadgeCorner = 'top-1 end-1';
const outOfStockBadgeBottomRow = 'bottom-2 start-1 max-w-[calc(100%-2.75rem)] truncate';

// The "+" tile, greyed out, in its usual bottom corner.
const outOfStockTileClasses =
  'absolute bottom-1 end-1 z-1 flex size-7.5 items-center justify-center rounded-lg ' +
  'bg-light-grey text-silver-light';

type Translate = ReturnType<typeof useTranslation>['t'];

/** "-" turns into a trash can on the last unit. */
const decreaseLabel = (t: Translate, quantity: number) =>
  quantity > 1
    ? t('pages.cart.decrease_quantity', 'Decrease quantity')
    : t('pages.cart.remove_item', 'Remove from cart');

/** Debounced, optimistic quantity control for one product's cart line.
 *  Shared by the card overlay stepper and the cart page's row stepper. */
function useQuantityStepper(productId: number | string, exactLine?: CartLine) {
  const productLine = useCartLine(productId);
  const line = exactLine ?? productLine;
  const syncKey = exactLine?.itemId ?? Number(productId);

  // Optimistic quantity while taps are being debounced; null = server truth.
  const [pending, setPending] = useState<number | null>(null);
  const pendingRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Qty at the start of the current burst — same as theme-grocery's _debounceFromQty.
  const fromQtyRef = useRef<number | null>(null);
  // Quantity this hook last pushed successfully. Shown until the authoritative
  // line moves, because settling a sync only refreshes the shared store — the
  // parent may still pass a stale exactLine.quantity, and falling straight
  // back to it would snap the row back and mis-base the next tap.
  const confirmedRef = useRef<number | null>(null);

  // Any movement in the authoritative line supersedes our confirmation.
  const lineQtyRef = useRef<number | null>(null);
  if (line && lineQtyRef.current !== null && lineQtyRef.current !== line.quantity) {
    confirmedRef.current = null;
  }
  if (line) {
    lineQtyRef.current = line.quantity;
  }

  const settle =
    (target: number) =>
    (ok: boolean): void => {
      if (pendingRef.current !== target) return;
      if (ok) confirmedRef.current = target;
      pendingRef.current = null;
      setPending(null);
    };

  const cancelDebounce = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    fromQtyRef.current = null;
  };

  const change = (target: number) => {
    target = Math.max(0, target);
    // Same chain as the returned quantity: once a settled sync is only
    // visible via confirmedRef (parent props lag), basing the next burst on
    // line.quantity would compute deltas against a value nobody sees.
    const current = pendingRef.current ?? confirmedRef.current ?? line?.quantity ?? 0;

    // Same native haptics as theme-tania's card: medium on add, light on decrease/remove.
    hapticImpact(target > current ? 'medium' : 'light');

    // Trash at qty 1: cancel any in-flight burst and delete now. Invalidate
    // queued syncs so a first-add that already entered the queue cannot land
    // after the customer visibly removed it.
    if (target <= 0) {
      cancelDebounce();
      invalidateSync(syncKey);
      pendingRef.current = 0;
      setPending(0);
      if (!line) {
        enqueueReconcileDelete(productId, settle(0));
        return;
      }
      enqueueDelete(line.itemId, settle(0));
      return;
    }

    if (fromQtyRef.current === null) {
      fromQtyRef.current = current;
    }
    pendingRef.current = target;
    setPending(target);

    if (timerRef.current) clearTimeout(timerRef.current);
    const fromQty = fromQtyRef.current;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      fromQtyRef.current = null;
      enqueueSync(productId, fromQty, target, settle(target), exactLine);
    }, SYNC_DELAY);
  };

  return { line, quantity: pending ?? confirmedRef.current ?? line?.quantity ?? 0, change };
}

export const OWN_FLOW_TYPES = new Set<string>(['booking', 'donating', 'financial_support']);

export function AddToCartStepper({ product }: { product: Product }) {
  const { t } = useTranslation();
  const { line, quantity, change } = useQuantityStepper(product.id);
  const outlined = useAccentOutlined();
  // Theme-specific key (twilight.json) the engine's ThemeSettings type doesn't list.
  const withWishlist = useThemeSettings()?.show_wishlist === true;
  const consent = useProductConsent(product);

  const addLabel = t('pages.products.add_to_cart', 'Add to Cart');

  // Out of stock: the chip, and the "+" disabled in its corner.
  if (product.status !== 'sale') {
    const outOfStockLabel = t('pages.products.out_of_stock', 'Out of Stock');

    return (
      <>
        <span
          aria-hidden
          className={`${outOfStockBadgeClasses} ${withWishlist ? outOfStockBadgeBottomRow : outOfStockBadgeCorner}`}
        >
          {outOfStockLabel}
        </span>
        <button
          type="button"
          aria-label={outOfStockLabel}
          title={outOfStockLabel}
          disabled
          className={outOfStockTileClasses}
        >
          <PlusIcon />
        </button>
      </>
    );
  }

  // Booking and donations can't be quick-added; salla-add-product-button runs
  // their own flows, as on the engine card.
  if (OWN_FLOW_TYPES.has(product.type)) {
    return (
      <span className="contents" onClickCapture={consent.onClickCapture}>
        <SallaAddProductButton
          productId={product.id}
          productStatus={product.status}
          productType={product.type}
          aria-label={addLabel}
          className={`s-product-card-add-button${outlined ? ' s-product-card-add-button--outlined' : ''}`}
        >
          <PlusIcon />
        </SallaAddProductButton>
      </span>
    );
  }

  // Everything else quick-adds, options included, like theme-grocery's card:
  // the server picks the default options and "-" resends the line's options.
  const maxQuantity = line?.maxQuantity ?? product.max_quantity;
  const atMax = !!maxQuantity && quantity >= maxQuantity;

  // With several option lines the card can't tell which one "-" should change,
  // so it only adds; the cart manages each line.
  if (quantity <= 0 || (line?.lineCount ?? 1) > 1) {
    return (
      <button
        type="button"
        aria-label={addLabel}
        onClick={() => consent.guard(() => change(quantity + 1))}
        className={`${collapsedClasses} ${outlined ? outlinedClasses : softClasses}`}
      >
        <PlusIcon />
      </button>
    );
  }

  return (
    <div
      data-in-cart
      className="absolute bottom-1 end-1 start-1 z-1 flex h-8 items-center justify-between rounded-lg bg-brand-reverse p-px"
    >
      <button
        type="button"
        aria-label={decreaseLabel(t, quantity)}
        onClick={() => change(quantity - 1)}
        className="flex size-7.5 items-center justify-center rounded-lg bg-white text-silver shadow-[0_4px_4px_rgba(0,0,0,0.04)]"
      >
        {quantity > 1 ? <MinusIcon /> : <TrashIcon />}
      </button>
      <span className="text-[12px] font-semibold leading-none text-ink">{quantity}</span>
      <button
        type="button"
        aria-label={addLabel}
        onClick={() => change(quantity + 1)}
        disabled={atMax}
        className="flex size-7.5 items-center justify-center rounded-lg bg-brand text-brand-reverse disabled:opacity-50"
      >
        <PlusIcon />
      </button>
    </div>
  );
}

/** Cart-page row stepper — same debounced sync as the card overlay. */
export function CartLineStepper({
  productId,
  itemId,
  quantity: initialQuantity,
  maxQuantity,
  formRef,
}: {
  productId: number | string;
  itemId: number | string;
  quantity: number;
  maxQuantity?: number;
  /** Row form whose `options[..]` fields are sent with every update. */
  formRef?: RefObject<HTMLFormElement | null>;
}) {
  const { line, quantity, change } = useQuantityStepper(productId, {
    itemId: String(itemId),
    quantity: initialQuantity,
    maxQuantity,
    form: () => formRef?.current ?? null,
  });
  const max = line?.maxQuantity ?? maxQuantity;

  // Re-choosing an option saves it at the current quantity, through the same
  // debounced queue as the buttons.
  const onOptionChange = useEffectEvent(() => change(quantity));
  useEffect(() => {
    const form = formRef?.current;
    if (!form) return;
    const onChange = (e: Event) => {
      if ((e.target as HTMLInputElement | null)?.name?.startsWith('options[')) onOptionChange();
    };
    form.addEventListener('change', onChange);
    return () => form.removeEventListener('change', onChange);
  }, [formRef]);
  return <StepperPill quantity={quantity} change={change} atMax={!!max && quantity >= max} />;
}

/** Inline stepper keyed by product only: `fallback` (a "+" by default) until
 *  the product is in the cart, then the same pill as the cart row. */
export function ProductLineStepper({
  productId,
  fallback,
}: {
  productId: number | string;
  fallback?: ReactNode;
}) {
  const { t } = useTranslation();
  const outlined = useAccentOutlined();
  const { line, quantity, change } = useQuantityStepper(productId);
  const max = line?.maxQuantity;

  if (quantity <= 0 || (line?.lineCount ?? 1) > 1) {
    if (fallback) return fallback;
    return (
      <button
        type="button"
        aria-label={t('pages.products.add_to_cart', 'Add to Cart')}
        onClick={() => change(quantity + 1)}
        className={`flex size-[30px] shrink-0 items-center justify-center rounded-lg border bg-brand-reverse ${
          outlined ? outlinedClasses : softClasses
        }`}
      >
        <PlusIcon />
      </button>
    );
  }
  return <StepperPill quantity={quantity} change={change} atMax={!!max && quantity >= max} />;
}

function StepperPill({
  quantity,
  change,
  atMax,
}: {
  quantity: number;
  change: (target: number) => void;
  atMax: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1.5">
      <SallaButton
        type="button"
        shape="btn"
        size="small"
        color="light"
        ariaLabel={decreaseLabel(t, quantity)}
        onClick={() => change(quantity - 1)}
        className="!size-[30px] !min-h-0 !min-w-0 !flex-none !rounded-lg !border-0 !bg-white !p-0 !text-silver !shadow-[0_4px_4px_rgba(0,0,0,0.04)] hover:!bg-white [&_svg]:!size-4"
      >
        {quantity > 1 ? <MinusIcon /> : <TrashIcon />}
      </SallaButton>
      <span className="w-6 text-center text-[12px] font-semibold leading-none text-ink">
        {quantity}
      </span>
      <SallaButton
        type="button"
        shape="btn"
        size="small"
        color="primary"
        ariaLabel={t('pages.products.add_to_cart', 'Add to Cart')}
        onClick={() => change(quantity + 1)}
        disabled={atMax}
        className="cta-button !size-[30px] !min-h-0 !min-w-0 !flex-none !rounded-lg !border-0 !bg-brand !p-0 !text-brand-reverse hover:!bg-brand [&_svg]:!size-4"
      >
        <PlusIcon />
      </SallaButton>
    </div>
  );
}
