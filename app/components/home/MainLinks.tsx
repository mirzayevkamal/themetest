import { memo } from 'react';
import { Image, Link } from '@salla.sa/twilight-theme-engine/common';

interface LinkItem {
  id?: string | number;
  url?: string;
  icon?: string;
  image?: string;
  title?: string;
  link_title?: string;
}

interface Category {
  id?: string | number;
  url?: string;
  icon?: string;
  image?: string;
  name?: string;
}

export interface MainLinksProps {
  data: {
    links?: LinkItem[];
    categories?: Category[];
    show_cats?: boolean;
    merge_with_top_component?: boolean;
    title?: string;
    tile_background?: string;
    position?: number;
    [key: string]: unknown;
  };
}

export function getMainLinksClassName(data: MainLinksProps['data']): string {
  const mergeWithTop = Boolean(data.merge_with_top_component);
  return [
    's-block',
    's-block--main-links',
    mergeWithTop ? 'merge-with-top-component' : '',
    mergeWithTop && !data.title ? 'merged-has-no-title' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export const MainLinks = memo(function MainLinks({ data }: MainLinksProps) {
  const position = data.position ?? 0;
  const {
    links = [],
    categories = [],
    show_cats: showCats = false,
    title,
    tile_background: tileBackground,
  } = data;
  const thumbStyle = tileBackground ? { backgroundColor: tileBackground } : undefined;
  const items = showCats ? categories : links;

  if (!items.length) return null;

  return (
    <div className="container">
      <div className="main-links-slider main-links-grid" id={`main-links-${position}`}>
        {title ? (
          <div className="s-slider-block__title">
            <h2>{title}</h2>
          </div>
        ) : null}
        <div className="main-links-grid__items">
          {items.map((item, index) => {
            const itemTitle = showCats
              ? (item as Category).name
              : (item as LinkItem).title || (item as LinkItem).link_title;
            const itemIcon = showCats ? (item as Category).icon : (item as LinkItem).icon;
            const itemImage = showCats ? (item as Category).image : (item as LinkItem).image;
            const itemUrl = item.url || '#';
            const itemKey =
              item.id ?? item.url ?? itemTitle ?? itemImage ?? itemIcon ?? `link-${index}`;

            return (
              <div key={itemKey} className="main-links-slider__slide">
                <Link to={itemUrl} className="slide--cat-entry main-links-slider__item">
                  <span className="main-links-slider__thumb" style={thumbStyle}>
                    {showCats && itemImage ? (
                      <Image
                        src={itemImage}
                        width={192}
                        height={192}
                        // The link's <h2> already names it; a repeated alt is read twice.
                        alt=""
                        objectFit="cover"
                        noWrapper
                        // In the first screen next to the hero: let the hero's bytes go first.
                        fetchPriority="low"
                      />
                    ) : itemIcon ? (
                      <i className={itemIcon} />
                    ) : null}
                  </span>
                  <h2>{itemTitle}</h2>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
