// @vitest-environment node
import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { swiperCssAlias } from '../vite.config';

// swiper is the engine's dependency, not the theme's, so resolve it from there.
const requireFromEngine = createRequire(
  realpathSync('node_modules/@salla.sa/twilight-theme-engine/package.json')
);
const vendored = readFileSync('app/styles/vendor/swiper.css', 'utf8');
const classNames = (css: string) => new Set(css.match(/\.swiper-[\w-]+/g));

describe('swiper/css alias', () => {
  const aliased = ['swiper/css', 'swiper/css/navigation', 'swiper/css/autoplay'];

  it('swaps the stylesheets the SDK slider imports for an empty module', () => {
    for (const id of aliased) expect(swiperCssAlias.find.test(id), id).toBe(true);
    expect(swiperCssAlias.replacement).toMatch(/app\/lib\/empty-css\.ts$/);
  });

  it('leaves swiper itself and the stylesheets it does not vendor alone', () => {
    for (const id of ['swiper', 'swiper/modules', 'swiper/css/pagination', 'swiper/css/bundle']) {
      expect(swiperCssAlias.find.test(id), id).toBe(false);
    }
  });

  it('vendors every swiper class rule the aliased stylesheets carry', () => {
    const shipped = classNames(vendored);
    for (const id of aliased) {
      const missing = [...classNames(readFileSync(requireFromEngine.resolve(id), 'utf8'))].filter(
        (name) => !shipped.has(name)
      );
      expect(missing, id).toEqual([]);
    }
  });

  it('ships the vendored sheet in app.css ahead of the theme component layers', () => {
    const scss = readFileSync('app/styles/app.scss', 'utf8');
    const vendorAt = scss.indexOf("@import './vendor/swiper.css';");
    expect(vendorAt).toBeGreaterThan(-1);
    expect(vendorAt).toBeLessThan(scss.indexOf("@import './03-elements/"));
    expect(readFileSync('app/styles/app.css', 'utf8')).toContain('@import "./app.scss";');
  });
});
