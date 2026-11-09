import type { PageSingleProps } from '@salla.sa/twilight-theme-engine/routes/page';
import { BlockHookSlot } from '../common/BlockHookSlot';
import { PageHeader } from '../navigation';

export type StaticPageProps = {
  page: PageSingleProps['page'] & { type?: string };
};

/** Store info page (`/$slug/page-$id`): title + back header instead of the engine breadcrumb. */
export function StaticPage({ page }: StaticPageProps) {
  return (
    <div key={page.slug} className="flex min-h-full flex-col bg-smoke">
      <PageHeader title={page.title} />
      {/* Like Twig, an app-built page's body is the app's own block. */}
      {page.type === 'customised' ? (
        <BlockHookSlot
          name="information_page.information_page"
          wrapper="s-information-page"
          scope={page.id != null ? { page_id: page.id } : undefined}
        />
      ) : (
        page.content && (
          <article
            className="content-entry article m-4 rounded-xl bg-white p-4 text-sm leading-normal text-ink"
            dangerouslySetInnerHTML={{ __html: page.content.replace(/&nbsp;/g, ' ') }}
          />
        )
      )}
    </div>
  );
}
