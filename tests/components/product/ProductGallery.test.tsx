import { act, fireEvent, render, screen } from '@testing-library/react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import type { Product } from '@salla.sa/twilight-theme-engine/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ProductGallery,
  ProductGalleryStage,
} from '../../../app/components/product/ProductGallery';
import { cardImageSrc } from '../../../app/components/product/ProductCard';

// The gallery reads slider_background_size from the provider context.
vi.mock('@salla.sa/twilight-theme-engine/providers', () => ({
  useTwilight: () => ({ theme: { settings: {} } }),
}));

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

const product = {
  id: 42,
  name: 'Fresh apples',
  image: { id: 1, url: '/apple-1.jpg', alt: 'Fresh apples' },
  images: [
    { id: 1, url: '/apple-1.jpg', alt: 'Fresh apples' },
    { id: 2, url: '/apple-2.jpg', alt: 'Fresh apples from the side' },
    { id: 3, url: '/apple-3.jpg', alt: 'Fresh apples in a basket' },
  ],
} as Product;

function stubDesktop() {
  vi.stubGlobal(
    'matchMedia',
    () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) as MediaQueryList
  );
}

describe('ProductGallery', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders the slider and the initial fraction counter', () => {
    const { container } = render(<ProductGallery product={product} />);
    expect(container.querySelector('salla-slider')).toBeTruthy();
    expect(screen.getByText('1 / 3')).toBeTruthy();
  });

  it('updates the fraction counter when the active slide changes', () => {
    const { container } = render(<ProductGallery product={product} />);
    const slider = container.querySelector('salla-slider');

    fireEvent(slider!, new CustomEvent('slideChange', { detail: { realIndex: 1 } }));

    expect(screen.getByText('2 / 3')).toBeTruthy();
  });

  it('opens the native gallery on the tapped image', () => {
    const openGallery = vi.fn();
    window.salla = {
      mobile: { isEnabled: () => true, openGallery },
    } as unknown as typeof window.salla;
    const { container } = render(<ProductGallery product={product} />);

    fireEvent.click(container.querySelector('[data-slid-index="2"]')!);

    expect(openGallery).toHaveBeenCalledWith(product.images, product.images![2]);
    delete (window as { salla?: unknown }).salla;
  });

  it('falls back to the web lightbox when the shell has no openGallery', () => {
    window.salla = { mobile: { isEnabled: () => true } } as unknown as typeof window.salla;
    const { container } = render(<ProductGallery product={product} />);
    const slide = container.querySelector('[data-slid-index="1"]')!;

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(slide, event);

    // Web lightbox path claims the click (preventDefault) instead of following the href.
    expect(event.defaultPrevented).toBe(true);
    delete (window as { salla?: unknown }).salla;
  });

  it('shows a frame with thumbnails on web desktop and selects one', () => {
    stubDesktop();
    const { container } = render(<ProductGallery product={product} />);
    expect(container.querySelector('salla-slider')).toBeNull();
    const thumb = (index: number) =>
      container.querySelectorAll('.product-details-gallery__thumb')[index];

    expect(container.querySelectorAll('.product-details-gallery__thumb')).toHaveLength(3);
    expect(thumb(0).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(thumb(1));
    expect(thumb(1).getAttribute('aria-pressed')).toBe('true');
    expect(thumb(0).getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps the desktop frame for a video entry without a poster', () => {
    stubDesktop();
    const video = { id: 4, video_url: 'https://youtu.be/x', alt: 'Apples video' };
    const { container } = render(
      <ProductGallery product={{ ...product, images: [...product.images!, video] } as Product} />
    );

    fireEvent.click(container.querySelectorAll('.product-details-gallery__thumb')[3]);

    expect(container.querySelector('salla-slider')).toBeNull();
    expect(container.querySelector('.product-details-gallery__frame a')?.getAttribute('href')).toBe(
      'https://youtu.be/x'
    );
  });

  it('keeps the lightbox link off the swiper slide so it keeps its own name', () => {
    const { container } = render(<ProductGallery product={product} />);
    const link = container.querySelector('[data-slid-index="0"]')!;

    expect(link.classList.contains('swiper-slide')).toBe(false);
    expect(link.parentElement?.classList.contains('swiper-slide')).toBe(true);
    expect(link.getAttribute('aria-label')).toBe('Fresh apples');
  });

  it('server-renders the first image inside the placeholder frame', () => {
    const html = renderToString(<ProductGalleryStage product={product} isPreview={false} />);

    expect(html).toContain('product-details-gallery__placeholder');
    expect(html).toContain('apple-1.jpg');
    expect(html).not.toContain('animate-pulse');
    expect(html).not.toContain('salla-slider');
  });

  it('shows the card image, not a pulse, while the sheet opens on list data', () => {
    const card = { ...product, image: { url: '/apple-card.jpg' }, images: undefined } as Product;
    const { container } = render(<ProductGalleryStage product={card} isPreview />);

    expect(container.querySelector('.animate-pulse')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('src')).toContain('apple-card.jpg');
  });

  it('paints the slide-size CDN URL, not the upload, when no card image was captured', () => {
    const upload = 'https://cdn.salla.sa/x/apple-original.webp';
    const { container } = render(
      <ProductGalleryStage
        product={{ id: 42, name: 'Fresh apples', image: { url: upload } } as Product}
        isPreview
      />
    );

    expect(container.querySelector('.animate-pulse')).toBeNull();
    expect(container.querySelector('salla-slider')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://cdn.salla.sa/cdn-cgi/image/fit=scale-down,onerror=redirect,format=auto,width=414,height=244/x/apple-original.webp'
    );
  });

  it('shows the tapped card image as-is so it comes from the browser cache', () => {
    const loaded = 'https://cdn.salla.sa/cdn-cgi/image/format=auto,width=240/x/apple-500x500.png';
    cardImageSrc.set('42', loaded);
    const { container } = render(<ProductGalleryStage product={product} isPreview={false} />);
    cardImageSrc.clear();

    expect(container.querySelector('img')?.getAttribute('src')).toBe(loaded);
  });

  it('keeps the same image when details arrive with the same first file', () => {
    const file = { url: '/apple-card.jpg', alt: 'Fresh apples' };
    const list = { ...product, image: file, images: undefined } as Product;
    const details = { ...product, image: file, images: [file] } as Product;
    const { container, rerender } = render(<ProductGalleryStage product={list} isPreview />);
    const opening = container.querySelector('img');

    rerender(<ProductGalleryStage product={details} isPreview={false} />);

    expect(container.querySelector('salla-slider')).toBeNull();
    expect(container.querySelector('img')).toBe(opening);
    expect(opening?.getAttribute('src')).toContain('apple-card.jpg');
  });

  it('follows the first gallery file when it differs from image.url', () => {
    const upload = 'https://cdn.salla.sa/x/apple-original.webp';
    const gallery = 'https://cdn.salla.sa/x/apple-gallery.webp';
    const sized = (file: string) =>
      `https://cdn.salla.sa/cdn-cgi/image/fit=scale-down,onerror=redirect,format=auto,width=414,height=244/x/${file}`;
    const list = { id: 42, name: 'Fresh apples', image: { url: upload } } as Product;
    const details = {
      id: 42,
      name: 'Fresh apples',
      image: { url: upload },
      images: [{ id: 1, url: gallery, alt: 'Fresh apples' }],
    } as Product;
    const { container, rerender } = render(<ProductGalleryStage product={list} isPreview />);

    expect(container.querySelector('img')?.getAttribute('src')).toBe(sized('apple-original.webp'));

    rerender(<ProductGalleryStage product={details} isPreview={false} />);

    expect(container.querySelector('salla-slider')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('src')).toBe(sized('apple-gallery.webp'));
  });

  it('mounts the first slide on the same CDN URL it decoded', async () => {
    const created: HTMLImageElement[] = [];
    const nativeCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const el = nativeCreate(tagName, options);
      if (tagName.toLowerCase() === 'img') created.push(el as HTMLImageElement);
      return el;
    });
    const url = 'https://cdn.salla.sa/x/apple-1000x1000.png';
    const cdn = { ...product, images: [{ id: 1, url }] } as Product;

    const { container } = render(<ProductGalleryStage product={cdn} isPreview={false} />);
    const probe = created.find((img) => !img.isConnected)!;
    await act(async () => {
      probe.dispatchEvent(new Event('load'));
    });

    expect(probe.src).toContain('width=414,height=244/x/apple-1000x1000.png');
    expect(container.querySelector('[data-slid-index="0"] img')?.getAttribute('src')).toBe(
      probe.src
    );
  });

  it('fetches the slide image while the product is still the list card', () => {
    const created: HTMLImageElement[] = [];
    const nativeCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const el = nativeCreate(tagName, options);
      if (tagName.toLowerCase() === 'img') created.push(el as HTMLImageElement);
      return el;
    });
    const list = {
      id: 42,
      name: 'Fresh apples',
      image: { url: 'https://cdn.salla.sa/x/apple-original.webp' },
    } as Product;

    render(<ProductGalleryStage product={list} isPreview />);

    const probe = created.find((img) => !img.isConnected);
    expect(probe?.src).toContain('width=414,height=244/x/apple-original.webp');
  });

  it('hydrates on the server image and keeps it until the desktop size has decoded', async () => {
    const cdn = {
      ...product,
      images: [{ id: 1, url: 'https://cdn.salla.sa/x/apple.png', alt: 'Fresh apples' }],
    } as Product;
    // Server: phone size. Client: a desktop viewport.
    const html = renderToString(<ProductGalleryStage product={cdn} isPreview={false} />);
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    vi.stubGlobal(
      'matchMedia',
      () =>
        ({
          matches: true,
          addEventListener() {},
          removeEventListener() {},
        }) as unknown as MediaQueryList
    );
    const created: HTMLImageElement[] = [];
    const nativeCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const el = nativeCreate(tagName, options);
      if (tagName.toLowerCase() === 'img') created.push(el as HTMLImageElement);
      return el;
    });
    const serverImg = container.querySelector('img')!;
    expect(serverImg.getAttribute('src')).toContain('width=414,height=244/x/apple.png');

    let root!: Root;
    await act(async () => {
      root = hydrateRoot(container, <ProductGalleryStage product={cdn} isPreview={false} />);
    });

    expect(container.querySelector('a[data-fslightbox]')).toBeNull();
    expect(container.querySelector('img')).toBe(serverImg);
    expect(serverImg.getAttribute('src')).toContain('width=414,height=244/x/apple.png');
    const desktopProbe = created.filter((img) => !img.isConnected).at(-1)!;
    expect(desktopProbe.src).toContain('width=560,height=444/x/apple.png');

    await act(async () => {
      desktopProbe.dispatchEvent(new Event('load'));
    });

    expect(container.querySelector('a[data-fslightbox] img')?.getAttribute('src')).toBe(
      desktopProbe.src
    );
    await act(async () => root.unmount());
    container.remove();
  });

  it('keeps a mounted gallery when the slide size changes later', async () => {
    const media = { matches: false, addEventListener() {}, removeEventListener() {} };
    vi.stubGlobal('matchMedia', () => media as unknown as MediaQueryList);
    const created: HTMLImageElement[] = [];
    const nativeCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const el = nativeCreate(tagName, options);
      if (tagName.toLowerCase() === 'img') created.push(el as HTMLImageElement);
      return el;
    });
    const cdn = {
      ...product,
      images: [
        { id: 1, url: 'https://cdn.salla.sa/x/apple-1.png', alt: 'Fresh apples' },
        { id: 2, url: 'https://cdn.salla.sa/x/apple-2.png', alt: 'Fresh apples from the side' },
      ],
    } as Product;

    const { container } = render(<ProductGalleryStage product={cdn} isPreview={false} />);
    await act(async () => {
      created.find((img) => !img.isConnected)!.dispatchEvent(new Event('load'));
    });
    const slider = container.querySelector('salla-slider')!;
    fireEvent(slider, new CustomEvent('slideChange', { detail: { realIndex: 1 } }));
    expect(screen.getByText('2 / 2')).toBeTruthy();

    // The window grows past the desktop cutoff while the gallery is open.
    media.matches = true;
    await act(async () => {
      document.dispatchEvent(new Event('theme::ready'));
    });

    expect(container.querySelector('.product-details-gallery__thumb.is-active')).toBe(
      container.querySelectorAll('.product-details-gallery__thumb')[1]
    );
  });

  it('does not render a counter for a single product image', () => {
    render(<ProductGallery product={{ ...product, images: [product.images![0]] }} />);

    expect(screen.queryByText('1 / 1')).toBeNull();
  });

  it('keeps the placeholder until the first image is decoded', async () => {
    const created: HTMLImageElement[] = [];
    const nativeCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const el = nativeCreate(tagName, options);
      if (tagName.toLowerCase() === 'img') created.push(el as HTMLImageElement);
      return el;
    });

    const { container, rerender } = render(<ProductGalleryStage product={product} isPreview />);
    expect(container.querySelector('salla-slider')).toBeNull();

    rerender(<ProductGalleryStage product={product} isPreview={false} />);
    expect(container.querySelector('salla-slider')).toBeNull();
    expect(created.length).toBeGreaterThan(0);

    await act(async () => {
      created.find((img) => !img.isConnected)!.dispatchEvent(new Event('load'));
    });

    expect(container.querySelector('salla-slider')).toBeTruthy();
  });
});
