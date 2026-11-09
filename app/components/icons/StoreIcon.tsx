import { Image } from '@salla.sa/twilight-theme-engine/common';
import { useStore } from '@salla.sa/twilight-theme-engine/hooks/useStore';
import { HomeIcon } from './HomeIcon';

/** The store logo at icon size, or the home icon when the store has none. */
export function StoreIcon() {
  const store = useStore();

  return store.icon ? (
    <Image
      src={store.icon}
      alt=""
      width={24}
      height={24}
      sizes="24px"
      srcSetWidths={[24, 48, 72]}
      noWrapper
      objectFit="contain"
      fetchPriority="low"
      className="h-6 w-6"
    />
  ) : (
    <HomeIcon />
  );
}
