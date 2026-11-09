import { Link } from '@salla.sa/twilight-theme-engine/common';
import { HookSlot } from '@salla.sa/twilight-theme-engine/hooks';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import type { NotificationsPageProps } from '@salla.sa/twilight-theme-engine/routes/account';
import { BellIcon } from '../icons/BellIcon';
import { PageHeader } from '../navigation';
import { AccountShell } from './AccountSidebar';

type Notification = NotificationsPageProps['notifications'][number];

function NotificationRow({ notification }: { notification: Notification }) {
  const unread = !notification.is_read;
  return (
    <li>
      <Link to={notification.url} className="flex items-start gap-3 py-3">
        <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-mint-tint text-ink">
          <BellIcon />
          {unread && <span className="absolute end-0 top-0 size-2 rounded-full bg-discount" />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={`text-sm leading-5 text-ink ${unread ? 'font-bold' : ''}`}>
            {notification.title}
          </span>
          {notification.body && (
            <span className="line-clamp-2 text-xs text-neutral-500">{notification.body}</span>
          )}
          <span className="text-xs text-silver">{notification.time_ago}</span>
        </span>
      </Link>
    </li>
  );
}

function EmptyNotifications() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-mint-tint text-ink">
        <BellIcon size={28} />
      </span>
      <p className="text-base font-black text-ink">
        {t('blocks.header.no_notifications', 'لا توجد إشعارات')}
      </p>
    </div>
  );
}

/** Notifications in the account shell: one card, newest first as the API sends them, an unread
 *  dot and bold title per unread one. The engine's merchant-app slots stay around the list. */
export function NotificationsPage({ notifications }: NotificationsPageProps) {
  const { t } = useTranslation();
  return (
    <AccountShell header={<PageHeader title={t('common.titles.notifications', 'الإشعارات')} />}>
      <HookSlot name="customer:notifications.items.start" />
      <section className="rounded-xl bg-white px-4 py-1">
        {notifications.length > 0 ? (
          <ul className="divide-y divide-neutral-100">
            {notifications.map((notification) => (
              <NotificationRow key={notification.id} notification={notification} />
            ))}
          </ul>
        ) : (
          <EmptyNotifications />
        )}
      </section>
      <HookSlot name="customer:notifications.items.end" />
    </AccountShell>
  );
}
