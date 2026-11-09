import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';

const SLOP = 10; // px of vertical movement before the gesture engages
const DAMPING = 0.4;
const MAX_PULL = 80; // damped px, indicator travel cap
const TRIGGER = 60; // damped px needed on release to refresh

// Native browser PTR never fires: #main-content is an inner scroller with
// `overscroll-behavior-y: none` (app.css), so a downward pan at scrollTop 0 is
// a dead gesture for the browser — passive listeners are enough.
export function PullToRefresh({
  scrollRef,
  children,
}: {
  scrollRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const reducedMotion = useReducedMotion();

  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const engagedRef = useRef(false);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    // ponytail: nested vertical scrollers (dialogs live outside #main-content)
    // are only guarded by this walk-up; add a data-attr opt-out if a page needs it.
    function hasScrolledAncestor(target: EventTarget | null): boolean {
      let el = target instanceof Element ? target : null;
      while (el && el !== container) {
        if (el.scrollTop > 0) return true;
        el = el.parentElement;
      }
      return false;
    }

    function setPullBoth(value: number) {
      pullRef.current = value;
      setPull(value);
    }

    function onTouchStart(event: TouchEvent) {
      if (refreshingRef.current || container!.scrollTop > 0) return;
      const touch = event.touches[0];
      startRef.current = { x: touch.clientX, y: touch.clientY };
      engagedRef.current = false;
    }

    function onTouchMove(event: TouchEvent) {
      const start = startRef.current;
      if (!start || refreshingRef.current) return;

      const touch = event.touches[0];
      const deltaY = touch.clientY - start.y;
      const deltaX = touch.clientX - start.x;

      if (!engagedRef.current) {
        if (deltaY < SLOP || Math.abs(deltaX) >= deltaY) {
          // horizontal or upward intent — hand over to swipe-back / scrolling
          if (Math.abs(deltaX) > SLOP || deltaY < -SLOP) startRef.current = null;
          return;
        }
        if (container!.scrollTop > 0 || hasScrolledAncestor(event.target)) {
          startRef.current = null;
          return;
        }
        engagedRef.current = true;
      }

      if (container!.scrollTop > 0) {
        engagedRef.current = false;
        startRef.current = null;
        setPullBoth(0);
        return;
      }

      setPullBoth(Math.min(Math.max(deltaY - SLOP, 0) * DAMPING, MAX_PULL));
    }

    async function onTouchEnd() {
      const triggered = engagedRef.current && pullRef.current >= TRIGGER;
      startRef.current = null;
      engagedRef.current = false;

      if (!triggered) {
        setPullBoth(0);
        return;
      }

      refreshingRef.current = true;
      setRefreshing(true);
      try {
        await Promise.allSettled([
          router.invalidate(), // re-runs route loaders (ensureQueryData)
          queryClient.refetchQueries({ type: 'active' }),
        ]);
      } finally {
        refreshingRef.current = false;
        setRefreshing(false);
        setPullBoth(0);
      }
    }

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [router, queryClient, scrollRef]);

  const visible = pull > 0 || refreshing;
  const offset = refreshing ? TRIGGER : pull;

  return (
    // h-full keeps the height chain from #main-content intact so pages using
    // min-h-full (cart, empty states) still fill the scroll area.
    <div className="relative h-full">
      {visible && (
        <motion.div
          // z-30: sticky page titles pin at z-20 (page-title-sticky mixin) — the indicator must float above them
          className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center"
          initial={false}
          animate={{ y: offset - 40, opacity: Math.min(offset / TRIGGER, 1) }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { type: 'tween', duration: refreshing || pull === 0 ? 0.2 : 0 }
          }
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md">
            <svg
              className={refreshing ? 'animate-spin' : ''}
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              style={refreshing ? undefined : { transform: `rotate(${offset * 3}deg)` }}
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="42"
                strokeDashoffset="14"
                className="text-primary"
              />
            </svg>
          </span>
        </motion.div>
      )}
      {children}
    </div>
  );
}
