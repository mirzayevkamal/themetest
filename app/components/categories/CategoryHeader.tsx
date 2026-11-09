import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { BackButton, MobileOnly } from '../navigation';
import { SearchTrigger } from '../SearchBar';

/** Category back-and-search bar from the grocery phone design. Desktop uses the shell search. */
export function CategoryHeader() {
  const { t } = useTranslation();
  const searchPlaceholder = t(
    'pages.categories.search_placeholder',
    'ابحث عن الموز، الخيار وغيره....'
  );

  return (
    <MobileOnly>
      <header className="category-page-header flex shrink-0 gap-2 border-b border-neutral-100 bg-white px-4 py-2">
        {/* Grocery categories always return home, even with browsing history. */}
        <BackButton to="/" />
        <SearchTrigger
          label={searchPlaceholder}
          className="min-w-0 flex-1 border border-neutral-100"
        />
      </header>
    </MobileOnly>
  );
}
