import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProductSheet } from '../../../app/components/product/ProductSheet';
import { resetCartStoreForTests } from '../../../app/components/cart/useCart';

const onClose = vi.fn();

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

vi.mock('@salla.sa/twilight-theme-engine/skeleton', () => ({
  ProductDetailSkeleton: () => <p>skeleton</p>,
}));

vi.mock('@salla.sa/twilight-theme-engine/common', () => ({
  Link: ({ to, children, ...props }: React.PropsWithChildren<{ to: string }>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

beforeEach(() => {
  resetCartStoreForTests();
  delete (window as { salla?: unknown }).salla;
  onClose.mockClear();
});

describe('ProductSheet', () => {
  it('wraps the page in a dialog with a close control and a cart shortcut', () => {
    render(
      <ProductSheet onClose={onClose}>
        <p>page</p>
      </ProductSheet>
    );

    expect(screen.getByRole('dialog', { name: 'تفاصيل المنتج' })).toBeTruthy();
    expect(screen.getByText('page')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'السلة' }).getAttribute('href')).toBe('/cart');

    fireEvent.click(screen.getAllByRole('button', { name: 'إغلاق' })[1]);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the cart count badge from the SDK storage', async () => {
    window.salla = {
      storage: { get: () => 2 },
      event: { on: vi.fn(), off: vi.fn() },
    } as unknown as typeof window.salla;

    render(
      <ProductSheet onClose={onClose}>
        <p>page</p>
      </ProductSheet>
    );
    await act(async () => {});

    expect(screen.getByRole('link', { name: 'السلة' }).textContent).toBe('2');
  });

  it('keeps the chrome mounted and shows the skeleton while a lazy child loads', async () => {
    let resolve!: () => void;
    const pending = new Promise<void>((r) => (resolve = r));
    let ready = false;
    function LazyChild() {
      if (!ready) throw pending;
      return <p>page</p>;
    }

    render(
      <ProductSheet onClose={onClose}>
        <LazyChild />
      </ProductSheet>
    );
    const dialog = screen.getByRole('dialog');
    expect(screen.getByText('skeleton')).toBeTruthy();

    ready = true;
    await act(async () => resolve());

    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(screen.getByText('page')).toBeTruthy();
  });

  it('paints a server-rendered sheet in place instead of below the viewport', () => {
    const html = renderToString(
      <ProductSheet onClose={onClose}>
        <p>page</p>
      </ProductSheet>
    );

    expect(html).not.toContain('translateY(100%)');
    expect(html).not.toContain('opacity:0');
  });

  it('still slides up when opened on the client', () => {
    const { container } = render(
      <ProductSheet onClose={onClose}>
        <p>page</p>
      </ProductSheet>
    );

    const panel = container.querySelector<HTMLElement>('.product-sheet__panel');
    expect(panel?.style.transform).toContain('translateY(100%)');
  });
});
