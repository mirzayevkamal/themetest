import { ProductListPage as EngineProductListPage } from '@salla.sa/twilight-theme-engine/routes/product-listing';
import type { ProductListLoaderData } from '@salla.sa/twilight-theme-engine/routes/product-listing';
import { BlockHookSlot } from '../common/BlockHookSlot';
import { PageHeader } from '../navigation/PageHeader';

/** The engine prints the brand description inside a `<p>`; the editor's own `<p>`s
 *  there make the browser split it, so hydration fails (React error #418). */
export const inlineDescription = (html: string) =>
  html
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>\s*(?=\S)/gi, '<br>')
    .replace(/<\/?(p|div|h[1-6]|ul|ol|li|blockquote)\b[^>]*>/gi, '')
    .trim();

/** Registered as `product:list-page`, so every engine listing (products, brands,
 *  tags) gets the grocery bar over the engine list. Like categories, back always
 *  returns home: these lists are entered from home links. */
export function ProductListPage(data: ProductListLoaderData) {
  const { type, entity } = data.source;
  const source =
    type === 'brands' && entity && 'description' in entity && entity.description
      ? {
          ...data.source,
          entity: { ...entity, description: inlineDescription(entity.description) },
        }
      : data.source;
  return (
    <>
      <PageHeader title={data.page.title} backTo="/" />
      <div className="products-page pt-4 [&_.breadcrumbs]:hidden [&_#page-main-title]:hidden">
        <BlockHookSlot
          name="product.index.before_products_group_with_filter"
          wrapper="s-before-products-list"
        />
        <EngineProductListPage {...data} source={source} />
        <BlockHookSlot
          name="product.index.after_products_group_with_filter"
          wrapper="s-after-products-list"
        />
      </div>
    </>
  );
}
