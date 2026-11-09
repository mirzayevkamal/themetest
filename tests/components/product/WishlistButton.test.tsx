import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { resetWishlistStore } from '@salla.sa/twilight-theme-engine/hooks/useWishlist';
import { WishlistButton } from '../../../app/components/product/WishlistButton';

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

const themeSettings: Record<string, unknown> = {};
vi.mock('@salla.sa/twilight-theme-engine/providers', () => ({
  useTwilight: () => ({ theme: { settings: themeSettings } }),
}));

const add = vi.fn(() => Promise.resolve());
const remove = vi.fn(() => Promise.resolve());

function sdk(saved: number[]) {
  window.salla = {
    storage: { get: () => saved },
    wishlist: { add, remove },
  } as never;
}

beforeEach(() => {
  themeSettings.show_wishlist = true;
  resetWishlistStore();
  localStorage.clear();
  add.mockClear();
  remove.mockClear();
});
afterEach(() => {
  delete (window as { salla?: unknown }).salla;
});

const heart = (container: HTMLElement) => container.querySelector('button[data-id]')!;

describe('WishlistButton', () => {
  it('renders nothing unless the merchant turns on show_wishlist (off by default)', () => {
    sdk([7]);
    delete themeSettings.show_wishlist;
    expect(render(<WishlistButton productId={7} />).container.innerHTML).toBe('');
    themeSettings.show_wishlist = false;
    expect(render(<WishlistButton productId={7} />).container.innerHTML).toBe('');
  });

  it('shows a saved product as added, filled in the brand colour', async () => {
    sdk([7]);
    const { container } = render(<WishlistButton productId={7} />);
    await waitFor(() => expect(heart(container).getAttribute('aria-pressed')).toBe('true'));
    expect(heart(container).className).toContain('text-brand');
    expect(heart(container).querySelector('path')?.getAttribute('fill')).toBe('currentColor');
    expect(heart(container).getAttribute('data-id')).toBe('7');
  });

  it('adds an unsaved product through the SDK, then shows it as added', async () => {
    sdk([]);
    const { container } = render(<WishlistButton productId={9} />);
    expect(heart(container).getAttribute('aria-pressed')).toBe('false');
    expect(heart(container).querySelector('path')?.getAttribute('fill')).toBe('none');

    await act(async () => fireEvent.click(heart(container)));
    expect(add).toHaveBeenCalledWith(9);
    await waitFor(() => expect(heart(container).getAttribute('aria-pressed')).toBe('true'));
  });

  it('removes a saved product through the SDK', async () => {
    sdk([7]);
    const { container } = render(<WishlistButton productId={7} />);
    await waitFor(() => expect(heart(container).getAttribute('aria-pressed')).toBe('true'));

    await act(async () => fireEvent.click(heart(container)));
    expect(remove).toHaveBeenCalledWith(7);
    await waitFor(() => expect(heart(container).getAttribute('aria-pressed')).toBe('false'));
  });
});
