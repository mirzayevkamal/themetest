import postcss from 'postcss';
import { compileString } from 'sass';
import { describe, expect, it } from 'vitest';

const css = compileString("@import '02-generic/common';", {
  loadPaths: ['app/styles'],
  silenceDeprecations: ['import'],
}).css;
const root = postcss.parse(css);

function declsFor(selector: string): string {
  let found = '';
  root.walkRules(selector, (rule) => {
    found += rule.toString();
  });
  return found;
}

describe('bottom sheet stylesheet', () => {
  it('clears the slide-in offset once a sheet is open', () => {
    expect(declsFor('.s-modal-body.s-modal-entering')).toContain('--tw-translate-y: 0px');
  });

  it('sizes sheets by the visible viewport so mobile browser toolbars cannot hide them', () => {
    expect(declsFor('.s-modal-container .s-modal-body')).toContain(
      'max-height: calc(100dvh - 2rem) !important'
    );
    expect(declsFor('.s-modal-spacer')).toContain('height: 100dvh');
  });
});
