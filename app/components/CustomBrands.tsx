/**
 * Custom Brands Component
 *
 * Example of how to override a home component in theme-custom.
 * This component replaces the default Brands component from theme-engine.
 *
 * To activate in app/setup.ts:
 * ```ts
 * import { CustomBrands } from './components/CustomBrands';
 * registerHomeComponents({
 *   ...DefaultHomeComponents,
 *   'brands': CustomBrands,
 * });
 * ```
 */

import { memo } from 'react';

interface Brand {
  id: number;
  name: string;
  logo?: string;
  url?: string;
}

interface CustomBrandsProps {
  componentProps?: {
    brands?: Brand[];
    title?: string;
    path?: string;
    position?: number;
    [key: string]: unknown;
  };
}

export const CustomBrands = memo(function CustomBrands({ componentProps }: CustomBrandsProps) {
  const { brands = [], title = 'Our Brands' } = componentProps || {};

  if (!brands.length) return null;

  return (
    <section className="custom-brands py-12 bg-gray-50">
      <div className="container mx-auto px-4">
        {/* Custom header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">{title}</h2>
        </div>

        {/* Custom grid layout */}
        <div className="grid grid-cols-2 gap-6">
          {brands.map((brand) => (
            <a
              key={brand.id}
              href={brand.url || '#'}
              className="group block p-4 bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
            >
              {brand.logo ? (
                <img
                  src={brand.logo}
                  alt={brand.name}
                  className="w-full h-20 object-contain filter grayscale group-hover:grayscale-0 transition-all"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-20 flex items-center justify-center bg-gray-100 rounded">
                  <span className="text-gray-500 font-medium">{brand.name}</span>
                </div>
              )}
              <p className="text-center text-sm text-gray-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {brand.name}
              </p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
});

export default CustomBrands;
