// Custom static page. No `@auto-generated` marker: the engine must not overwrite this.
import { createFileRoute } from '@tanstack/react-router';
import { page as pageApi } from '@salla.sa/twilight-theme-engine/api/page';
import { PageSingle } from '@salla.sa/twilight-theme-engine/routes/page';
import { withHead } from '@salla.sa/twilight-theme-engine/tanstack';
import { StaticPage, type StaticPageProps } from '../components/account/StaticPage';

// The engine loader drops the page `type`, which marks app-built (`customised`) pages.
export async function staticPageLoader(id: string): Promise<StaticPageProps> {
  const data = await pageApi.findOrThrow(id);
  return {
    page: {
      slug: 'page-single',
      id: data.id,
      title: data.name,
      url: data.url,
      content: data.content,
      metadata: data.metadata,
      created_at: data.created_at,
      type: data.type,
    },
  };
}

export const Route = createFileRoute('/{-$locale}/$slug/page-{$id}')({
  loader: ({ params }) => staticPageLoader(params.id),
  head: withHead(PageSingle),
  component: StaticPageRoute,
});

function StaticPageRoute() {
  const data = Route.useLoaderData();
  return <StaticPage {...data} />;
}
