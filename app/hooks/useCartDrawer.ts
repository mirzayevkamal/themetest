import { createOverlayStore } from './overlayStore';

const drawer = createOverlayStore(false);

/** Opens the web-desktop cart drawer over the current page. */
export const openCartDrawer = () => drawer.open(true);

/** Dismisses the web-desktop cart drawer. */
export const closeCartDrawer = drawer.close;

/** True while the desktop cart drawer is open. Always false on SSR. */
export const useCartDrawerOpen = drawer.useValue;

export const resetCartDrawerForTests = drawer.close;
