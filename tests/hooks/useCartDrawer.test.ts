import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  closeCartDrawer,
  openCartDrawer,
  resetCartDrawerForTests,
  useCartDrawerOpen,
} from '../../app/hooks/useCartDrawer';

describe('useCartDrawer', () => {
  beforeEach(() => {
    resetCartDrawerForTests();
  });

  it('starts closed and opens then closes', () => {
    const { result } = renderHook(() => useCartDrawerOpen());
    expect(result.current).toBe(false);

    act(() => openCartDrawer());
    expect(result.current).toBe(true);

    act(() => openCartDrawer());
    expect(result.current).toBe(true);

    act(() => closeCartDrawer());
    expect(result.current).toBe(false);
  });
});
