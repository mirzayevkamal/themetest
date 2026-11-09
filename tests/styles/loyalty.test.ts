// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { compileWithTailwind } from './compileWithTailwind';

let styles: Awaited<ReturnType<typeof compileWithTailwind>>;
beforeAll(async () => {
  styles = await compileWithTailwind('04-components/loyalty');
}, 60_000);

// jsdom has no layout, so card heights can't be measured; these are the declarations the
// equal heights and wrapping depend on, after Tailwind expands them.
describe('loyalty stylesheet (Sass + Tailwind)', () => {
  it('leaves no @apply unexpanded', () => {
    expect(styles.unexpanded).toBe(0);
  });

  it('lets long reward names wrap instead of cutting them to one line', () => {
    expect(styles.decls('.s-loyalty-program-rewards-name')).toMatchObject({
      'white-space': 'normal',
      'overflow-wrap': 'break-word',
      overflow: 'visible',
      'text-overflow': 'clip',
    });
  });

  it('stretches reward cards in a row to one height so their buttons line up', () => {
    // The slide no longer sizes to its own card, so the row's tallest card sets the height...
    expect(styles.decls('.s-loyalty-program-rewards-container .swiper-slide')).toMatchObject({
      height: 'auto',
    });
    expect(styles.decls('.s-loyalty-program-rewards-container-cart .swiper-slide')).toMatchObject({
      height: 'auto',
    });
    // ...the card's host and container fill it...
    expect(styles.decls('.s-loyalty-program-reward-host')).toMatchObject({
      display: 'block',
      height: '100%',
    });
    expect(styles.decls('.s-loyalty-program-reward-container')).toMatchObject({
      display: 'flex',
      'flex-direction': 'column',
      height: '100%',
    });
    // ...and the body grows, pushing the button to the bottom.
    expect(styles.decls('.s-loyalty-program-reward-container > [role=button]')).toMatchObject({
      flex: '1 1 0%',
    });
  });
});
