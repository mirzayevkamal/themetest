import type { MouseEvent, ReactNode } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cardImageSrc } from '../../app/components/product/cardImage';
import {
  productHref,
  productHrefFromItem,
  ProductSheetLink,
  useOpenProductSheet,
  useProductSheetId,
  useProductSheetLinks,
} from '../../app/hooks/useProductSheet';

let mockRouteId = '/{-$locale}/';
let mockHash = '';
const navigate = vi.fn();
const history = { canGoBack: vi.fn(() => true), back: vi.fn() };

vi.mock('../../app/components/product/ProductPage', () => ({
  ProductPage: () => null,
}));

let mockLocale: string | undefined;

vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ matches: [{ routeId: mockRouteId }], location: { hash: mockHash } }),
  useRouter: () => ({ navigate, history, state: { location: { hash: mockHash } } }),
  useParams: () => ({ locale: mockLocale }),
}));

function Page() {
  useProductSheetLinks();
  return (
    <>
      <a data-spa-link="" href="https://store.example/apples/p123">
        product
      </a>
      <a data-spa-link="" href="/apples/c9">
        category
      </a>
      <a href="/x/p5">plain</a>
    </>
  );
}

function mockDesktop(matches: boolean) {
  window.matchMedia = vi.fn(() => ({ matches }) as MediaQueryList);
}

beforeEach(() => {
  mockRouteId = '/{-$locale}/';
  mockHash = '';
  mockLocale = undefined;
  navigate.mockClear();
  history.back.mockClear();
});

afterEach(async () => {
  await vi.dynamicImportSettled();
  vi.unstubAllGlobals();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe('productHref', () => {
  it('builds a product path from a URL or id, and from order/cart line shapes', () => {
    expect(productHref('/apples/p123')).toBe('/apples/p123');
    expect(productHref('apples/p123')).toBe('/apples/p123');
    expect(productHref('/product/10')).toBe('/product/p10');
    expect(productHref(undefined, 7)).toBe('/product/p7');
    expect(productHref('/cart')).toBeUndefined();
    expect(productHrefFromItem({ product: { id: 10, url: '/apples/p10' } })).toBe('/apples/p10');
    expect(productHrefFromItem({ product: 10 })).toBe('/product/p10');
    expect(productHrefFromItem({ product_id: 10 })).toBe('/product/p10');
    expect(productHrefFromItem({ productId: 11 })).toBe('/product/p11');
    expect(productHrefFromItem({ product_url: '/apples/p12' })).toBe('/apples/p12');
    expect(productHrefFromItem({ name: 'x' })).toBeUndefined();
  });
});

describe('useProductSheetId', () => {
  it('reads the id whether or not the router kept the sacrificial first character', () => {
    let id: string | null = null;
    function Reader() {
      id = useProductSheetId();
      return null;
    }
    mockHash = '-sheet-7';
    const { rerender } = render(<Reader />);
    expect(id).toBe('7');
    mockHash = 'sheet-7';
    rerender(<Reader />);
    expect(id).toBe('7');
    mockHash = 'product-7';
    rerender(<Reader />);
    expect(id).toBe('7');
    mockHash = '';
    rerender(<Reader />);
    expect(id).toBeNull();
  });
});

describe('useProductSheetLinks', () => {
  it('opens product links as a masked hash entry instead of navigating', () => {
    const { getByText } = render(<Page />);
    const event = fireEvent.click(getByText('product'));

    expect(event).toBe(false); // default prevented
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        hash: '-sheet-123',
        replace: false,
        mask: { to: '/apples/p123', unmaskOnReload: true },
      })
    );
  });

  it('remembers the link image before the sheet opens', () => {
    function WithImage() {
      useProductSheetLinks();
      return (
        <a data-spa-link="" href="/apples/p123">
          <img src="https://cdn.salla.sa/cdn-cgi/image/width=240/x/apple.png" alt="" />
        </a>
      );
    }
    render(<WithImage />);
    const img = document.querySelector('img')!;
    Object.defineProperty(img, 'currentSrc', { value: 'https://cdn.salla.sa/w240/apple.png' });

    fireEvent.click(img);

    expect(cardImageSrc.get('123')).toBe('https://cdn.salla.sa/w240/apple.png');
    cardImageSrc.clear();
  });

  it('replaces the entry when a product is already open in the sheet', () => {
    mockHash = 'product-7';
    const { getByText } = render(<Page />);
    fireEvent.click(getByText('product'));

    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ replace: true }));
  });

  it('lets product links navigate on web desktop', () => {
    mockDesktop(true);
    const { getByText } = render(<Page />);
    const event = fireEvent.click(getByText('product'));

    expect(event).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('leaves non-product, non-engine and modified clicks alone', () => {
    const { getByText } = render(<Page />);

    fireEvent.click(getByText('category'));
    fireEvent.click(getByText('plain'));
    fireEvent.click(getByText('product'), { metaKey: true });

    expect(navigate).not.toHaveBeenCalled();
  });

  it('lets product links navigate normally from the full product page', () => {
    mockRouteId = '/{-$locale}/$slug/p{$id}';
    const { getByText } = render(<Page />);
    fireEvent.click(getByText('product'));

    expect(navigate).not.toHaveBeenCalled();
  });

  it('closes by popping history, or clearing the hash when there is none', () => {
    let close!: () => void;
    function Closer() {
      close = useProductSheetLinks();
      return null;
    }
    render(<Closer />);

    close();
    expect(history.back).toHaveBeenCalled();

    history.canGoBack.mockReturnValueOnce(false);
    close();
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ hash: '', replace: true }));
  });
});

vi.mock('@salla.sa/twilight-theme-engine/common', () => ({
  Link: ({
    to,
    children,
    onClick,
    className,
  }: {
    to: string;
    children: ReactNode;
    onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
    className?: string;
  }) => (
    <a href={to} className={className} onClick={onClick}>
      {children}
    </a>
  ),
}));

describe('useOpenProductSheet', () => {
  it('opens a masked sheet entry from an id-only product path', () => {
    let open!: (href: string) => void;
    function Opener() {
      open = useOpenProductSheet();
      return null;
    }
    render(<Opener />);
    open('/p10');
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        hash: '-sheet-10',
        hashScrollIntoView: false,
        mask: { to: '/product/p10', unmaskOnReload: true },
      })
    );
  });

  it('remembers the thumbnail of the row it was opened from', () => {
    let open!: (href: string, from?: Element) => void;
    function Opener() {
      open = useOpenProductSheet();
      return (
        <button type="button">
          <img src="https://cdn.salla.sa/cdn-cgi/image/width=100/x/milk.webp" alt="" />
        </button>
      );
    }
    render(<Opener />);
    const img = document.querySelector('img')!;
    Object.defineProperty(img, 'currentSrc', { value: 'https://cdn.salla.sa/w100/milk.webp' });

    open('/milk/p77', img.closest('button')!);

    expect(cardImageSrc.get('77')).toBe('https://cdn.salla.sa/w100/milk.webp');
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ hash: '-sheet-77' }));
    cardImageSrc.clear();
  });

  it('navigates to the locale product route on web desktop', () => {
    mockDesktop(true);
    mockLocale = 'ar';
    let open!: (href: string) => void;
    function Opener() {
      open = useOpenProductSheet();
      return null;
    }
    render(<Opener />);
    open('/apples/p123');
    expect(navigate).toHaveBeenCalledWith({ to: '/ar/apples/p123' });
  });
});

describe('ProductSheetLink', () => {
  it('opens the sheet on click instead of following the href', () => {
    const { getByText } = render(<ProductSheetLink to="/apples/p123">Similac</ProductSheetLink>);
    fireEvent.click(getByText('Similac'));
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        hash: '-sheet-123',
        mask: { to: '/apples/p123', unmaskOnReload: true },
      })
    );
  });

  it('follows the href on web desktop', () => {
    mockDesktop(true);
    const { getByText } = render(<ProductSheetLink to="/apples/p123">Similac</ProductSheetLink>);
    const event = fireEvent.click(getByText('Similac'));
    expect(event).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });
});
