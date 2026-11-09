// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import tailwind from 'tailwindcss';
import { compileString } from 'sass';
import { beforeAll, describe, expect, it } from 'vitest';

// The inline home sheet through the real pipeline: Sass, then Tailwind with critical.tailwind.cjs
// (its content scan, safelist and the Twilight plugin expand @apply and emit the utilities).
let css = '';
const selectors = new Set<string>();

beforeAll(async () => {
  const source = readFileSync('app/styles/critical.scss', 'utf8').replace(/@config[^\n]*\n/, '');
  const sassCss = compileString(source, {
    loadPaths: ['app/styles'],
    silenceDeprecations: ['import'],
    url: new URL(`file://${resolve('app/styles/critical.scss')}`),
  }).css;
  const result = await postcss([
    tailwind({ config: resolve('app/styles/critical.tailwind.cjs') }),
  ]).process(sassCss, { from: 'app/styles/critical.scss' });
  css = result.css;
  postcss.parse(css).walkRules((rule) => rule.selectors.forEach((s) => selectors.add(s)));
}, 60_000);

const ruleBody = (selector: string) =>
  postcss
    .parse(css)
    .nodes.filter((n): n is postcss.Rule => n.type === 'rule' && n.selectors.includes(selector))
    .map((r) => r.toString())
    .join('\n');

describe('critical.scss through Tailwind', () => {
  it('leaves no Tailwind directive or @apply unexpanded', () => {
    expect(css).not.toMatch(/@tailwind|@apply|@config/);
  });

  it('carries the mobile shell rules', () => {
    expect(ruleBody('.app-inner')).toContain('padding-top');
    expect(ruleBody('#main-content')).toContain('overscroll-behavior-y: none');
  });

  it('carries the header and home block rules', () => {
    expect([...selectors].some((s) => s.startsWith('.home-banner-slider'))).toBe(true);
    expect(selectors).toContain('html:not(.mobile-webview) .desktop-header');
    expect(ruleBody('.s-slider-block__title h2')).toContain('font-size: 20px');
  });

  it('emits the utilities the first-screen components and the safelist use', () => {
    for (const selector of ['.s-button-small', '.object-cover', '.rounded-t-3xl']) {
      expect(selectors, selector).toContain(selector);
    }
  });

  it('leaves out page-only rules so the inline sheet stays small', () => {
    expect([...selectors].some((s) => s.includes('.category-products-grid'))).toBe(false);
    expect([...selectors].some((s) => s.includes('.product-details-gallery__thumbs'))).toBe(false);
  });
});
