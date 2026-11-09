import React, { lazy, Suspense } from 'react';
import { preconnect } from 'react-dom';
import { Scripts, Outlet } from '@tanstack/react-router';
import { TwilightProvider } from '@salla.sa/twilight-theme-engine';
import {
  createTwilightRootRoute,
  getTwilightContext,
  ThemeStylesheet,
} from '@salla.sa/twilight-theme-engine/tanstack';
import themeTranslations from 'virtual:twilight/theme-translations';
import devSchema from 'virtual:twilight/schema';
import { MainLayout } from '../components/layout/MainLayout';
import { ThemeHeadContent } from '../components/layout/ThemeHeadContent';
import { useMobileUiUpdate } from '../hooks/useMobileUiUpdate';
import { HOME_ROUTE_ID } from '../hooks/useMatchedRoute';
import appCssUrl from '../styles/app.css?url';
import homeCriticalCss from '../styles/critical.scss?inline';

// Dev-only: reads the theme's local twilight.json (settings + components),
// fills defaults, and lets you edit them live. Imported from the engine's `/dev`
// subpath under an import.meta.env.DEV gate so it is tree-shaken from prod builds.
const DevSettingsWidget = import.meta.env.DEV
  ? lazy(() =>
      import('@salla.sa/twilight-theme-engine/dev').then((m) => ({ default: m.DevSettingsWidget }))
    )
  : null;

const TanStackRouterDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-router-devtools').then((m) => ({
        default: m.TanStackRouterDevtools,
      }))
    )
  : null;

// Server-only strings: the client bundle skips them; hydration adopts the inlined <style> by its href.
const CRITICAL_CSS = {
  [HOME_ROUTE_ID]: import.meta.env.SSR ? homeCriticalCss : '',
};

export const Route = createTwilightRootRoute()({
  shellComponent: RootComponent,
});

function RootComponent() {
  const ctx = getTwilightContext();
  // The native Bullet Delivery refresh. The app's own webview events are the engine's.
  useMobileUiUpdate();

  preconnect('https://cdn.files.salla.network');

  return (
    <html lang={ctx.locale} dir={ctx.dir} suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* The Twilight SDK inserts its component CSS before the first stylesheet <link>.
            This empty one keeps that above the inline critical sheet, as app.css used to be,
            so the theme's overrides still win before app.css arrives. */}
        <link rel="stylesheet" href="data:text/css," precedence="twilight-sdk" />
        {/* Home paints from inline critical CSS; `bootClient` adds the full sheet once its first
            screen has painted. Other routes: the full sheet blocks, as before. (Product measured
            worse with its own critical sheet on PR 66: larger HTML, later hydration.) */}
        <ThemeStylesheet href={appCssUrl} critical={CRITICAL_CSS} />
        <ThemeHeadContent />
      </head>
      <body suppressHydrationWarning>
        <noscript>
          To get full functionality of this site you need to enable JavaScript.
          <a href="https://www.enable-javascript.com/" rel="noreferrer" target="_blank">
            To enable JavaScript on webpage
          </a>
          .
        </noscript>
        <TwilightProvider translations={themeTranslations} layout={MainLayout}>
          <Outlet />
        </TwilightProvider>
        {TanStackRouterDevtools ? (
          <Suspense fallback={null}>
            <TanStackRouterDevtools position="bottom-right" />
          </Suspense>
        ) : null}
        {DevSettingsWidget && (
          <Suspense fallback={null}>
            <DevSettingsWidget schema={devSchema} />
          </Suspense>
        )}
        <Scripts />
      </body>
    </html>
  );
}
