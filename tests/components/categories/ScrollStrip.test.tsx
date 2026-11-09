import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScrollStrip } from '../../../app/components/categories/ScrollStrip';

vi.mock('@salla.sa/twilight-theme-engine/i18n', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

function renderStrip({ scrollWidth, clientWidth }: { scrollWidth: number; clientWidth: number }) {
  render(
    <ScrollStrip className="bg-white">
      <div>tabs</div>
    </ScrollStrip>
  );
  const strip = screen.getByText('tabs').parentElement as HTMLDivElement;
  Object.defineProperty(strip, 'scrollWidth', { configurable: true, value: scrollWidth });
  Object.defineProperty(strip, 'clientWidth', { configurable: true, value: clientWidth });
  strip.scrollBy = vi.fn();
  act(() => {
    fireEvent.scroll(strip);
  });
  return strip;
}

describe('ScrollStrip', () => {
  // The strip measures its edges in the next frame; run frames on demand.
  let frames: FrameRequestCallback[] = [];
  const runFrames = () =>
    act(() => {
      const pending = frames;
      frames = [];
      pending.forEach((cb) => cb(0));
    });
  beforeEach(() => {
    frames = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb));
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      frames[id - 1] = () => {};
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('locks both arrows when the content already fits', () => {
    renderStrip({ scrollWidth: 300, clientWidth: 300 });
    runFrames();
    const prev = screen.getByRole('button', { name: 'Previous' });
    const next = screen.getByRole('button', { name: 'Next' });
    expect(prev.className).toContain('swiper-button-lock');
    expect(next.className).toContain('swiper-button-lock');
  });

  it('disables only the start arrow at the start and scrolls toward the end', () => {
    const strip = renderStrip({ scrollWidth: 900, clientWidth: 300 });
    runFrames();
    const prev = screen.getByRole('button', { name: 'Previous' });
    const next = screen.getByRole('button', { name: 'Next' });
    expect((prev as HTMLButtonElement).disabled).toBe(true);
    expect((next as HTMLButtonElement).disabled).toBe(false);
    expect(next.className).not.toContain('swiper-button-lock');

    fireEvent.click(next);
    expect(strip.scrollBy).toHaveBeenCalledWith({ left: 240, behavior: 'smooth' });
  });

  it('disables the end arrow once scrolled to the end', () => {
    const strip = renderStrip({ scrollWidth: 900, clientWidth: 300 });
    runFrames();
    strip.scrollLeft = 600;
    act(() => {
      fireEvent.scroll(strip);
    });
    runFrames();
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(
      false
    );
  });

  it('measures its edges once per frame, however many scroll events it gets', () => {
    const strip = renderStrip({ scrollWidth: 900, clientWidth: 300 });
    runFrames();
    let reads = 0;
    Object.defineProperty(strip, 'scrollWidth', {
      configurable: true,
      get: () => {
        reads += 1;
        return 900;
      },
    });

    act(() => {
      for (let i = 0; i < 5; i++) fireEvent.scroll(strip);
    });
    expect(reads).toBe(0);
    runFrames();
    expect(reads).toBe(1);
  });
});
