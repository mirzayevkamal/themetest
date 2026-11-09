import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileString } from 'sass';
import { describe, expect, it } from 'vitest';

const ABSOLUTE_URL = /url\(\s*['"]?\//;

function imports(sheet: string): string[] {
  const source = readFileSync(`app/styles/${sheet}`, 'utf8');
  return [...source.matchAll(/@import '\.\/([^']+)'/g)].map((m) => m[1]);
}

function compile(sheet: string): string {
  return compileString(readFileSync(`app/styles/${sheet}`, 'utf8'), {
    loadPaths: ['app/styles'],
    silenceDeprecations: ['import'],
  }).css;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.(tsx?|s?css)$/.test(f))
    .map((f) => join(dir, f));
}

describe.each([
  [
    'critical.scss',
    [
      '04-components/header',
      '04-components/desktop',
      '04-components/home-blocks',
      '04-components/slider',
    ],
  ],
])('%s', (sheet, partials) => {
  it('compiles and imports the shell partial last', () => {
    expect(() => compile(sheet)).not.toThrow();
    expect(imports(sheet).at(-1)).toBe('02-generic/shell');
  });

  it('includes its first-screen partials', () => {
    expect(imports(sheet)).toEqual(expect.arrayContaining(partials));
  });

  // An absolute url('/...') inside ?inline CSS breaks the SSR build in vite:asset.
  it('has no absolute url()', () => {
    expect(compile(sheet)).not.toMatch(ABSOLUTE_URL);
  });
});

describe('components', () => {
  it('have no absolute url(), which the critical sheets would inline', () => {
    const offenders = sourceFiles('app/components').filter((f) =>
      ABSOLUTE_URL.test(readFileSync(f, 'utf8'))
    );
    expect(offenders).toEqual([]);
  });
});
