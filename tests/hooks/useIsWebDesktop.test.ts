import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { isWebDesktop, isWebWide, useIsWebDesktop } from '../../app/hooks/useIsWebDesktop';

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const media = {
    matches,
    media: '(min-width: 768px)',
    addEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    dispatch: (next: boolean) => {
      media.matches = next;
      listeners.forEach((listener) => listener({ matches: next } as MediaQueryListEvent));
    },
  };
  window.matchMedia = vi.fn(() => media as unknown as MediaQueryList);
  return media;
}

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.classList.remove('mobile-webview');
  delete (window as { salla?: unknown }).salla;
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe('isWebDesktop', () => {
  it('is true on a wide viewport outside the native webview', () => {
    mockMatchMedia(true);
    expect(isWebDesktop()).toBe(true);
  });

  it('is false on a phone-width viewport', () => {
    mockMatchMedia(false);
    expect(isWebDesktop()).toBe(false);
  });

  it('is false inside the native app', () => {
    mockMatchMedia(true);
    window.salla = { mobile: { isEnabled: () => true } } as unknown as typeof window.salla;
    expect(isWebDesktop()).toBe(false);
  });

  it('is false when html has mobile-webview', () => {
    mockMatchMedia(true);
    document.documentElement.classList.add('mobile-webview');
    expect(isWebDesktop()).toBe(false);
  });
});

describe('useIsWebDesktop', () => {
  it('follows viewport changes', () => {
    const media = mockMatchMedia(true);
    const { result } = renderHook(() => useIsWebDesktop());
    expect(result.current).toBe(true);

    act(() => media.dispatch(false));
    expect(result.current).toBe(false);
  });
});

describe('isWebWide', () => {
  function mockWidth(width: number) {
    window.matchMedia = vi.fn((query: string) => {
      const min = Number(/min-width: (\d+)px/.exec(query)?.[1]);
      return { matches: width >= min, addEventListener() {}, removeEventListener() {} };
    }) as unknown as typeof window.matchMedia;
  }

  it('is true from 1024px on web desktop', () => {
    mockWidth(1024);
    expect(isWebWide()).toBe(true);
  });

  it('is false on tablet widths', () => {
    mockWidth(900);
    expect(isWebWide()).toBe(false);
  });

  it('is false inside the native webview', () => {
    mockWidth(1280);
    document.documentElement.classList.add('mobile-webview');
    expect(isWebWide()).toBe(false);
  });
});
