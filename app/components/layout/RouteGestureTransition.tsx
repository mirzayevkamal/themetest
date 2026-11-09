import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useRouter, useRouterState } from '@tanstack/react-router';
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
  type PanInfo,
} from 'motion/react';
import { useTwilight } from '@salla.sa/twilight-theme-engine';

type SwipeIntent = 'edge-back' | 'full';
type SwipeAction = 'back' | 'forward';

interface SwipeActionInput {
  offsetX: number;
  velocityX: number;
  dir: 'ltr' | 'rtl';
  intent: SwipeIntent;
}

interface PendingSwipe {
  pointerId: number;
  x: number;
  y: number;
  intent: SwipeIntent;
}

const EDGE_WIDTH = 32;
const SWIPE_DIRECTION_THRESHOLD = 10;
const SWIPE_DISTANCE = 96;
const SWIPE_VELOCITY = 700;
const BLOCKED_SWIPE_SELECTOR = [
  'input',
  'textarea',
  'select',
  'button',
  '[contenteditable="true"]',
  '[role="dialog"]',
  '[data-route-swipe="ignore"]',
  '.swiper',
  '.swiper-wrapper',
  '.swiper-slide',
  'salla-slider',
].join(',');

const variants = {
  enter: (direction: 1 | -1) => ({
    opacity: 0,
    x: direction * 28,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (direction: 1 | -1) => ({
    opacity: 0,
    x: direction * -28,
  }),
};

const transition = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1],
} as const;

export function isRouteSwipeBlocked(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  if (target.closest(BLOCKED_SWIPE_SELECTOR)) return true;

  let current: Element | null = target;
  while (current && current !== document.body) {
    const overflowX = window.getComputedStyle(current).overflowX;
    const canScrollX = overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'overlay';
    if (canScrollX && current.scrollWidth > current.clientWidth + 8) return true;
    current = current.parentElement;
  }

  return false;
}

export function getSwipeIntent(
  target: EventTarget | null,
  pointerX: number,
  viewportWidth: number,
  dir: 'ltr' | 'rtl'
): SwipeIntent | null {
  if (isRouteSwipeBlocked(target)) return null;
  const isBackEdge =
    dir === 'rtl' ? pointerX >= viewportWidth - EDGE_WIDTH : pointerX <= EDGE_WIDTH;
  return isBackEdge ? 'edge-back' : 'full';
}

export function getSwipeAction({
  offsetX,
  velocityX,
  dir,
  intent,
}: SwipeActionInput): SwipeAction | null {
  const passedDistance = Math.abs(offsetX) >= SWIPE_DISTANCE;
  const passedVelocity = Math.abs(velocityX) >= SWIPE_VELOCITY;
  if (!passedDistance && !passedVelocity) return null;

  const isBack = dir === 'rtl' ? offsetX < 0 || velocityX < 0 : offsetX > 0 || velocityX > 0;

  if (intent === 'edge-back') return isBack ? 'back' : null;
  return isBack ? 'back' : 'forward';
}

export function getSwipeAxis(offsetX: number, offsetY: number): 'horizontal' | 'vertical' | null {
  const distanceX = Math.abs(offsetX);
  const distanceY = Math.abs(offsetY);
  if (Math.max(distanceX, distanceY) < SWIPE_DIRECTION_THRESHOLD) return null;
  return distanceX > distanceY ? 'horizontal' : 'vertical';
}

const CATEGORY_ROUTE_ID = '/{-$locale}/$slug/c{$id}';

/** Pathname only, so query changes (e.g. /search?q=) update in place instead of
 *  remounting the page through AnimatePresence. Category pages share one key:
 *  the parent tabs are links, and remounting there would tear down the sticky
 *  header and tab strip on every tab tap. */
export function routeTransitionKey(state: {
  location: { pathname: string };
  matches: ReadonlyArray<{ routeId: string }>;
}): string {
  const routeId = state.matches[state.matches.length - 1]?.routeId;
  return routeId === CATEGORY_ROUTE_ID ? routeId : state.location.pathname;
}

export function RouteGestureTransition({ children }: { children: ReactNode }) {
  const router = useRouter();
  const routeKey = useRouterState({ select: routeTransitionKey });
  const { dir } = useTwilight();
  const reducedMotion = useReducedMotion();
  const dragControls = useDragControls();
  const pendingSwipeRef = useRef<PendingSwipe | null>(null);
  const swipeIntentRef = useRef<SwipeIntent | null>(null);
  const directionRef = useRef<1 | -1>(dir === 'rtl' ? -1 : 1);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (reducedMotion || event.pointerType === 'mouse' || !event.isPrimary) return;

    swipeIntentRef.current = null;
    const intent = getSwipeIntent(event.target, event.clientX, window.innerWidth, dir);
    pendingSwipeRef.current = intent
      ? { pointerId: event.pointerId, x: event.clientX, y: event.clientY, intent }
      : null;
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pendingSwipe = pendingSwipeRef.current;
    if (!pendingSwipe || pendingSwipe.pointerId !== event.pointerId) return;

    const axis = getSwipeAxis(event.clientX - pendingSwipe.x, event.clientY - pendingSwipe.y);
    if (!axis) return;

    pendingSwipeRef.current = null;
    if (axis === 'vertical') return;

    // Starting Motion promotes the route to a transform layer, so only do it
    // after vertical scrolling has been ruled out.
    swipeIntentRef.current = pendingSwipe.intent;
    dragControls.start(event, { distanceThreshold: 0 });
  }

  function handleDragEnd(_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    const intent = swipeIntentRef.current;
    swipeIntentRef.current = null;
    if (!intent) return;

    const action = getSwipeAction({
      offsetX: info.offset.x,
      velocityX: info.velocity.x,
      dir,
      intent,
    });

    if (!action) return;

    directionRef.current = action === 'back' ? -1 : 1;
    if (action === 'back') router.history.back();
    else router.history.forward();
  }

  if (reducedMotion) return <>{children}</>;

  return (
    <div className="route-transition-viewport h-full overflow-x-clip">
      <AnimatePresence mode="wait" initial={false} custom={directionRef.current}>
        <motion.div
          key={routeKey}
          className="h-full"
          custom={directionRef.current}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={transition}
          drag="x"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.28}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={() => (pendingSwipeRef.current = null)}
          onPointerCancel={() => (pendingSwipeRef.current = null)}
          onDragEnd={handleDragEnd}
          style={{ touchAction: 'pan-y' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
