import fixtures from './home-components.json';

const COMPONENT_LIST_PATH = '/store/v1/component/list';
const PREVIEW_STATE_KEY = '__sallaHomeComponentPreview__';

interface PreviewFixture extends Record<string, unknown> {
  __at?: number;
}

interface PreviewState {
  fixtures: PreviewFixture[];
  originalFetch: typeof fetch;
  installed: boolean;
}

type PreviewGlobal = typeof globalThis & {
  [PREVIEW_STATE_KEY]?: PreviewState;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function getRequestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== 'undefined' && input instanceof Request) return input.method;
  return 'GET';
}

export function isHomeComponentListRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  if (getRequestMethod(input, init) !== 'GET') return false;

  try {
    const url = new URL(getRequestUrl(input), 'http://localhost');
    return url.pathname === COMPONENT_LIST_PATH;
  } catch {
    return false;
  }
}

export function injectHomeComponents(
  body: unknown,
  previewFixtures: PreviewFixture[] = fixtures
): unknown {
  if (!isRecord(body) || !Array.isArray(body.data)) return body;

  const components = [...body.data];
  // Splice in __at order: applying a lower position after a higher one would
  // shift the already-inserted fixtures down (banner at 0 pushing a slider
  // inserted at 1 to index 2).
  const ordered = [...previewFixtures].sort(
    (a, b) =>
      (Number.isInteger(a.__at) ? (a.__at as number) : Infinity) -
      (Number.isInteger(b.__at) ? (b.__at as number) : Infinity)
  );
  for (const { __at, ...component } of ordered) {
    const requestedIndex = Number.isInteger(__at) ? (__at as number) : components.length;
    const index = Math.max(0, Math.min(requestedIndex, components.length));
    components.splice(index, 0, component);
  }

  return { ...body, data: components };
}

async function rewriteHomeComponentResponse(
  response: Response,
  previewFixtures: PreviewFixture[]
): Promise<Response> {
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    return response;
  }

  const body = await response.clone().json();
  const rewritten = injectHomeComponents(body, previewFixtures);
  if (rewritten === body) return response;

  const headers = new Headers(response.headers);
  headers.delete('content-encoding');
  headers.delete('content-length');
  headers.set('content-type', 'application/json; charset=utf-8');

  return new Response(JSON.stringify(rewritten), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function installHomeComponentPreview(): void {
  const previewGlobal = globalThis as PreviewGlobal;
  const existing = previewGlobal[PREVIEW_STATE_KEY];

  if (existing) {
    existing.fixtures = fixtures;
    return;
  }

  const state: PreviewState = {
    fixtures,
    originalFetch: globalThis.fetch.bind(globalThis),
    installed: true,
  };
  previewGlobal[PREVIEW_STATE_KEY] = state;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await state.originalFetch(input, init);
    if (!isHomeComponentListRequest(input, init)) return response;
    return rewriteHomeComponentResponse(response, state.fixtures);
  };
}
