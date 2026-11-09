import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { ChevronDownIcon, PinIcon } from '../icons';
import {
  openDeliverySheet,
  useBulletDeliveryEnabled,
  useDeliveryScope,
} from '../../hooks/useBulletDelivery';

/** Delivery address line shared by the app-shell and cart headers; taps open the address sheet. */
export function AddressBar({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const enabled = useBulletDeliveryEnabled();
  const { hasAddress, label, pickup } = useDeliveryScope();

  if (!enabled) return null;

  return (
    <button
      type="button"
      onClick={openDeliverySheet}
      className={`flex max-w-full items-center text-ink ${className}`.trim()}
    >
      <PinIcon />
      <span className="truncate">
        {hasAddress && label
          ? `${
              pickup
                ? t('common.delivery.pickup_label', 'استلام')
                : t('common.delivery.label', 'التوصيل')
            }: ${label}`
          : t('common.delivery.choose_address', 'حدد عنوان التوصيل')}
      </span>
      <ChevronDownIcon />
    </button>
  );
}
