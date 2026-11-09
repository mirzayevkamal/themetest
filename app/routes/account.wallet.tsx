// Custom wallet page. No `@auto-generated` marker: the engine must not overwrite this.
import { createFileRoute } from '@tanstack/react-router';
import { Wallet } from '@salla.sa/twilight-theme-engine/routes/account';
import type { WalletPageProps } from '@salla.sa/twilight-theme-engine/routes/account';
import { withHead } from '@salla.sa/twilight-theme-engine/tanstack';
import { WalletPage } from '../components/account/WalletPage';
import { AccountShellSkeleton } from '../components/account/AccountPageSkeleton';

export const Route = createFileRoute('/{-$locale}/account/wallet')({
  validateSearch: (search: Record<string, unknown>) => {
    const page = Number(search.page) || 1;
    return page > 1 ? { page } : {};
  },
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: ({ deps }): Promise<WalletPageProps> =>
    Wallet.loader({ search: { page: deps.page ?? 1 } }),
  head: withHead(Wallet),
  pendingComponent: AccountShellSkeleton,
  component: WalletRoute,
});

function WalletRoute() {
  const data: WalletPageProps = Route.useLoaderData();
  return <WalletPage {...data} />;
}
