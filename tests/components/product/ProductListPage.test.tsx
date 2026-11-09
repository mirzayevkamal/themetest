import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const engineProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock('@salla.sa/twilight-theme-engine/routes/product-listing', () => ({
  ProductListPage: (props: Record<string, unknown>) => {
    engineProps.current = props;
    return <div data-testid="products-engine-list-render" />;
  },
}));
vi.mock('@salla.sa/twilight-theme-engine/home', () => ({
  PageBlocks: ({ hook }: { hook: string }) => <div data-page-blocks={hook} />,
}));
vi.mock('@salla.sa/twilight-theme-engine/hooks', () => ({
  HookSlot: ({ name }: { name: string }) => <div data-hook-slot={name} />,
}));
vi.mock('../../../app/components/navigation/BackButton', () => ({
  BackButton: ({ to }: { to?: string }) => (
    <button data-testid="products-header-back" data-to={to} />
  ),
}));

import {
  ProductListPage,
  inlineDescription,
} from '../../../app/components/product/ProductListPage';

const data = {
  page: { title: 'أحدث المنتجات', slug: 'latest-products' },
  source: { type: 'latest' },
  query: {},
  products: [],
  pagination: { next: null },
} as unknown as Parameters<typeof ProductListPage>[0];

describe('ProductListPage', () => {
  it('keeps the classic app hooks around brand and tag listings, with no merchant blocks', () => {
    const { container } = render(<ProductListPage {...data} />);
    const hooks = Array.from(container.querySelectorAll('[data-hook-slot]'));

    expect(hooks.map((el) => el.getAttribute('data-hook-slot'))).toEqual([
      'product.index.before_products_group_with_filter',
      'product.index.after_products_group_with_filter',
    ]);
    expect(container.querySelector('[data-page-blocks]')).toBeNull();
  });

  it('puts the grocery title bar over the engine list, inside the desktop grid wrapper', () => {
    render(<ProductListPage {...data} />);
    expect(screen.getByRole('heading', { level: 1, name: 'أحدث المنتجات' })).toBeTruthy();
    // desktop.scss keys the category-sized grid off this class.
    expect(
      screen.getByTestId('products-engine-list-render').closest('.products-page')
    ).not.toBeNull();
  });

  it('sends the back button home instead of popping history', () => {
    render(<ProductListPage {...data} />);
    expect(screen.getByTestId('products-header-back').getAttribute('data-to')).toBe('/');
  });

  it('hands the engine a brand description that fits inside its <p>', () => {
    const brand = {
      id: 1,
      name: 'الشفاء',
      description:
        '<p class="ql-direction-rtl">عسل <strong>طبيعي</strong></p><p>من مصادر موثوقة</p>',
    };
    render(<ProductListPage {...data} source={{ type: 'brands', entity: brand } as never} />);

    const entity = (engineProps.current?.source as { entity: typeof brand }).entity;
    expect(entity.description).toBe('عسل <strong>طبيعي</strong><br>من مصادر موثوقة');
    expect(entity.name).toBe('الشفاء');
  });

  it('leaves non-brand sources untouched', () => {
    render(<ProductListPage {...data} />);
    expect(engineProps.current?.source).toBe(data.source);
  });
});

describe('inlineDescription', () => {
  it('turns block breaks into <br> without a trailing one', () => {
    expect(inlineDescription('<h2>Title</h2>\n<div>Body</div>')).toBe('Title<br>Body');
    expect(inlineDescription('plain <em>text</em>')).toBe('plain <em>text</em>');
  });
});
