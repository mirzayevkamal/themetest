import { useSyncExternalStore } from 'react';
import type { Money } from '@salla.sa/twilight-theme-engine/types';

// The engine types `window.salla` globally but only exports the SDK shapes
// through the API surface, so derive the cart payload from `api.cart.details`.
type Salla = NonNullable<typeof window.salla>;
export type SdkCart = Awaited<ReturnType<Salla['api']['cart']['details']>>['data']['cart'];
export type SdkCartItem = SdkCart['items'][number];

/** `salla.cart.api.details()` exists at runtime but the engine only types it
 *  under `api.cart`, so borrow that signature. */
export const cartDetails = (
  ...args: Parameters<Salla['api']['cart']['details']>
): ReturnType<Salla['api']['cart']['details']> | undefined =>
  (window.salla?.cart?.api as Salla['api']['cart'] | undefined)?.details?.(...args);

type AmountValue = number | string | Money | null | undefined;

/** Values the cart update endpoint expects under `options[id]`: the selected
 *  detail id(s) for choice options, the raw value for text-like ones. Without
 *  them `updateItem` rejects any line that has options. */
export type CartItemOptionValues = Record<string, string | string[]>;

export function cartItemOptionValues(item: {
  options?: ReadonlyArray<{
    id: number | string;
    type?: string;
    value?: unknown;
    details?: ReadonlyArray<{ id: number | string; is_selected?: boolean }>;
  }>;
}): CartItemOptionValues {
  const values: CartItemOptionValues = {};
  for (const option of item.options ?? []) {
    if (option.type === 'splitter') continue;
    if (option.details?.length) {
      const selected = option.details.filter((d) => d.is_selected).map((d) => String(d.id));
      if (selected.length === 1) values[option.id] = selected[0];
      else if (selected.length > 1) values[option.id] = selected;
    } else if (option.value != null && option.value !== '') {
      values[option.id] = String(option.value);
    }
  }
  return values;
}

export const amount = (value: AmountValue): number => {
  const raw = value && typeof value === 'object' ? value.amount : value;
  return Number(raw) || 0;
};

interface CartLinePrices {
  product_price?: AmountValue;
  price?: AmountValue;
}

/** A line's unit price before cart offers. `price` is the line total spread over
 *  its quantity once an offer applies (buy 2 get 1: 3.35 instead of 5.03), so it
 *  already contains the offer that `cart.discount` counts. */
export const cartLineUnitPrice = (item: CartLinePrices): number =>
  amount(item.product_price ?? item.price);

interface CartSavingsInput {
  items?: ReadonlyArray<
    CartLinePrices & {
      has_discount?: boolean;
      original_price?: AmountValue;
      quantity?: number;
    }
  >;
  discount?: AmountValue;
}

/** Item sale discounts + the cart-level discount (offers and coupon), in whole cents. */
export function cartSavings(cart: CartSavingsInput): number {
  const savings =
    (cart.items ?? []).reduce(
      (sum, item) =>
        item.has_discount
          ? sum +
            Math.max(0, amount(item.original_price) - cartLineUnitPrice(item)) *
              (item.quantity ?? 1)
          : sum,
      0
    ) + amount(cart.discount);
  return Math.round(savings * 100) / 100;
}

const EMPTY = { count: 0, items: [] } as unknown as SdkCart;

let current: SdkCart | null = null;
const listeners = new Set<() => void>();
let started = false;
let listening = false;
let pollId: ReturnType<typeof setTimeout> | undefined;
// Bumped by clearCartStore so a details() reply for the previous market is dropped.
let generation = 0;

function emit() {
  listeners.forEach((cb) => cb());
}

function setCurrent(next: SdkCart | null) {
  current = next;
  emit();
}

function hasLineItems(cart: { items?: unknown } | null | undefined): boolean {
  return Array.isArray(cart?.items) && (cart?.items as unknown[]).length > 0;
}

type Countable = { count?: number; items?: ReadonlyArray<unknown> } | null | undefined;

export function cartLineCount(cart: Countable): number {
  if (!cart) return 0;
  if (cart.count != null) return Number(cart.count) || 0;
  return cart.items?.length ?? 0;
}

/** True when the badge/count says there are items but the payload has no
 *  lines yet — a summary-only `cart::updated`, or storage seeded before
 *  details() returns. CartView must not treat this as empty. */
export function cartAwaitingLines(cart: Countable): boolean {
  return !!cart && !hasLineItems(cart) && cartLineCount(cart) > 0;
}

function cartFromUpdated(d: unknown): SdkCart | undefined {
  if (!d || typeof d !== 'object') return undefined;
  const o = d as { data?: { cart?: SdkCart }; count?: number; items?: unknown };
  if (o.data?.cart) return o.data.cart;
  if ('count' in o || 'items' in o) return o as SdkCart;
  return undefined;
}

/** Mutation `cart::updated` often carries count/totals with an empty `items`
 *  array. Applying that as the full cart emptied the page while the badge
 *  still showed storage's count. Keep existing lines and let details() fill in. */
function applyEventCart(cart: SdkCart) {
  if (hasLineItems(cart) || cartLineCount(cart) === 0) {
    setCurrent(cart);
    return;
  }
  if (current && hasLineItems(current)) {
    setCurrent({ ...current, ...cart, items: current.items } as SdkCart);
    return;
  }
  setCurrent({ ...(current ?? {}), ...cart, items: current?.items ?? [] } as SdkCart);
}

function applyStorageCount() {
  const n = Number(window.salla?.storage?.get('cart.summary.count')) || 0;
  if (current) setCurrent({ ...current, count: n } as SdkCart);
  else setCurrent(n ? ({ count: n, items: [] } as unknown as SdkCart) : EMPTY);
}

function onUpdated(d: unknown) {
  const cart = cartFromUpdated(d);
  if (cart) applyEventCart(cart);
  else applyStorageCount();
}

function onFetched(d: unknown) {
  const c = (d as { data?: { cart?: SdkCart } } | undefined)?.data?.cart;
  if (c) applyEventCart(c);
}

function seedFromStorage() {
  if (current) return;
  const n = Number(window.salla?.storage?.get('cart.summary.count')) || 0;
  if (n) current = { count: n, items: [] } as unknown as SdkCart;
}

async function refreshDetails() {
  const p = cartDetails(null, ['options']);
  if (!p) return;
  const requested = generation;
  try {
    const c = (await p)?.data?.cart;
    if (requested !== generation) return;
    if (c) setCurrent(c);
    else if (!hasLineItems(current)) setCurrent(EMPTY);
  } catch (err: unknown) {
    if (requested !== generation) return;
    // Guests with no cart id reject with CartNotCreated: that is an empty cart.
    // Other failures keep whatever we already have (storage seed, events, or
    // CartView's loader fallback).
    if ((err as { name?: string })?.name === 'CartNotCreated' && !hasLineItems(current)) {
      setCurrent(EMPTY);
    }
  }
}

type OptionsComponent = { host?: HTMLElement; enterCartMode?: () => Promise<void> };

/** Order options render outside the cart page too (the desktop drawer), where
 *  `<salla-product-options>` neither pre-selects saved values nor skips its
 *  product price lookup. It awaits this hook before both, and the SDK replays
 *  it for instances that already loaded, so registering once here, as soon as
 *  the SDK is ready on any page, covers the drawer's first open. */
let cartModeHooked = false;
function hookCartMode() {
  const hooks = window.salla?.hooks;
  if (cartModeHooked || !hooks?.registerHook) return;
  cartModeHooked = true;
  hooks.registerHook('salla-product-options', 'componentDidLoad', (component: OptionsComponent) =>
    component.host?.hasAttribute('data-cart-mode') ? component.enterCartMode?.() : undefined
  );
}

// A page restored from the back/forward cache keeps the snapshot it was
// frozen with; the cart may have changed on the page in between.
function onPageShow(e: PageTransitionEvent) {
  if (e.persisted) void refreshDetails();
}

function start() {
  const sdk = window.salla;
  // The engine's head stub is `{ onReady }` only; keep polling until the SDK
  // module installs `event`, or the listeners below are skipped for good.
  if (!sdk?.event?.on) {
    pollId = setTimeout(start, 250);
    return;
  }
  seedFromStorage();
  emit();
  if (!listening && sdk.event?.on) {
    listening = true;
    sdk.event.on('cart::updated', onUpdated);
    sdk.event.on('cart::latest.fetched', onFetched);
    sdk.event.on('cart::item.updated', onFetched);
    sdk.event.on('cart::details.fetched', onFetched);
    window.addEventListener('pageshow', onPageShow);
  }
  const fetch = () => {
    hookCartMode();
    void refreshDetails();
  };
  if (sdk.onReady) sdk.onReady(fetch);
  else fetch();
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

/** Shared cart store so the page, dock, and bottom-nav badge read the same payload. */
export function useCart(): SdkCart | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null
  );
}

export function useCartCount(): number {
  return cartLineCount(useCart());
}

/** Empties the shared cart (a market switch starts a new one), then reloads it from the SDK. */
export function clearCartStore() {
  generation += 1;
  setCurrent(EMPTY);
  void refreshDetails();
}

/** Clears the singleton between tests. */
export function resetCartStoreForTests(cart: SdkCart | null = null) {
  if (pollId) clearTimeout(pollId);
  pollId = undefined;
  current = cart;
  started = false;
  listening = false;
  cartModeHooked = false;
  const sdk = window.salla;
  if (sdk?.event?.off) {
    sdk.event.off('cart::updated', onUpdated);
    sdk.event.off('cart::latest.fetched', onFetched);
    sdk.event.off('cart::item.updated', onFetched);
    sdk.event.off('cart::details.fetched', onFetched);
  }
  window.removeEventListener('pageshow', onPageShow);
  emit();
}

/** Renders a translated template around a highlighted :amount placeholder,
 *  so word order stays correct in both locales. */
export function AmountTextInline({
  template,
  formattedAmount,
  amountClass = 'font-bold',
}: {
  template: string;
  formattedAmount: React.ReactNode;
  amountClass?: string;
}) {
  const [before, after] = template.split(':amount');
  return (
    <span>
      {before}
      <span className={amountClass}>{formattedAmount}</span>
      {after}
    </span>
  );
}
