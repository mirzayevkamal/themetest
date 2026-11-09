import { useRouter } from '@tanstack/react-router';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { BackIcon } from '../icons';

/** Pops history, or lands on `to` / home when there is nothing to pop (deep links). */
export function useGoBack(to?: string) {
  const router = useRouter();

  return () => {
    if (to) {
      void router.navigate({ to });
      return;
    }

    if (router.history.canGoBack()) {
      router.history.back();
      return;
    }

    void router.navigate({ to: '/' });
  };
}

/** Locale-aware back action shared by cart and other compact page headers. */
export function BackButton({ to }: { to?: string } = {}) {
  const { t } = useTranslation();
  const goBack = useGoBack(to);

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={t('common.elements.back', 'رجوع')}
      className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-neutral-100 bg-white p-2.5"
    >
      <BackIcon />
    </button>
  );
}
