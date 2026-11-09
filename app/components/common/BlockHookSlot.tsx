import { HookSlot } from '@salla.sa/twilight-theme-engine/hooks';
import { PageBlocks } from '@salla.sa/twilight-theme-engine/home';
import type { BlockScope } from '@salla.sa/twilight-theme-engine/api/home';

interface BlockHookSlotProps {
  /** Exact hook name: apps match it as a literal string. */
  name: string;
  /** The classic `s-before-*` / `s-after-*` wrapper class that app CSS targets. */
  wrapper: string;
  className?: string;
  /** The product, category or page whose merchant blocks render here; none without it. */
  scope?: BlockScope;
}

// The classic storefront's dotted hooks (`product.single.*`, `product.index.*`), which the
// engine's own `product:*` slots don't cover: the merchant's blocks, then app injections.
export function BlockHookSlot({ name, wrapper, className, scope }: BlockHookSlotProps) {
  return (
    <div className={`s-blocks-wrapper ${wrapper}${className ? ` ${className}` : ''}`}>
      {scope && <PageBlocks hook={name} scope={scope} />}
      <HookSlot name={name} />
    </div>
  );
}
