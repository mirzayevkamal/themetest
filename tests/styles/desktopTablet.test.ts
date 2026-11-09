import postcss, { type AtRule, type Rule } from 'postcss';
import { compileString } from 'sass';
import { describe, expect, it } from 'vitest';

const compile = (...partials: string[]) =>
  compileString(['01-settings/breakpoints', ...partials].map((p) => `@import '${p}';`).join('\n'), {
    loadPaths: ['app/styles'],
    silenceDeprecations: ['import'],
  }).css;

// app.scss order: desktop-pages.scss holds the non-home, non-product rules, right after desktop.scss.
const root = postcss.parse(compile('04-components/desktop', '04-components/desktop-pages'));

function rulesIn(media: string): Rule[] {
  const rules: Rule[] = [];
  root.walkAtRules('media', (at: AtRule) => {
    if (at.params === media) at.walkRules((rule) => void rules.push(rule));
  });
  return rules;
}

const TABLET = '(min-width: 768px) and (max-width: 1023px)';

describe('web tablet stylesheet', () => {
  const tablet = rulesIn(TABLET);

  it('scopes every tablet rule away from the mobile shell and the native webview', () => {
    expect(tablet.length).toBeGreaterThan(0);
    for (const rule of tablet) {
      for (const selector of rule.selectors) {
        expect(selector.startsWith('html:not(.mobile-webview) ')).toBe(true);
      }
    }
  });

  it('hides the header labels visually but keeps them for screen readers', () => {
    const label = tablet.find((rule) => rule.selector.endsWith('.desktop-header__label'));
    const decls = Object.fromEntries(
      (label?.nodes ?? []).flatMap((node) =>
        node.type === 'decl' ? [[node.prop, node.value]] : []
      )
    );
    expect(decls['clip-path']).toBe('inset(50%)');
    expect(decls.position).toBe('absolute');
    expect(decls.display).toBeUndefined();
    expect(decls.visibility).toBeUndefined();
  });

  it('caps the category grid at six columns', () => {
    const grid = tablet.find((rule) => rule.selector.endsWith('.main-links-grid__items'));
    expect(grid?.toString()).toContain('minmax(max(100px, (100% - 120px) / 6), 1fr)');
  });

  it('hides slider arrows only on touch screens', () => {
    const touch = rulesIn('(min-width: 768px) and (hover: none)');
    expect(touch.map((rule) => rule.selector)).toEqual([
      'html:not(.mobile-webview) .s-slider-block__title-nav',
    ]);
  });
});

describe('web desktop category toolbar', () => {
  const desktop = rulesIn('(min-width: 768px)');

  it('pins the tabs and chips under the desktop header', () => {
    const toolbar = desktop.find((rule) => rule.selector.endsWith(' .category-toolbar'));
    expect(toolbar?.toString()).toContain('top: var(--desktop-header-h)');
    expect(toolbar?.toString()).not.toContain('position: static');
  });

  it('lands chip jumps below the header and the pinned toolbar', () => {
    const section = desktop.find((rule) =>
      rule.selector.endsWith('.category-toolbar ~ .container > *')
    );
    expect(section?.toString()).toContain(
      'scroll-margin-top: calc(var(--desktop-header-h) + 133px)'
    );
  });

  it('matches the Figma row metrics: 51px tabs, 42px chips, flat arrows', () => {
    const rule = (suffix: string) =>
      desktop.find((r) => r.selector.endsWith(suffix))?.toString() ?? '';
    expect(rule('.category-toolbar nav a')).toContain('padding-block: 12px 11px');
    expect(rule('.category-toolbar .container button')).toContain('padding: 7px');
    expect(rule('.category-toolbar .container button')).toContain('line-height: 26px');
    const arrows = desktop.filter((r) =>
      r.selector.endsWith('.category-toolbar .s-slider-nav-arrow')
    );
    expect(arrows.at(-1)?.toString()).toContain('box-shadow: none');
  });

  it('colors the slider arrow icons with the merchant brand, not a fixed hex', () => {
    const button =
      desktop.find((r) => r.selector.endsWith('.s-slider-nav-arrow'))?.toString() ?? '';
    expect(button).toContain('border-brand-tint-hover');
    expect(button).not.toContain('mint');
    const icon =
      desktop.find((r) => r.selector.endsWith('.s-slider-button-icon'))?.toString() ?? '';
    expect(icon).toContain('@apply bg-brand');
    expect(icon).toContain('mask-repeat: no-repeat');
    const next = desktop.find((r) => r.selector.endsWith('.s-slider-next .s-slider-button-icon'));
    expect(next?.toString()).toMatch(/mask-image: url\(.*arrow-left-02-outline/);
    expect(next?.toString()).not.toContain('background-image');
  });

  it('hides the arrow at the end a row has reached without shifting the other one', () => {
    // The last match is the toolbar's override of the shared `opacity: 1` rule.
    const disabled = desktop
      .filter((r) =>
        r.selector.endsWith('.category-toolbar .s-slider-nav-arrow.swiper-button-disabled')
      )
      .at(-1);
    expect(disabled?.toString()).toContain('visibility: hidden');
    expect(disabled?.toString()).not.toContain('display: none');
  });
});

describe('web desktop header settings', () => {
  const desktop = rulesIn('(min-width: 768px)');
  const rule = (suffix: string) =>
    desktop.find((r) => r.selector.endsWith(suffix))?.toString() ?? '';

  it('pins the category toolbar at the top when the header is not sticky', () => {
    expect(rule('.desktop-header--static) .category-page > .category-toolbar')).toContain('top: 0');
    expect(
      rule('.desktop-header--static) .category-page > .category-toolbar ~ .container > *')
    ).toContain('scroll-margin-top: 133px');
  });

  it('turns the dark header text, store name, icons and controls light', () => {
    const text = desktop.find((r) =>
      r.selectors.some((s) =>
        s.endsWith('body.topnav-is-dark .desktop-header .desktop-header__brand > span')
      )
    );
    expect(text?.selectors.some((s) => s.endsWith('.desktop-header__tail'))).toBe(true);
    expect(text?.selectors.some((s) => s.endsWith('.desktop-header__promise'))).toBe(true);
    expect(text?.toString()).toContain('color: #fff');
    const iconFill = desktop.find((r) =>
      r.selectors.some((s) =>
        s.endsWith('body.topnav-is-dark .desktop-header .desktop-header__delivery button path')
      )
    );
    expect(iconFill?.selectors.some((s) => s.endsWith('.desktop-header__delivery > p path'))).toBe(
      true
    );
    expect(iconFill?.toString()).toContain('fill: currentColor');
    const header = rule('body.topnav-is-dark .desktop-header');
    expect(header).toContain('background-color: #000');
    expect(header).toContain('color: #fff');
    const control = rule('body.topnav-is-dark .desktop-header .desktop-header__control');
    expect(control).toContain('background-color: rgba(255, 255, 255, 0.1)');
    expect(control).toContain('color: #fff');
    expect(rule('body.topnav-is-dark .desktop-header .desktop-header__control img')).toContain(
      'invert(1)'
    );
  });
});

describe('web desktop home tiles', () => {
  const desktop = rulesIn('(min-width: 768px)');
  const find = (suffix: string) =>
    desktop.find((rule) => rule.selector === `html:not(.mobile-webview) ${suffix}`)?.toString();

  it('keeps category tiles at 114px instead of stretching with the window', () => {
    const grid = find('.main-links-grid .main-links-grid__items');
    expect(grid).toContain('repeat(auto-fill, 114px)');
    expect(grid).toContain('justify-content: space-between');
    expect(find('.main-links-slider__item h2')).toContain('font-size: 14px');
  });
});

// The critical sheets inline desktop.scss, so page-only rules must stay in desktop-pages.scss.
describe('critical desktop partial', () => {
  const css = compile('04-components/desktop');

  it.each([
    '.category-page',
    '.category-products-grid',
    '.category-toolbar .container',
    '.cart-page-header',
    '.mobile-sticky-bar',
    '.search-page {',
    '.s-modal-body',
  ])('leaves %s to desktop-pages.scss', (selector) => {
    expect(css).not.toContain(selector);
  });
});

describe('web desktop home spacing', () => {
  it('drops the mobile page-bottom padding so the last block sits 44px above the footer', () => {
    const selectors: string[] = [];
    root.walkRules((rule) => {
      if (rule.toString().includes('padding-bottom: 0') && rule.selector.includes('last-of-type'))
        selectors.push(...rule.selectors);
    });
    expect(selectors).toEqual([
      'html:not(.mobile-webview) #main-content .s-block:last-of-type',
      'html:not(.mobile-webview) #main-content .s-block:is(:has(+ .s-block:empty:last-of-type))',
    ]);
  });
});

describe('center-highlight banner card', () => {
  const HIGHLIGHT_SLIDE =
    '.home-banner-slider.home-banner-slider--center-highlight .home-banner-slider__slide.swiper-slide';
  const declsOf = (rules: Rule[], selector: string) =>
    rules
      .filter((rule) => rule.selectors.some((s) => s.endsWith(selector)))
      .flatMap((rule) => rule.nodes.flatMap((n) => (n.type === 'decl' ? [n] : [])));

  it('keeps the 754/320 shape on phone so a 1508×640 upload is not cropped', () => {
    const mobile = postcss.parse(compile('04-components/slider'));
    const rules: Rule[] = [];
    mobile.walkRules((rule) => {
      if (rule.parent?.type === 'root') rules.push(rule);
    });
    const ratio = declsOf(
      rules,
      '.home-banner-slider .home-banner-slider__slide.swiper-slide'
    ).find((d) => d.prop === 'aspect-ratio');
    expect(ratio?.value).toBe('754/320');
  });

  it('keeps the 754/320 shape for the desktop cards with highlight off', () => {
    const desktop = rulesIn('(min-width: 768px)');
    const card = declsOf(
      desktop.filter((rule) =>
        rule.selectors.includes(
          'html:not(.mobile-webview) .home-banner-slider .home-banner-slider__slide.swiper-slide'
        )
      ),
      '.swiper-slide'
    );
    expect(card.find((d) => d.prop === 'aspect-ratio')?.value).toBe('754/320');
    expect(card.find((d) => d.prop === 'width')?.value).toBe('364px');
    expect(card.find((d) => d.prop === 'height')?.value).toBe('auto');
  });

  it('keeps the same shape on tablet without the desktop 320px floor', () => {
    const tablet = rulesIn(TABLET);
    const ratio = declsOf(tablet, HIGHLIGHT_SLIDE).find((d) => d.prop === 'aspect-ratio');
    expect(ratio?.value).toBe('754/320');
    const floor = declsOf(tablet, '.s-block--enhanced-slider--center-highlight').find(
      (d) => d.prop === 'min-height'
    );
    expect(floor?.value).toBe('248px');
    expect(floor?.important).toBe(true);
  });
});

describe('sticky offsets under the desktop header', () => {
  const desktop = rulesIn('(min-width: 768px)');
  const decl = (selector: string, prop: string) =>
    desktop
      .filter((rule) => rule.selectors.includes(`html:not(.mobile-webview) ${selector}`))
      .flatMap((rule) => rule.nodes)
      .find((node) => node.type === 'decl' && node.prop === prop)
      ?.toString();

  it('grows the header height by the menu row when the header menu shows', () => {
    expect(decl('body', '--desktop-header-h')).toContain('80px');
    expect(decl('body:has(.desktop-header__menu)', '--desktop-header-h')).toContain('112px');
  });

  it('pins the cart summary, category toolbar and chip jumps from that height', () => {
    expect(decl('.cart-desktop__summary', 'top')).toContain('var(--desktop-header-h) + 16px');
    expect(decl('.category-page > .category-toolbar', 'top')).toContain('var(--desktop-header-h)');
    expect(
      decl('.category-page > .category-toolbar ~ .container > *', 'scroll-margin-top')
    ).toContain('var(--desktop-header-h) + 133px');
  });
});
