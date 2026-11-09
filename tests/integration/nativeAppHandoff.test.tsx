import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({ invalidate: vi.fn(), navigate: vi.fn() }));

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    useRouter: () => router,
    useNavigate: () => vi.fn(),
    useParams: () => ({ locale: 'en' }),
  };
});

import { TwilightProvider } from '@salla.sa/twilight-theme-engine';
import { useMobileUiUpdate } from '../../app/hooks/useMobileUiUpdate';

/** The SDK as the native app's webview has it: loaded, ready, and inside the app. */
function installNativeSdk() {
  const handlers = new Map<string, Set<(data?: unknown) => void>>();
  (window as unknown as { salla: unknown }).salla = {
    init: vi.fn(),
    onReady: () => Promise.resolve(),
    mobile: { isEnabled: () => true },
    config: { get: () => undefined, set: () => {} },
    storage: { get: () => null, set: () => {}, remove: () => {} },
    event: {
      dispatch: () => {},
      on: (event: string, callback: (data?: unknown) => void) => {
        (handlers.get(event) ?? handlers.set(event, new Set()).get(event)!).add(callback);
      },
      off: (event: string, callback: (data?: unknown) => void) => {
        handlers.get(event)?.delete(callback);
      },
    },
  };
  return {
    emit: (event: string, data?: unknown) => handlers.get(event)?.forEach((cb) => cb(data)),
    listeners: (event: string) => handlers.get(event)?.size ?? 0,
  };
}

/** What `__root.tsx` mounts: the theme's own hook, and the engine's provider around the page. */
function Root() {
  useMobileUiUpdate();
  return (
    <TwilightProvider
      toast={false}
      routeClass={false}
      layout={({ children }: { children: ReactNode }) => <>{children}</>}
    >
      <main>page</main>
    </TwilightProvider>
  );
}

describe('native app events after the handoff to the engine', () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete (window as unknown as { salla?: unknown }).salla;
  });

  it('are handled once, by the engine, with the theme hook mounted next to it', async () => {
    router.invalidate.mockResolvedValue(undefined);
    const sdk = installNativeSdk();
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <Root />
      </QueryClientProvider>
    );

    // The engine listens once the SDK is ready and its navigation setup has loaded.
    await waitFor(() => expect(sdk.listeners('mobile::ui.update')).toBe(1));
    expect(sdk.listeners('mobile::open.order')).toBe(1);
    expect(sdk.listeners('mobile::navigate.to')).toBe(1);
    expect(sdk.listeners('mobile::ui.safearea')).toBe(1);

    act(() => sdk.emit('mobile::ui.update'));
    expect(router.invalidate).toHaveBeenCalledOnce();

    act(() => sdk.emit('mobile::open.order', { id: 123 }));
    expect(router.navigate).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith({ href: '/en/account/orders/123' });

    act(() => sdk.emit('mobile::ui.safearea', { top: 62, bottom: 34 }));
    expect(document.documentElement.style.getPropertyValue('--app-safe-area-top')).toBe('62px');
  });
});
