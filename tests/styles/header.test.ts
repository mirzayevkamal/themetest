import postcss from 'postcss';
import { compileString } from 'sass';
import { describe, expect, it } from 'vitest';

const css = compileString("@import '04-components/header';", {
  loadPaths: ['app/styles'],
  silenceDeprecations: ['import'],
}).css;
const root = postcss.parse(css);

function rule(selector: string): string {
  let found = '';
  root.walkRules((r) => {
    if (r.selectors.includes(selector)) found += r.toString();
  });
  return found;
}

describe('mobile header with topnav_is_dark', () => {
  it('turns the bar black', () => {
    expect(rule('body.topnav-is-dark .mobile-header')).toContain('@apply bg-black');
  });

  it('turns the delivery promise, its tail and the address white', () => {
    const text = rule('body.topnav-is-dark .mobile-header .mobile-header__promise > span');
    expect(text).toContain('@apply text-white');
    expect(text).toContain('.mobile-header__address');
  });

  it('lets the hardcoded icon fills follow the text color', () => {
    const fill = rule('body.topnav-is-dark .mobile-header .mobile-header__promise path');
    expect(fill).toContain('fill: currentColor');
    expect(fill).toContain('.mobile-header__address path');
  });
});

describe('mobile header with header_style brand', () => {
  it('rounds the platform reverse text colour to white or black, so any primary stays readable', () => {
    const text = rule('.mobile-header--brand .mobile-header__promise > span');
    expect(text).toContain('color: var(--color-primary-reverse, #fff)');
    expect(text).toContain('.mobile-header__address');
    expect(css).toContain('color: oklch(from var(--color-primary-reverse, #fff) round(l) 0 0)');
  });

  it('lets the hardcoded icon fills follow the text color', () => {
    expect(rule('.mobile-header--brand .mobile-header__promise path')).toContain(
      'fill: currentColor'
    );
  });
});
