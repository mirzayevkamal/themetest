import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import {
  HomeComponentRenderer,
  registerHomeComponentConfig,
} from '@salla.sa/twilight-theme-engine/components/home';
import { registry } from '@salla.sa/twilight-theme-engine';
import type { HomeComponentData } from '@salla.sa/twilight-theme-engine';
import { getPromotionalBannerClassName } from '../../../app/components/home/PromotionalBanner';

// The engine's renderer imports its block skeletons from here; the global setup mock has none.
vi.mock('@salla.sa/twilight-components-react', () => {
  const Skeleton = () => null;
  return {
    BackgroundSliderSkeleton: Skeleton,
    BulletDeliverySkeleton: Skeleton,
    FixedProductsSkeleton: Skeleton,
    ListSkeleton: Skeleton,
    ProductsSliderSkeleton: Skeleton,
    Pulse: Skeleton,
    ReviewItemSkeleton: Skeleton,
    SliderSkeleton: Skeleton,
  };
});

// The dashboard's "show on desktop / mobile" pick arrives as channel_visibility on
// every block. The engine turns it into a hide class on the wrapper; this guards
// that grocery's className overrides (router.tsx) keep that class alongside theirs.
describe('home block channel visibility', () => {
  beforeEach(() => {
    // jsdom has no IntersectionObserver; the lazy wrapper observes the block.
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        disconnect() {}
      }
    );
  });

  afterEach(() => {
    // Unmount first: the lazy wrapper can land after the test and would observe
    // with the stub already gone (setup's cleanup runs after this hook).
    cleanup();
    registry.clear();
    vi.unstubAllGlobals();
  });

  // The built engine loads the lazy wrapper through a dynamic import, so the section lands a tick later.
  const renderBanner = (data: Partial<HomeComponentData>) => {
    registry.register('home:promotional-banner', () => <p />);
    registerHomeComponentConfig({
      'promotional-banner': { className: getPromotionalBannerClassName },
    });
    const { container } = render(
      <HomeComponentRenderer
        index={9}
        priority={false}
        data={{ path: 'promotional-banner', ...data } as HomeComponentData}
      />
    );
    return () => container.querySelector('section')?.className;
  };

  it('keeps the grocery classes and hides a mobile-only banner on desktop', async () => {
    const sectionClass = renderBanner({
      merge_with_top_component: true,
      channel_visibility: { desktop: false, mobile: true },
    });
    await waitFor(() =>
      expect(sectionClass()).toBe(
        's-block s-block--promotional-banner merge-with-top-component s-hide-on-desktop'
      )
    );
    expect(
      document.head.querySelector('style[data-href="twilight-channel-visibility"]')?.textContent
    ).toContain('@media (min-width:768px){.s-hide-on-desktop{display:none!important}}');
  });

  it('hides a desktop-only banner on mobile', async () => {
    const sectionClass = renderBanner({ channel_visibility: { desktop: true, mobile: false } });
    await waitFor(() =>
      expect(sectionClass()).toBe('s-block s-block--promotional-banner s-hide-on-mobile')
    );
  });

  it('shows the banner everywhere when the store sends no pick', async () => {
    const sectionClass = renderBanner({});
    await waitFor(() => expect(sectionClass()).toBe('s-block s-block--promotional-banner'));
  });
});
