import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Product } from '@salla.sa/twilight-theme-engine/types';
import {
  ProductInfo,
  fitsChips,
  hasInstallments,
} from '../../../app/components/product/ProductInfo';

vi.mock('@salla.sa/twilight-theme-engine/hooks/useMoney', () => ({
  useMoney: () => ({ format: (amount: number) => `${amount} ر.س` }),
}));

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, vars?: Record<string, unknown>) =>
      vars ? fallback.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(vars[name])) : fallback,
  }),
}));

const themeSettings: { show_tags?: boolean; show_wishlist?: boolean } = {};
let storeMock: Record<string, unknown> = {};
let mockInApp = false;
vi.mock('@salla.sa/twilight-theme-engine/native-app', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useIsNativeApp: () => mockInApp,
}));
vi.mock('@salla.sa/twilight-theme-engine/providers', () => ({
  useTwilight: () => ({
    theme: { settings: themeSettings },
    store: storeMock,
  }),
}));

vi.mock('@salla.sa/twilight-theme-engine/common', () => ({
  Link: ({ to, children, ...props }: { to?: string; children?: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  Image: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

// Partial fixture mirroring the `products/{id}/details` payload (option
// `details` + variant `skus`).
const product = {
  id: 670442748,
  name: 'تفاح رويال غالا الفاخر مستورد',
  description: 'تفاح رويال جالا هو أحد أكثر أصناف التفاح شعبية في العالم',
  has_read_more: true,
  options: [
    {
      id: 147711412,
      name: 'اختر الحجم',
      required: true,
      details: [
        {
          id: 411466551,
          name: '950 -1000 جرام',
          additional_price: 0,
          is_out: false,
          is_default: 1,
        },
        { id: 7665377, name: '450 -500 جرام', additional_price: 0, is_out: false, is_default: 0 },
      ],
    },
  ],
  skus: [
    {
      price: { amount: 14.95 },
      regular_price: { amount: 19.95 },
      has_special_price: true,
      related_option_values: [411466551],
    },
    {
      price: { amount: 8.98 },
      regular_price: { amount: 8.98 },
      has_special_price: false,
      related_option_values: [7665377],
    },
  ],
} as unknown as Product;

describe('ProductInfo', () => {
  it('renders option chips as radios with per-SKU prices and a discount badge', () => {
    render(<ProductInfo product={product} />);

    expect(screen.getByRole('heading', { name: 'اختر الحجم' })).toBeTruthy();

    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios).toHaveLength(2);
    expect(radios[0].name).toBe('options[147711412]');
    expect(radios[0].value).toBe('411466551');
    expect(radios[0].checked).toBe(true); // is_default
    expect(radios[1].checked).toBe(false);

    // Discounted chip: struck regular price, sale price, 25% badge
    expect(screen.getByText('19.95 ر.س').tagName).toBe('S');
    expect(screen.getByText('14.95 ر.س')).toBeTruthy();
    expect(screen.getByText(/خصم%25/)).toBeTruthy();
    // Regular chip: plain price only
    expect(screen.getByText('8.98 ر.س')).toBeTruthy();
  });

  it("marks the picked chip in the merchant's brand colour", () => {
    render(<ProductInfo product={product} />);

    const chip = screen.getAllByRole('radio')[0].closest('label');
    expect(chip?.className).toContain('has-[:checked]:border-brand has-[:checked]:bg-brand-tint');
    expect(chip?.className).not.toContain('mint');
  });

  it('leaves the delivery promise to the SDK component in the description hook', () => {
    render(<ProductInfo product={product} />);

    expect(screen.queryByText('اطلبه الان ويجيك في')).toBeNull();
    expect(screen.queryByText('15 دقيقة')).toBeNull();
  });

  it('clamps the description until expanded', () => {
    render(<ProductInfo product={product} />);

    const article = document.querySelector('article');
    expect(article?.className).toContain('line-clamp-2');

    fireEvent.click(screen.getByRole('button', { name: /الوصف كامل/ }));
    expect(document.querySelector('article')?.className).not.toContain('line-clamp-2');
    expect(screen.queryByRole('button', { name: /الوصف كامل/ })).toBeNull();
  });

  it('shows the full description without a button when the store disables read more', () => {
    render(<ProductInfo product={{ ...product, has_read_more: false }} />);

    expect(document.querySelector('article')?.className).not.toContain('line-clamp-2');
    expect(screen.queryByRole('button', { name: /الوصف كامل/ })).toBeNull();
  });

  it('lazy-loads description iframes unless the merchant set loading', () => {
    const description =
      '<p>شرح</p><iframe src="https://www.youtube.com/embed/x" title="a>b"></iframe>' +
      '<iframe loading="eager" src="https://maps.example/e"></iframe>' +
      '<span title="<iframe>">مساعدة</span>';
    render(<ProductInfo product={{ ...product, description }} />);

    const frames = [...document.querySelectorAll('article iframe')];
    expect(frames).toHaveLength(2);
    expect(frames.map((frame) => frame.getAttribute('loading'))).toEqual(['lazy', 'eager']);
    expect(frames[0].getAttribute('title')).toBe('a>b');
    expect(document.querySelector('article span')?.getAttribute('title')).toBe('<iframe>');
  });

  it('puts the share button beside the title, with or without the wishlist heart', () => {
    const titleRow = (container: HTMLElement) => container.querySelector('h1')?.parentElement;

    const off = render(<ProductInfo product={product} />);
    expect(
      titleRow(off.container)?.querySelector('salla-social-share.product-info__share')
    ).toBeTruthy();
    off.unmount();

    themeSettings.show_wishlist = true;
    const on = render(<ProductInfo product={product} />);
    const actions = titleRow(on.container)?.querySelector('salla-social-share')?.parentElement;
    // Share first, then the heart, at the end of the title row.
    expect([...(actions?.children ?? [])].map((el) => el.tagName.toLowerCase())).toEqual([
      'salla-social-share',
      'button',
    ]);
    on.unmount();
    delete themeSettings.show_wishlist;
  });

  it('puts the wishlist heart beside the title only when the merchant turns it on', () => {
    const heart = (container: HTMLElement) =>
      container.querySelector('h1')?.parentElement?.querySelector('button[data-id]');

    const off = render(<ProductInfo product={product} />);
    expect(heart(off.container)).toBeFalsy();
    off.unmount();

    themeSettings.show_wishlist = true;
    const on = render(<ProductInfo product={product} />);
    expect(heart(on.container)?.getAttribute('data-id')).toBe(String(product.id));
    on.unmount();
    delete themeSettings.show_wishlist;
  });

  it('links the product tags unless the merchant hides them', () => {
    const tagged = {
      ...product,
      tags: [
        { name: 'فواكه', url: '/tags/1' },
        { name: 'مستورد', url: '/tags/2' },
      ],
    } as unknown as Product;

    const { unmount } = render(<ProductInfo product={tagged} />);
    expect(screen.getByText('فواكه').closest('a')?.getAttribute('href')).toBe('/tags/1');
    expect(screen.getByText('مستورد')).toBeTruthy();
    unmount();

    themeSettings.show_tags = false;
    render(<ProductInfo product={tagged} />);
    expect(screen.queryByText('فواكه')).toBeNull();
    delete themeSettings.show_tags;
  });

  it('shows the SKU and a linked brand logo when the store returns them', () => {
    render(
      <ProductInfo
        product={
          {
            ...product,
            sku: '50373',
            brand: { id: 1, name: 'ندى', logo: 'https://cdn.test/nada.png', url: '/brands/nada' },
          } as unknown as Product
        }
      />
    );

    expect(screen.getByText('50373')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'ندى' }).getAttribute('href')).toBe('/brands/nada');
    expect(screen.getByRole('img', { name: 'ندى' }).getAttribute('src')).toBe(
      'https://cdn.test/nada.png'
    );
  });

  it('omits the SKU and brand rows when the store hides them', () => {
    render(<ProductInfo product={product} />);
    expect(screen.queryByText(/رمز المنتج/)).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('keeps the chips for plain pick-one options only', () => {
    const option = (type: string | undefined, extra = {}) =>
      ({ id: 1, name: 'x', type, required: true, details: [], ...extra }) as never;

    expect(fitsChips([option(undefined), option('single-option'), option('radio')])).toBe(true);
    expect(fitsChips([option('single-option'), option('text')])).toBe(false);
    expect(fitsChips([option('multiple-options')])).toBe(false);
    expect(fitsChips([option('color')])).toBe(false);
    // A "show when" rule needs both options inside Salla's component.
    expect(
      fitsChips([
        option('single-option'),
        option('single-option', { visibility_condition: { option: 1, operator: '=', value: 2 } }),
      ])
    ).toBe(false);
  });

  it("hands every option to Salla's component when one isn't a plain list", () => {
    const withText = {
      ...product,
      options: [...(product.options ?? []), { id: 9, name: 'الاسم', type: 'text', details: [] }],
    } as unknown as Product;
    render(<ProductInfo product={withText} />);

    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    const el = document.querySelector('salla-product-options');
    expect(el?.getAttribute('product-id')).toBe(String(product.id));
    expect(JSON.parse(el?.getAttribute('options') ?? '[]')).toHaveLength(2);
    expect(JSON.parse(el?.getAttribute('config') ?? '{}')).toEqual({
      'single-option': { type: 'button' },
      'multiple-option': { type: 'button' },
    });
  });

  describe('stock, codes, availability and installments', () => {
    const details = (extra: Record<string, unknown>) => ({ ...product, ...extra }) as Product;
    afterEach(() => {
      storeMock = {};
      mockInApp = false;
    });

    it('notes that the price includes VAT only for taxable products', () => {
      const { unmount } = render(<ProductInfo product={details({ is_taxable: true })} />);
      expect(screen.getByText('السعر شامل الضريبة')).toBeTruthy();
      unmount();
      render(<ProductInfo product={details({ is_taxable: false })} />);
      expect(screen.queryByText('السعر شامل الضريبة')).toBeNull();
    });

    it('shows the sold count, and the stock left only when the merchant allows it', () => {
      const { unmount } = render(
        <ProductInfo
          product={details({ sold_quantity: 128, can_show_remained_quantity: true, quantity: 4 })}
        />
      );
      expect(screen.getByText('بيع منه 128')).toBeTruthy();
      expect(screen.getByText('متبقي 4 فقط')).toBeTruthy();
      unmount();

      render(
        <ProductInfo
          product={details({ sold_quantity: 0, can_show_remained_quantity: false, quantity: 4 })}
        />
      );
      expect(screen.queryByText(/بيع منه/)).toBeNull();
      expect(screen.queryByText(/متبقي/)).toBeNull();
    });

    it('shows the barcode beside the SKU', () => {
      render(<ProductInfo product={details({ sku: '50373', barcode: '6281007035017' })} />);
      expect(screen.getByText('50373')).toBeTruthy();
      expect(screen.getByText('6281007035017')).toBeTruthy();
    });

    it("opens Salla's branch list for availability, only when the store has branches", () => {
      const dispatch = vi.fn();
      window.salla = { event: { dispatch } } as never;
      const { unmount } = render(<ProductInfo product={details({ show_availability: true })} />);
      expect(screen.queryByRole('button', { name: 'اختر الفرع' })).toBeNull();
      unmount();

      storeMock = { scope: { id: 1 } };
      render(<ProductInfo product={details({ show_availability: true })} />);
      fireEvent.click(screen.getByRole('button', { name: 'اختر الفرع' }));
      expect(dispatch).toHaveBeenCalledWith('scopes::open', {
        mode: 'availability',
        product_id: String(product.id),
      });
    });

    it('hides branch availability inside the app, which opens its own branch picker', () => {
      storeMock = { scope: { id: 1 } };
      mockInApp = true;
      render(<ProductInfo product={details({ show_availability: true })} />);
      expect(screen.queryByRole('button', { name: 'اختر الفرع' })).toBeNull();
      expect(screen.queryByText('التوفر في الفروع')).toBeNull();
    });

    it('mounts the installment widget with the product price when a provider is on', () => {
      const priced = details({ base_currency_price: { amount: 9.5 } });
      const { unmount } = render(<ProductInfo product={priced} />);
      expect(document.querySelector('salla-installment')).toBeNull();
      unmount();

      storeMock = { settings: { installments: { tabby: true } } };
      render(<ProductInfo product={priced} />);
      expect(document.querySelector('salla-installment')?.getAttribute('price')).toBe('9.5');
    });

    it("mounts Salla's custom fields for this product only when it has some", () => {
      const { unmount } = render(<ProductInfo product={details({ has_metadata: false })} />);
      expect(document.querySelector('salla-metadata')).toBeNull();
      unmount();

      render(<ProductInfo product={details({ has_metadata: true })} />);
      const fields = document.querySelector('salla-metadata');
      expect(fields?.getAttribute('entity-id')).toBe(String(product.id));
      // Salla's component draws nothing when the product has no values; the card hides it.
      expect(fields?.className).toContain('empty:hidden');
    });

    it('reads an empty installments value as no provider', () => {
      expect(hasInstallments([])).toBe(false);
      expect(hasInstallments({})).toBe(false);
      expect(hasInstallments(null)).toBe(false);
      expect(hasInstallments(['tabby'])).toBe(true);
      expect(hasInstallments({ tamara: { publicKey: 'k' } })).toBe(true);
    });
  });
});
