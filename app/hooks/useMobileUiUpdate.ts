import { useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSallaEvent } from './sdk';
import { DELIVERY_SELECT_EVENT } from './useBulletDelivery';
import { isNativeApp } from '@salla.sa/twilight-theme-engine/native-app';

/** Re-runs the route loaders and refetches what is on screen, without a document reload. */
export function useRefreshPage(): () => Promise<unknown> {
  const router = useRouter();
  const queryClient = useQueryClient();

  return () =>
    Promise.allSettled([router.invalidate(), queryClient.refetchQueries({ type: 'active' })]);
}

/**
 * Refetches the page when the native Bullet Delivery sheet picks a place: the native app
 * writes the new scope to storage first, and the engine reads it from there on every request.
 * The app's own webview events (`mobile::ui.update`, `mobile::open.order`,
 * `mobile::navigate.to`, `mobile::ui.safearea`) are the engine's: a listener here would
 * handle them twice.
 */
export function useMobileUiUpdate(): void {
  const refresh = useRefreshPage();

  // Web: the SDK sheet owns what happens after a selection, so leave it alone.
  useSallaEvent(DELIVERY_SELECT_EVENT, () => {
    if (isNativeApp()) void refresh();
  });
}
