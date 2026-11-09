import { describe, expect, it } from 'vitest';
import {
  injectHomeComponents,
  isHomeComponentListRequest,
} from '../../preview-component-overrides/install';

describe('home component preview adapter', () => {
  it('matches only GET requests to the home component list endpoint', () => {
    expect(
      isHomeComponentListRequest('https://api.salla.dev/store/v1/component/list?locale=ar')
    ).toBe(true);
    expect(
      isHomeComponentListRequest('https://api.salla.dev/store/v1/component/list', {
        method: 'POST',
      })
    ).toBe(false);
    expect(isHomeComponentListRequest('https://api.salla.dev/store/v1/products')).toBe(false);
  });

  it('inserts fixtures at the requested position without exposing preview metadata', () => {
    const body = { data: [{ path: 'home.products-slider' }] };
    const rewritten = injectHomeComponents(body, [
      { __at: 0, path: 'home.promotional-banner', key: 'preview-banner' },
    ]) as typeof body;

    expect(rewritten.data).toEqual([
      { path: 'home.promotional-banner', key: 'preview-banner' },
      { path: 'home.products-slider' },
    ]);
    expect(rewritten.data[0]).not.toHaveProperty('__at');
  });

  it('applies out-of-order fixtures by ascending position', () => {
    const body = { data: [{ path: 'home.products-slider' }] };
    const rewritten = injectHomeComponents(body, [
      { __at: 1, path: 'home.enhanced-slider', key: 'preview-slider' },
      { __at: 0, path: 'home.promotional-banner', key: 'preview-banner' },
    ]) as typeof body;

    expect(rewritten.data.map(({ path }) => path)).toEqual([
      'home.promotional-banner',
      'home.enhanced-slider',
      'home.products-slider',
    ]);
  });

  it('leaves unexpected API payloads unchanged', () => {
    const body = { data: null };
    expect(injectHomeComponents(body, [])).toBe(body);
  });
});
