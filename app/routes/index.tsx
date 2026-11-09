import { createFileRoute } from '@tanstack/react-router';
import { Home } from '@salla.sa/twilight-theme-engine/routes/home';
import type { HomeLoaderData } from '@salla.sa/twilight-theme-engine/routes/home';
import { HomeSkeleton } from '../components/home/placeholders';
import { getTwilightContext, withHead } from '@salla.sa/twilight-theme-engine/tanstack';
import { home } from '@salla.sa/twilight-theme-engine/api/home';
import { earlyHomeComponents } from '../lib/earlyHomeComponents';

/**
 * Home (index) route configuration.
 * Loads page data via loader and renders the Home component.
 */
/** The engine's home loader, seeded with the layout the request middleware already fetched. */
export async function homeLoader({ params }: { params: { locale?: string } }): Promise<HomeLoaderData> {
  const components = await earlyHomeComponents();
  if (components) {
    getTwilightContext().queryClient.setQueryData(home.queries.components().queryKey, components);
  }
  return Home.loader({ locale: params.locale });
}

export const Route = createFileRoute('/{-$locale}/')({
  loader: homeLoader,
  head: withHead(Home),
  pendingComponent: () => <HomeSkeleton />,
  component: HomeComponent,
});

/**
 * Home page component.
 * Uses Route.useLoaderData() to access the data loaded by the route loader,
 * following React best practices for data fetching in route components.
 */
function HomeComponent() {
  const data: HomeLoaderData = Route.useLoaderData();
  return <Home.Component {...data} />;
}
