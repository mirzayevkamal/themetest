import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  clearDeliveryIntent,
  marketPlace,
  openDeliverySheet,
  saveMarketPlace,
  useDeliveryScope,
} from '../../app/hooks/useBulletDelivery';

vi.mock('@salla.sa/twilight-theme-engine/providers', () => ({
  useTwilight: () => ({ store: null }),
}));

afterEach(() => {
  delete (window as { salla?: unknown }).salla;
  vi.unstubAllGlobals();
});

function memoryStorage(entries: Record<string, string> = {}) {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

describe('useDeliveryScope', () => {
  // jsdom here has no web storage, so the initial read yields the empty state.
  it('follows the select event payload inside the native app only', async () => {
    const handlers = new Map<string, (data?: unknown) => void>();
    let native = false;
    window.salla = {
      mobile: { isEnabled: () => native },
      onReady: () => Promise.resolve(),
      event: { on: (e: string, cb: (d?: unknown) => void) => handlers.set(e, cb), off: vi.fn() },
    } as unknown as typeof window.salla;

    const { result } = renderHook(() => useDeliveryScope());
    await act(async () => {});
    expect(result.current).toEqual({ hasAddress: false, label: '', pickup: false });

    const payload = {
      type: 'address',
      address_details: { city: { name: 'مكة المكرمة' }, district: { name: 'ولي العهد' } },
    };
    act(() => handlers.get('salla::bullet-delivery.select')?.(payload));
    expect(result.current).toEqual({ hasAddress: false, label: '', pickup: false });

    native = true;
    act(() => handlers.get('salla::bullet-delivery.select')?.(payload));
    expect(result.current).toEqual({
      hasAddress: true,
      label: 'ولي العهد، مكة المكرمة',
      pickup: false,
    });

    act(() =>
      handlers.get('salla::bullet-delivery.select')?.({
        type: 'branch',
        branch_details: { name: 'فرع العليا', city: 'الرياض' },
      })
    );
    expect(result.current).toEqual({ hasAddress: true, label: 'الرياض', pickup: true });
  });
});

describe('clearDeliveryIntent', () => {
  it('forgets the stored place and resets the header label', () => {
    const intent = JSON.stringify({ type: 'branch', branch_details: { city: 'الرياض' } });
    const session = memoryStorage({ bullet_delivery_intent: intent });
    vi.stubGlobal('sessionStorage', session);
    vi.stubGlobal('localStorage', memoryStorage({ bullet_delivery_intent: intent }));

    const { result } = renderHook(() => useDeliveryScope());
    expect(result.current).toEqual({ hasAddress: true, label: 'الرياض', pickup: true });

    act(() => clearDeliveryIntent());
    expect(session.getItem('bullet_delivery_intent')).toBeNull();
    expect(globalThis.localStorage.getItem('bullet_delivery_intent')).toBeNull();
    expect(result.current).toEqual({ hasAddress: false, label: '', pickup: false });
  });
});

describe('market places', () => {
  it('brings back the place picked in a market after switching away and back', () => {
    const intent = JSON.stringify({ type: 'branch', branch_details: { city: 'مكة المكرمة' } });
    vi.stubGlobal('sessionStorage', memoryStorage({ bullet_delivery_intent: intent }));
    vi.stubGlobal(
      'localStorage',
      memoryStorage({
        scope: JSON.stringify({ id: '1', allocation_type: 'branch', allocation_id: '676605929' }),
      })
    );
    const { result } = renderHook(() => useDeliveryScope());

    saveMarketPlace();
    globalThis.localStorage.setItem('scope', JSON.stringify({ id: '2' }));
    act(() => clearDeliveryIntent(marketPlace(2)));
    expect(marketPlace(2)).toBeUndefined();
    expect(result.current).toEqual({ hasAddress: false, label: '', pickup: false });

    const place = marketPlace('1');
    expect(place).toMatchObject({ allocation_type: 'branch', allocation_id: '676605929' });
    globalThis.localStorage.setItem('scope', JSON.stringify({ id: '1', ...place }));
    act(() => clearDeliveryIntent(place));
    expect(globalThis.sessionStorage.getItem('bullet_delivery_intent')).toBe(intent);
    expect(result.current).toEqual({ hasAddress: true, label: 'مكة المكرمة', pickup: true });
  });

  it('keeps a session-only place in sessionStorage, not localStorage', () => {
    const intent = JSON.stringify({ type: 'branch', branch_details: { city: 'جدة' } });
    vi.stubGlobal('sessionStorage', memoryStorage({ bullet_delivery_intent: intent }));
    vi.stubGlobal(
      'localStorage',
      memoryStorage({
        scope: JSON.stringify({ id: '1', allocation_type: 'branch', allocation_id: '7' }),
      })
    );

    saveMarketPlace();
    expect(globalThis.localStorage.getItem('grocery:market-places')).toBeNull();
    expect(marketPlace(1)).toMatchObject({ allocation_id: '7' });
    // A new session forgets it.
    vi.stubGlobal('sessionStorage', memoryStorage());
    expect(marketPlace(1)).toBeUndefined();
  });

  it('reads no place, instead of throwing, where storage is blocked', () => {
    const blocked = () => {
      throw new DOMException('denied', 'SecurityError');
    };
    const names = ['localStorage', 'sessionStorage'] as const;
    const saved = names.map((name) => Object.getOwnPropertyDescriptor(globalThis, name));
    for (const name of names) {
      Object.defineProperty(globalThis, name, { configurable: true, get: blocked });
    }
    try {
      expect(marketPlace(1)).toBeUndefined();
    } finally {
      names.forEach((name, i) => {
        const descriptor = saved[i];
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete (globalThis as Record<string, unknown>)[name];
      });
    }
  });

  it('saves nothing for a market where no place was picked', () => {
    vi.stubGlobal('sessionStorage', memoryStorage());
    vi.stubGlobal('localStorage', memoryStorage({ scope: JSON.stringify({ id: '1' }) }));

    saveMarketPlace();
    expect(marketPlace(1)).toBeUndefined();
  });
});

describe('clearDeliveryIntent where storage is blocked', () => {
  it('still signals the header instead of throwing', () => {
    const blocked = () => {
      throw new DOMException('denied', 'SecurityError');
    };
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: blocked });
    const onCleared = vi.fn();
    window.addEventListener('grocery:delivery-intent-cleared', onCleared);
    try {
      expect(() => clearDeliveryIntent()).not.toThrow();
      expect(onCleared).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener('grocery:delivery-intent-cleared', onCleared);
      if (saved) Object.defineProperty(globalThis, 'localStorage', saved);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });
});

describe('openDeliverySheet', () => {
  it('shares one sheet across taps made before the element is ready', async () => {
    const open = vi.fn(() => Promise.resolve());
    const first = openDeliverySheet();
    const second = openDeliverySheet();

    customElements.define(
      'salla-bullet-delivery',
      class extends HTMLElement {
        componentOnReady = () => Promise.resolve(this);
        open = open;
      }
    );

    await expect(Promise.all([first, second])).resolves.toBeDefined();
    expect(document.querySelectorAll('salla-bullet-delivery')).toHaveLength(1);
    expect(open).toHaveBeenCalledTimes(2);
  });
});
