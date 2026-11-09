import { memo } from 'react';
import type { Brand } from '@salla.sa/twilight-theme-engine/types';
import { Image, Link } from '@salla.sa/twilight-theme-engine/common';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';

export interface BrandsData {
  brands: Brand[];
  title?: string;
  show_all?: boolean;
  position?: number;
  [key: string]: unknown;
}

export interface BrandsProps {
  data: BrandsData;
}

export const Brands = memo(function Brands({ data }: BrandsProps) {
  const { brands, title, show_all: showAll } = data;
  const { t } = useTranslation();

  if (!brands.length) return null;

  return (
    <div className="container brands-home">
      {(title || showAll) && (
        <div className="s-block__title brands-home__title">
          {title && (
            <div className="right-side">
              <h2>{title}</h2>
            </div>
          )}
          {showAll && (
            <Link to="/brands" className="s-block__display-all">
              {t('blocks.home.display_all', 'View All')}
              <i className="sicon-arrow-left"></i>
            </Link>
          )}
        </div>
      )}

      <div className="brands-home__list" aria-label={title}>
        {brands.map((brand) => (
          <Link key={brand.id} to={brand.url} className="brands-home__link" aria-label={brand.name}>
            <span className="brands-home__item">
              <Image
                src={brand.logo}
                alt=""
                width={160}
                height={160}
                objectFit="cover"
                noWrapper
                fetchPriority="low"
                className="brands-home__logo"
              />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
});
