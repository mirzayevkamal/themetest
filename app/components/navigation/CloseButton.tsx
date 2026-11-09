import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { CloseIcon } from '../icons/CloseIcon';

/** Square close control for drawers and sheets; same box as BackButton. */
export function CloseButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('common.elements.close', 'إغلاق')}
      className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-neutral-100 bg-white"
    >
      <CloseIcon size={24} />
    </button>
  );
}
