import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react';
import type { Product } from '@salla.sa/twilight-theme-engine/types';
import { cardImageSrc, ProductCard } from '../../../app/components/product/ProductCard';

// These need a TwilightProvider; the card's only real logic is the discount,
// so stub them rather than stand up a store context.
vi.mock('@salla.sa/twilight-theme-engine/hooks/useMoney', () => ({
  useMoney: () => ({ format: (amount: number) => `${amount}` }),
}));

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, options?: { time?: string }) =>
      options?.time != null ? fallback.replace('{{time}}', options.time) : fallback,
  }),
}));

const themeSettings: {
  notify_when_available_in_card?: boolean;
  delivery_promise_color?: string;
  accent_style?: string;
} = {};
const channels = { email: true, sms: false, mobile: false, whatsapp: false };
const productSettings: {
  fit_type?: 'cover' | 'contain' | null;
  availability_notify?: typeof channels | null;
} = { availability_notify: channels };
vi.mock('@salla.sa/twilight-theme-engine/providers', () => ({
  useTwilight: () => ({
    theme: { settings: themeSettings },
    store: {
      settings: { product: productSettings },
      shipping: { express_delivery_promise: '15 دقيقة' },
    },
  }),
}));

// The real notify-me wrapper, so the card CSS is tested against the DOM it renders.
// It hydrates once in view; jsdom has no IntersectionObserver, so report everything visible.
vi.stubGlobal(
  'IntersectionObserver',
  class {
    constructor(private cb: (entries: unknown[]) => void) {}
    observe(target: Element) {
      this.cb([{ isIntersecting: true, intersectionRatio: 1, target }]);
    }
    unobserve() {}
    disconnect() {}
  }
);

const notify = (container: HTMLElement) => container.querySelector('salla-product-availability');

vi.mock('@salla.sa/twilight-theme-engine/common', () => ({
  Link: ({ to, children, ...props }: { to?: string; children?: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  Image: ({
    priority: _p,
    objectFit,
    noWrapper: _n,
    srcSetWidths,
    ...props
  }: Record<string, unknown>) => (
    <img
      {...props}
      data-object-fit={objectFit as string}
      data-srcset-widths={Array.isArray(srcSetWidths) ? srcSetWidths.join(',') : undefined}
    />
  ),
}));

const base = {
  id: 7,
  name: 'أبو كاس أرز مزة هندي بسمتي 10 كجم',
  url: '/p7',
  price: 19.95,
  sale_price: 14.95,
  regular_price: 19.95,
  is_on_sale: true,
  image: { url: 'rice.jpg', alt: 'rice' },
} as unknown as Product;

const badge = (container: HTMLElement) =>
  container.querySelector('.s-product-card-promotion-title')?.textContent;

describe('ProductCard', () => {
  it('remembers the loaded image URL when the card is tapped', () => {
    const { container } = render(<ProductCard product={base} />);
    const img = container.querySelector('img')!;
    Object.defineProperty(img, 'currentSrc', { value: 'https://cdn.salla.sa/w240/rice.jpg' });

    fireEvent.click(img);

    expect(cardImageSrc.get('7')).toBe('https://cdn.salla.sa/w240/rice.jpg');
    cardImageSrc.clear();
  });

  it('remembers nothing when the card has not picked a candidate yet', () => {
    const { container } = render(<ProductCard product={base} />);
    const img = container.querySelector('img')!;
    Object.defineProperty(img, 'currentSrc', { value: '' });

    fireEvent.click(img);

    expect(cardImageSrc.get('7')).toBeUndefined();
  });

  it('keeps only the last tapped card image', () => {
    const { container } = render(
      <>
        <ProductCard product={base} />
        <ProductCard product={{ ...base, id: 8 } as Product} />
      </>
    );
    const imgs = container.querySelectorAll('img');
    imgs.forEach((img, i) => Object.defineProperty(img, 'currentSrc', { value: `card-${i}.jpg` }));

    fireEvent.click(imgs[0]);
    fireEvent.click(imgs[1]);

    expect([...cardImageSrc]).toEqual([['8', 'card-1.jpg']]);
    cardImageSrc.clear();
  });

  it('shows the rounded discount off the regular price', () => {
    const { container } = render(<ProductCard product={base} />);
    expect(badge(container)).toContain('%25');
  });

  it('shows the merchant promotion title instead of the discount seal', () => {
    const { container } = render(
      <ProductCard product={{ ...base, promotion_title: 'عرض خاص' } as Product} />
    );
    expect(badge(container)).toBe('عرض خاص');
    expect(container.querySelector('.s-product-card-promotion-title--text')).not.toBeNull();
  });

  it('hides the badge and the strikethrough when the product is not on sale', () => {
    const { container } = render(
      <ProductCard product={{ ...base, is_on_sale: false } as Product} />
    );
    expect(badge(container)).toBeUndefined();
    expect(container.querySelector('.s-product-card-sale-price span')).toBeNull();
  });

  it('hides the badge when the sale price is not actually lower', () => {
    const { container } = render(
      <ProductCard product={{ ...base, sale_price: 19.95 } as Product} />
    );
    expect(badge(container)).toBeUndefined();
  });

  it('treats a product flagged on sale without a sale price as not on sale', () => {
    // A null sale price compared as 0: the card showed a 100% discount.
    const { container } = render(
      <ProductCard product={{ ...base, sale_price: null } as unknown as Product} />
    );
    expect(container.querySelector('.s-product-card-promotion-title')).toBeNull();
    expect(container.querySelector('.s-product-card-sale-price')).toBeNull();
  });

  it('shows the variant line only when the product has a subtitle', () => {
    const withSubtitle = render(
      <ProductCard product={{ ...base, subtitle: '400 جرام' } as Product} />
    );
    expect(withSubtitle.container.textContent).toContain('400 جرام');
    expect(render(<ProductCard product={base} />).container.textContent).not.toContain('400 جرام');
  });

  it('serves product images through a compressed responsive srcset', () => {
    const { container } = render(
      <ProductCard
        product={
          {
            ...base,
            image: { url: 'https://cdn.salla.sa/store/rice.webp', alt: 'rice' },
          } as Product
        }
      />
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://cdn.salla.sa/store/rice.webp');
    expect(img?.getAttribute('data-srcset-widths')).toBe('120,200,240,320,640');
    expect(img?.getAttribute('sizes')).toContain('120px');
  });

  it('sizes CDN card images to the card box, cropping on the CDN for cover', () => {
    const cdn = { ...base, image: { url: 'https://cdn.salla.sa/store/tall.webp', alt: 'tall' } };
    const srcset = () =>
      render(<ProductCard product={cdn as Product} />)
        .container.querySelector('img')
        ?.getAttribute('srcset');
    expect(srcset()).toContain('fit=scale-down,');
    expect(srcset()).toContain('width=240,height=227/store/tall.webp 240w');
    productSettings.fit_type = 'cover';
    expect(srcset()).toContain('fit=cover,');
    expect(srcset()).toContain('width=240,height=227/store/tall.webp 240w');
    delete productSettings.fit_type;
    expect(
      render(<ProductCard product={base} />)
        .container.querySelector('img')
        ?.getAttribute('srcset')
    ).toBeNull();
  });

  it('lets fixed-width callers override the image sizes', () => {
    const { container } = render(<ProductCard product={base} imageSizes="120px" />);
    expect(container.querySelector('img')?.getAttribute('sizes')).toBe('120px');
  });

  it('keeps prices out of the heading outline', () => {
    const onSale = render(<ProductCard product={base} />);
    expect(onSale.getAllByRole('heading').map((h) => h.tagName)).toEqual(['H3']);
    onSale.unmount();

    const regular = render(<ProductCard product={{ ...base, is_on_sale: false } as Product} />);
    expect(regular.container.querySelector('.s-product-card-price')?.tagName).toBe('P');
    expect(regular.getAllByRole('heading').map((h) => h.tagName)).toEqual(['H3']);
  });

  it('shows the market delivery promise', () => {
    expect(render(<ProductCard product={base} />).container.textContent).toContain(
      '15 دقيقة ونوصلك'
    );
  });

  it('paints the delivery promise in the merchant colour, the brand colour by default', () => {
    const promise = (container: HTMLElement) =>
      [...container.querySelectorAll('p')].find((p) => p.textContent?.includes('ونوصلك'));
    const flash = (p?: HTMLElement) => p?.querySelector('path')?.getAttribute('fill');
    const plain = promise(render(<ProductCard product={base} />).container);
    expect(plain?.style.color).toBe('');
    expect(plain?.classList).toContain('capitalize');
    expect(flash(plain)).toBe('#FF4300');
    themeSettings.delivery_promise_color = '#F89817';
    const tinted = promise(render(<ProductCard product={base} />).container);
    expect(tinted?.style.color).toBe('rgb(248, 152, 23)');
    expect(flash(tinted)).toBe('#F89817');
    delete themeSettings.delivery_promise_color;
  });

  it('fits the image per the store product fit_type, contain by default', () => {
    const fit = () =>
      render(<ProductCard product={base} />).container.querySelector('img')?.dataset.objectFit;
    expect(fit()).toBe('contain');
    productSettings.fit_type = 'cover';
    expect(fit()).toBe('cover');
    delete productSettings.fit_type;
  });

  it('offers notify-me on out-of-stock cards unless switched off or the store has no notify channel', async () => {
    const out = { ...base, is_out_of_stock: true, status: 'out' } as Product;

    // Notify-me is the only out-of-stock control, as on Raed.
    const first = render(<ProductCard product={out} />);
    await waitFor(() => expect(notify(first.container)).toBeTruthy());
    expect(first.queryByText('Out of Stock')).toBeNull();
    first.unmount();

    themeSettings.notify_when_available_in_card = false;
    const off = render(<ProductCard product={out} />);
    expect(notify(off.container)).toBeNull();
    expect(off.getByText('Out of Stock')).toBeTruthy();
    off.unmount();
    delete themeSettings.notify_when_available_in_card;

    // No notify channel on the store (Raed's add-product button checks the same).
    productSettings.availability_notify = null;
    const noChannel = render(<ProductCard product={out} />);
    expect(notify(noChannel.container)).toBeNull();
    expect(noChannel.getByText('Out of Stock')).toBeTruthy();
    noChannel.unmount();
    productSettings.availability_notify = { ...channels, email: false, whatsapp: true };
    const whatsapp = render(<ProductCard product={out} />);
    await waitFor(() => expect(notify(whatsapp.container)).toBeTruthy());
    whatsapp.unmount();
    productSettings.availability_notify = channels;

    expect(notify(render(<ProductCard product={base} />).container)).toBeNull();
    expect(
      notify(render(<ProductCard product={{ ...out, type: 'donating' } as Product} />).container)
    ).toBeNull();
  });

  it('puts the wishlist heart in the top-end corner, out of stock or not', () => {
    const heart = (container: HTMLElement) =>
      container.querySelector('.s-product-card-image > button[data-id]');

    // Off by default: no heart, and the out-of-stock chip keeps its Figma corner.
    productSettings.availability_notify = null;
    const out = { ...base, is_out_of_stock: true, status: 'out' } as Product;
    const off = render(<ProductCard product={out} />);
    expect(heart(off.container)).toBeNull();
    expect(off.getByText('Out of Stock').className).toContain('top-1 end-1');
    off.unmount();
    productSettings.availability_notify = channels;

    themeSettings.show_wishlist = true;
    const inStock = render(<ProductCard product={{ ...base, status: 'sale' } as Product} />);
    expect(heart(inStock.container)?.getAttribute('data-id')).toBe('7');
    expect(heart(inStock.container)?.className).toContain('end-2 top-2');
    inStock.unmount();

    // No notify channel: the stepper's out-of-stock chip shows, in the bottom row.
    productSettings.availability_notify = null;
    const chip = render(<ProductCard product={out} />);
    expect(chip.getByText('Out of Stock').className).toContain('bottom-2 start-1');
    expect(heart(chip.container)?.className).toContain('end-2 top-2');
    chip.unmount();
    productSettings.availability_notify = channels;
    delete themeSettings.show_wishlist;
  });

  it('puts notify-me in the stepper spot on the image, outlined per accent_style', async () => {
    const out = { ...base, is_out_of_stock: true, status: 'out' } as Product;
    const slot = '.s-product-card-image > .s-product-card-notify-slot';
    const soft = render(<ProductCard product={out} />).container;
    await waitFor(() => expect(notify(soft)).toBeTruthy());
    // the slot holds the hydration wrapper, so it also bounds the pre-hydration skeleton
    expect(soft.querySelector(slot)?.contains(notify(soft))).toBe(true);
    expect(soft.querySelector('.s-product-card-content salla-product-availability')).toBeNull();
    expect(soft.querySelector('.s-product-card-notify-slot--outlined')).toBeNull();

    themeSettings.accent_style = 'outlined';
    const outlined = render(<ProductCard product={out} />).container;
    expect(outlined.querySelector(`${slot}.s-product-card-notify-slot--outlined`)).toBeTruthy();
    delete themeSettings.accent_style;
  });

  it('equalises card heights only when the merchant switches it on', () => {
    const card = () =>
      render(<ProductCard product={base} />).container.querySelector('.s-product-card');

    expect(card()?.classList.contains('s-product-card-equal-height')).toBe(false);

    // the backend only sends fit_type while the switch is on
    productSettings.fit_type = 'cover';
    expect(card()?.classList.contains('s-product-card-equal-height')).toBe(true);
    delete productSettings.fit_type;
  });

  // Guards the register-then-override pair router.tsx depends on.
  it('takes over the engine card once registered', async () => {
    const { registry } = await import('@salla.sa/twilight-theme-engine');
    const { ProductCard: EngineProductCard } =
      await import('@salla.sa/twilight-theme-engine/product');

    registry.register('product:card', ProductCard);
    registry.override('product:card', ProductCard);

    const { container } = render(<EngineProductCard product={base} />);
    expect(badge(container)).toContain('%25');
  });
});
