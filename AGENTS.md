# Repository Guidelines

## Project Structure & Module Organization

Treat `app/routeTree.gen.ts` as generated; change route files instead.

## Documentation Reference

Start at `docs/README.md` before implementing or reviewing a feature. It indexes guidance for architecture, routes, components, hooks, types, styling, configuration, i18n, APIs, and performance. Follow the linked topic instead of guessing framework behavior. This gitignored folder is a local reference; if it conflicts with source, manifests, or configuration, verify the code and call out the mismatch.

## Build, Test, and Development Commands

Use pnpm 10 and Node.js 22, matching CI.

Before opening a PR, run `pnpm build`, `pnpm typecheck`, and `pnpm test`.

## Coding Style & Naming Conventions

Follow `.prettierrc`: two-space indentation, semicolons, single quotes, trailing ES5 commas, and a 100-character line width. Use strict TypeScript, function components, PascalCase component filenames (`ProductCard.tsx`), and camelCase hooks/functions. Follow existing TanStack file-route naming. Reuse Twilight components and i18n helpers; keep Arabic and English translations synchronized. Never edit generated files or commit debug logging or secrets.

Prefer the established Tailwind scale, project design tokens, and nearby component patterns over arbitrary values. Before replacing a bracketed value, verify the token definition and the rendered component layout, including secondary properties such as line-height and exact color or shadow values. Do not add `leading-[inherit]` or another compensating arbitrary line-height solely to reproduce the global body line-height when dimensions and visual alignment remain correct; add explicit leading only when the design specification or a measured layout regression requires it. Keep a Figma- or design-specific arbitrary value when no exact token exists, and never substitute a merely similar token or mechanically rewrite unrelated occurrences.

When translating Figma designs, resolve every color through the named tokens in `tailwind.config.js` (`theme.extend.colors`: `ink`, `smoke`, `hairline`, `discount`, `tomato`, `mint*`, `silver*`, plus default-scale matches such as `#F5F5F5` = `neutral-100`). Use the token whose hex value is exactly equal to the Figma value; if no token matches, keep the arbitrary value (for example `text-[#0EA5E9]`) rather than inventing a new name — propose adding it to the config instead in that case.

Use the runtime `brand*` tokens for merchant-brand accents; reserve fixed Figma color tokens such as `mint*` for colors that must not change with the merchant's primary color.

### Effects and `useEffectEvent`

React is 19.2+, so `useEffectEvent` is available. Use it whenever an effect needs the latest props or state but should not re-run when they change: an event listener, interval, or observer that reads `onClose`, `isPaused`, `quantity`, and similar. Put only the values that should tear down and re-subscribe in the deps array (the event name, a ref, a route id); wrap the rest in an effect event. Do not hand-roll the same thing with a "latest" `useRef` synced by an extra effect, do not write refs during render, do not add `useCallback` only to keep a deps array stable, and do not add `eslint-disable react-hooks/exhaustive-deps`. Effect events may only be called from inside effects; never pass one as a prop, call it during render or from a click handler, or list it in deps. Reference implementations: `app/hooks/sdk.ts` (`useSallaEvent`), `app/components/cart/AddProductToast.tsx` (interval tick), `app/components/layout/Drawer.tsx` (Escape listener), `app/components/product/AddToCartStepper.tsx` (form change listener). Docs: https://react.dev/reference/react/useEffectEvent and https://react.dev/learn/separating-events-from-effects.

## Review Rules (Greptile)

Greptile reviews every PR against a knowledge base kept outside this repo, and the check only passes at 5/5. These are the rules it has enforced; follow them up front instead of after the review.

- Do not add barrel files or new barrel exports under `app/components`; import new modules directly (`../icons/TaskIcon`, `../layout/Drawer`). Barrel imports that already exist stay as they are, and the Twilight build lint's deep-import notes for `layout/` and `product/` are warnings only.
- Never change or delete an existing value in `locales/*.json`; stores may have customized it. Add a new key when the copy is new, and keep an existing key on the element it already labels so store overrides keep applying.
- Do not add arbitrary positioning or sizing utilities (`left-[29px]`, `w-[365px]`). Use the Tailwind scale, an existing token, or put the desktop-only value in the matching SCSS block.
- Do not repeat an API call for data a route loader already returned; pass it down. UI that is only hidden by CSS must not fetch while hidden.
- An empty or filtered state must say what is true (filtered results do not mean "no orders yet") and keep an in-page action, since the mobile back bar is the only other way out.
- Every behavioural change ships with a Vitest case in the same PR.

## Testing Guidelines

Tests use Vitest, jsdom, and Testing Library. Name files `*.test.ts` or `*.test.tsx` inside `tests/`, matching the production path. Prefer user-visible behavior and accessibility queries. Add regression coverage for changed behavior; no numeric threshold is configured.

## Commit & Pull Request Guidelines

History follows Conventional Commits such as `feat:`, `fix:`, `test:`, `ci:`, and `chore:`; ticket scopes are accepted (for example, `ci(QCD-11): ...`). Use branches such as `feature/QCD-11-short-description`. PRs should explain impact, link the ticket, list validation, and include RTL/LTR screenshots for visual changes. Keep diffs focused; title and branch checks, React Doctor, build, typecheck, tests, and CODEOWNERS review run in GitHub.

## Configuration & Security

Keep store values in local `.env` variables such as `VITE_STORE_DOMAIN`; never commit credentials. `VITE_*` values are browser-visible. Salla handles deployment, so do not add deployment secrets or server configuration.
