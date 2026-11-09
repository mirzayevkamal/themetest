import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { SallaButton } from '@salla.sa/twilight-components-react';
import { SallaModal } from '@salla.sa/twilight-components-react/modal';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { useTwilight } from '@salla.sa/twilight-theme-engine/providers';
import type { Product } from '@salla.sa/twilight-theme-engine/types';
import { createOverlayStore } from '../../hooks/overlayStore';
import { localizedSetting } from '../../lib/localizedSetting';

const COOKIE = 'product_consent';
// Session cookie that also expires: the value is the consent time.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type Settings = Record<string, unknown> | undefined;

const normalize = (tag: string) => tag.trim().toLowerCase();

function hasConsent() {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=(\\d+)`));
  return !!match && Date.now() - Number(match[1]) < MAX_AGE_MS;
}

function saveConsent() {
  document.cookie = `${COOKIE}=${Date.now()}; path=/; SameSite=Lax`;
}

/** The merchant turned consent on and the product carries one of its tags. */
export function productNeedsConsent(settings: Settings, product: Pick<Product, 'tags'>) {
  if (settings?.product_consent_enabled !== true) return false;
  const wanted = new Set(
    String(settings.product_consent_tags ?? '')
      .split(/[,،]/)
      .map(normalize)
      .filter(Boolean)
  );
  if (!wanted.size) return false;
  return (product.tags ?? []).some((tag) => wanted.has(normalize(tag.name ?? '')));
}

const prompt = createOverlayStore<((agreed: boolean) => void) | null>(null);

/** Runs `action` now, or after the customer agrees when the product needs consent. */
export function useProductConsent(product: Pick<Product, 'tags'>) {
  const { theme } = useTwilight();
  const settings = theme?.settings as Settings;
  const needed = () => productNeedsConsent(settings, product) && !hasConsent();

  const guard = (action: () => void) => {
    if (!needed()) return action();
    prompt.open((agreed) => {
      prompt.close();
      if (!agreed) return;
      saveConsent();
      action();
    });
  };

  // For SDK web components that act on their own click: hold the tap, replay it once
  // agreed. The tap may land on an icon's svg, which has no click(), so replay on the
  // nearest HTML element (the component's own button).
  const onClickCapture = (e: MouseEvent) => {
    if (!needed()) return;
    const target = e.nativeEvent
      .composedPath()
      .find((node): node is HTMLElement => node instanceof HTMLElement);
    e.preventDefault();
    e.stopPropagation();
    guard(() => target?.click());
  };

  return { guard, onClickCapture };
}

/** The one consent modal, mounted by MainLayout. */
export function ProductConsentPrompt() {
  const { t, locale } = useTranslation();
  const { theme } = useTwilight();
  const settings = theme?.settings as Settings;
  const answer = prompt.useValue();
  const agreeRef = useRef<HTMLDivElement>(null);
  // salla-modal moves itself to <body> and its children into its own markup, so it is
  // portalled to <body> and its children never unmount; React's removeChild fails otherwise.
  const [body, setBody] = useState<HTMLElement | null>(null);
  useEffect(() => setBody(document.body), []);

  // salla-modal only focuses form fields and has no focus trap, so move focus to Agree once
  // it shows (which also lets its Escape listener hear the key), keep Tab inside it, and
  // hand focus back on close.
  useEffect(() => {
    if (!answer) return;
    const opener = document.activeElement;
    const frame = requestAnimationFrame(() => agreeRef.current?.querySelector('button')?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const dialog = agreeRef.current?.closest('[role="dialog"]');
      const buttons = [...(dialog?.querySelectorAll('button') ?? [])];
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      const active = document.activeElement;
      if (!first || !last) return;
      if (!dialog?.contains(active) || (!e.shiftKey && active === last)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [answer]);

  if (!body) return null;
  const title =
    localizedSetting(settings?.product_consent_title, locale) ||
    t('pages.products.consent_title', 'تأكيد الموافقة');
  const message =
    localizedSetting(settings?.product_consent_message, locale) ||
    t('pages.products.consent_message', 'يتطلب هذا المنتج موافقتك على شروط الشراء قبل المتابعة.');

  return createPortal(
    <SallaModal
      id="product-consent-modal"
      width="sm"
      visible={!!answer}
      // The close button, backdrop and Escape close it from inside the component.
      onModalVisibilityChanged={(e) => !e.detail && answer?.(false)}
    >
      <div className="product-consent">
        <h2 className="text-xl font-bold text-ink">{title}</h2>
        <p className="mt-2 whitespace-pre-line text-sm text-neutral-500">{message}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div ref={agreeRef} className="contents">
            <SallaButton
              color="primary"
              className="cta-button w-full"
              onClick={() => answer?.(true)}
            >
              {t('pages.products.consent_agree', 'أوافق')}
            </SallaButton>
          </div>
          <SallaButton
            color="light"
            fill="outline"
            className="w-full"
            onClick={() => answer?.(false)}
          >
            {t('common.actions.cancel', 'إلغاء')}
          </SallaButton>
        </div>
      </div>
    </SallaModal>,
    body
  );
}

export const resetProductConsentForTests = prompt.close;
