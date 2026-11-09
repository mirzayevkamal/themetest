import React, { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { PhotosSlider } from '../../../app/components/home/PhotosSlider';

vi.mock('@salla.sa/twilight-theme-engine/common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@salla.sa/twilight-theme-engine/common')>()),
  Link: ({ to, children }: { to: string; children?: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

const items = [
  { image: 'https://cdn.files.salla.network/homepage/1/first.webp', url: '/offers' },
  { image: 'https://cdn.files.salla.network/homepage/1/second.webp', url: '/new' },
];

describe('PhotosSlider', () => {
  it('server-renders the first banner as an eager, high-priority image', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<PhotosSlider data={{ items, priority: true }} />);

    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(1);
    expect(images[0].getAttribute('src')).toContain('first.webp');
    expect(images[0].getAttribute('loading')).toBe('eager');
    expect(images[0].getAttribute('fetchpriority')).toBe('high');
    expect(container.querySelector('salla-slider')).toBeNull();
    expect(container.querySelector('.s-skeleton-slider')).toBeNull();
  });

  it('requests width-only CDN sizes so the banner is not capped at 300px tall', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<PhotosSlider data={{ items, priority: true }} />);
    const img = container.querySelector('img')!;

    expect(img.getAttribute('srcset')).toContain('width=1920');
    expect(`${img.getAttribute('src')} ${img.getAttribute('srcset')}`).not.toContain('height=');
  });

  it('keeps later blocks lazy', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(<PhotosSlider data={{ items, priority: false }} />);

    expect(container.querySelector('img')?.getAttribute('loading')).toBe('lazy');
  });

  it('hands every banner to the slider after hydration, with pagination only for several', () => {
    const { container, rerender } = render(<PhotosSlider data={{ items, position: 2 }} />);
    const slider = container.querySelector('salla-slider')!;

    expect(slider.id).toBe('photos-2-slider');
    expect(slider.querySelectorAll('img')).toHaveLength(2);
    expect(slider.querySelector('a')?.getAttribute('href')).toBe('/offers');
    expect(slider.hasAttribute('pagination')).toBe(true);

    rerender(<PhotosSlider data={{ items: [items[0]], position: 2 }} />);
    expect(container.querySelector('salla-slider')?.hasAttribute('pagination')).toBe(false);
  });

  it('keeps the server-rendered banner in place until salla-slider upgrades', async () => {
    const original = customElements.get.bind(customElements);
    const get = vi.spyOn(customElements, 'get').mockImplementation((name) => {
      if (name === 'salla-slider') return HTMLElement as unknown as CustomElementConstructor;
      return original(name);
    });
    const container = document.createElement('div');
    container.innerHTML = renderToString(<PhotosSlider data={{ items, priority: true }} />);
    document.body.append(container);
    const serverImage = container.querySelector('.photos-slider--static img');
    let root: ReturnType<typeof hydrateRoot> | undefined;

    try {
      await act(async () => {
        root = hydrateRoot(container, <PhotosSlider data={{ items, priority: true }} />);
      });
      const slider = container.querySelector('salla-slider');

      // Same node as the server's, so the banner is never re-created or blanked.
      expect(container.querySelector('.photos-slider--static img')).toBe(serverImage);
      expect(slider?.getAttribute('aria-hidden')).toBe('true');

      await act(async () => {
        slider?.classList.add('hydrated');
      });

      await waitFor(() => {
        expect(container.querySelector('.photos-slider--static')).toBeNull();
      });
      expect(container.querySelector('salla-slider')?.getAttribute('aria-hidden')).toBeNull();
      expect(container.querySelector('salla-slider img')?.getAttribute('src')).toBe(
        serverImage?.getAttribute('src')
      );
    } finally {
      act(() => root?.unmount());
      container.remove();
      get.mockRestore();
    }
  });

  it('renders nothing without an image', () => {
    const { container } = render(<PhotosSlider data={{ items: [{ url: '/x' }] }} />);
    expect(container.firstChild).toBeNull();
  });
});
