import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BannerSheet } from '../../../app/components/home/BannerSheet';

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

describe('BannerSheet', () => {
  it('fills the phone column and closes from the visual-right control', () => {
    const onClose = vi.fn();
    render(
      <BannerSheet onClose={onClose}>
        <p>offers</p>
      </BannerSheet>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('inset-0');
    expect(dialog.className).toContain('w-full');
    expect(dialog.className).toContain('max-w-[480px]');
    expect(screen.getByText('offers')).toBeTruthy();

    const close = screen.getByRole('button', { name: 'إغلاق' });
    expect(close.parentElement?.getAttribute('dir')).toBe('ltr');
    expect(close.parentElement?.className).toContain('justify-end');
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalled();
  });
});
