import { act, render } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useMountedFromServer } from '../../app/hooks/useMountedFromServer';

function Probe() {
  return <span>{String(useMountedFromServer())}</span>;
}

describe('useMountedFromServer', () => {
  it('is false for a client-only mount', () => {
    const { container } = render(<Probe />);
    expect(container.textContent).toBe('false');
  });

  it('is true on the server and stays true after hydration', async () => {
    const html = renderToString(<Probe />);
    expect(html).toContain('true');

    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.append(host);
    const root = await act(async () => hydrateRoot(host, <Probe />));

    expect(host.textContent).toBe('true');
    act(() => root.unmount());
    host.remove();
  });
});
