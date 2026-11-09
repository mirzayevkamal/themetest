import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { PagesPage } from '../../../app/components/account/PagesPage';

let mockPages: unknown[] | undefined = [];

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ history: { back: vi.fn(), canGoBack: () => true }, navigate: vi.fn() }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: mockPages, isPending: mockPages === undefined }),
}));

vi.mock('@salla.sa/twilight-theme-engine/api/menu', () => ({ menu: { footer: vi.fn() } }));

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

vi.mock('@salla.sa/twilight-theme-engine/common', () => ({
  Link: ({ to, children, className }: { to: string; children: unknown; className?: string }) => (
    <a href={to} className={className}>
      {children as React.ReactNode}
    </a>
  ),
}));

describe('PagesPage', () => {
  it('lists footer pages as rows under a title + back header', () => {
    mockPages = [{ id: 1, title: 'اسئلة شائعة', url: '/faq/page-1' }];
    const { getByText, container } = render(<PagesPage />);

    expect(getByText('الصفحات التعريفية')).toBeTruthy();
    expect(container.querySelector('a[href="/faq/page-1"]')?.textContent).toContain('اسئلة شائعة');
    expect(container.querySelector('button[aria-label="رجوع"]')).toBeTruthy();
  });

  it('shows a skeleton while the menu is loading', () => {
    mockPages = undefined;
    const { getByTestId, queryByText } = render(<PagesPage />);

    expect(getByTestId('pages-skeleton')).toBeTruthy();
    expect(queryByText('لا توجد صفحات حالياً')).toBeNull();
  });

  it('shows an empty message without pages', () => {
    mockPages = [];
    expect(render(<PagesPage />).getByText('لا توجد صفحات حالياً')).toBeTruthy();
  });
});
