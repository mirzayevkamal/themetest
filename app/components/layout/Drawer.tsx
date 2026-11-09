import { useEffect, useEffectEvent, useRef, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';

const sheetEase = [0.32, 0.72, 0, 1] as const;

/**
 * 511px web-desktop side panel over a dimmed page (cart, order tracking).
 * Slides in from the inline-end: visual left in RTL. Escape and the backdrop
 * close it, MainLayout closes it on navigation and marks the page inert; the
 * child header labels it with `id="drawer-title"`. Focus moves into the panel
 * on open and back to the opener on close.
 */
export function Drawer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const { locale } = useTranslation();
  const reducedMotion = useReducedMotion();
  const sheetTransition = reducedMotion ? { duration: 0 } : { duration: 0.4, ease: sheetEase };
  const fadeTransition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.25, ease: 'easeOut' as const };
  const offscreen = locale === 'en' ? '100%' : '-100%';
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement;
    panelRef.current?.focus();
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
  });
  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.overflowY;
    html.style.overflowY = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      html.style.overflowY = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      className="fixed inset-0 z-60 flex justify-end overflow-hidden"
    >
      <motion.div
        className="absolute inset-0 bg-ink/80"
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={fadeTransition}
        onClick={onClose}
      />
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-drawer flex-col overflow-hidden bg-smoke outline-none"
        initial={{ x: offscreen }}
        animate={{ x: 0 }}
        exit={{ x: offscreen }}
        transition={sheetTransition}
        style={{ willChange: 'transform' }}
      >
        {children}
      </motion.div>
    </div>
  );
}
