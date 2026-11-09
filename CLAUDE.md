# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Architecture

This is a Salla storefront theme: TanStack Start + Vite, SSR in workerd via `@salla.sa/twilight-theme-engine`. The engine, not this repo, owns the base routes, data loaders, and default components — the theme customizes by **registration and override**, mostly wired in `app/router.tsx`:

- `registry.register('product:card', ProductCard)` + `registry.override(...)` swaps the product card everywhere (both calls are required — see the comment there and `docs/05-component-system.md`).
- `registerHomeComponents({...DefaultHomeComponents, ...})` maps home-page component keys (from the store's page builder / `twilight.json`) to React components in `app/components/home/`.
- `registerThemeHooks()` (`app/hooks/index.tsx`) injects components into engine hook slots (`HookName.BODY_END`, `HookName.PRODUCT_DESCRIPTION`, …) via `hookRegistry.register`. It must be called exactly once — router.tsx does it; don't re-add the module-load call.
- `getRouter()` returns a per-request router on SSR but a client-side singleton, to preserve the QueryClient cache across navigations.

Routing is virtual-file based: the engine supplies default routes, `app/routes.ts` adds or overrides paths (matching path = override, e.g. replacing the engine's `/cart`), and each declared path needs a file in `app/routes/`. `app/routeTree.gen.ts` is generated from all this.

Run-time data comes from the store configured by `VITE_STORE_DOMAIN` in `.env` (written by `salla theme dev`). Theme settings live in `twilight.json` and are read at runtime via `twilight.theme.settings`; in dev, `__root.tsx` mounts a `DevSettingsWidget` to edit them live. `__root.tsx` also contains localhost-only base-path handling — everything gated on `import.meta.env.DEV`/localhost is tree-shaken or inert in production.
