import { memo } from 'react';
import { Image, Link } from '@salla.sa/twilight-theme-engine/common';

interface BannerItem {
  image?: string;
  url?: string;
  title?: string;
  description?: string;
}

export interface EnhancedSquareBannersProps {
  data: {
    banners: BannerItem[];
    position?: number;
    [key: string]: unknown;
  };
}

export const EnhancedSquareBanners = memo(function EnhancedSquareBanners({
  data,
}: EnhancedSquareBannersProps) {
  const { banners } = data;

  if (!banners.length) return null;

  return (
    <>
      <div className="grid grid-flow-row gap-3">
        {banners.map((banner, index) => (
          <Link
            key={index}
            to={banner.url || '#'}
            aria-label={banner.title ? banner.title : `square-banner-${index}`}
            className={`banner-entry h-banner ${banner.title ? 'has-overlay' : ''}`}
          >
            {/* .banner-entry is relative; overlay (:after) and text stack above */}
            <Image
              src={banner.image}
              alt=""
              width={600}
              height={400}
              objectFit="cover"
              noWrapper
              className="absolute inset-0 h-full w-full"
            />
            <article className="banner-entry__text text-with-border">
              <h3 className="banner__title font-bold mb-1 leading-6">{banner.title}</h3>
              <p className="banner__description">{banner.description}</p>
            </article>
          </Link>
        ))}
      </div>
    </>
  );
});
