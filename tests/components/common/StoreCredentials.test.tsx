import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  SbcBadge,
  TaxCertificateLink,
  hasTrustBadge,
} from '../../../app/components/common/StoreCredentials';

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

describe('StoreCredentials', () => {
  it('keeps the VAT number plain text without an uploaded certificate', () => {
    render(<TaxCertificateLink certificate={null}>310123456700003</TaxCertificateLink>);
    expect(screen.getByText('310123456700003')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('opens the uploaded certificate from the VAT number, and closes it', async () => {
    render(
      <TaxCertificateLink certificate="https://cdn.test/vat.png">
        310123456700003
      </TaxCertificateLink>
    );
    expect(screen.queryByRole('img', { name: 'الشهادة الضريبية' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'الشهادة الضريبية' }));
    const image = await screen.findByRole('img', { name: 'الشهادة الضريبية' });
    expect(image.getAttribute('src')).toBe('https://cdn.test/vat.png');

    const close = screen
      .getAllByRole('button')
      .find((button) => button.textContent !== '310123456700003')!;
    fireEvent.click(close);
    await waitFor(() => expect(screen.queryByRole('img', { name: 'الشهادة الضريبية' })).toBeNull());
  });

  it('links the Saudi Business Center badge to the certificate page', () => {
    render(<SbcBadge id="0000 123" />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe(
      'https://eauthenticate.saudibusiness.gov.sa/certificate-details/0000%20123'
    );
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.textContent).toContain('منصة الأعمال');
  });

  it('renders no Saudi Business Center badge without a certificate id', () => {
    const { container } = render(<SbcBadge id={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('expects a trust badge only with a commercial register or freelance number', () => {
    expect(hasTrustBadge(undefined)).toBe(false);
    expect(hasTrustBadge({ commercial_number: null, freelance_number: '' })).toBe(false);
    expect(hasTrustBadge({ commercial_number: '1010123456' })).toBe(true);
    expect(hasTrustBadge({ freelance_number: 'FL-1' })).toBe(true);
  });
});
