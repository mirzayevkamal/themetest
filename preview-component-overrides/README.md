# Local component preview

This directory provides a development-only way to render a new homepage component before the
component has been added to a store through Salla's theme editor.

## Setup

1. Copy `preview-component-overrides/install.ts` and `tests/preview-component-overrides/install.test.ts`
   into your theme at the same paths.
2. Create `preview-component-overrides/home-components.json` containing `[]`.
3. In `app/router.tsx`, at module scope, install the adapter in development:

   ```tsx
   import { installHomeComponentPreview } from '../preview-component-overrides/install';

   if (import.meta.env.DEV) {
     installHomeComponentPreview();
   }
   ```

4. In the same file, register your home components over the engine defaults:

   ```tsx
   import {
     registerHomeComponents,
     registerHomeComponentConfig,
     DefaultHomeComponents,
   } from '@salla.sa/twilight-theme-engine/routes/home';
   import { MyComponent } from './components/home';

   registerHomeComponents({
     ...DefaultHomeComponents,
     'my-component': MyComponent,
   });

   registerHomeComponentConfig({
     'my-component': {
       height: '160px',
       placeholder: <div className="h-40 animate-pulse bg-gray-100" />,
     },
   });
   ```

5. Declare the component in `twilight.json` under `components` with `"path": "home.my-component"`.
6. Add a fixture to `home-components.json`:

   ```json
   { "__at": 0, "path": "home.my-component", "key": "dev-my-component", "title": "Preview" }
   ```

7. Run `pnpm test` and `pnpm dev`. The block renders on the homepage without being placed in the
   editor.

Each step is explained below.

## Supported scope

| Requirement                                                      | What to use                                                      |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| Merchant-arranged homepage block                                 | Follow this README                                               |
| Fixed UI added to an existing product/cart/search location       | Use a Twilight hook slot                                         |
| A global option used on several pages                            | Add it to `twilight.json.settings` and read it with `useTheme()` |
| Merchant-arranged product, category, or informational-page block | Not supported by the current React engine                        |

`twilight.json.components` is the homepage component palette. A component's `path` identifies its
homepage implementation; it does not select which storefront page should render the component.
Do not invent paths such as `product.my-component` or `category.my-component`.

## How the homepage preview works

The Twilight home loader requests:

```text
GET https://api.salla.dev/store/v1/component/list
```

Salla returns only the components that the merchant has placed on the homepage. Declaring a new
component in `twilight.json` makes it available to the editor, but does not add it to this response.

In development, `install.ts` wraps `globalThis.fetch`, lets the real request complete, and inserts
the fixtures from `home-components.json` into a successful JSON response. It rewrites only GET
requests whose pathname is `/store/v1/component/list`.

Install the adapter from `app/router.tsx` behind `import.meta.env.DEV` so production builds use
the original response. This repo currently calls it unconditionally (see the TODO in
`app/router.tsx`) until the theme is installed in the dashboard; remove that once it is.

## Files

- `home-components.json` contains the local homepage blocks and their preview data.
- `install.ts` intercepts the homepage component-list response in development.
- `tests/preview-component-overrides/install.test.ts` protects endpoint matching and response
  injection.

## Add a new homepage component

Use one slug consistently in all four integration points below. The example slug is
`my-component`.

### 1. Create and export the React component

Create `app/components/home/MyComponent.tsx`. It must accept the data returned by the component
list under a `data` prop:

```tsx
export interface MyComponentData {
  title?: string;
  position?: number;
}

export function MyComponent({ data }: { data: MyComponentData }) {
  if (!data.title) return null;
  return <section>{data.title}</section>;
}
```

Export it from `app/components/home/index.ts`.

### 2. Declare the editor fields in `twilight.json`

Add an entry to the top-level `components` array:

```json
{
  "key": "use-a-stable-unique-key",
  "title": {
    "ar": "اسم العنصر",
    "en": "My component"
  },
  "icon": "sicon-layout-grid",
  "path": "home.my-component",
  "is_default": false,
  "fields": [
    {
      "id": "title",
      "type": "string",
      "format": "text",
      "label": "العنوان",
      "multilanguage": true,
      "required": false
    }
  ]
}
```

The manifest controls what the merchant can edit. It does not render the component by itself.

### 3. Register the React implementation

Import the component in `app/router.tsx` and add it to `registerHomeComponents()` using the slug
without the `home.` prefix:

```tsx
registerHomeComponents({
  ...DefaultHomeComponents,
  'my-component': MyComponent,
});
```

The binding is:

```text
twilight.json path       registerHomeComponents key     runtime registry key
home.my-component   ->   my-component               ->  home:my-component
```

Both the manifest declaration and the registration are required.

### 4. Reserve the correct lazy-render height when needed

The home renderer mounts blocks through `RenderWhenVisible`. If the default 400 px product
skeleton is the wrong shape, add a matching entry to `registerHomeComponentConfig()`:

```tsx
registerHomeComponentConfig({
  'my-component': {
    height: '160px',
    placeholder: <div className="h-40 animate-pulse bg-gray-100" />,
  },
});
```

Use the component's expected rendered height to avoid layout shift.

### 5. Add the local fixture

Add an object to `preview-component-overrides/home-components.json`:

```json
{
  "__at": 0,
  "path": "home.my-component",
  "key": "dev-my-component",
  "title": "Local preview title"
}
```

Fixture rules:

1. Keep the full `home.my-component` path. The engine removes `home.` after loading the response.
2. Use a stable, unique `key` so React can preserve the block between renders.
3. Put component field values at the top level of the fixture. The renderer passes the complete
   object as the component's `data` prop.
4. Match collection fields with their real nested API shape. Editing `twilight.json` defaults does
   not automatically update the fixture.
5. `__at` is local metadata selecting the zero-based insertion index. It is removed before the
   response reaches the theme. Omit it to append the component.

The Theme Dev widget can override supported scalar fields such as text, colors, and booleans.
Edit collection values directly in `home-components.json`.

### 6. Confirm the adapter is installed once

`app/router.tsx` must contain this module-scope installation:

```tsx
import { installHomeComponentPreview } from '../preview-component-overrides/install';

if (import.meta.env.DEV) {
  installHomeComponentPreview();
}
```

Do not install it inside a React component or route loader. The installer is HMR-safe and updates
the fixture reference when the module reloads.
