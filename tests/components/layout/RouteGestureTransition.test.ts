import { describe, expect, it } from 'vitest';
import {
  getSwipeAction,
  getSwipeAxis,
  getSwipeIntent,
  isRouteSwipeBlocked,
  routeTransitionKey,
} from '../../../app/components/layout/RouteGestureTransition';

describe('routeTransitionKey', () => {
  it('keeps category pages on one key so tab switches update in place', () => {
    const category = '/{-$locale}/$slug/c{$id}';
    const key = (pathname: string, routeId: string) =>
      routeTransitionKey({
        location: { pathname },
        matches: [{ routeId: '__root__' }, { routeId }],
      });

    expect(key('/fruits/c1', category)).toBe(key('/dairy/c2', category));
    expect(key('/p1', '/{-$locale}/$slug/p{$id}')).not.toBe(key('/p2', '/{-$locale}/$slug/p{$id}'));
    expect(key('/search', '/{-$locale}/search')).toBe('/search');
  });
});

describe('RouteGestureTransition gestures', () => {
  it('detects the RTL back edge', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    expect(getSwipeIntent(target, 390, 400, 'rtl')).toBe('edge-back');

    target.remove();
  });

  it('allows full-route swipes away from the edge', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);

    expect(getSwipeIntent(target, 200, 400, 'rtl')).toBe('full');

    target.remove();
  });

  it('blocks gestures from interactive or horizontally scrollable elements', () => {
    const input = document.createElement('input');
    const scroller = document.createElement('div');
    scroller.style.overflowX = 'auto';
    Object.defineProperties(scroller, {
      clientWidth: { value: 100 },
      scrollWidth: { value: 180 },
    });

    document.body.append(input, scroller);

    expect(isRouteSwipeBlocked(input)).toBe(true);
    expect(isRouteSwipeBlocked(scroller)).toBe(true);

    input.remove();
    scroller.remove();
  });

  it('maps RTL full swipes to back and forward history actions', () => {
    expect(
      getSwipeAction({
        offsetX: -120,
        velocityX: -100,
        dir: 'rtl',
        intent: 'full',
      })
    ).toBe('back');

    expect(
      getSwipeAction({
        offsetX: 120,
        velocityX: 100,
        dir: 'rtl',
        intent: 'full',
      })
    ).toBe('forward');
  });

  it('requires edge swipes to move in the back direction', () => {
    expect(
      getSwipeAction({
        offsetX: 120,
        velocityX: 100,
        dir: 'rtl',
        intent: 'edge-back',
      })
    ).toBeNull();
  });

  it.each([
    [0, 0, null],
    [9, 0, null],
    [-9, 0, null],
    [10, 0, 'horizontal'],
    [-10, 0, 'horizontal'],
    [0, 10, 'vertical'],
    [0, -10, 'vertical'],
    [10, 10, 'vertical'],
    [12, 4, 'horizontal'],
    [4, 12, 'vertical'],
  ] as const)('classifies movement (%s, %s) as %s', (offsetX, offsetY, expected) => {
    expect(getSwipeAxis(offsetX, offsetY)).toBe(expected);
  });

  it.each([
    [-96, 'rtl', 'back'],
    [96, 'rtl', 'forward'],
    [96, 'ltr', 'back'],
    [-96, 'ltr', 'forward'],
  ] as const)(
    'accepts an offset of %spx at the exact distance threshold in %s',
    (offsetX, dir, expected) => {
      expect(getSwipeAction({ offsetX, velocityX: 0, dir, intent: 'full' })).toBe(expected);
    }
  );

  it.each([
    [95, 699],
    [-95, -699],
  ] as const)(
    'rejects offset %spx and velocity %spx/s below both thresholds',
    (offsetX, velocityX) => {
      expect(getSwipeAction({ offsetX, velocityX, dir: 'rtl', intent: 'full' })).toBeNull();
    }
  );

  it.each([
    [-95, -700, 'back'],
    [95, 700, 'forward'],
  ] as const)('accepts the velocity fallback at %spx/s', (offsetX, velocityX, expected) => {
    expect(getSwipeAction({ offsetX, velocityX, dir: 'rtl', intent: 'full' })).toBe(expected);
  });

  it('requires the pre-drag distance when Motion starts after direction detection', () => {
    const directionDetectionOffsetX = -10;
    const motionOffsetX = -86;

    expect(
      getSwipeAction({ offsetX: motionOffsetX, velocityX: 0, dir: 'rtl', intent: 'full' })
    ).toBeNull();
    expect(
      getSwipeAction({
        offsetX: directionDetectionOffsetX + motionOffsetX,
        velocityX: 0,
        dir: 'rtl',
        intent: 'full',
      })
    ).toBe('back');
  });
});
