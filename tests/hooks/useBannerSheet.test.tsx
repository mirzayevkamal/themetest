import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { localizedPath, storePathOf } from '../../app/hooks/storePath';
import {
  bannerSheetClick,
  canOpenBannerSheet,
  parseBannerTarget,
  useBannerNavigate,
  useBannerSheetPath,
  useCloseBannerSheet,
  useOpenBannerSheet,
} from '../../app/hooks/useBannerSheet';

let mockHash = '';
const navigate = vi.fn();
const history = { canGoBack: vi.fn(() => true), back: vi.fn() };

vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ location: { hash: mockHash } }),
  useRouter: () => ({ navigate, history, state: { location: { hash: mockHash } } }),
  useParams: () => ({ locale: 'ar' }),
}));

describe('parseBannerTarget', () => {
  it('maps storefront paths merchants pick in the banner url field', () => {
    expect(parseBannerTarget('/apples/p123')).toEqual({ kind: 'product', id: '123' });
    expect(parseBannerTarget('/fruit/c9')).toEqual({ kind: 'category', id: '9' });
    expect(parseBannerTarget('/offers')).toEqual({ kind: 'listing', source: 'offers' });
    expect(parseBannerTarget('/latest-products')).toEqual({ kind: 'listing', source: 'latest' });
    expect(parseBannerTarget('/most-sales-products')).toEqual({ kind: 'listing', source: 'sales' });
    expect(parseBannerTarget('/summer/tag-44')).toEqual({
      kind: 'listing',
      source: 'tags',
      sourceValue: '44',
    });
    expect(parseBannerTarget('/nike/brand-3')).toEqual({
      kind: 'listing',
      source: 'brands',
      sourceValue: '3',
    });
    expect(parseBannerTarget('/brands')).toEqual({ kind: 'brands-index' });
    expect(parseBannerTarget('/ar/offers')).toEqual({ kind: 'listing', source: 'offers' });
    expect(parseBannerTarget('/about/page-8')).toBeNull();
    expect(parseBannerTarget('/blog')).toBeNull();
    expect(parseBannerTarget('/blog/news/c-2')).toBeNull();
    expect(parseBannerTarget('/cart')).toBeNull();
    expect(parseBannerTarget('https://example.com/offers')).toEqual({
      kind: 'listing',
      source: 'offers',
    });
  });
});

describe('storePathOf', () => {
  it('normalizes absolute and locale-prefixed urls to a pathname', () => {
    expect(storePathOf('offers')).toBe('/offers');
    expect(storePathOf('/ar/offers/')).toBe('/offers');
    expect(storePathOf('/ar')).toBe('/');
    expect(storePathOf('https://store.test/en/')).toBe('/');
  });
});

describe('localizedPath', () => {
  it('prefixes the current locale onto a storefront path', () => {
    expect(localizedPath('/offers', 'ar')).toBe('/ar/offers');
    expect(localizedPath('/ar/offers/', 'ar')).toBe('/ar/offers');
    expect(localizedPath('/fruit/c9', 'en')).toBe('/en/fruit/c9');
    expect(localizedPath('/ar', 'en')).toBe('/en');
    expect(localizedPath('/offers')).toBe('/offers');
  });
});

describe('canOpenBannerSheet', () => {
  it('rejects unknown paths and other-origin urls', () => {
    expect(canOpenBannerSheet('/offers')).toBe(true);
    expect(canOpenBannerSheet('/brands')).toBe(true);
    expect(canOpenBannerSheet('/blog')).toBe(false);
    expect(canOpenBannerSheet('/blog/news/c-2')).toBe(false);
    expect(canOpenBannerSheet('/about/page-8')).toBe(false);
    expect(canOpenBannerSheet('/cart')).toBe(false);
    expect(canOpenBannerSheet('https://example.com/offers')).toBe(false);
  });
});

describe('bannerSheetClick', () => {
  const open = vi.fn();
  const go = vi.fn();
  const openWindow = vi.fn();
  const originalOpen = window.open;

  function clickEvent() {
    return {
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as ReactMouseEvent<HTMLAnchorElement> & {
      preventDefault: ReturnType<typeof vi.fn>;
      stopPropagation: ReturnType<typeof vi.fn>;
    };
  }

  function mockDesktop(matches: boolean) {
    window.matchMedia = vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  }

  beforeEach(() => {
    open.mockClear();
    go.mockClear();
    openWindow.mockReset();
    window.open = openWindow;
    document.documentElement.classList.remove('mobile-webview');
    delete (window as { salla?: unknown }).salla;
  });

  afterEach(() => {
    window.open = originalOpen;
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it('opens the in-page sheet on mobile for store listing urls', () => {
    mockDesktop(false);
    const event = clickEvent();
    bannerSheetClick('/offers', open, event, go);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith('/offers');
    expect(go).not.toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('SPA-navigates category and internal urls on desktop', () => {
    mockDesktop(true);
    const event = clickEvent();
    bannerSheetClick('/fruit/c9', open, event, go);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(go).toHaveBeenCalledWith('/fruit/c9');
    expect(open).not.toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('opens other-origin urls in a new window on desktop', () => {
    mockDesktop(true);
    const event = clickEvent();
    bannerSheetClick('https://example.com/sale', open, event, go);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(go).not.toHaveBeenCalled();
    expect(openWindow).toHaveBeenCalledWith(
      'https://example.com/sale',
      '_blank',
      'noopener,noreferrer'
    );
  });
});

describe('useBannerSheetPath', () => {
  it('reads the encoded path from the hash, with or without the leading dash', () => {
    let path: string | null = null;
    function Reader() {
      path = useBannerSheetPath();
      return null;
    }

    mockHash = `-banner-${encodeURIComponent('/offers')}`;
    const { rerender } = render(<Reader />);
    expect(path).toBe('/offers');

    mockHash = `banner-${encodeURIComponent('/fruit/c9')}`;
    rerender(<Reader />);
    expect(path).toBe('/fruit/c9');
  });

  it('keeps the banner path while a product sheet is stacked on top', () => {
    let path: string | null = null;
    function Reader() {
      path = useBannerSheetPath();
      return null;
    }

    mockHash = `-banner-${encodeURIComponent('/offers')}`;
    const { rerender } = render(<Reader />);
    expect(path).toBe('/offers');

    mockHash = '-sheet-42';
    rerender(<Reader />);
    expect(path).toBe('/offers');

    mockHash = '';
    rerender(<Reader />);
    expect(path).toBeNull();
  });
});

describe('useBannerNavigate', () => {
  beforeEach(() => {
    navigate.mockClear();
  });

  it('pushes a locale-prefixed storefront path', () => {
    let go!: (url: string) => void;
    function Nav() {
      go = useBannerNavigate();
      return null;
    }
    render(<Nav />);
    go('/offers');

    expect(navigate).toHaveBeenCalledWith({ to: '/ar/offers' });
  });
});

describe('useOpenBannerSheet / useCloseBannerSheet', () => {
  beforeEach(() => {
    mockHash = '';
    navigate.mockClear();
    history.back.mockClear();
    history.canGoBack.mockReturnValue(true);
  });

  it('pushes a banner hash for a listing url', () => {
    let open!: (url: string) => void;
    function Opener() {
      open = useOpenBannerSheet();
      return null;
    }
    render(<Opener />);
    open('/offers');

    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        hash: `-banner-${encodeURIComponent('/offers')}`,
        replace: false,
      })
    );
  });

  it('closes by replacing the location with the homepage, not history.back', () => {
    let close!: () => void;
    function Closer() {
      close = useCloseBannerSheet();
      return null;
    }
    render(<Closer />);
    close();
    expect(history.back).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/',
        hash: '',
        replace: true,
      })
    );
  });
});
