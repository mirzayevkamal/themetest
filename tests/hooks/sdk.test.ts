import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSallaEvent } from '../../app/hooks/sdk';

afterEach(() => {
  delete (window as { salla?: unknown }).salla;
});

describe('useSallaEvent', () => {
  it('does not throw when onReady fires before the event bus exists', async () => {
    window.salla = {
      onReady: () => Promise.resolve(),
    } as unknown as typeof window.salla;
    const handler = vi.fn();

    expect(() => renderHook(() => useSallaEvent('Product Added', handler))).not.toThrow();
    await act(async () => {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('subscribes after onReady', async () => {
    const on = vi.fn();
    let release: () => void = () => {};
    window.salla = {
      onReady: () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
      event: { on, off: vi.fn() },
    } as unknown as typeof window.salla;

    renderHook(() => useSallaEvent('Product Added', vi.fn()));
    await act(async () => {});
    expect(on).not.toHaveBeenCalled();

    await act(async () => {
      release();
    });
    expect(on).toHaveBeenCalledWith('Product Added', expect.any(Function));
  });

  it('calls the latest handler without re-subscribing', async () => {
    const on = vi.fn();
    const off = vi.fn();
    window.salla = {
      onReady: () => Promise.resolve(),
      event: { on, off },
    } as unknown as typeof window.salla;
    const first = vi.fn();
    const second = vi.fn();

    const { rerender } = renderHook(({ handler }) => useSallaEvent('Product Added', handler), {
      initialProps: { handler: first },
    });
    await act(async () => {});
    rerender({ handler: second });

    const listener = on.mock.calls[0][1] as (data?: unknown) => void;
    listener('payload');

    expect(on).toHaveBeenCalledTimes(1);
    expect(off).not.toHaveBeenCalled();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('payload');
  });
});
