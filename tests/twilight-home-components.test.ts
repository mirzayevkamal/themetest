import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type TwilightField = {
  id?: string;
  type?: string;
  format?: string;
  required?: boolean;
  source?: string;
  searchable?: boolean;
  value?: unknown;
  sources?: unknown;
  fields?: TwilightField[];
};

type TwilightComponent = {
  path?: string;
  title?: { ar?: string; en?: string };
  fields?: TwilightField[];
};

type TwilightManifest = {
  components?: TwilightComponent[];
  features?: string[];
};

const MIXED_FORMATS = new Set(['image', 'variable-list']);

const twilight = JSON.parse(readFileSync('twilight.json', 'utf8')) as TwilightManifest;

function walkCollections(
  fields: TwilightField[] | undefined,
  path: string,
  visit: (collection: TwilightField, path: string) => void
) {
  for (const field of fields ?? []) {
    if (field.type !== 'collection') continue;
    const collectionPath = `${path}.${field.id}`;
    visit(field, collectionPath);
    walkCollections(field.fields, collectionPath, visit);
  }
}

function findField(fields: TwilightField[] | undefined, id: string): TwilightField | undefined {
  for (const field of fields ?? []) {
    if (field.id === id) return field;
    const nested = findField(field.fields, id);
    if (nested) return nested;
  }
  return undefined;
}

describe('home component twilight config', () => {
  it('offers no home block the grocery design has no component for', () => {
    const paths = twilight.components?.map((component) => component.path);

    expect(paths).not.toContain('home.custom-testimonials');
    expect(twilight.features).not.toContain('component-featured-products');
  });

  it('does not seed null into image or variable-list collection defaults', () => {
    const hits: string[] = [];

    for (const component of twilight.components ?? []) {
      walkCollections(component.fields, component.path ?? 'unknown', (collection, path) => {
        const byId = Object.fromEntries(
          (collection.fields ?? [])
            .filter((field) => field.id)
            .map((field) => [field.id as string, field])
        );
        const rows = Array.isArray(collection.value) ? collection.value : [];

        rows.forEach((row, index) => {
          if (!row || typeof row !== 'object') return;
          for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
            const child = byId[key];
            if (value === null && child && MIXED_FORMATS.has(child.format ?? '')) {
              hits.push(`${path}[${index}].${key}`);
            }
          }
        });
      });
    }

    expect(hits).toEqual([]);
  });

  it('keeps the promotional banner icon optional', () => {
    const banner = twilight.components?.find((component) => component.path === 'home.promotional-banner');
    const icon = findField(banner?.fields, 'messages.icon_image');

    expect(icon).toBeDefined();
    expect(icon?.required).toBe(false);
    expect(icon?.format).toBe('image');
  });

  it('names the promotional bar شريط ترويجي in the theme editor', () => {
    const banner = twilight.components?.find((component) => component.path === 'home.promotional-banner');

    expect(banner?.title).toEqual({ ar: 'شريط ترويجي', en: 'Promotional bar' });
    expect(findField(banner?.fields, 'auto_rotate')).toBeUndefined();
  });

  it('gives the merchant a show_controls switch only on the enhanced image slider', () => {
    const enhanced = twilight.components?.find((item) => item.path === 'home.enhanced-slider');

    expect(findField(enhanced?.fields, 'show_controls')).toMatchObject({
      type: 'boolean',
      format: 'switch',
      label: 'عرض أسهم التحرك',
      required: false,
      value: false,
      selected: false,
    });

    for (const path of [
      'home.slider-products-with-header',
      'home.main-links',
      'home.promotional-banner',
    ]) {
      const component = twilight.components?.find((item) => item.path === path);

      expect(findField(component?.fields, 'show_controls'), path).toBeUndefined();
    }
  });

  it('lets merchants attach product, category, brand, and offer links to each slider image', () => {
    const slider = twilight.components?.find((component) => component.path === 'home.enhanced-slider');
    const slideUrl = findField(slider?.fields, 'slides.url');

    expect(slideUrl).toMatchObject({
      format: 'variable-list',
      required: false,
      source: 'custom',
      searchable: true,
    });
    expect((slideUrl?.sources as { key?: string }[] | undefined)?.map((source) => source.key)).toEqual([
      'products',
      'products_tags',
      'categories',
      'brands',
      'offers_link',
      'brands_link',
      'custom',
    ]);
  });

  it('defaults promotional banner highlight color to the current red', () => {
    const banner = twilight.components?.find((component) => component.path === 'home.promotional-banner');
    const highlightColor = findField(banner?.fields, 'highlight_color');

    expect(highlightColor).toMatchObject({
      format: 'color',
      required: false,
      value: '#FF0000',
    });
  });
});
