import { describe, it, expect, vi } from 'vitest';

const findOrThrow = vi.hoisted(() => vi.fn());

vi.mock('@salla.sa/twilight-theme-engine/api/page', () => ({ page: { findOrThrow } }));
vi.mock('@salla.sa/twilight-theme-engine/routes/page', () => ({ PageSingle: {} }));
vi.mock('@salla.sa/twilight-theme-engine/tanstack', () => ({ withHead: () => () => ({}) }));
vi.mock('../../app/components/account/StaticPage', () => ({ StaticPage: () => null }));

import { staticPageLoader } from '../../app/routes/$slug.page-$id';

describe('staticPageLoader', () => {
  it('keeps the page type, which marks app-built pages', async () => {
    findOrThrow.mockResolvedValueOnce({
      id: 12,
      name: 'صفحة تطبيق',
      url: '/p/page-12',
      content: '',
      type: 'customised',
    });

    await expect(staticPageLoader('12')).resolves.toMatchObject({
      page: { slug: 'page-single', id: 12, title: 'صفحة تطبيق', type: 'customised' },
    });
    expect(findOrThrow).toHaveBeenCalledWith('12');
  });
});
