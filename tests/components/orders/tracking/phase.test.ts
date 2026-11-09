import { describe, it, expect } from 'vitest';
import {
  ACTIVE_ORDER_STATUS,
  findActiveOrder,
  isInFlightStatus,
  liveTracking,
  minutesBetween,
  orderPhase,
  progressFills,
} from '../../../../app/components/orders/tracking/phase';

describe('orderPhase', () => {
  it('maps Salla status slugs to tracking stages, not merchant status copy', () => {
    expect(orderPhase('under_review')).toBe('confirmed');
    expect(orderPhase('payment_pending')).toBe('confirmed');
    expect(orderPhase('in_progress')).toBe('preparing');
    expect(orderPhase('completed')).toBe('preparing');
    expect(orderPhase('delivering')).toBe('delivering');
    expect(orderPhase('shipped')).toBe('delivering');
    expect(orderPhase('delivered')).toBe('delivered');
    expect(orderPhase('canceled')).toBe('cancelled');
    expect(orderPhase(undefined)).toBe('confirmed');
  });
});

describe('isInFlightStatus', () => {
  it('lists every in-flight slug the storefront status filter accepts', () => {
    expect(ACTIVE_ORDER_STATUS).toBe('under_review,in_progress,delivering,shipped');
    expect(isInFlightStatus('payment_pending')).toBe(false);
    expect(isInFlightStatus('waiting_for_payment_confirmation')).toBe(false);
    expect(isInFlightStatus('under_review')).toBe(true);
    expect(isInFlightStatus('in_progress')).toBe(true);
    expect(isInFlightStatus('delivering')).toBe(true);
    expect(isInFlightStatus('shipped')).toBe(true);
    expect(isInFlightStatus('completed')).toBe(false);
    expect(isInFlightStatus('delivered')).toBe(false);
    expect(isInFlightStatus('canceled')).toBe(false);
  });
});

describe('progressFills', () => {
  it('fills completed stages and half of the current one', () => {
    expect(progressFills('confirmed', 3)).toEqual([1, 0, 0]);
    expect(progressFills('preparing', 3)).toEqual([1, 0.5, 0]);
    expect(progressFills('preparing', 4)).toEqual([1, 0.5, 0, 0]);
    expect(progressFills('delivering', 4)).toEqual([1, 1, 0.5, 0]);
  });
});

describe('liveTracking', () => {
  it('uses only the shipment embed link as the map url', () => {
    const shipment = { tracking_embed_link: '/embed', tracking_url: '/map' } as never;
    expect(liveTracking({ shipments: [shipment] }).mapUrl).toBe('/embed');
    expect(liveTracking({ shipments: [{ tracking_url: '/map' } as never] }).mapUrl).toBeUndefined();
  });

  it('treats null ETA, driver and delivery time from legacy shipments as missing', () => {
    const shipment = {
      estimated_delivery_at: null,
      driver_info: null,
      actual_delivered_at: null,
    } as never;
    expect(liveTracking({ shipments: [shipment] })).toMatchObject({
      eta: undefined,
      driver: undefined,
      deliveredAt: undefined,
    });
  });
});

describe('minutesBetween', () => {
  it('counts whole minutes between two store-time strings', () => {
    expect(minutesBetween('2026-10-04 12:00:00.000000', '2026-10-04 12:25:00')).toBe(25);
    expect(minutesBetween('2026-10-04 12:30:00', '2026-10-04 12:00:00')).toBeUndefined();
    expect(minutesBetween(undefined, '2026-10-04 12:00:00')).toBeUndefined();
  });

  it('ignores a DST change in the shopper timezone', () => {
    const tz = process.env.TZ;
    process.env.TZ = 'Europe/London';
    try {
      expect(minutesBetween('2026-10-25 01:50:00', '2026-10-25 02:10:00')).toBe(20);
    } finally {
      process.env.TZ = tz;
    }
  });
});

describe('findActiveOrder', () => {
  it('returns the first in-flight order and skips completed, delivered or cancelled', () => {
    const orders = [
      { id: 1, status: { slug: 'under_review' } },
      { id: 2, status: { slug: 'completed' } },
      { id: 3, status: { slug: 'delivered' } },
      { id: 4, status: { slug: 'canceled' } },
    ];
    expect(findActiveOrder(orders)?.id).toBe(1);
    expect(findActiveOrder([{ id: 5, status: { slug: 'delivering' } }])?.id).toBe(5);
    expect(findActiveOrder(orders.slice(1))).toBeUndefined();
    expect(findActiveOrder(undefined)).toBeUndefined();
  });
});
