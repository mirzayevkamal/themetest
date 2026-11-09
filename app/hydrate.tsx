import { StrictMode, startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { StartClient } from '@tanstack/react-start/client';
import { removeEdgeInjections } from '@salla.sa/twilight-theme-engine/dom';
import { initThemeSentry } from '@salla.sa/twilight-theme-engine/sentry/client';

// No-op unless the build has a VITE_SENTRY_DSN; events are tagged theme:grocery.
initThemeSentry('grocery');

export function hydrate(): void {
  // The edge's injected head tags (Cloudflare's WebMCP bridge): left in, they shift
  // React's head hydration (error #418 on the PDP).
  removeEdgeInjections();

  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>
    );
  });
}
