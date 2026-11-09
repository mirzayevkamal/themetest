import postcss, { type Rule } from 'postcss';
import { compileString } from 'sass';
import { describe, expect, it } from 'vitest';

const css = compileString(
  // home-blocks @extends a slider selector, so both partials compile together.
  "@import '01-settings/breakpoints';\n@import '04-components/home-blocks';\n@import '04-components/slider';",
  { loadPaths: ['app/styles'], silenceDeprecations: ['import'] }
).css;
const root = postcss.parse(css);

describe('home blocks stylesheet', () => {
  it('skips rendering unmounted off-screen blocks under the native app wrappers too', () => {
    let rule: Rule | undefined;
    root.walkRules((candidate) => {
      if (candidate.some((node) => node.type === 'decl' && node.prop === 'content-visibility')) {
        rule = candidate;
      }
    });
    // Descendant combinator: in the native app PullToRefresh and RouteGestureTransition
    // sit between #main-content and the blocks, so a child combinator would never match.
    expect(rule?.selector).toBe('#main-content .s-block:nth-of-type(n + 4)[style*=min-height]');
  });

  it('puts the held hero slide on its own layer so a fractional center cannot log a late LCP', () => {
    let decls = '';
    root.walkRules(
      '.home-banner-slider .home-banner-slider__static > .home-banner-slider__slide',
      (rule) => {
        decls += rule.toString();
      }
    );
    // A pixel-snapped hold paints a few px² smaller than Swiper's transformed copy.
    expect(decls).toContain('will-change: transform');
  });

  it('collapses any block that rendered nothing instead of keeping its reserved height', () => {
    let decls = '';
    root.walkRules('.s-block:empty', (rule) => {
      decls += rule.toString();
    });
    expect(decls).toContain('display: none');
  });

  it('never starts an adjacency rule from a collapsed block', () => {
    const siblingSelectors: string[] = [];
    root.walkRules((rule) => {
      siblingSelectors.push(
        ...rule.selectors.filter((sel) => /^\.s-block--[\w-]+[^ ]* \+/.test(sel))
      );
    });
    expect(siblingSelectors.length).toBeGreaterThan(0);
    expect(
      siblingSelectors.filter((sel) => !/^\.s-block--[\w-]+:where\(:not\(:empty\)\) \+/.test(sel))
    ).toEqual([]);
  });

  it('applies the adjacency, first and last block rules across one collapsed block', () => {
    const selectors = new Set<string>();
    root.walkRules((rule) => rule.selectors.forEach((sel) => selectors.add(sel)));
    expect(selectors).toContain(
      '.s-block--full-bg:where(:not(:empty)) + :where(.s-block:empty) + .s-block--full-bg'
    );
    expect(selectors).toContain(
      '.s-block--full-bg:where(:not(:empty)) + :where(.s-block:empty) + .merge-with-top-component'
    );
    expect(selectors).toContain(':where(.s-block:empty:first-of-type) + .s-block--full-bg');
    expect(selectors).toContain('#main-content .s-block:is(:has(+ .s-block:empty:last-of-type))');
  });

  it('spaces every home block 24px apart on mobile and adds no extra space around the hero slider', () => {
    let block = '';
    root.walkRules('.s-block', (rule) => {
      block += rule.toString();
    });
    expect(block).toContain('mt-6');

    let slider = '';
    root.walkRules(/^\.home-banner-slider/, (rule) => {
      slider += rule.toString();
    });
    expect(slider).not.toMatch(/\bpy-2\b/);
  });

  it('drops the slider-products-with-header floor once its wrapper is shown', () => {
    let decls = '';
    root.walkRules(
      '.s-block--slider-products-with-header:has(> .slider-products-with-header:not([hidden]))',
      (rule) => {
        decls += rule.toString();
      }
    );
    expect(decls).toContain('min-height: 0');
  });

  it('keeps no class-level floor on a loaded products slider', () => {
    const floors: string[] = [];
    root.walkRules(/s-block--products-slider/, (rule) => {
      rule.walkDecls('min-height', () => floors.push(rule.selector));
    });
    expect(floors).toEqual([]);
  });

  it('tints the main-links tiles from the merchant primary by default', () => {
    let decls = '';
    root.walkRules(/main-links-slider__thumb$/, (rule) => {
      decls += rule.toString();
    });
    expect(decls).toContain('bg-brand-reverse');
    expect(decls).not.toContain('mint');
  });
});
