import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const twilight = JSON.parse(readFileSync('twilight.json', 'utf8')) as {
  settings?: { id?: string }[];
};

describe('twilight.json theme settings', () => {
  // Raed switches for UI the grocery design doesn't have; a merchant toggling them saw no change.
  it.each([
    'important_links',
    'enable_more_menu',
    'is_more_button_enabled',
    'product_index_show_breadcrumbs',
  ])('does not offer %s', (id) => {
    expect(twilight.settings?.map((setting) => setting.id)).not.toContain(id);
  });
});
