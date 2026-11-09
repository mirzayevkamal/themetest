import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContactPage } from '../../../app/components/account/ContactPage';

const mockStore: { contacts: Record<string, string>; social: Record<string, string> | unknown[] } =
  {
    contacts: { mobile: '8001210003' },
    social: [],
  };

vi.mock('@salla.sa/twilight-theme-engine', () => ({
  useTwilight: () => ({ store: mockStore }),
}));

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

vi.mock('../../../app/components/navigation', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock('@salla.sa/twilight-components-react/contacts', () => ({
  SallaContacts: () => <div data-testid="contact-channels-list" />,
}));

vi.mock('@salla.sa/twilight-components-react/social', () => ({
  SallaSocial: ({ className }: { className?: string }) => (
    <ul data-testid="contact-social-list" className={className} />
  ),
}));

describe('ContactPage', () => {
  beforeEach(() => {
    mockStore.social = [];
  });

  it('lists the store social links under the contacts', () => {
    mockStore.social = {
      instagram: 'https://instagram.com/meed',
      tiktok: 'https://tiktok.com/@meed',
    };
    render(<ContactPage />);
    const contacts = screen.getByTestId('contact-channels-list');
    const social = screen.getByTestId('contact-social-list');
    expect(social.className).toBe('mt-4 block');
    expect(
      contacts.compareDocumentPosition(social) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('leaves out the social row when the store has no social links', () => {
    render(<ContactPage />);
    expect(screen.getByTestId('contact-channels-list')).toBeTruthy();
    expect(screen.queryByTestId('contact-social-list')).toBeNull();
  });
});
