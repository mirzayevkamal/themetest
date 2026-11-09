import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({ invalidate: vi.fn(), navigate: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => router,
}));

import { useMobileUiUpdate } from '../../app/hooks/useMobileUiUpdate';

function installSallaEvent(native = false) {
  const handlers = new Map<string, Set<(data?: unknown) => void>>();
  (window as unknown as { salla: unknown }).salla = {
    mobile: { isEnabled: () => native },
    onReady: () => Promise.resolve(),
    event: {
      on: (event: string, callback: (data?: unknown) => void) => {
        (handlers.get(event) ?? handlers.set(event, new Set()).get(event)!).add(callback);
      },
      off: (event: string, callback: (data?: unknown) => void) => {
        handlers.get(event)?.delete(callback);
      },
    },
  };

  return (event: string, data?: unknown) => handlers.get(event)?.forEach((cb) => cb(data));
}

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// The subscriptions attach after `salla.onReady()` resolves.
async function mount(queryClient: QueryClient) {
  const result = renderHook(() => useMobileUiUpdate(), { wrapper: wrapper(queryClient) });
  await act(async () => {});
  return result;
}

describe('useMobileUiUpdate', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    router.invalidate.mockReset();
    router.invalidate.mockResolvedValue(undefined);
    router.navigate.mockReset();
    delete (window as unknown as { salla?: unknown }).salla;
  });

  afterEach(() => {
    queryClient.clear();
    delete (window as unknown as { salla?: unknown }).salla;
  });

  it('refetches the page when the native bullet delivery sheet selects a place', async () => {
    const emit = installSallaEvent(true);
    const refetchQueries = vi.spyOn(queryClient, 'refetchQueries');
    await mount(queryClient);

    act(() => emit('salla::bullet-delivery.select', { type: 'address' }));

    await waitFor(() => {
      expect(router.invalidate).toHaveBeenCalledOnce();
      expect(refetchQueries).toHaveBeenCalledWith({ type: 'active' });
    });
  });

  it('leaves the web bullet delivery selection to the SDK sheet', async () => {
    const emit = installSallaEvent(false);
    const refetchQueries = vi.spyOn(queryClient, 'refetchQueries');
    await mount(queryClient);

    act(() => emit('salla::bullet-delivery.select', { type: 'address' }));
    await act(async () => {});

    expect(router.invalidate).not.toHaveBeenCalled();
    expect(refetchQueries).not.toHaveBeenCalled();
  });

  it('stops refetching on unmount', async () => {
    const emit = installSallaEvent(true);
    const { unmount } = await mount(queryClient);

    unmount();
    act(() => emit('salla::bullet-delivery.select', { type: 'address' }));

    expect(router.invalidate).not.toHaveBeenCalled();
  });

  // The engine handles these for every theme; a second listener would run them twice.
  it.each([
    ['mobile::ui.update', undefined],
    ['mobile::open.order', { id: 123 }],
    ['mobile::navigate.to', { url: '/offers' }],
  ])('leaves %s to the engine', async (event, data) => {
    const emit = installSallaEvent(true);
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    await mount(queryClient);

    act(() => emit(event, data));
    await act(async () => {});

    expect(router.invalidate).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
