// Custom notifications page. No `@auto-generated` marker: the engine must not overwrite this.
import { createFileRoute } from '@tanstack/react-router';
import { Notifications } from '@salla.sa/twilight-theme-engine/routes/account';
import type { NotificationsPageProps } from '@salla.sa/twilight-theme-engine/routes/account';
import { withHead } from '@salla.sa/twilight-theme-engine/tanstack';
import { NotificationsPage } from '../components/account/NotificationsPage';
import { AccountShellSkeleton } from '../components/account/AccountPageSkeleton';

export const Route = createFileRoute('/{-$locale}/account/notifications')({
  loader: ({ params }): Promise<NotificationsPageProps> =>
    Notifications.loader({ locale: params.locale }),
  head: withHead(Notifications),
  pendingComponent: AccountShellSkeleton,
  component: NotificationsRoute,
});

function NotificationsRoute() {
  const data: NotificationsPageProps = Route.useLoaderData();
  return <NotificationsPage {...data} />;
}
