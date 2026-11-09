import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryHeader } from '../../../app/components/categories/CategoryHeader';

const back = vi.fn();
const navigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    history: {
      canGoBack: () => true,
      back,
    },
    navigate,
  }),
}));

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

vi.mock('@salla.sa/twilight-theme-engine/common', () => ({
  Link: ({ to, children, ...props }: { to?: string; children?: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe('CategoryHeader', () => {
  beforeEach(() => {
    back.mockReset();
    navigate.mockReset();
  });

  it('renders the search trigger and back controls without a filter action', () => {
    const { container, getByRole } = render(<CategoryHeader />);
    const header = container.querySelector('header');
    const backButton = getByRole('button', { name: 'رجوع' });
    const trigger = container.querySelector('a[href="/search"]');

    expect(trigger?.textContent).toContain('ابحث عن الموز، الخيار وغيره....');
    expect(header?.firstElementChild).toBe(backButton);
    expect(backButton.querySelector('svg')?.className.baseVal).toContain('rtl:-scale-x-100');
    expect(container.querySelectorAll('button')).toHaveLength(1);
  });

  it('always navigates to the homepage instead of popping history', () => {
    const { getByRole } = render(<CategoryHeader />);
    fireEvent.click(getByRole('button', { name: 'رجوع' }));
    expect(navigate).toHaveBeenCalledWith({ to: '/' });
    expect(back).not.toHaveBeenCalled();
  });
});
