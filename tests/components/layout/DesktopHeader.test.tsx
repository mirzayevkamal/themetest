import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { DesktopHeader } from '../../../app/components/layout/DesktopHeader';
import { LocalizationModal } from '../../../app/components/layout/LocalizationModal';

const store = {
  name: 'الدكان',
  logo: 'https://cdn.example.com/logo.png',
  settings: { is_multilingual: false, currencies_enabled: false } as {
    is_multilingual?: boolean;
    currencies_enabled?: boolean;
  },
};

let mockLoggedIn = false;
let themeSettings: {
  header_is_sticky?: boolean;
  topnav_is_dark?: boolean;
  header_promise_color?: string;
} = {};

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
    locale: 'ar',
  }),
}));

vi.mock('@salla.sa/twilight-theme-engine', () => ({
  useTwilight: () => ({ currency: { code: 'SAR' } }),
}));

vi.mock('@salla.sa/twilight-theme-engine/hooks/useStore', () => ({
  useStore: () => store,
}));

vi.mock('@salla.sa/twilight-theme-engine/hooks/useTheme', () => ({
  useTheme: () => ({ settings: themeSettings }),
}));

vi.mock('@salla.sa/twilight-theme-engine/hooks/useUser', () => ({
  useUser: () => ({ isLoggedIn: mockLoggedIn }),
}));

vi.mock('@salla.sa/twilight-theme-engine/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@salla.sa/twilight-theme-engine/common')>();
  return {
    ...actual,
    Link: ({ to, children, ...props }: { to?: string; children?: React.ReactNode }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

vi.mock('@salla.sa/twilight-components-react/localization-modal', () => ({
  SallaLocalizationModal: () => <salla-localization-modal data-testid="localization-modal" />,
}));

const navigate = vi.fn();
const historyGo = vi.fn();
// The route id stands in for the pathname; `index` is the history position.
const routerState = { routeId: '/{-$locale}/', search: {} as { q?: string }, index: 0 };
const router = {
  navigate,
  buildLocation: () => ({ pathname: '/{-$locale}/search' }),
  get latestLocation() {
    return { pathname: routerState.routeId };
  },
  get state() {
    return {
      location: { pathname: routerState.routeId },
      matches: [{ routeId: routerState.routeId }],
    };
  },
  history: {
    get location() {
      return { state: { __TSR_index: routerState.index } };
    },
    go: historyGo,
  },
};
vi.mock('@tanstack/react-router', () => ({
  useRouter: () => router,
  useParams: () => ({ locale: 'ar' }),
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({
      matches: [{ routeId: routerState.routeId }],
      location: { search: routerState.search, pathname: routerState.routeId },
    }),
}));

vi.mock('../../../app/components/layout/AddressBar', () => ({
  AddressBar: () => <span>address</span>,
}));

vi.mock('../../../app/hooks/useDeliveryPromise', () => ({
  useDeliveryPromise: () => '15 دقيقة',
}));

let cartCount = 0;
vi.mock('../../../app/components/cart/useCart', () => ({ useCartCount: () => cartCount }));

const openCartDrawer = vi.fn();
vi.mock('../../../app/hooks/useCartDrawer', () => ({
  openCartDrawer: () => openCartDrawer(),
  useCartDrawerOpen: () => false,
}));

beforeEach(() => {
  mockLoggedIn = false;
  themeSettings = {};
  store.settings.is_multilingual = false;
  store.settings.currencies_enabled = false;
  openCartDrawer.mockClear();
  cartCount = 0;
  navigate.mockClear();
  historyGo.mockClear();
  routerState.routeId = '/{-$locale}/';
  routerState.search = {};
  routerState.index = 0;
  window.salla = { event: { dispatch: vi.fn() } } as unknown as typeof window.salla;
});

describe('DesktopHeader', () => {
  it('shares its measured height so pinned controls clear a wrapped menu', () => {
    let resize = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect = disconnect;
      }
    );
    const { container, unmount } = render(<DesktopHeader />);
    const header = container.querySelector('header')!;
    Object.defineProperty(header, 'offsetHeight', { configurable: true, value: 144 });
    act(() => resize());
    expect(document.body.style.getPropertyValue('--desktop-header-h')).toBe('144px');

    unmount();
    expect(disconnect).toHaveBeenCalled();
    expect(document.body.style.getPropertyValue('--desktop-header-h')).toBe('');
    vi.unstubAllGlobals();
  });

  it('renders logo, search, cart and login for guests', async () => {
    const { container, getByText } = render(<DesktopHeader />);
    await act(async () => {});
    const logo = container.querySelector('img[alt="الدكان"]');
    expect(logo?.getAttribute('width')).toBe('131');
    expect(logo?.getAttribute('height')).toBe('40');
    expect(container.querySelector('.desktop-header__search-field input')).not.toBeNull();
    expect(container.querySelector('a[href="/search"]')?.textContent).toContain('ابحث عن ارز');
    expect(container.querySelector('a[href="/cart"]')).toBeNull();
    const cart = getByText('السلة').closest('button');
    expect(cart?.getAttribute('aria-haspopup')).toBe('dialog');
    expect(cart?.querySelector('svg')?.classList.contains('text-brand')).toBe(true);
    expect(getByText('تسجيل دخول')).toBeTruthy();
    expect(getByText('15 دقيقة')).toBeTruthy();
    expect(getByText('ونوصلك')).toBeTruthy();
    expect(getByText('15 دقيقة').parentElement?.classList).toContain('capitalize');
  });

  const searchField = (container: HTMLElement) =>
    container.querySelector<HTMLInputElement>('.desktop-header__search-field input')!;
  const submit = (input: HTMLInputElement, value: string) => {
    fireEvent.change(input, { target: { value } });
    fireEvent.keyDown(input, { key: 'Enter' });
  };

  it('opens the search page from the header field', () => {
    const { container } = render(<DesktopHeader />);
    const input = searchField(container);
    expect(input.autofocus).toBe(false);

    submit(input, '   ');
    expect(navigate).not.toHaveBeenCalled();

    submit(input, 'حليب');
    expect(navigate).toHaveBeenCalledWith({
      to: '/{-$locale}/search',
      params: { locale: 'ar' },
      search: { q: 'حليب' },
      replace: false,
    });
  });

  it('keeps the same field, and what is typed, when the search page opens', () => {
    const { container, rerender } = render(<DesktopHeader />);
    const input = searchField(container);
    input.focus();
    submit(input, 'حليب');
    fireEvent.change(input, { target: { value: 'حليب كامل' } });

    routerState.routeId = '/{-$locale}/search';
    routerState.search = { q: 'حليب' };
    rerender(<DesktopHeader />);
    expect(searchField(container)).toBe(input);
    expect(input.value).toBe('حليب كامل');
  });

  it('updates the results in place on the search page and clears after leaving it', () => {
    routerState.routeId = '/{-$locale}/search';
    routerState.search = { q: 'تفاح' };
    const { container, rerender } = render(<DesktopHeader />);
    expect(searchField(container).value).toBe('تفاح');

    submit(searchField(container), 'تفاح احمر');
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ search: { q: 'تفاح احمر' }, replace: true })
    );

    routerState.routeId = '/{-$locale}/';
    routerState.search = {};
    rerender(<DesktopHeader />);
    expect(searchField(container).value).toBe('');
  });

  it('shows the query again when the shopper comes back to a search', () => {
    routerState.routeId = '/{-$locale}/search';
    routerState.search = { q: 'تفاح' };
    const { container, rerender } = render(<DesktopHeader />);

    routerState.routeId = '/{-$locale}/$slug/p{$id}';
    routerState.search = {};
    rerender(<DesktopHeader />);
    expect(searchField(container).value).toBe('');

    routerState.routeId = '/{-$locale}/search';
    routerState.search = { q: 'تفاح' };
    rerender(<DesktopHeader />);
    expect(searchField(container).value).toBe('تفاح');
  });

  it('runs a pending search after a click on the same page, and drops it after leaving', () => {
    vi.useFakeTimers();
    try {
      routerState.routeId = '/{-$locale}/search';
      routerState.search = { q: 'تفاح' };
      const { container, rerender, unmount } = render(<DesktopHeader />);
      const input = searchField(container);
      input.focus();
      fireEvent.change(input, { target: { value: 'تفاح احمر' } });
      fireEvent.blur(input);
      vi.advanceTimersByTime(1000);
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({ search: { q: 'تفاح احمر' }, replace: true })
      );

      navigate.mockClear();
      fireEvent.change(input, { target: { value: 'موز' } });
      routerState.routeId = '/{-$locale}/$slug/p{$id}';
      rerender(<DesktopHeader />);
      vi.advanceTimersByTime(1000);
      expect(navigate).not.toHaveBeenCalled();

      fireEvent.change(input, { target: { value: 'حليب' } });
      unmount();
      vi.advanceTimersByTime(1000);
      expect(navigate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('continues the search it started with text typed while the results open', () => {
    vi.useFakeTimers();
    try {
      routerState.index = 3;
      const { container, rerender } = render(<DesktopHeader />);
      const input = searchField(container);
      input.focus();
      submit(input, 'حليب');
      fireEvent.change(input, { target: { value: 'حليب كامل' } });

      // The results opened one entry later; the pending text lands there.
      routerState.routeId = '/{-$locale}/search';
      routerState.search = { q: 'حليب' };
      routerState.index = 4;
      rerender(<DesktopHeader />);
      navigate.mockClear();
      vi.advanceTimersByTime(1000);
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({ search: { q: 'حليب كامل' }, replace: true })
      );

      input.value = '';
      input.dispatchEvent(new Event('search'));
      expect(historyGo).toHaveBeenCalledWith(-1);
    } finally {
      vi.useRealTimers();
    }
  });

  const clear = (input: HTMLInputElement) => {
    input.value = '';
    input.dispatchEvent(new Event('search'));
  };

  it("leaves the search, past its sort and query steps, with the field's clear button", () => {
    routerState.index = 3;
    const { container, rerender } = render(<DesktopHeader />);
    submit(searchField(container), 'تفاح');

    // Now on the results, two entries later (the search, then a sort change).
    routerState.routeId = '/{-$locale}/search';
    routerState.search = { q: 'تفاح' };
    routerState.index = 5;
    rerender(<DesktopHeader />);
    clear(searchField(container));
    expect(historyGo).toHaveBeenCalledWith(-2);
  });

  it('forgets where a search started once the shopper leaves it', () => {
    routerState.index = 3;
    const { container, rerender } = render(<DesktopHeader />);
    submit(searchField(container), 'تفاح');
    const goTo = (routeId: string, index: number, q?: string) => {
      routerState.routeId = routeId;
      routerState.search = q ? { q } : {};
      routerState.index = index;
      rerender(<DesktopHeader />);
    };
    goTo('/{-$locale}/search', 4, 'تفاح');
    goTo('/{-$locale}/$slug/p{$id}', 5);
    goTo('/{-$locale}/search', 6, 'موز'); // opened by a link

    navigate.mockClear();
    clear(searchField(container));
    expect(historyGo).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith({ to: '/{-$locale}/', params: { locale: 'ar' } });
  });

  it('goes home when a search opened by a link is cleared', () => {
    routerState.routeId = '/{-$locale}/search';
    routerState.search = { q: 'تفاح' };
    routerState.index = 4;
    const { container } = render(<DesktopHeader />);
    navigate.mockClear();
    clear(searchField(container));
    expect(historyGo).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith({ to: '/{-$locale}/', params: { locale: 'ar' } });
  });

  it('keeps accessible names on the controls that turn icon-only on tablet', async () => {
    store.settings.is_multilingual = true;
    const { getByRole } = render(<DesktopHeader />);
    await act(async () => {});
    const labels = [
      getByRole('link', { name: /ابحث عن ارز/ }),
      getByRole('button', { name: 'السلة' }),
      getByRole('button', { name: 'English' }),
    ].map((control) => control.querySelector('.desktop-header__label'));
    for (const label of labels) {
      expect(label).not.toBeNull();
      expect(label?.closest('[aria-hidden="true"]')).toBeNull();
    }
  });

  it('is a sticky light header by default', () => {
    const header = render(<DesktopHeader />).container.querySelector('header');
    expect([...(header?.classList ?? [])]).toEqual(
      expect.arrayContaining(['sticky', 'top-0', 'bg-white'])
    );
    expect(header?.classList.contains('desktop-header--dark')).toBe(false);
  });

  it('paints the promise in the brand colour, or the header promise colour unless dark', () => {
    const promise = () =>
      render(<DesktopHeader />).container.querySelector<HTMLElement>('.desktop-header__promise');
    expect(promise()?.className).toContain('text-brand');
    expect(promise()?.className).not.toContain('text-mint-dark');
    expect(promise()?.style.color).toBe('');
    themeSettings = { header_promise_color: '#F89817' };
    expect(promise()?.style.color).toBe('rgb(248, 152, 23)');
    themeSettings = { header_promise_color: '#F89817', topnav_is_dark: true };
    expect(promise()?.style.color).toBe('');
  });

  it('scrolls away when the sticky switch is off', () => {
    themeSettings = { header_is_sticky: false };
    const header = render(<DesktopHeader />).container.querySelector('header');
    expect(header?.classList.contains('sticky')).toBe(false);
    expect(header?.classList.contains('desktop-header--static')).toBe(true);
  });

  it('turns dark when the dark top bar switch is on', () => {
    themeSettings = { topnav_is_dark: true };
    const header = render(<DesktopHeader />).container.querySelector('header');
    expect([...(header?.classList ?? [])]).toEqual(
      expect.arrayContaining(['desktop-header--dark', 'bg-black', 'text-white'])
    );
    expect(header?.classList.contains('bg-white')).toBe(false);
  });

  it('opens the cart drawer from the chrome button', async () => {
    const { getByText } = render(<DesktopHeader />);
    await act(async () => {});
    fireEvent.click(getByText('السلة'));
    expect(openCartDrawer).toHaveBeenCalled();
  });

  it('shows the cart count on the basket once the cart has items', async () => {
    const { getByText, rerender } = render(<DesktopHeader />);
    await act(async () => {});
    const cart = getByText('السلة').closest('button')!;
    expect(cart.textContent).toBe('السلة');

    cartCount = 3;
    rerender(<DesktopHeader />);
    expect(cart.textContent).toBe('3السلة');
  });

  it('opens login from the chrome button', async () => {
    const { getByText } = render(<DesktopHeader />);
    await act(async () => {});
    fireEvent.click(getByText('تسجيل دخول'));
    expect(window.salla?.event.dispatch).toHaveBeenCalledWith('login::open');
  });

  it('swaps login for the account link when the user is signed in', () => {
    mockLoggedIn = true;
    const { container, queryByText } = render(<DesktopHeader />);
    expect(queryByText('تسجيل دخول')).toBeNull();
    expect(container.querySelector('a[href="/account/profile"]')?.textContent).toContain('حسابي');
  });

  it('hides the language control when the store has neither languages nor currencies', async () => {
    const { queryByText, queryByTestId } = render(<DesktopHeader />);
    await act(async () => {});
    expect(queryByText('English')).toBeNull();
    expect(queryByTestId('localization-modal')).toBeNull();
  });

  it('loads the shared localization modal when the language button is pressed', async () => {
    store.settings.is_multilingual = true;
    const { getByText, queryByTestId, findByTestId } = render(
      <>
        <LocalizationModal />
        <DesktopHeader />
      </>
    );
    await act(async () => {});
    expect(queryByTestId('localization-modal')).toBeNull();
    fireEvent.click(getByText('English'));
    expect(await findByTestId('localization-modal')).toBeTruthy();
    await waitFor(() => {
      expect(window.salla?.event.dispatch).toHaveBeenCalledWith('localization::open');
    });
    fireEvent.click(getByText('English'));
    expect(document.querySelectorAll('salla-localization-modal').length).toBe(1);
  });

  it('loads the shared localization modal when only currencies are enabled', async () => {
    store.settings.currencies_enabled = true;
    const { getByText, queryByTestId, findByTestId } = render(
      <>
        <LocalizationModal />
        <DesktopHeader />
      </>
    );
    await act(async () => {});
    expect(queryByTestId('localization-modal')).toBeNull();
    fireEvent.click(getByText('English'));
    expect(await findByTestId('localization-modal')).toBeTruthy();
    await waitFor(() => {
      expect(window.salla?.event.dispatch).toHaveBeenCalledWith('localization::open');
    });
  });

  it('waits for the SDK event bus before opening localization', async () => {
    store.settings.is_multilingual = true;
    let markReady: () => void = () => {};
    const dispatch = vi.fn();
    window.salla = {
      onReady: () =>
        new Promise<void>((resolve) => {
          markReady = resolve;
        }),
    } as unknown as typeof window.salla;

    const { getByText, findByTestId } = render(
      <>
        <LocalizationModal />
        <DesktopHeader />
      </>
    );
    fireEvent.click(getByText('English'));
    expect(await findByTestId('localization-modal')).toBeTruthy();
    expect(dispatch).not.toHaveBeenCalled();

    window.salla = { event: { dispatch } } as unknown as typeof window.salla;
    markReady();
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith('localization::open');
    });
  });

  it('opens a localization modal already on the page without mounting another', async () => {
    store.settings.is_multilingual = true;
    const existing = document.createElement('salla-localization-modal');
    document.body.appendChild(existing);
    const { getByText, queryByTestId } = render(<DesktopHeader />);
    await act(async () => {});
    fireEvent.click(getByText('English'));
    await act(async () => {});
    expect(window.salla?.event.dispatch).toHaveBeenCalledWith('localization::open');
    expect(queryByTestId('localization-modal')).toBeNull();
    expect(document.querySelectorAll('salla-localization-modal').length).toBe(1);
    existing.remove();
  });
});
