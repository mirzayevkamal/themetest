// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { compileWithTailwind } from './compileWithTailwind';

let styles: Awaited<ReturnType<typeof compileWithTailwind>>;
beforeAll(async () => {
  styles = await compileWithTailwind('01-settings/breakpoints', '04-components/product');
}, 60_000);

const share = '.product-info__share';

describe('product share button (Sass + Tailwind)', () => {
  it('leaves no @apply unexpanded', () => {
    expect(styles.unexpanded).toBe(0);
  });

  it('draws a round smoke button like the wishlist heart, over the store CSS', () => {
    expect(styles.decls(share)).toMatchObject({
      width: '2.25rem',
      height: '2.25rem',
      'border-radius': '9999px',
      'background-color': '#F8F8F8 !important',
    });
  });

  it("stretches Salla's wrapper and trigger to the button, as Raed does", () => {
    expect(styles.decls(`${share} .s-social-share-wrapper`)).toMatchObject({
      width: '100%',
      height: '100%',
    });
    expect(styles.decls(`${share} .s-social-share-btn`)).toMatchObject({
      'border-width': '0px',
      'background-color': 'transparent',
    });
  });

  it('drops the list straight below the button from the end edge', () => {
    expect(styles.decls(`${share} .s-social-share-list`)).toMatchObject({
      left: 'auto',
      right: 'auto',
      'inset-inline-end': '0',
      'inset-block-start': 'calc(100% + 0.4rem)',
      'border-radius': '0.75rem',
    });
  });
});
