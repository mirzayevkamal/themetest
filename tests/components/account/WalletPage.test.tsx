import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { WalletPage } from '../../../app/components/account/WalletPage';

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

vi.mock('@salla.sa/twilight-theme-engine/hooks/useMoney', () => ({
  useMoney: () => ({ format: (n: number) => `${n} SAR` }),
}));

// Sidebar (AccountShell) dependencies.
vi.mock('@salla.sa/twilight-theme-engine', () => ({
  useTwilight: () => ({ store: { id: 42 } }),
}));
vi.mock('@salla.sa/twilight-theme-engine/routes/account', () => ({
  Wallet: { loader: vi.fn().mockResolvedValue({ balance: 15, transactions: [], pagination: {} }) },
}));
const { useQuery } = vi.hoisted(() => ({ useQuery: vi.fn(() => ({ data: undefined })) }));
vi.mock('@tanstack/react-query', () => ({ useQuery }));

const transaction = (over: Partial<Record<string, unknown>>) => ({
  id: 1,
  order_id: 10,
  transaction_type: 'credit',
  action_type: 'refund',
  type: 'wallet',
  title: 'تعويض',
  description: '',
  amount: 40,
  created_at: 1786838400,
  expired_at: 0,
  ...over,
});

describe('WalletPage', () => {
  it('renders the balance and transactions, paginated by scroll not a link', () => {
    const { container, getByText } = render(
      <WalletPage
        page={{} as never}
        query={{}}
        balance={15}
        pagination={{ current: 1, next: 'x' }}
        transactions={[
          transaction({}) as never,
          transaction({
            id: 2,
            title: 'استخدام',
            action_type: 'purchase_by_wallet',
            amount: 25,
          }) as never,
        ]}
      />
    );

    expect(getByText('المحفظة')).toBeTruthy();
    expect(getByText('40 SAR')).toBeTruthy();
    // The sidebar shows the balance the route loaded instead of fetching it again.
    expect(
      container.querySelector('.account-sidebar a[href="/account/wallet"]')?.textContent
    ).toContain('15 SAR');
    expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    expect(getByText('تعويض')).toBeTruthy();
    expect(getByText('-25 SAR').className).toContain('text-discount');
    // Pagination is the ItemsList sentinel now, so no page link is rendered.
    expect(container.querySelector('a[href^="/account/wallet?page="]')).toBeNull();
  });

  it('renders the empty state without transactions', () => {
    const { getByText, queryByText } = render(
      <WalletPage page={{} as never} query={{}} balance={0} pagination={{}} transactions={[]} />
    );

    expect(getByText('لا يوجد عمليات استخدام!')).toBeTruthy();
    expect(queryByText('عرض المزيد')).toBeNull();
  });
});
