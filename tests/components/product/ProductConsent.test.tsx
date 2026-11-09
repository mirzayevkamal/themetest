import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Product } from '@salla.sa/twilight-theme-engine/types';
import {
  ProductConsentPrompt,
  productNeedsConsent,
  resetProductConsentForTests,
  useProductConsent,
} from '../../../app/components/product/ProductConsent';

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback, locale: 'ar' }),
}));

let themeSettings: Record<string, unknown> = {};
vi.mock('@salla.sa/twilight-theme-engine/providers', () => ({
  useTwilight: () => ({ theme: { settings: themeSettings } }),
}));

const tagged = { tags: [{ name: ' Consent ', url: '' }] } as Pick<Product, 'tags'>;
const plain = { tags: [{ name: 'fresh', url: '' }] } as Pick<Product, 'tags'>;

function Add({ product, onAdd }: { product: Pick<Product, 'tags'>; onAdd: () => void }) {
  const { guard } = useProductConsent(product);
  return (
    <button type="button" onClick={() => guard(onAdd)}>
      add
    </button>
  );
}

function renderAdd(product: Pick<Product, 'tags'>, onAdd = vi.fn()) {
  render(
    <>
      <Add product={product} onAdd={onAdd} />
      <ProductConsentPrompt />
    </>
  );
  return onAdd;
}

const clearCookie = () => {
  document.cookie = 'product_consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
};

describe('productNeedsConsent', () => {
  it('is off unless the merchant enabled it', () => {
    expect(productNeedsConsent({ product_consent_tags: 'consent' }, tagged)).toBe(false);
  });

  it('matches any listed tag, ignoring case, spaces and an Arabic comma', () => {
    const settings = { product_consent_enabled: true, product_consent_tags: 'other، CONSENT ,x' };
    expect(productNeedsConsent(settings, tagged)).toBe(true);
    expect(productNeedsConsent(settings, plain)).toBe(false);
  });

  it('is off when no tags are set', () => {
    expect(productNeedsConsent({ product_consent_enabled: true }, tagged)).toBe(false);
  });
});

describe('useProductConsent', () => {
  beforeEach(() => {
    clearCookie();
    resetProductConsentForTests();
    themeSettings = { product_consent_enabled: true, product_consent_tags: 'consent' };
  });
  afterEach(() => vi.useRealTimers());

  it('adds an untagged product without asking', () => {
    const onAdd = renderAdd(plain);
    fireEvent.click(screen.getByText('add'));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('holds the add until the customer agrees, then stops asking', () => {
    const onAdd = renderAdd(tagged);
    fireEvent.click(screen.getByText('add'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(onAdd).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'أوافق' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.cookie).toMatch(/product_consent=\d+/);

    fireEvent.click(screen.getByText('add'));
    expect(onAdd).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('drops the add on cancel and asks again next time', () => {
    const onAdd = renderAdd(tagged);
    fireEvent.click(screen.getByText('add'));
    fireEvent.click(screen.getByRole('button', { name: 'إلغاء' }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByText('add'));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('drops the add when the modal closes itself', () => {
    const onAdd = renderAdd(tagged);
    fireEvent.click(screen.getByText('add'));
    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('moves focus to Agree and back to the tapped control', async () => {
    renderAdd(tagged);
    const add = screen.getByText('add');
    add.focus();
    fireEvent.click(add);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'أوافق' }))
    );
    fireEvent.click(screen.getByRole('button', { name: 'إلغاء' }));
    expect(document.activeElement).toBe(add);
  });

  it('asks again once the consent is a day old', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    renderAdd(tagged);
    fireEvent.click(screen.getByText('add'));
    fireEvent.click(screen.getByRole('button', { name: 'أوافق' }));

    vi.setSystemTime(Date.now() + 24 * 60 * 60 * 1000 + 1);
    fireEvent.click(screen.getByText('add'));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('keeps Tab inside the modal', () => {
    renderAdd(tagged);
    fireEvent.click(screen.getByText('add'));
    const close = screen.getByRole('button', { name: 'close' });
    const cancel = screen.getByRole('button', { name: 'إلغاء' });

    cancel.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(cancel);

    screen.getByText('add').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
  });

  it("shows the merchant's title and message in the current locale", () => {
    themeSettings.product_consent_title = { ar: 'عنوان التاجر', en: 'Merchant title' };
    themeSettings.product_consent_message = { ar: 'رسالة التاجر', en: 'Merchant text' };
    renderAdd(tagged);
    fireEvent.click(screen.getByText('add'));
    expect(screen.getByRole('heading', { name: 'عنوان التاجر' })).toBeTruthy();
    expect(screen.getByText('رسالة التاجر')).toBeTruthy();
  });

  it('falls back to the default title when the merchant leaves it empty', () => {
    renderAdd(tagged);
    fireEvent.click(screen.getByText('add'));
    expect(screen.getByRole('heading', { name: 'تأكيد الموافقة' })).toBeTruthy();
  });

  it('holds a tap on a web component icon and replays it on the button', () => {
    const inner = vi.fn();
    function Widget() {
      const { onClickCapture } = useProductConsent(tagged);
      return (
        <span onClickCapture={onClickCapture}>
          <button type="button" onClick={inner}>
            <svg data-testid="product-consent-buy-icon">
              <path />
            </svg>
            buy
          </button>
        </span>
      );
    }
    render(
      <>
        <Widget />
        <ProductConsentPrompt />
      </>
    );
    fireEvent.click(screen.getByTestId('product-consent-buy-icon'));
    expect(inner).not.toHaveBeenCalled();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'أوافق' }));
    });
    expect(inner).toHaveBeenCalledTimes(1);
  });
});
