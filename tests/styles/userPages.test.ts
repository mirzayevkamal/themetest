// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { compileWithTailwind } from './compileWithTailwind';

let styles: Awaited<ReturnType<typeof compileWithTailwind>>;
beforeAll(async () => {
  styles = await compileWithTailwind('04-components/user-pages');
}, 60_000);

const entry = '.account-wishlist .product-entry--wishlist';

describe('wishlist page stylesheet (Sass + Tailwind)', () => {
  it('leaves no @apply unexpanded', () => {
    expect(styles.unexpanded).toBe(0);
  });

  it("hides the SDK's disabled share widget, leaving the engine's share bar", () => {
    expect(styles.decls('#wishlist > salla-wishlist-actions')).toMatchObject({ display: 'none' });
  });

  it('opens the share menu from the end edge so it stays on a phone screen', () => {
    expect(styles.decls('.s-wishlist-actions-dropdown .s-wishlist-actions-menu')).toMatchObject({
      'inset-inline-start': 'auto',
      'inset-inline-end': '0',
      'max-width': 'calc(100vw - 2rem)',
    });
  });

  it('lays the cards out as divided rows', () => {
    expect(
      styles.decls(
        '.account-wishlist .s-products-list-row-cards > :not([hidden]) ~ :not([hidden])'
      )
    ).toHaveProperty('border-top-width');
    expect(styles.decls(entry)).toMatchObject({
      'flex-direction': 'row',
      'flex-wrap': 'wrap',
      'align-items': 'center',
    });
  });

  it('keeps 12rem for the name, so the buttons wrap under it on phones', () => {
    // By tag: in selection mode the engine puts a checkbox before the name block.
    expect(styles.decls(`${entry} > div:first-of-type`)).toMatchObject({
      flex: '1 1 12rem',
      'min-width': '0px',
    });
    expect(styles.decls(`${entry} > div:last-child`)).toMatchObject({
      'margin-inline-start': 'auto',
    });
    expect(styles.decls(`${entry} h3`)).toMatchObject({ '-webkit-line-clamp': '2' });
  });

  it('draws the share checkboxes in the brand colour, not the forms plugin blue', () => {
    for (const box of [
      '.account-wishlist .s-wishlist-select',
      '.account-wishlist .s-wishlist-actions-select-all input',
    ]) {
      // @tailwindcss/forms fills a checked box with `currentColor`.
      expect(styles.decls(box)).toMatchObject({
        color: 'var(--brand-primary)',
        width: '1.25rem',
        height: '1.25rem',
        'border-radius': '0.375rem',
      });
    }
  });
});
