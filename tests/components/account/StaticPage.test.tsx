import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StaticPage } from '../../../app/components/account/StaticPage';

vi.mock('../../../app/components/navigation', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock('@salla.sa/twilight-theme-engine/hooks', () => ({
  HookSlot: ({ name }: { name: string }) => <div data-hook-slot={name} />,
}));
vi.mock('@salla.sa/twilight-theme-engine/home', () => ({
  PageBlocks: ({ hook, scope }: { hook: string; scope: unknown }) => (
    <div data-page-blocks={hook} data-scope={JSON.stringify(scope)} />
  ),
}));

const page = { slug: 'page-single', id: 12, title: 'من نحن', content: '<p>نص الصفحة</p>' };

describe('StaticPage', () => {
  it('shows the page content under the title bar', () => {
    const { container } = render(<StaticPage page={page} />);

    expect(screen.getByRole('heading', { name: 'من نحن' })).toBeTruthy();
    expect(screen.getByText('نص الصفحة')).toBeTruthy();
    expect(container.querySelector('[data-hook-slot]')).toBeNull();
  });

  it("renders an app-built page's block instead of its content, keeping the title bar", () => {
    const { container } = render(<StaticPage page={{ ...page, type: 'customised' }} />);

    expect(screen.getByRole('heading', { name: 'من نحن' })).toBeTruthy();
    expect(screen.queryByText('نص الصفحة')).toBeNull();
    expect(container.querySelector('[data-page-blocks]')?.getAttribute('data-scope')).toBe(
      '{"page_id":12}'
    );
    expect(
      container.querySelector('[data-hook-slot="information_page.information_page"]')
    ).toBeTruthy();
  });
});
