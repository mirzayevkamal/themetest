import { describe, it, expect } from 'vitest';
import { cartSavings } from '../../../app/components/cart/useCart';

// Real `cart/details` lines for a 8.95 juice on sale at 5.03 with "buy 2 get 1".
const line = (quantity: number, price: number) => ({
  quantity,
  original_price: 8.95,
  product_price: 5.03,
  price,
  has_discount: true,
});

describe('cartSavings', () => {
  it('counts the sale discount when no offer applies', () => {
    expect(cartSavings({ items: [line(2, 5.03)], discount: 0 })).toBeCloseTo(7.84);
  });

  it('counts a buy-x-get-y offer once, not in the spread line price too', () => {
    // 3 × 8.95 regular, 10.06 paid: price is 10.06 / 3 and discount is the free unit.
    expect(cartSavings({ items: [line(3, 3.35)], discount: 5.03 })).toBeCloseTo(16.79);
    expect(cartSavings({ items: [line(4, 3.77)], discount: 5.03 })).toBeCloseTo(20.71);
    expect(cartSavings({ items: [line(6, 3.35)], discount: 10.06 })).toBeCloseTo(33.58);
  });

  it('rounds to whole cents', () => {
    // 5 × (8.95 − 5.03) + 5.03 is 24.629999999999995 in floating point.
    expect(cartSavings({ items: [line(5, 4.02)], discount: 5.03 })).toBe(24.63);
  });

  it('falls back to price when a payload has no product_price', () => {
    const { product_price: _, ...noProductPrice } = line(1, 5.03);
    expect(cartSavings({ items: [noProductPrice] })).toBeCloseTo(3.92);
  });
});
