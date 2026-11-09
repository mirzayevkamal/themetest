import { useSyncExternalStore } from 'react';
import { isNativeApp } from '@salla.sa/twilight-theme-engine/native-app';

/** Same cutoff as `$web-desktop-min` / Tailwind `screens.desktop`. */
const WEB_DESKTOP_MQ = '(min-width: 768px)';
/** Large web desktop, where the header menu shows (menus.scss). */
const WEB_WIDE_MQ = '(min-width: 1024px)';

function isMobileWebview(): boolean {
  if (typeof document === 'undefined') return false;
  return isNativeApp() || document.documentElement.classList.contains('mobile-webview');
}

/** Mirrors `@mixin web-desktop`: 768px+ and not the native webview. */
export function isWebDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  if (isMobileWebview()) return false;
  return window.matchMedia?.(WEB_DESKTOP_MQ)?.matches ?? false;
}

/** Web desktop at 1024px and up. */
export function isWebWide(): boolean {
  return isWebDesktop() && (window.matchMedia?.(WEB_WIDE_MQ)?.matches ?? false);
}

function subscribe(onChange: () => void) {
  const medias = [WEB_DESKTOP_MQ, WEB_WIDE_MQ].map((q) => window.matchMedia?.(q));
  medias.forEach((media) => media?.addEventListener('change', onChange));
  document.addEventListener('theme::ready', onChange);
  return () => {
    medias.forEach((media) => media?.removeEventListener('change', onChange));
    document.removeEventListener('theme::ready', onChange);
  };
}

const serverSnapshot = () => false;

/** SSR hydrates as phone, then follows the viewport; client-only mounts read it immediately. */
export function useIsWebDesktop(): boolean {
  return useSyncExternalStore(subscribe, isWebDesktop, serverSnapshot);
}

/** Like useIsWebDesktop, from 1024px. */
export function useIsWebWide(): boolean {
  return useSyncExternalStore(subscribe, isWebWide, serverSnapshot);
}
