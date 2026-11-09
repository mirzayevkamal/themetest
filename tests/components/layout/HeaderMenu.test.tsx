import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HeaderMenu } from '../../../app/components/layout/HeaderMenu';

let themeSettings: { header_menu_enabled?: boolean; header_menu_color?: string | null } = {};
let wide = true;
const fetchHeader = vi.fn();

vi.mock('@salla.sa/twilight-theme-engine/hooks/useTheme', () => ({
  useTheme: () => ({ settings: themeSettings }),
}));

vi.mock('../../../app/hooks/useIsWebDesktop', () => ({ useIsWebWide: () => wide }));

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

vi.mock('@salla.sa/twilight-theme-engine/api/menu', () => ({
  menu: { queries: { header: () => ({ queryKey: ['menu', 'header'], queryFn: fetchHeader }) } },
}));

vi.mock('@salla.sa/twilight-theme-engine/common', () => ({
  Link: ({ to, children }: { to?: string; children?: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

const link = (id: number, children?: unknown[]) => ({
  id,
  title: `Link ${id}`,
  url: `/link-${id}`,
  children,
});

function renderMenu() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HeaderMenu />
    </QueryClientProvider>
  );
}

describe('HeaderMenu', () => {
  beforeEach(() => {
    themeSettings = {};
    wide = true;
    fetchHeader.mockReset();
  });

  it('renders nothing and does not fetch the menu while the switch is off', () => {
    const { container } = renderMenu();
    expect(container.innerHTML).toBe('');
    expect(fetchHeader).not.toHaveBeenCalled();
  });

  it('does not fetch the menu below 1024px or in the native app, where it is hidden', () => {
    themeSettings = { header_menu_enabled: true };
    wide = false;
    const { container } = renderMenu();
    expect(container.innerHTML).toBe('');
    expect(fetchHeader).not.toHaveBeenCalled();
  });

  it('shows the header links with their sub-links when the switch is on', async () => {
    themeSettings = { header_menu_enabled: true };
    fetchHeader.mockResolvedValue([link(1, [link(11)]), link(2)]);
    renderMenu();

    expect((await screen.findByRole('link', { name: 'Link 1' })).getAttribute('href')).toBe(
      '/link-1'
    );
    screen.getByRole('link', { name: 'Link 11' });
    screen.getByRole('link', { name: 'Link 2' });
    expect(screen.queryByText('المزيد')).toBeNull();
  });

  it('moves links past the seventh under "More"', async () => {
    themeSettings = { header_menu_enabled: true };
    fetchHeader.mockResolvedValue([
      ...Array.from({ length: 8 }, (_, i) => link(i + 1)),
      link(9, [link(91)]),
    ]);
    renderMenu();

    const more = (await screen.findByText('المزيد')).closest('li')!;
    const overflow = [...more.querySelectorAll('.sub-menu a')].map((a) => a.textContent);
    // An overflow link keeps its own sub-links.
    expect(overflow).toEqual(['Link 8', 'Link 9', 'Link 91']);
  });

  it('turns the menu into a colored bar when the merchant picks a menu color', async () => {
    themeSettings = { header_menu_enabled: true, header_menu_color: '#fa3a00' };
    fetchHeader.mockResolvedValue([link(1)]);
    renderMenu();

    const nav = (await screen.findByRole('link', { name: 'Link 1' })).closest('nav')!;
    expect(nav.classList.contains('desktop-header__menu--bar')).toBe(true);
    expect(nav.style.getPropertyValue('--header-menu-color')).toBe('#fa3a00');
  });

  it('keeps the plain header row when the menu color is empty', async () => {
    themeSettings = { header_menu_enabled: true, header_menu_color: null };
    fetchHeader.mockResolvedValue([link(1)]);
    renderMenu();

    const nav = (await screen.findByRole('link', { name: 'Link 1' })).closest('nav')!;
    expect(nav.classList.contains('desktop-header__menu--bar')).toBe(false);
    expect(nav.getAttribute('style')).toBeNull();
  });
});
