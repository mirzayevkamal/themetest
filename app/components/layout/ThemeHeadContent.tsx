import { Asset, useRouter, useTags } from '@tanstack/react-router';

/**
 * The route's head tags without module preloads. Every page preloaded ~38 chunks
 * (cart, product, account, blog...) that raced the LCP image for bandwidth; the
 * entry script still imports whatever the current route needs.
 */
export function ThemeHeadContent() {
  const tags = useTags();
  const nonce = useRouter().options.ssr?.nonce;
  return tags
    .filter((tag) => !(tag.tag === 'link' && tag.attrs?.rel === 'modulepreload'))
    .map((tag) => <Asset {...tag} key={`tsr-meta-${JSON.stringify(tag)}`} nonce={nonce} />);
}
