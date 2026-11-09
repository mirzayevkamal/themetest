import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function channel(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function contrastOnWhite(hex: string): number {
  const raw = hex.replace('#', '');
  const red = channel(parseInt(raw.slice(0, 2), 16));
  const green = channel(parseInt(raw.slice(2, 4), 16));
  const blue = channel(parseInt(raw.slice(4, 6), 16));
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return 1.05 / (luminance + 0.05);
}

describe('product card sale price contrast', () => {
  const source = readFileSync('app/styles/04-components/product-card.scss', 'utf8');
  const sale = source.slice(source.indexOf('&-sale-price {'), source.indexOf('&-content-title'));

  it('uses a darker sale price than the Figma discount token', () => {
    expect(sale).toContain('color: #d63c00 !important');
    expect(sale).not.toContain('text-discount');
    expect(contrastOnWhite('#d63c00')).toBeGreaterThanOrEqual(4.5);
    expect(contrastOnWhite('#ff4300')).toBeLessThan(4.5);
  });

  it('uses neutral-500 for the struck price', () => {
    expect(sale).toContain('text-neutral-500');
    expect(sale).not.toContain('text-silver');
    expect(contrastOnWhite('#737373')).toBeGreaterThanOrEqual(4.5);
    expect(contrastOnWhite('#adadad')).toBeLessThan(4.5);
  });
});
