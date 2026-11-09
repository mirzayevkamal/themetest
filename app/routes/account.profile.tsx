// Account hub (Figma "حسابي"). No `@auto-generated` marker: the engine must not overwrite this.
// No loader: the engine's Profile.loader 401s for guests, and the hub renders for them too.
import { createFileRoute } from '@tanstack/react-router';
import { AccountPage } from '../components/account/AccountPage';

export const Route = createFileRoute('/{-$locale}/account/profile')({
  component: AccountPage,
});
