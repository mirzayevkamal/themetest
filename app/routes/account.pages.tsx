import { createFileRoute } from '@tanstack/react-router';
import { PagesPage } from '../components/account/PagesPage';

export const Route = createFileRoute('/{-$locale}/account/pages')({
  component: PagesPage,
});
