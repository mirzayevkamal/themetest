import { createOverlayStore } from './overlayStore';

const drawer = createOverlayStore<string | null>(null);

/** Opens the web-desktop order tracking drawer for one order. */
export const openOrderDrawer = (id: string | number) => drawer.open(String(id));

/** Dismisses the web-desktop order tracking drawer. */
export const closeOrderDrawer = drawer.close;

let onArrival: string | null = null;

/** Queue the drawer for the next route: MainLayout opens it on arrival instead of
 *  closing drawers. In-memory only, so a reload or back/forward never reopens it. */
export const openOrderDrawerOnArrival = (id: string | number) => {
  onArrival = String(id);
};

/** Consumes the queued id; null when nothing was queued. */
export const takeOrderDrawerOnArrival = () => {
  const id = onArrival;
  onArrival = null;
  return id;
};

/** Order id while the desktop tracking drawer is open; null otherwise and on SSR. */
export const useOrderDrawerId = drawer.useValue;
