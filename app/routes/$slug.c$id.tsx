// Custom override of the engine's ProductListing route (QCD-11): category
// URLs render the grocery category-list page instead. Header intentionally
// NOT "@auto-generated" so the engine build keeps this file.
import { createFileRoute, notFound } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { category } from '@salla.sa/twilight-theme-engine/api/category';
import type { Category } from '@salla.sa/twilight-theme-engine/types';
import { withHead } from '@salla.sa/twilight-theme-engine/tanstack';
import { CategoryListPage, CategoryListSkeleton } from '../components/categories/CategoryListPage';
import { categorySectionQuery, serverSections } from '../components/categories/sectionQuery';

export interface CategoryListLoaderData {
  page: { title: string; slug: string };
  /** Full top-level tree; parents carry sub_categories. */
  categories: Category[];
  activeParent: Category;
  /** Set when the URL points at a sub-category rather than a parent. */
  activeSub?: Category;
}

// URLs may carry the hashed id ("xzjvNQ") or the raw numeric one.
const matches = (cat: Category, id: string) =>
  String(cat.id) === id || (cat.id_ != null && String(cat.id_) === id);

export async function categoryListLoader({
  params,
  context,
}: {
  params: { id: string };
  context: { queryClient: QueryClient };
}): Promise<CategoryListLoaderData> {
  // Through the query cache so parent-tab navigations don't refetch the tree.
  const categories = await context.queryClient.ensureQueryData(category.queries.list());
  const data = resolve(categories, params.id);
  if (!data) throw notFound();

  // The first screen's sections ship in the HTML so their images (the LCP) need no
  // hydration, intersection or client fetch. A failure here just leaves that section
  // to fetch on the client like the others.
  const sections = Promise.all(
    serverSections(data).map((section) =>
      context.queryClient.ensureQueryData(categorySectionQuery(section)).catch(() => undefined)
    )
  );
  // Only the server waits. A client navigation renders the shell at once; each
  // section's own skeleton covers this prefetch, which its useQuery then dedupes.
  if (import.meta.env.SSR) await sections;

  return data;
}

function resolve(categories: Category[], id: string): CategoryListLoaderData | undefined {
  for (const parent of categories) {
    if (matches(parent, id)) {
      return { page: { title: parent.name, slug: 'category' }, categories, activeParent: parent };
    }
    const sub = parent.sub_categories?.find((s) => matches(s, id));
    if (sub) {
      return {
        page: { title: sub.name, slug: 'category' },
        categories,
        activeParent: parent,
        activeSub: sub,
      };
    }
  }
  return undefined;
}

export const Route = createFileRoute('/{-$locale}/$slug/c{$id}')({
  loader: ({ params, context }) => categoryListLoader({ params, context }),
  head: withHead({
    head: (_ctx, data: CategoryListLoaderData) => ({ title: data.page.title }),
  }),
  // Pending components stay in the eager route file by default; this one drags the
  // page's components in, so split it like the component.
  codeSplitGroupings: [['component'], ['pendingComponent']],
  pendingComponent: CategoryListSkeleton,
  component: CategoryListComponent,
});

function CategoryListComponent() {
  const data = Route.useLoaderData();
  return <CategoryListPage {...data} />;
}
