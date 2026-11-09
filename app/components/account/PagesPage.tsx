import { useQuery } from '@tanstack/react-query';
import { menu } from '@salla.sa/twilight-theme-engine/api/menu';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { PageHeader } from '../navigation';
import { Row, Section } from './AccountRows';

function PagesSkeleton() {
  return (
    <div data-testid="pages-skeleton">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-2 py-2">
          <div className="h-5 flex-1 animate-pulse rounded bg-gray-100" />
          <div className="size-4 animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

/** `/account/pages`: the store's footer menu (info pages) as tappable rows. */
export function PagesPage() {
  const { t } = useTranslation();
  const { data: pages = [], isPending } = useQuery({
    queryKey: ['menu', 'footer'],
    queryFn: menu.footer,
  });

  return (
    <div className="flex min-h-full flex-col bg-smoke">
      <PageHeader title={t('pages.account.pages', 'الصفحات التعريفية')} />
      <div className="p-4">
        <Section>
          {isPending ? (
            <PagesSkeleton />
          ) : pages.length === 0 ? (
            <p className="py-2 text-center text-sm text-neutral-500">
              {t('pages.account.no_pages', 'لا توجد صفحات حالياً')}
            </p>
          ) : (
            pages.map((page) => <Row key={page.id} label={page.title} to={page.url} />)
          )}
        </Section>
      </div>
    </div>
  );
}
