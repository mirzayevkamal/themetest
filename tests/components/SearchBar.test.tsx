import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchInput, SearchTrigger } from '../../app/components/SearchBar';

vi.mock('@salla.sa/twilight-theme-engine/common', () => ({
  Link: ({ to, children, ...props }: { to?: string; children?: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  vi.useRealTimers();
});

describe('SearchTrigger', () => {
  it('links to the search page with the placeholder label', () => {
    const { container } = render(<SearchTrigger label="ابحث عن ارز" />);
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/search');
    expect(link?.textContent).toContain('ابحث عن ارز');
  });
});

describe('SearchInput', () => {
  it('debounces typing and searches with the latest value', () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    const { getByPlaceholderText } = render(
      <SearchInput placeholder="ابحث" onSearch={onSearch} />
    );
    const input = getByPlaceholderText('ابحث');

    fireEvent.change(input, { target: { value: 'مو' } });
    fireEvent.change(input, { target: { value: 'موز' } });
    expect(onSearch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);
    expect(onSearch).toHaveBeenCalledExactlyOnceWith('موز');
  });

  it('searches immediately on Enter', () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    const { getByPlaceholderText } = render(
      <SearchInput placeholder="ابحث" onSearch={onSearch} />
    );
    const input = getByPlaceholderText('ابحث');

    fireEvent.change(input, { target: { value: 'حليب' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSearch).toHaveBeenCalledExactlyOnceWith('حليب');

    vi.advanceTimersByTime(400);
    expect(onSearch).toHaveBeenCalledTimes(1);
  });
});
