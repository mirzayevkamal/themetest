import { Drawer } from '../layout/Drawer';
import { CartView } from './CartView';

/** Figma 3203:11694 / 3203:12313 — the cart in the web-desktop side drawer. */
export function CartDrawer({ onClose }: { onClose: () => void }) {
  return (
    <Drawer onClose={onClose}>
      <CartView onClose={onClose} />
    </Drawer>
  );
}
