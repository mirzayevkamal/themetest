import postcss, { type AtRule, type Rule } from 'postcss';
import { compileString } from 'sass';
import { describe, expect, it } from 'vitest';

// Wide phones and small tablets (481–767px) keep the phone layout; tiles must stay
// tile-sized and add columns instead of growing with the viewport.
const root = postcss.parse(
  compileString(
    [
      '01-settings/breakpoints',
      '04-components/slider',
      '04-components/desktop',
      '04-components/desktop-pages',
      '04-components/product',
    ]
      .map((p) => `@import '${p}';`)
      .join('\n'),
    {
      loadPaths: ['app/styles'],
      silenceDeprecations: ['import'],
    }
  ).css
);

const WIDE = '(min-width: 481px)';

function rulesIn(media: string): Rule[] {
  const rules: Rule[] = [];
  root.walkAtRules('media', (at: AtRule) => {
    if (at.params === media) at.walkRules((rule) => void rules.push(rule));
  });
  return rules;
}

describe('wide mobile tiles', () => {
  const wide = rulesIn(WIDE);
  const find = (selector: string) => wide.find((rule) => rule.selector === selector)?.toString();

  it('is not gated on the native webview, so a tablet inside the app gets it too', () => {
    expect(wide.length).toBeGreaterThan(0);
    for (const rule of wide) expect(rule.selector).not.toContain('mobile-webview');
  });

  it('pins slider cards to the 127px card with a 24px gap', () => {
    const card = find('.s-products-slider-card');
    expect(card).toContain('width: 151px !important');
    expect(card).toContain('padding: 0 !important');
    expect(card).toContain('padding-inline-end: 24px !important');
  });

  it('lets the tile grids add columns instead of stretching', () => {
    expect(find('.main-links-grid .main-links-grid__items')).toContain(
      'repeat(auto-fill, minmax(96px, 1fr))'
    );
    expect(find('.category-products-grid')).toContain('repeat(auto-fill, minmax(114px, 1fr))');
    expect(find('.product-page__related-row')).toContain('grid-auto-columns: 127px');
  });

  it('scales the highlight hero slide with the viewport so neighbours keep peeking', () => {
    const slide = wide.find((rule) =>
      rule.selector.endsWith(
        '.home-banner-slider--center-highlight .home-banner-slider__slide.swiper-slide'
      )
    );
    expect(slide?.toString()).toContain('width: min(585px, 62vw)');
  });

  it('caps the tracking card at the desktop width and centers it in its strip', () => {
    const card = find('.order-tracking-banner > *');
    expect(card).toContain('width: min(463px, 100%)');
    expect(card).toContain('margin-inline: auto');
    expect(find('.order-tracking-banner')).toBeUndefined();
  });
});
