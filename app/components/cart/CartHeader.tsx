import { SallaButton } from '@salla.sa/twilight-components-react';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { AddressBar } from '../layout/AddressBar';
import { BackButton, MobileOnly } from '../navigation';
import { CloseIcon } from '../icons';

/** Cart screen header from Figma: back, title, address. Drawer swaps back for close. */
export function CartHeader({ onClose }: { onClose?: () => void } = {}) {
  const { t } = useTranslation();
  const drawer = Boolean(onClose);

  return (
    <header
      className={
        drawer
          ? 'sticky top-0 z-20 flex shrink-0 items-center gap-2 bg-white p-4 shadow-[0_6px_16px_rgba(0,0,0,0.08)]'
          : 'cart-page-header mobile-sticky-bar sticky top-0 z-20 flex shrink-0 items-center gap-2 bg-white px-4 py-2 shadow-[0_6px_16px_rgba(0,0,0,0.08)]'
      }
    >
      {onClose ? (
        <SallaButton
          type="button"
          shape="btn"
          fill="outline"
          color="light"
          ariaLabel={t('common.elements.close', 'إغلاق')}
          onClick={onClose}
          className="!size-11 !min-h-0 !min-w-0 shrink-0 !rounded-xl !border-neutral-100 !bg-white !p-0"
        >
          <CloseIcon size={24} />
        </SallaButton>
      ) : (
        <MobileOnly>
          <BackButton />
        </MobileOnly>
      )}
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5">
        <p id={drawer ? 'drawer-title' : undefined} className="text-base font-bold text-ink">
          {t('pages.cart.title', 'السلة')}
        </p>
        {!drawer && <AddressBar className="gap-1 text-sm" />}
      </div>
      {drawer ? (
        <span className="w-11 shrink-0" aria-hidden="true" />
      ) : (
        <MobileOnly>
          <span className="w-11 shrink-0" aria-hidden="true" />
        </MobileOnly>
      )}
    </header>
  );
}
