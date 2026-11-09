import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useTwilight } from '@salla.sa/twilight-theme-engine';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';

const SallaLocalizationModal = lazy(() =>
  import('@salla.sa/twilight-components-react/localization-modal').then((m) => ({
    default: m.SallaLocalizationModal,
  }))
);

function dispatchLocalizationOpen() {
  // The engine stub sets `window.salla` before the CDN SDK attaches `event`.
  void Promise.resolve(window.salla?.onReady?.()).then(() => {
    window.salla?.event?.dispatch('localization::open');
  });
}

type LocalizationModalElement = HTMLElement & { open?: () => Promise<boolean> | boolean };

let requestMount: (() => void) | null = null;

/** Header and account open this one modal. The chunk loads on the first press. */
export function openLocalizationModal() {
  const modal = document.querySelector('salla-localization-modal') as LocalizationModalElement | null;
  if (modal?.classList.contains('hydrated') && typeof modal.open === 'function') {
    void modal.open();
    return;
  }
  if (modal && typeof modal.open !== 'function') {
    dispatchLocalizationOpen();
    return;
  }
  requestMount?.();
}

function MountedLocalizationModal({
  language,
  currency,
}: {
  language: string;
  currency: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const open = () => {
      const modal = root.querySelector('salla-localization-modal') as LocalizationModalElement | null;
      if (!modal) return false;
      // Stencil drops open() before `hydrated`. A test stub has no open method.
      if (modal.classList.contains('hydrated') && typeof modal.open === 'function') {
        void modal.open();
        return true;
      }
      if (typeof modal.open !== 'function' && !customElements.get('salla-localization-modal')) {
        dispatchLocalizationOpen();
        return true;
      }
      return false;
    };

    if (open()) return;

    const observer = new MutationObserver(() => {
      if (open()) observer.disconnect();
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="contents">
      <Suspense fallback={null}>
        <SallaLocalizationModal
          language={language}
          currency={currency}
          suppressHydrationWarning
        />
      </Suspense>
    </div>
  );
}

/** Mounted once in the layout. Stays empty until a language button asks for the modal. */
export function LocalizationModal() {
  const [ready, setReady] = useState(false);
  const { locale } = useTranslation();
  const { currency } = useTwilight();

  useEffect(() => {
    requestMount = () => setReady(true);
    return () => {
      requestMount = null;
    };
  }, []);

  if (!ready) return null;
  return <MountedLocalizationModal language={locale} currency={currency?.code || 'SAR'} />;
}
