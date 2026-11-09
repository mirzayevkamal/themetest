import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Drawer } from '../../../app/components/layout/Drawer';

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({ locale: 'ar' }),
}));

describe('Drawer', () => {
  it('closes with the latest onClose without re-locking page scroll', () => {
    const first = vi.fn();
    const second = vi.fn();
    document.documentElement.style.overflowY = 'auto';

    const { rerender, unmount } = render(<Drawer onClose={first}>body</Drawer>);
    expect(document.documentElement.style.overflowY).toBe('hidden');

    document.documentElement.style.overflowY = 'scroll';
    rerender(<Drawer onClose={second}>body</Drawer>);
    expect(document.documentElement.style.overflowY).toBe('scroll');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);

    unmount();
    expect(document.documentElement.style.overflowY).toBe('auto');
  });
});
