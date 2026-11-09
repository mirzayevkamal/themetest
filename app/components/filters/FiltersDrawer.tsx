import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'motion/react';
import { SallaButton } from '@salla.sa/twilight-components-react';
import { SallaFilters } from '@salla.sa/twilight-components-react/filters';
import type { Filter } from '@salla.sa/twilight-theme-engine/api/product';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { Drawer } from '../layout/Drawer';
import { PageHeader } from '../navigation/PageHeader';
import { useDarkButtons } from '../../hooks/useAccentStyle';

/** `<salla-filters>` in the side drawer. Each change applies at once (the component
 *  emits `salla-filters::changed`), so the drawer stays open for more picks. */
export function FiltersDrawer({
  open,
  filters,
  onClose,
}: {
  open: boolean;
  /** Undefined while they load. */
  filters?: Filter[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const dark = useDarkButtons();
  const ref = useRef<ComponentRef<typeof SallaFilters>>(null);
  // Portalled to the body: the page's scroll area may be transformed in the native app.
  const [body, setBody] = useState<HTMLElement | null>(null);
  useEffect(() => setBody(document.body), []);
  if (!body) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <Drawer key="filters-drawer" onClose={onClose}>
          <PageHeader title={t('pages.filters.title', 'تصفية المنتجات')} onClose={onClose} />
          <div className="filters-drawer min-h-0 flex-1 overflow-y-auto bg-white p-4">
            {filters ? (
              <SallaFilters ref={ref} filters={filters as never} />
            ) : (
              <div className="flex flex-col gap-4">
                {['w-24', 'w-full', 'w-2/3', 'w-28', 'w-full'].map((w, i) => (
                  <div key={i} className={`h-5 ${w} rounded bg-gray-100 animate-pulse`} />
                ))}
              </div>
            )}
          </div>
          <div className={`flex shrink-0 gap-2 bg-white p-4 shadow-bar${dark ? ' cta-dark' : ''}`}>
            <SallaButton
              type="button"
              onClick={onClose}
              color="primary"
              size="medium"
              className="cta-button flex-1"
            >
              {t('pages.filters.show_results', 'عرض النتائج')}
            </SallaButton>
            <SallaButton
              type="button"
              onClick={() => void ref.current?.resetFilters()}
              color="primary"
              fill="outline"
              size="medium"
              disabled={!filters}
            >
              {t('pages.filters.clear', 'مسح الكل')}
            </SallaButton>
          </div>
        </Drawer>
      ) : null}
    </AnimatePresence>,
    body
  );
}
