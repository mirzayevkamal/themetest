import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({ find: vi.fn() }));
const navigate = vi.hoisted(() => vi.fn());
const desktop = vi.hoisted(() => ({ value: false }));
const auth = vi.hoisted(() => ({ token: 'jwt' as string | null }));

vi.mock('@salla.sa/twilight-theme-engine/api/order', () => ({ order: api }));
vi.mock('../../app/hooks/useIsWebDesktop', () => ({ isWebDesktop: () => desktop.value }));
vi.mock('@salla.sa/twilight-theme-engine/api/client', () => ({ getAuthToken: () => auth.token }));
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return { ...actual, useNavigate: () => navigate };
});

import { resolveOrderId, ThankYouRedirect } from '../../app/routes/thankyou.$orderId';
import { takeOrderDrawerOnArrival } from '../../app/hooks/useOrderDrawer';

describe('resolveOrderId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves a thank-you hash via order.find', async () => {
    api.find.mockResolvedValueOnce({ order: { id: 42 } });
    await expect(resolveOrderId('ENZWrjY')).resolves.toBe('42');
    expect(api.find).toHaveBeenCalledWith('ENZWrjY');
  });

  it('passes a numeric id straight through without API calls', async () => {
    await expect(resolveOrderId('7')).resolves.toBe('7');
    expect(api.find).not.toHaveBeenCalled();
  });
});

describe('ThankYouRedirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    desktop.value = false;
    auth.token = 'jwt';
  });

  it('goes home on web desktop and queues the order drawer for the layout', async () => {
    desktop.value = true;
    api.find.mockResolvedValueOnce({ order: { id: 42 } });

    render(<ThankYouRedirect orderId="ENZWrjY" locale="ar" />);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: '/ar', replace: true });
    });
    expect(takeOrderDrawerOnArrival()).toBe('42');
    expect(takeOrderDrawerOnArrival()).toBeNull();
  });

  it('still goes home on web desktop when the lookup fails, without queueing a drawer', async () => {
    desktop.value = true;
    api.find.mockRejectedValueOnce({ message: 'Not Found', response: { status: 404 } });

    render(<ThankYouRedirect orderId="nope" />);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: '/', replace: true });
    });
    expect(takeOrderDrawerOnArrival()).toBeNull();
  });

  it('keeps guests on the orders path and its login gate on web desktop', async () => {
    desktop.value = true;
    auth.token = null;
    api.find.mockResolvedValueOnce({ order: { id: 42 } });

    render(<ThankYouRedirect orderId="ENZWrjY" />);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: '/account/orders/42', replace: true });
    });
    expect(takeOrderDrawerOnArrival()).toBeNull();
  });

  it('navigates to the order details page after resolving a hash', async () => {
    api.find.mockResolvedValueOnce({ order: { id: 42 } });

    render(<ThankYouRedirect orderId="ENZWrjY" locale="ar" />);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({
        to: '/ar/account/orders/42',
        replace: true,
      });
    });
  });

  it('falls back to the orders list when the hash is unknown or the API fails', async () => {
    api.find.mockRejectedValueOnce({ message: 'Not Found', response: { status: 404 } });

    render(<ThankYouRedirect orderId="nope" />);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: '/account/orders', replace: true });
    });
  });

  it('does not navigate after unmount', async () => {
    let resolveFind: (value: { order: { id: number } }) => void = () => undefined;
    api.find.mockImplementationOnce(
      () =>
        new Promise<{ order: { id: number } }>((resolve) => {
          resolveFind = resolve;
        })
    );

    const { unmount } = render(<ThankYouRedirect orderId="ENZWrjY" />);
    unmount();
    await act(async () => {
      resolveFind({ order: { id: 42 } });
    });
    expect(navigate).not.toHaveBeenCalled();
  });
});
