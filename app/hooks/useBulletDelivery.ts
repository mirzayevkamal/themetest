import { useEffect, useState } from 'react';
import { useTwilight } from '@salla.sa/twilight-theme-engine/providers';
import type { Store } from '@salla.sa/twilight-theme-engine/types';
import { useSallaEvent } from './sdk';
import { isNativeApp } from '@salla.sa/twilight-theme-engine/native-app';

interface BulletDeliverySettings {
  enabled?: boolean;
  settings?: {
    remember_last_session?: boolean;
    is_required?: boolean;
  };
}

/** SDK `scope` entry: the market plus, once the sheet confirms, the allocation. */
interface StoredScope {
  allocation_type?: string;
  allocation_id?: string | number;
}

/** The sheet's stored intent (`bullet_delivery_intent`), used only for the header label. */
interface StoredIntent {
  type?: 'address' | 'branch';
  address_details?: {
    city?: { name?: string };
    district?: { name?: string };
    short_address?: string;
  };
  branch_details?: { name?: string; city?: string };
}

function bulletDeliverySettings(
  store: Pick<Store, 'features' | 'settings'> | null | undefined
): BulletDeliverySettings | null {
  const settings = store?.settings?.bullet_delivery as unknown as BulletDeliverySettings | null;
  return store?.features?.includes('bullet-delivery-v2') && settings?.enabled ? settings : null;
}

/** Bullet Delivery is on in the market these store settings belong to. */
export function isBulletDeliveryOn(
  store: Pick<Store, 'features' | 'settings'> | null | undefined
): boolean {
  return bulletDeliverySettings(store) !== null;
}

function useBulletDeliverySettings(): BulletDeliverySettings | null {
  return bulletDeliverySettings(useTwilight().store);
}

/** Merchant has Bullet Delivery on, so the salla-bullet-delivery sheet is mounted and usable. */
export function useBulletDeliveryEnabled(): boolean {
  return useBulletDeliverySettings() !== null;
}

function readJson<T>(storage: Storage | undefined, key: string): T | null {
  try {
    const raw = storage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Emitted by the native app once storage holds the new place; the payload is the
 *  same shape as the stored intent. Only acted on inside the app: on the web the SDK
 *  sheet owns what happens after a selection. */
export const DELIVERY_SELECT_EVENT = 'salla::bullet-delivery.select';

interface DeliveryScope {
  hasAddress: boolean;
  label: string;
  /** Customer chose a branch to collect from rather than a delivery address. */
  pickup: boolean;
}

function scopeFromIntent(intent: StoredIntent | null, stored: StoredScope | null): DeliveryScope {
  const a = intent?.address_details;
  const label =
    intent?.type === 'branch'
      ? (intent.branch_details?.city ?? intent.branch_details?.name ?? '')
      : [a?.district?.name, a?.city?.name].filter(Boolean).join('، ') || a?.short_address || '';
  return {
    hasAddress: Boolean(a || intent?.branch_details || stored?.allocation_id != null),
    label,
    pickup: intent?.type === 'branch',
  };
}

const INTENT_CLEARED = 'grocery:delivery-intent-cleared';
const INTENT_KEY = 'bullet_delivery_intent';
const MARKET_PLACES_KEY = 'grocery:market-places';

type StorageName = 'localStorage' | 'sessionStorage';

/** The place picked in a market: its allocation plus the sheet's intent for the label. */
export interface MarketPlace {
  allocation_type: string;
  allocation_id: string | number;
  intent?: { storage: StorageName; value: string };
}

function readPlaces(name: StorageName): Record<string, MarketPlace> {
  try {
    return readJson<Record<string, MarketPlace>>(globalThis[name], MARKET_PLACES_KEY) ?? {};
  } catch {
    // The getter itself throws where storage is blocked.
    return {};
  }
}

/** Keeps the place picked in the current market so switching back can restore it. It is
 *  kept in the storage its intent lives in, so a session-only place ends with the session. */
export function saveMarketPlace(): void {
  try {
    const scope = readJson<StoredScope & { id?: string | number }>(localStorage, 'scope');
    if (scope?.id == null || !scope.allocation_type || scope.allocation_id == null) return;
    const id = String(scope.id);
    const storage = (['localStorage', 'sessionStorage'] as const).find((name) =>
      globalThis[name].getItem(INTENT_KEY)
    );
    const target = storage ?? 'localStorage';
    for (const name of ['localStorage', 'sessionStorage'] as const) {
      const places = readPlaces(name);
      if (name === target) {
        places[id] = {
          allocation_type: scope.allocation_type,
          allocation_id: scope.allocation_id,
          intent: storage && { storage, value: globalThis[storage].getItem(INTENT_KEY) as string },
        };
      } else if (id in places) {
        delete places[id];
      } else {
        continue;
      }
      globalThis[name].setItem(MARKET_PLACES_KEY, JSON.stringify(places));
    }
  } catch {
    // Blocked storage: the shopper picks again after switching back.
  }
}

/** The place saved for `marketId`, if the shopper picked one there before. */
export function marketPlace(marketId: string | number): MarketPlace | undefined {
  const id = String(marketId);
  return readPlaces('sessionStorage')[id] ?? readPlaces('localStorage')[id];
}

/** Swaps the chosen place for `place`'s on a market switch, or forgets it without one. */
export function clearDeliveryIntent(place?: MarketPlace) {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try {
      // The getter itself throws where storage is blocked, so it stays inside the try.
      globalThis[name]?.removeItem(INTENT_KEY);
      if (place?.intent?.storage === name) globalThis[name].setItem(INTENT_KEY, place.intent.value);
    } catch {
      // Storage can be blocked; there is nothing stored to clear then.
    }
  }
  window.dispatchEvent(new Event(INTENT_CLEARED));
}

/** Selected delivery place as the sheet stores it; read in an effect so SSR matches,
 *  then kept current from the select event so the header updates without a reload. */
export function useDeliveryScope(): DeliveryScope {
  const remember = Boolean(useBulletDeliverySettings()?.settings?.remember_last_session);
  const [scope, setScope] = useState<DeliveryScope>({
    hasAddress: false,
    label: '',
    pickup: false,
  });

  useEffect(() => {
    const read = () =>
      setScope(
        scopeFromIntent(
          readJson<StoredIntent>(
            remember ? globalThis.localStorage : globalThis.sessionStorage,
            INTENT_KEY
          ),
          readJson<StoredScope>(globalThis.localStorage, 'scope')
        )
      );
    read();
    window.addEventListener(INTENT_CLEARED, read);
    return () => window.removeEventListener(INTENT_CLEARED, read);
  }, [remember]);

  useSallaEvent(DELIVERY_SELECT_EVENT, (intent) => {
    if (!isNativeApp()) return;
    setScope(scopeFromIntent((intent as StoredIntent | undefined) ?? null, null));
  });

  return scope;
}

let sheet: Promise<HTMLSallaBulletDeliveryElement> | undefined;

async function mountSheet() {
  const el = document.createElement('salla-bullet-delivery');
  document.body.append(el);
  await customElements.whenDefined('salla-bullet-delivery');
  await el.componentOnReady();
  return el;
}

/** Opens the address/branch sheet. The SDK's own copy is re-appended on every
 *  body:end hook load, and a moved Stencil element drops its listeners for good, so
 *  the theme keeps one copy of its own that is never moved and calls `open()` on it.
 *  The readiness promise is shared so taps during initialization all wait for it. */
export async function openDeliverySheet() {
  sheet ??= mountSheet().catch((error: unknown) => {
    sheet = undefined;
    throw error;
  });
  await (await sheet).open();
}
