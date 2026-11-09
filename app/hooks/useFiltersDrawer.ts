import { createOverlayStore } from './overlayStore';

const drawer = createOverlayStore(false);

/** Opens the filters drawer over the current page; the shell goes inert meanwhile. */
export const openFiltersDrawer = () => drawer.open(true);

/** Dismisses the filters drawer. */
export const closeFiltersDrawer = drawer.close;

/** True while the filters drawer is open. Always false on SSR. */
export const useFiltersDrawerOpen = drawer.useValue;

export const resetFiltersDrawerForTests = drawer.close;
