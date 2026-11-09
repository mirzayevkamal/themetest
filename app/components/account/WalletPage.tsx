import { useCallback, useRef } from 'react';
import { ItemsList } from '@salla.sa/twilight-components-react';
import { useMoney } from '@salla.sa/twilight-theme-engine/hooks/useMoney';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { Wallet } from '@salla.sa/twilight-theme-engine/routes/account';
import type { WalletPageProps } from '@salla.sa/twilight-theme-engine/routes/account';
import { WalletAddIcon, WalletEmptyBadgeIcon, WalletRemoveIcon } from '../icons';
import { PageHeader } from '../navigation';
import { AccountShell } from './AccountSidebar';

type Transaction = WalletPageProps['transactions'][number];

function TransactionRow({ transaction }: { transaction: Transaction }) {
  const { format } = useMoney();
  const debit = transaction.amount < 0 || transaction.action_type === 'purchase_by_wallet';
  const date = transaction.created_at
    ? new Date(transaction.created_at * 1000).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  return (
    <li className="flex items-center gap-2 py-2">
      {debit ? <WalletRemoveIcon className="text-discount" /> : <WalletAddIcon />}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-sm font-bold leading-5 text-ink">{transaction.title}</p>
        <p className="text-[10px] leading-3 text-neutral-500">{date}</p>
      </div>
      <p className={`text-sm font-bold leading-4 ${debit ? 'text-discount' : 'text-brand'}`}>
        {debit && transaction.amount > 0 && '-'}
        {format(transaction.amount)}
      </p>
    </li>
  );
}

function EmptyHistory() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <span className="relative flex size-14 items-center justify-center rounded-full bg-mint-tint">
        <WalletAddIcon size={30} />
        <span className="absolute left-[29px] top-[29px]">
          <WalletEmptyBadgeIcon />
        </span>
      </span>
      <p className="text-base font-black text-ink">
        {t('pages.wallet.empty_title', 'لا يوجد عمليات استخدام!')}
      </p>
      <p className="text-xs text-neutral-500">
        {t('pages.wallet.empty_description', 'لا توجد اي تواريخ عمليات استخدام المحفظة حتي الان')}
      </p>
    </div>
  );
}

/** Wallet screen from Figma: balance card + transaction history. */
export function WalletPage({ balance, transactions, pagination }: WalletPageProps) {
  const { t } = useTranslation();
  const { format } = useMoney();
  const nextPage = useRef((pagination.current ?? 1) + 1);

  // The engine ships no client-callable wallet API (`api/wallet` is types only),
  // so the route loader doubles as the pager.
  const loadMore = useCallback(async () => {
    const res = await Wallet.loader({ search: { page: nextPage.current } });
    nextPage.current += 1;
    return { items: res.transactions, next: res.pagination.next ?? null };
  }, []);

  return (
    <AccountShell
      balance={balance}
      header={<PageHeader title={t('pages.wallet.title', 'المحفظة')} />}
    >
      <section className="flex items-center gap-2 rounded-xl bg-white p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-mint-tint">
          <WalletAddIcon />
        </span>
        <div className="flex flex-1 flex-col gap-1">
          <p className="text-2xl font-bold leading-5 text-ink">{format(balance)}</p>
          <p className="text-[10px] leading-3 text-neutral-500">
            {t('pages.wallet.available_balance', 'رصيد المحفظة المتاح للاستخدام')}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl bg-white p-4">
        <h2 className="text-base font-bold text-brand">
          {t('pages.wallet.history', 'تاريخ عمليات الاستخدام')}
        </h2>
        <ItemsList<Transaction>
          items={transactions}
          loader={loadMore}
          mode={pagination.next ? 'infinite' : 'static'}
          itemsAs="ul"
          itemsClassName="-my-2 divide-y divide-neutral-100"
          empty={<EmptyHistory />}
          t={(key, fallback) => t(key, fallback || key)}
          ariaLabel={t('pages.wallet.history', 'تاريخ عمليات الاستخدام')}
        >
          {(items) =>
            items.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} />
            ))
          }
        </ItemsList>
      </section>
    </AccountShell>
  );
}
