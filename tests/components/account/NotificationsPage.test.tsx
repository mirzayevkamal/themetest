import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { NotificationsPage } from '../../../app/components/account/NotificationsPage';

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ history: { back: vi.fn(), canGoBack: () => true }, navigate: vi.fn() }),
}));

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    locale: 'ar',
  }),
}));

vi.mock('@salla.sa/twilight-theme-engine/common', () => ({
  Link: ({ to, children, className }: { to: string; children: unknown; className?: string }) => (
    <a href={to} className={className}>
      {children as React.ReactNode}
    </a>
  ),
}));

vi.mock('@salla.sa/twilight-theme-engine/hooks', () => ({
  HookSlot: ({ name }: { name: string }) => <i data-slot={name} />,
}));

vi.mock('@salla.sa/twilight-theme-engine/hooks/useMoney', () => ({
  useMoney: () => ({ format: (n: number) => `${n} SAR` }),
}));

// Sidebar (AccountShell) dependencies.
vi.mock('@salla.sa/twilight-theme-engine', () => ({
  useTwilight: () => ({ store: { id: 42 } }),
}));
vi.mock('@salla.sa/twilight-theme-engine/routes/account', () => ({
  Wallet: { loader: vi.fn() },
}));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: undefined }) }));

const notification = (over: Record<string, unknown>) =>
  ({
    id: 1,
    title: 'الطلب #268920814',
    body: 'أصبحت حالة الطلب (ملغي)',
    url: '/account/orders/268920814',
    is_read: true,
    time_ago: 'منذ أسبوعين',
    ...over,
  }) as never;

const renderPage = (notifications: never[]) =>
  render(<NotificationsPage page={{} as never} notifications={notifications} />);

describe('NotificationsPage', () => {
  it('links each notification and marks the unread ones', () => {
    const { container, getByText } = renderPage([
      notification({ id: 1, is_read: false, title: 'جديد' }),
      notification({ id: 2, title: 'مقروء' }),
    ]);

    const [unread, read] = [...container.querySelectorAll('section li a')];
    expect(unread.getAttribute('href')).toBe('/account/orders/268920814');
    expect(unread.querySelector('.bg-discount')).toBeTruthy();
    expect(getByText('جديد').className).toContain('font-bold');
    expect(read.querySelector('.bg-discount')).toBeNull();
    expect(getByText('مقروء').className).not.toContain('font-bold');
    expect(unread.textContent).toContain('منذ أسبوعين');
  });

  it('keeps the merchant-app slots around the list', () => {
    const { container } = renderPage([notification({})]);
    const slots = [...container.querySelectorAll('[data-slot]')].map((s) =>
      s.getAttribute('data-slot')
    );
    expect(slots).toEqual([
      'customer:notifications.items.start',
      'customer:notifications.items.end',
    ]);
  });

  it('shows an empty state with no notifications', () => {
    const { container, getByText } = renderPage([]);
    expect(container.querySelector('section ul')).toBeNull();
    expect(getByText('لا توجد إشعارات')).toBeTruthy();
  });
});
