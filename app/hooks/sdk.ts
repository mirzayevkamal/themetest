import { useEffect, useEffectEvent } from 'react';

type Salla = NonNullable<typeof window.salla>;

// `close()` exists on the element at runtime; the component typings only list `open()`.
type LoginModalElement = HTMLElement & { close?: () => void };

/** Subscribes `handler` to an SDK event for the component's lifetime. The latest
 *  handler is the one called, so callers don't need a stable callback. `onReady`
 *  is the engine stub's wait — after it, `event` exists. */
export function useSallaEvent(event: string, handler: (data?: unknown) => void): void {
  const onEvent = useEffectEvent(handler);

  useEffect(() => {
    let sdk: Salla | undefined;
    let cancelled = false;
    const listener = (data?: unknown) => onEvent(data);
    void Promise.resolve(window.salla?.onReady?.()).then(() => {
      if (cancelled) return;
      sdk = window.salla;
      sdk?.event?.on(event, listener);
    });
    return () => {
      cancelled = true;
      sdk?.event?.off(event, listener);
    };
  }, [event]);
}

/** Guest gate, same recipe as theme-tania: once the SDK is ready (earlier and
 *  the accounts iframe gets a config without store.id → empty modal) open the
 *  login modal without its default full reload, and run `onLoggedIn` once on
 *  `auth::logged.in`. Returns the unsubscribe for the cancel / navigate-away
 *  case — that also closes the modal, which the layout mounts, so it doesn't
 *  linger over the next page. */
export function openLoginThen(onLoggedIn: () => void): () => void {
  let cancelled = false;
  let opened = false;
  let sdk: Salla | undefined;
  const off = () => sdk?.event?.off('auth::logged.in', done);
  const done = () => {
    off();
    onLoggedIn();
  };

  void Promise.resolve(window.salla?.onReady?.()).then(() => {
    if (cancelled) return;
    sdk = window.salla;
    sdk?.event?.on('auth::logged.in', done);
    sdk?.event?.dispatch('login::open', { withoutReload: true });
    opened = true;
  });

  return () => {
    cancelled = true;
    off();
    if (opened) document.querySelector<LoginModalElement>('salla-login-modal')?.close?.();
  };
}
