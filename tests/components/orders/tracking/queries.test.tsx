import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { listShipments, useShipments } from '../../../../app/components/orders/tracking/queries';

const api = vi.hoisted(() => ({
  urls: [] as string[],
  response: {} as Record<string, unknown>,
}));
vi.mock('@salla.sa/twilight-theme-engine/api/client', () => ({
  api: {
    get: (url: string) => ({
      json: async () => {
        api.urls.push(url);
        return api.response;
      },
    }),
  },
}));

describe('listShipments', () => {
  beforeEach(() => {
    api.urls = [];
    api.response = {};
  });

  it('asks the shipments endpoint for products and unwraps data', async () => {
    const shipments = [
      { id: 1, number: '0', name: 'x', logo: '', website: '', tracking_url: null, products: [] },
    ];
    api.response = { status: 200, success: true, data: shipments };
    expect(await listShipments(622651189)).toBe(shipments);
    expect(api.urls).toEqual(['orders/622651189/shipments?with_products=true']);
    api.response = {};
    expect(await listShipments('1')).toEqual([]);
  });
});

describe('useShipments', () => {
  beforeEach(() => {
    api.urls = [];
    api.response = { data: [] };
  });

  it('fetches once more when the order stops being in flight', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, rerender } = renderHook(({ active }) => useShipments(7, { active }), {
      wrapper,
      initialProps: { active: true },
    });
    await waitFor(() => expect(api.urls).toHaveLength(1));

    api.response = { data: [{ actual_delivered_at: '2026-10-04 12:25:00' }] };
    rerender({ active: false });
    await waitFor(() => expect(result.current.data?.[0]?.actual_delivered_at).toBeTruthy());
    expect(api.urls).toHaveLength(2);
  });
});
