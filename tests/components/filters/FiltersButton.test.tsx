import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { FiltersButton } from '../../../app/components/filters/FiltersButton';
import {
  resetFiltersDrawerForTests,
  useFiltersDrawerOpen,
} from '../../../app/hooks/useFiltersDrawer';

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
vi.mock('@salla.sa/twilight-theme-engine/hooks/useStore', () => ({
  useStore: () => ({ settings: { product: { filters: true } } }),
}));
vi.mock('../../../app/components/filters/FiltersDrawer', () => ({
  FiltersDrawer: ({ open }: { open: boolean }) => (open ? <div role="dialog" /> : null),
}));

const isOpen = () => renderHook(() => useFiltersDrawerOpen()).result.current;

describe('FiltersButton', () => {
  afterEach(resetFiltersDrawerForTests);

  it('opens the shell drawer state and drops it when it unmounts', async () => {
    const view = render(<FiltersButton filters={[{ key: 'price' }]} />);
    expect(isOpen()).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'تصفية المنتجات' }));
    expect(isOpen()).toBe(true);
    expect(await screen.findByRole('dialog')).toBeTruthy();

    // A new search term remounts the search page's button while the drawer is open.
    view.unmount();
    expect(isOpen()).toBe(false);
  });
});
