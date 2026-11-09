import { lazy } from 'react';
import { createRouter } from '@salla.sa/twilight-theme-engine/tanstack';
import {
  registerHomeComponents,
  registerHomeComponentConfig,
  DefaultHomeComponents,
} from '@salla.sa/twilight-theme-engine/routes/home';
import { routeTree } from './routeTree.gen';
import { EnhancedSlider, getEnhancedSliderClassName } from './components/home/EnhancedSlider';
import { MainLinks, getMainLinksClassName } from './components/home/MainLinks';
import { PhotosSlider } from './components/home/PhotosSlider';
import { ProductsSlider } from './components/home/ProductsSlider';
import {
  PromotionalBanner,
  getPromotionalBannerClassName,
} from './components/home/PromotionalBanner';
import {
  BrandsPlaceholder,
  EnhancedSliderPlaceholder,
  EnhancedSquareBannersPlaceholder,
  MainLinksPlaceholder,
  ProductsSliderPlaceholder,
  PromotionalBannerPlaceholder,
  SliderProductsWithHeaderPlaceholder,
} from './components/home/placeholders';
import { registry } from '@salla.sa/twilight-theme-engine';
import { registerThemeHooks } from './hooks';
import { ProductCard } from './components/product/ProductCard';
import { ProductListPage } from './components/product/ProductListPage';
import { AccountPageSkeleton } from './components/account/AccountPageSkeleton';
import { installHomeComponentPreview } from '../preview-component-overrides/install';
import { installScrollRestoration } from './lib/scrollRestoration';

// TODO remove installHomeComponentPreview once theme is installed in the dashboard side
if (import.meta.env.DEV) {
  installHomeComponentPreview();
}

// Register theme-level hooks (AddProductToast, DigitalFilesSettings, etc.)
registerThemeHooks();

// The grocery card, on every page. Both calls per docs/05-component-system.md:
// override() alone on an unseeded key records no original, and the engine only
// honours an override when an original exists.
registry.register('product:card', ProductCard);
registry.override('product:card', ProductCard);

// Product-page only; keep it out of the entry chunk.
const ProductGallery = lazy(() =>
  import('./components/product/ProductGallery').then((m) => ({ default: m.ProductGallery }))
);
registry.register('product:gallery', ProductGallery);
registry.override('product:gallery', ProductGallery);

// The engine's account-layout placeholder is the desktop sidebar skeleton; ours is mobile.
registry.register('account:layout-pending', AccountPageSkeleton);

// Every engine product listing (products, brands, tags). Unseeded key: register is enough.
registry.register('product:list-page', ProductListPage);

registerHomeComponents({
  ...DefaultHomeComponents,
  'enhanced-slider': EnhancedSlider,
  'products-slider': ProductsSlider,
  brands: lazy(() => import('./components/home/Brands').then((m) => ({ default: m.Brands }))),
  'main-links': MainLinks,
  'photos-slider': PhotosSlider,
  'square-links': MainLinks,
  'slider-products-with-header': lazy(() =>
    import('./components/home/SliderProductsWithHeader').then((m) => ({
      default: m.SliderProductsWithHeader,
    }))
  ),
  'enhanced-square-banners': lazy(() =>
    import('./components/home/EnhancedSquareBanners').then((m) => ({
      default: m.EnhancedSquareBanners,
    }))
  ),
  'promotional-banner': PromotionalBanner,
  //TODO remove this , for fahdasweets
  'banners-slider': () => null,
  'circle-links': () => null,
  'dynamic-banner': () => null,
  special_product: () => null,
  'double-banner': () => null,
  'animated-brands': () => null,
});

// Placeholders reuse each block's real markup/classes so desktop CSS (slide
// sizes, 8-col main-links, 127px cards, full-bleed promo) applies while
// RenderWhenVisible waits. The engine fallback is a 400px products grid.
registerHomeComponentConfig({
  // my-4 around a 242/128 slide that is 5/12 viewport wide on mobile.
  // Web desktop beats this inline height in desktop.scss: highlight slides are
  // min(754px, the content column) at 754/320, otherwise the 364×256 box.
  'enhanced-slider': {
    height: 'min(22vw + 32px, 160px)',
    placeholder: <EnhancedSliderPlaceholder />,
    className: getEnhancedSliderClassName,
  },
  // 30px title + 12px + 4px + 80px logo row
  brands: { height: '126px', placeholder: <BrandsPlaceholder /> },
  // always h-banner (200px) — matches .banner-entry / the phone-width shell
  'enhanced-square-banners': {
    height: '200px',
    placeholder: <EnhancedSquareBannersPlaceholder />,
  },
  // Before mount only (home-blocks.scss and desktop.scss size it per width); the
  // skeleton then holds the real height.
  'products-slider': {
    height: 'min(91px + 31.5vw, 226px)',
    placeholder: <ProductsSliderPlaceholder />,
  },
  // Mobile one row ~176; desktop title 41 + 122px thumbs + 2-line labels ~213
  'main-links': {
    height: '176px',
    placeholder: <MainLinksPlaceholder />,
    className: getMainLinksClassName,
  },
  'square-links': { height: '176px', placeholder: <MainLinksPlaceholder /> },
  // Figma: 220px background with the cards pulled up 122px over it (311px) + pb-8.
  // Measured real height is 320px with fonts loaded — reserve that, not 343px.
  'slider-products-with-header': {
    height: '320px',
    placeholder: <SliderProductsWithHeaderPlaceholder />,
  },
  // Figma: 24px content with 8px vertical padding. The wrapper class owns the
  // optional visual merge because RenderWhenVisible renders the outer section.
  'promotional-banner': {
    height: '40px',
    placeholder: <PromotionalBannerPlaceholder />,
    className: getPromotionalBannerClassName,
  },
});

// Singleton for client-side (preserves QueryClient cache across navigations)
// SSR creates fresh instances per request via getRouter()
let clientRouter: ReturnType<typeof createRouter> | null = null;

// TanStack Start expects getRouter() for SSR compatibility
export function getRouter() {
  // On client: reuse existing router to preserve QueryClient cache
  if (typeof window !== 'undefined' && clientRouter) {
    return clientRouter;
  }

  // On SSR or first client load: create new router
  const router = createRouter(routeTree, {
    defaultPendingMs: 100,
    defaultPendingMinMs: 200,
  });

  installScrollRestoration(router);

  // Cache for client-side
  if (typeof window !== 'undefined') {
    clientRouter = router;
  }

  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
