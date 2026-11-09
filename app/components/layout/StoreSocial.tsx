import { SallaSocial } from '@salla.sa/twilight-components-react/social';
import type { StoreSocial as StoreSocialLinks } from '@salla.sa/twilight-theme-engine/types';

// SallaSocial skips WhatsApp, so a store with only that link renders nothing.
export function hasSocial(social: StoreSocialLinks | unknown[] | undefined): boolean {
  if (!social || Array.isArray(social)) return false;
  return Object.entries(social).some(([type, link]) => type !== 'whatsapp' && Boolean(link));
}

/** The store's social links, or nothing when it has none `SallaSocial` would show. */
export function StoreSocial({
  social,
  className,
}: {
  social: StoreSocialLinks | unknown[] | undefined;
  className?: string;
}) {
  return hasSocial(social) ? <SallaSocial className={className} /> : null;
}
