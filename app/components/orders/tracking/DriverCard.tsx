import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { PhoneIcon, WhatsappIcon } from '../../icons';
import driverPlaceholder from '../../../styles/images/driver-placeholder.png';
import type { ShipmentDriver } from '../types';

/** Assigned driver with call / WhatsApp, or the "not assigned yet" placeholder. */
export function DriverCard({ driver }: { driver?: ShipmentDriver }) {
  const { t } = useTranslation();
  const digits = driver?.mobile?.replace(/\D/g, '') ?? '';
  const contact =
    'flex size-[34px] items-center justify-center rounded-lg border border-neutral-100 text-[#555555]';

  return (
    <section className="flex items-center gap-2 rounded-xl bg-white p-3">
      <span className="flex size-[34px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100">
        <img
          src={driverPlaceholder}
          alt=""
          width={18}
          height={18}
          className="size-[18px] opacity-30"
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-black text-ink">
          {driver?.name ?? t('pages.order.no_driver', 'لم يتعين مندوب التوصيل')}
        </p>
        {!driver && (
          <p className="text-xs text-neutral-500">
            {t('pages.order.no_driver_message', 'سيتم تعيين مندوب التوصيل خلال ثوان')}
          </p>
        )}
      </div>
      <div className={`flex gap-3 ${digits ? '' : 'pointer-events-none opacity-30'}`}>
        <a
          href={digits ? `tel:${driver?.mobile}` : undefined}
          aria-disabled={!digits}
          aria-label={t('pages.order.call_driver', 'اتصل بالمندوب')}
          className={contact}
        >
          <PhoneIcon />
        </a>
        <a
          href={digits ? `https://wa.me/${digits}` : undefined}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!digits}
          aria-label={t('pages.order.whatsapp_driver', 'راسل المندوب عبر واتساب')}
          className={contact}
        >
          <WhatsappIcon />
        </a>
      </div>
    </section>
  );
}
