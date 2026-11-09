import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ThemeHeadContent } from '../../../app/components/layout/ThemeHeadContent';

vi.mock('@tanstack/react-router', () => ({
  Asset: ({ tag, attrs }: { tag: string; attrs?: Record<string, string> }) =>
    tag === 'link' ? <link {...attrs} /> : null,
  useRouter: () => ({ options: { ssr: { nonce: undefined } } }),
  useTags: () => [
    { tag: 'link', attrs: { rel: 'modulepreload', href: '/assets/cart-chunk.js' } },
    { tag: 'link', attrs: { rel: 'canonical', href: 'https://store.test/ar' } },
    { tag: 'link', attrs: { rel: 'preload', as: 'image', href: '/hero.webp' } },
  ],
}));

describe('ThemeHeadContent', () => {
  it('renders the route head without module preloads, so no chunk races the LCP image', () => {
    const html = renderToString(<ThemeHeadContent />);

    expect(html).not.toContain('modulepreload');
    expect(html).toContain('rel="canonical"');
    expect(html).toContain('rel="preload"');
  });
});
