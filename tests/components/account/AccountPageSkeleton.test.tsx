import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  AccountPageSkeleton,
  AccountShellSkeleton,
} from '../../../app/components/account/AccountPageSkeleton';

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
  Wallet: { loader: vi.fn() },
}));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: 15 }) }));

describe('AccountShellSkeleton', () => {
  it('keeps the real sidebar beside the placeholder cards while a page loads', () => {
    const { container, getByTestId } = render(<AccountShellSkeleton />);

    const shell = container.querySelector('.account-shell');
    const sidebar = shell?.querySelector('.account-sidebar');
    expect(sidebar?.querySelector('a[href="/account/orders"]')).toBeTruthy();
    expect(sidebar?.querySelector('a[href="/account/wishlist"]')).toBeTruthy();
    expect(
      shell?.querySelector('.account-shell__main')?.contains(getByTestId('account-skeleton'))
    ).toBe(true);
  });

  it("marks its header bar like PageHeader's, so web desktop hides it", () => {
    const { container } = render(<AccountShellSkeleton />);
    expect(container.querySelector('.account-shell > .mobile-sticky-bar')).toBeTruthy();
  });
});

describe('AccountPageSkeleton', () => {
  it('stays sidebar-free for the order drawer and thank-you page', () => {
    const { container, getByTestId } = render(<AccountPageSkeleton header={false} />);
    expect(getByTestId('account-skeleton')).toBeTruthy();
    expect(container.querySelector('.account-sidebar')).toBeNull();
    expect(container.querySelector('.mobile-sticky-bar')).toBeNull();
  });
});
