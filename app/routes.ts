/**
 * Custom routes file — extend or override built-in engine routes.
 *
 * The `twilightReact()` plugin auto-discovers this file at build time.
 * Routes defined here are merged with the engine's defaults:
 *   - New paths are added alongside the built-in routes.
 *   - Matching paths override the built-in route for that path.
 *
 * After adding a route here, create the corresponding file in `app/routes/`.
 * Do NOT prefix your custom route file with `// @auto-generated` or the
 * engine will overwrite it on the next build.
 *
 * Note: `/account` itself is the engine's layout route; overriding it drops
 * every account child, so only add children under `/account/...`.
 */
import { route } from '@tanstack/virtual-file-routes';

export const routes = [
  route('/account/pages', 'account.pages.tsx'),
  route('/account/contact', 'account.contact.tsx'),
];
