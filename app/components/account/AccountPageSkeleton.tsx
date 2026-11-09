import { AccountShell } from './AccountSidebar';

/** The phone header bar's placeholder. `mobile-sticky-bar`, like PageHeader's bar, so web
 *  desktop hides it inside the account shell (account-desktop.scss). */
function HeaderPlaceholder() {
  return (
    <div className="mobile-sticky-bar flex h-15 shrink-0 items-center justify-center bg-white px-4">
      <div className="h-5 w-24 animate-pulse rounded bg-gray-100" />
    </div>
  );
}

function CardPlaceholders({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-3 ${className}`} data-testid="account-skeleton">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-xl border border-neutral-100 bg-white px-3 py-4"
        >
          <div className="flex items-center">
            {[0, 1, 2].map((j) => (
              <div
                key={j}
                className={`size-11 animate-pulse rounded-xl border border-neutral-100 bg-gray-100 ${j ? '-ms-2' : ''}`}
              />
            ))}
            <div className="ms-auto h-5 w-16 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
          <div className="flex gap-3">
            {[0, 1, 2].map((j) => (
              <div key={j} className="h-8 flex-1 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Mobile account-page placeholder: header bar plus card outlines. Registered as the
 *  engine's `account:layout-pending`, and used by the order drawer and the thank-you page,
 *  which have no account sidebar. */
export function AccountPageSkeleton({ header = true }: { header?: boolean } = {}) {
  return (
    <div className="flex min-h-full flex-col bg-smoke">
      {header && <HeaderPlaceholder />}
      <CardPlaceholders className="p-4" />
    </div>
  );
}

/** pendingComponent of the account pages drawn in `AccountShell`: the same phone placeholder,
 *  and on web desktop the real sidebar beside the cards, so the layout doesn't jump while a
 *  page loads. The sidebar needs no page data (the wallet balance is its own cached query). */
export function AccountShellSkeleton() {
  return (
    <AccountShell header={<HeaderPlaceholder />}>
      <CardPlaceholders />
    </AccountShell>
  );
}
