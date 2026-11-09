import { Suspense, useState, type ReactNode } from 'react';
import { ImageModal } from '@salla.sa/twilight-theme-engine/components/modal';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';

/** Salla's VAT and Saudi Business Center marks: platform assets, the same for every store. */
export const TAX_ICON_URL =
  'https://cdn.salla.network/cdn-cgi/image/fit=scale-down,width=70,height=70,onerror=redirect,format=auto/images/tax.png?v=2.0.5';
const SBC_ICON_URL = 'https://cdn.salla.network/images/sbc.png?v=2.0.5';

/**
 * The VAT number's wrapper. With an uploaded certificate it is a button that opens the
 * certificate image; without one it is plain content. The modal's chunk loads on first open.
 */
export function TaxCertificateLink({
  certificate,
  className,
  children,
}: {
  /** `store.settings.tax.certificate`: the uploaded certificate image, if any. */
  certificate?: string | null;
  className?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!certificate) return <div className={className}>{children}</div>;

  const label = t('common.elements.tax_certificate', 'الشهادة الضريبية');
  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={label}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      {open && (
        <Suspense fallback={null}>
          <ImageModal
            isOpen
            onClose={() => setOpen(false)}
            src={certificate}
            alt={label}
            title={label}
          />
        </Suspense>
      )}
    </>
  );
}

/** The store's Saudi Business Center certificate, linking to its page on the SBC site. */
export function SbcBadge({ id, className = '' }: { id?: string | null; className?: string }) {
  const { t } = useTranslation();
  if (!id) return null;

  return (
    <a
      href={`https://eauthenticate.saudibusiness.gov.sa/certificate-details/${encodeURIComponent(id)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2 transition-opacity hover:opacity-80 ${className}`}
    >
      <img
        src={SBC_ICON_URL}
        alt=""
        width={56}
        height={40}
        loading="lazy"
        decoding="async"
        className="h-8 w-auto rounded-sm"
      />
      <span className="flex flex-col gap-1 text-start leading-none">
        <span className="text-xs opacity-60">{t('blocks.footer.sbc_trusted_by', 'موثق لدى')}</span>
        <b className="text-sm">{t('blocks.footer.sbc_platform', 'منصة الأعمال')}</b>
      </span>
    </a>
  );
}

/** Salla's commercial register / freelance badge renders only when one of the numbers is set. */
export function hasTrustBadge(
  settings:
    | {
        commercial_number?: string | null;
        freelance_number?: string | null;
      }
    | undefined
): boolean {
  return Boolean(settings?.commercial_number || settings?.freelance_number);
}
