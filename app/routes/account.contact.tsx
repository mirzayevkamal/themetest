import { createFileRoute } from '@tanstack/react-router';
import { ContactPage } from '../components/account/ContactPage';

export const Route = createFileRoute('/{-$locale}/account/contact')({
  component: ContactPage,
});
