import postcss from 'postcss';
import { compileString } from 'sass';
import { describe, expect, it } from 'vitest';

const css = compileString("@import '01-settings/breakpoints';\n@import '04-components/brands';", {
  loadPaths: ['app/styles'],
  silenceDeprecations: ['import'],
}).css;
const root = postcss.parse(css);

describe('brands stylesheet', () => {
  it('lifts a desktop brand tile on hover and keyboard focus', () => {
    const selectors: string[] = [];
    root.walkRules((rule) => {
      if (rule.selector.includes(':hover')) selectors.push(...rule.selectors);
    });
    expect(selectors).toEqual([
      'html:not(.mobile-webview) .brands-home__link:hover .brands-home__item',
      'html:not(.mobile-webview) .brands-home__link:focus-visible .brands-home__item',
    ]);
  });

  it('keeps the hover room inside the logo scroller out of the block height', () => {
    let list = '';
    root.walkRules('.brands-home__list', (rule) => {
      list += rule.toString();
    });
    // pb-4 is offset by -mb-4, so the next block sits 24px below the logos.
    expect(list).toMatch(/@apply[^;]*\bpt-1\b[^;]*\bpb-4\b[^;]*-mb-4/);
  });
});
