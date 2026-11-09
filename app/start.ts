import { createMiddleware, createStart } from '@tanstack/react-start';
import { twilightMiddleware, earlyHintsMiddleware } from '@salla.sa/twilight-theme-engine/tanstack';
import { withEarlyHomeComponents } from './lib/earlyHomeComponents';

// After twilightMiddleware: it needs the store, scope and version that one resolves.
const earlyHomeComponentsMiddleware = createMiddleware().server(({ request, next }) =>
  withEarlyHomeComponents(request, () => next())
);

export const startInstance = createStart(() => {
  return {
    requestMiddleware: [twilightMiddleware(), earlyHomeComponentsMiddleware, earlyHintsMiddleware()],
  };
});
