import { Suspense, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { CloseIcon } from '../icons';

const sheetEase = [0.32, 0.72, 0, 1] as const;

/**
 * Full-screen overlay for homepage banner destinations. Same rise-from-bottom
 * motion as the product sheet, but edge-to-edge of the phone column with a
 * close control pinned to the visual right (no cart shortcut).
 */
export function BannerSheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const sheetTransition = reducedMotion ? { duration: 0 } : { duration: 0.4, ease: sheetEase };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 mx-auto flex w-full max-w-[480px] flex-col overflow-hidden bg-white"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={sheetTransition}
      style={{ willChange: 'transform' }}
    >
      <header
        dir="ltr"
        className="flex shrink-0 items-center justify-end bg-white px-4 py-2 pt-[calc(0.5rem+var(--app-safe-area-top,0px))]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.elements.close', 'إغلاق')}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-neutral-100 bg-white"
        >
          <CloseIcon size={24} />
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-smoke">
        <Suspense fallback={<BannerSheetSkeleton />}>{children}</Suspense>
      </div>
    </motion.div>
  );
}

function BannerSheetSkeleton() {
  return (
    <div className="container py-4">
      <div className="mb-4 h-6 w-40 animate-pulse rounded bg-gray-100" />
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="aspect-[127/120] animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    </div>
  );
}
