import {
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ItemsList, SallaButton } from '@salla.sa/twilight-components-react';
import { product, type ProductsListResult } from '@salla.sa/twilight-theme-engine/api/product';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import { Link, NoContent, RenderWhenVisible } from '@salla.sa/twilight-theme-engine/common';
import type { Category, Product } from '@salla.sa/twilight-theme-engine/types';
import { ProductCard } from '../product';
import { ProductCardPlaceholder } from '../home/placeholders';
import { BlockHookSlot } from '../common/BlockHookSlot';
import { CategoryChip } from './CategoryChip';
import { CategoryHeader } from './CategoryHeader';
import { ScrollStrip } from './ScrollStrip';
import { useAccentOutlined, useThemeSettings } from '../../hooks/useAccentStyle';
import { FiltersButton } from '../filters/FiltersButton';
import { SortButton } from '../filters/SortButton';
import type { ListingSelection } from '../filters/useListingSelection';
import { useSectionSelection } from './useSectionSelection';
import {
  categorySectionParams,
  categorySectionQuery,
  landingSection,
  PRODUCTS_PER_PAGE,
  serverSections,
} from './sectionQuery';
import type { CategoryListLoaderData } from '../../routes/$slug.c$id';
import { returningInHistory } from '../../lib/scrollRestoration';

const sectionDomId = (cat: Category) => `category-section-${cat.id}`;

/** Phone: a third of the screen. From 481px the grid fills with 114px+ columns,
 *  capped by the 127px web-desktop card; 148px covers both. */
const CATEGORY_CARD_IMAGE_SIZES = '(min-width: 481px) 148px, 33vw';
/** First grid row (`grid-cols-3`): eager, high-priority images — the page's LCP. */
const FIRST_ROW = 3;
/** A section counts as current once its top is this close under the toolbar
 *  (chip jumps leave a 16px gap there on desktop). */
const SPY_SLACK = 32;
/** A chip jump ends after this long without scrolling where `scrollend` does not end it
 *  first: Safari before 26, or a jump with nowhere to go. */
const SCROLL_QUIET = 300;
/** Drift of a chip jump's target that its exact landing absorbs: a mid-flight re-aim would
 *  restart the animation from rest, and a section rendering in place drifts it by a pixel. */
const FLIGHT_SLACK = 32;
/** Scroll moves shorter than this do not slide the search bar: a jittery finger or a lazy
 *  section settling. */
const SCROLL_DIRECTION_SLACK = 8;
/** Scrolling by the user: a pinned deep-link target lets go on the first of these. */
const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
/** One number per product-list result, for the list's resetKey. */
let resultSerial = 0;

/**
 * Grocery category browsing page (QCD-11 redesign) rendered on every
 * category URL: parent-category tabs, sub-category chips that scroll to
 * their section, and a product grid per sub-category.
 */
export function CategoryListPage({
  page,
  categories,
  activeParent,
  activeSub,
  hideHeader = false,
}: CategoryListLoaderData & { hideHeader?: boolean }) {
  // A parent with no children still gets one section: itself.
  const allSections = activeParent.sub_categories?.length
    ? activeParent.sub_categories
    : [activeParent];
  // The chips and section headings only earn their place over sub-category grids;
  // the active tab already names a parent that is its own section.
  const hasSubSections = allSections[0] !== activeParent;

  // Its products come with the route data, so it renders in the HTML instead of
  // waiting for hydration, an intersection and a fetch before the LCP image exists.
  const landing = landingSection({ activeParent, activeSub });
  const inHtml = serverSections({ activeParent, activeSub }).map((s) => s.id);

  const pageCategory = activeSub ?? activeParent;
  const pageCategoryId = pageCategory.id_ ?? pageCategory.id;
  const blockScope = useMemo(() => ({ category_id: pageCategoryId }), [pageCategoryId]);

  const {
    sortIds,
    filtersEnabled,
    parentId,
    selection,
    setSort,
    clear,
    filterOptions,
    openFilters,
    sections,
    settled,
    unfiltered,
  } = useSectionSelection({ activeParent, allSections, hasSubSections });

  const [chip, setActiveChip] = useState(landing.id);
  // Switching parent tabs reuses this component, so a chip from the previous parent falls back.
  const activeChip = sections.some((s) => s.id === chip) ? chip : (sections[0]?.id ?? landing.id);

  const toolbarRef = useRef<HTMLDivElement>(null);
  const outlined = useAccentOutlined();
  const queryClient = useQueryClient();
  const sectionsRef = useRef<HTMLDivElement>(null);
  // The target of the chip jump in flight: the spy does not walk through every section in
  // between, and the sections it passes do not page.
  const jumping = useRef<Category | null>(null);
  // The same target, for rendering: sections it passes hold their placeholder until it lands.
  const [flyingTo, setFlyingTo] = useState<Category['id'] | null>(null);
  // Ends the current jump; a new jump or unmount cancels the previous one's listener and timer.
  const releaseJump = useRef<(() => void) | null>(null);
  // A jump's target (deep link or chip): re-pinned under the toolbar whenever a section above
  // it grows (a skeleton swapped for products, or a next page loaded as a chip jump passes
  // its end), until the shopper scrolls.
  const pinned = useRef<Category | null>(null);
  // The pinned target's offsetTop when it was last scrolled to.
  const aimedTop = useRef<number | null>(null);
  const autoHideSearch = useThemeSettings()?.category_header_auto_hide !== false;
  // How far the toolbar slides up to take the search bar off screen; 0 shows it.
  const [searchShift, setSearchShift] = useState(0);
  const lastScrollTop = useRef(0);

  const scrollToSection = (cat: Category, smooth = true) => {
    setActiveChip(cat.id);
    // Sections land under the full toolbar (scroll-mt-44).
    setSearchShift(0);
    releaseJump.current?.();
    pinned.current = cat;
    const aim = (behavior: ScrollBehavior) => {
      const el = document.getElementById(sectionDomId(cat));
      if (!el) return;
      aimedTop.current = el.offsetTop;
      el.scrollIntoView({ behavior, block: 'start' });
    };
    // A smooth flight needs the first page of every section it passes: their placeholders then
    // hold its exact height, so nothing above the target grows under it. A tap that comes
    // before them jumps at once instead and stays pinned while they load.
    const passed = sections.slice(0, sections.indexOf(cat) + 1);
    const loaded = passed.every(
      (s) => queryClient.getQueryData(categorySectionQuery(s, settled).queryKey) !== undefined
    );
    if (!smooth || !loaded) {
      // 'instant', not 'auto': html has `scroll-behavior: smooth`, and an animated jump over
      // unloaded sections would drag them through the viewport as they grow.
      aim('instant');
      return;
    }
    jumping.current = cat;
    setFlyingTo(cat.id);
    // A passed section's list flashes its loading row as the flight crosses its end, though
    // it loads nothing then: hidden, so the target does not move under the animation.
    sectionsRef.current?.setAttribute('data-jumping', '');
    let quiet: ReturnType<typeof setTimeout> | undefined;
    const waitForQuiet = () => {
      clearTimeout(quiet);
      quiet = setTimeout(() => release(true), SCROLL_QUIET);
    };
    const onScroll = (e: Event) => {
      // The chip row centering its chip scrolls on its own; only the page's scroll counts.
      if (e.target instanceof Node && toolbarRef.current?.contains(e.target)) return;
      if (e.type === 'scrollend') release(true);
      // ponytail: a main-thread stall longer than SCROLL_QUIET mid-flight ends the jump early
      // and snaps the rest; scrollend alone once Safari before 26 is gone.
      else waitForQuiet();
    };
    const release = (settle = false) => {
      jumping.current = null;
      sectionsRef.current?.removeAttribute('data-jumping');
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('scrollend', onScroll, { capture: true });
      clearTimeout(quiet);
      releaseJump.current = null;
      // The passed sections render their cards in the background; a newer jump keeps its own.
      startTransition(() => setFlyingTo((id) => (id === cat.id ? null : id)));
      // Land exactly on the target, wherever growth above left the animation's end.
      if (settle && pinned.current === cat) aim('instant');
    };
    releaseJump.current = release;
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('scrollend', onScroll, { capture: true });
    waitForQuiet();
    aim('smooth');
  };

  usePreloadSections(activeParent.id, unfiltered, sections, settled);

  // Scroll-spy: the last section whose top has reached the toolbar is the current one.
  const syncChipToScroll = useEffectEvent((scroller: Element | null) => {
    const toolbar = toolbarRef.current;
    if (jumping.current || !hasSubSections || !toolbar || !sections.length) return;
    const line = toolbar.getBoundingClientRect().bottom + SPY_SLACK;
    let current = sections[0];
    for (const sub of sections) {
      const top = document.getElementById(sectionDomId(sub))?.getBoundingClientRect().top;
      if (top !== undefined && top <= line) current = sub;
    }
    // A short last section can't reach the line; scrolled to the end, it is the current one.
    if (
      scroller &&
      scroller.scrollTop > 0 &&
      scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1
    ) {
      current = sections[sections.length - 1];
    }
    setActiveChip(current.id);
  });
  // Scrolling down slides the search bar away and scrolling up brings it back; the jumps and
  // pins that move the page on their own leave it as it is.
  const slideSearchBar = useEffectEvent((scroller: Element | null) => {
    const top = scroller?.scrollTop ?? 0;
    const delta = top - lastScrollTop.current;
    if (Math.abs(delta) < SCROLL_DIRECTION_SLACK) return;
    lastScrollTop.current = top;
    if (!autoHideSearch || jumping.current || pinned.current) return;
    const bar = toolbarRef.current?.querySelector<HTMLElement>('.category-page-header');
    const height = bar?.offsetHeight ?? 0;
    setSearchShift(delta > 0 && top > height ? height : 0);
  });
  useEffect(() => {
    let frame = 0;
    // The page or the phone shell's inner element, whichever scrolls the sections.
    let scroller: Element | null = null;
    const onScroll = (e?: Event) => {
      const target = e?.target instanceof Document ? e.target.scrollingElement : e?.target;
      if (target instanceof Element && target.contains(sectionsRef.current)) scroller = target;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        syncChipToScroll(scroller);
        slideSearchBar(scroller);
      });
    };
    // Capture: the phone shell scrolls an inner element, and scroll events don't bubble.
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    // Lazy sections swap their skeleton for real height without a scroll event.
    const onResize = () => {
      const target = pinned.current && document.getElementById(sectionDomId(pinned.current));
      const drift = target ? Math.abs(target.offsetTop - (aimedTop.current ?? 0)) : 0;
      if (target && drift > (jumping.current ? FLIGHT_SLACK : 0)) {
        aimedTop.current = target.offsetTop;
        // Mid chip jump, re-aim the animation rather than cut it short.
        target.scrollIntoView({ behavior: jumping.current ? 'smooth' : 'instant', block: 'start' });
      }
      onScroll();
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onResize);
    if (sectionsRef.current) observer?.observe(sectionsRef.current);
    const unpin = () => void (pinned.current = null);
    for (const type of USER_SCROLL_EVENTS) window.addEventListener(type, unpin, { passive: true });
    return () => {
      releaseJump.current?.();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll, { capture: true });
      for (const type of USER_SCROLL_EVENTS) window.removeEventListener(type, unpin);
      observer?.disconnect();
    };
  }, []);

  // Keep the active chip inside its horizontally scrolled row.
  const chipShown = useRef(false);
  useEffect(() => {
    const chip = toolbarRef.current?.querySelector('button[aria-current="true"]');
    const strip = chip?.closest('.overflow-x-auto');
    if (!chip || !strip) return;
    // On load, a row the shopper already scrolled (before hydration) stays where they put it.
    const onLoad = !chipShown.current;
    chipShown.current = true;
    if (onLoad && strip.scrollLeft !== 0) return;
    const c = chip.getBoundingClientRect();
    const s = strip.getBoundingClientRect();
    if (c.left >= s.left && c.right <= s.right) return;
    strip.scrollBy({ left: c.left + c.width / 2 - (s.left + s.width / 2), behavior: 'smooth' });
  }, [activeChip]);

  // Deep link to a sub-category URL: activate the parent tab, jump to the sub. Before paint,
  // so the lazy sections first see the viewport at the target: ones at the top of the page
  // would otherwise start rendering and push the target down as they outgrow their skeleton.
  const jumpToActiveSub = useEffectEvent(() => {
    if (!activeSub) {
      // The page is reused for a parent URL: nothing to hold in place any more.
      pinned.current = null;
      return;
    }
    scrollToSection(activeSub, false);
    // Back or Forward: the router restores the shopper's saved position over this jump.
    if (returningInHistory()) pinned.current = null;
  });
  useLayoutEffect(() => jumpToActiveSub(), [activeSub?.id]);

  return (
    <div className={hideHeader ? undefined : 'category-page'}>
      {/* The design names the category only through the active tab. */}
      {hideHeader ? null : <h1 className="sr-only">{page.title}</h1>}
      {/* One sticky block: header + tabs + chips pin together. */}
      <div
        ref={toolbarRef}
        className="category-toolbar sticky top-0 z-10 motion-safe:transition-transform"
        style={searchShift ? { transform: `translateY(-${searchShift}px)` } : undefined}
        // A keyboard user tabbing into the hidden search bar gets it back.
        onFocus={(e) => {
          if (e.target.closest('.category-page-header')) setSearchShift(0);
        }}
      >
        {hideHeader ? null : <CategoryHeader />}
        <ScrollStrip
          className="bg-white shadow-[inset_0_-1px_0_theme(colors.neutral.100)]"
          start={
            <div className="scroll-strip-start flex shrink-0 gap-2 ps-4 pe-2 empty:hidden">
              <SortButton sort={selection.sort ?? null} ids={sortIds} onChange={setSort} />
              {filtersEnabled ? (
                <FiltersButton
                  key={parentId}
                  filters={filterOptions}
                  active={Boolean(selection.filters)}
                  onOpen={openFilters}
                />
              ) : null}
            </div>
          }
        >
          <nav className="container px-4 flex w-max min-w-full max-w-none gap-4">
            {categories.map((cat) => {
              const active = cat.id === activeParent.id;
              return (
                <Link
                  key={cat.id}
                  to={cat.url}
                  className={`whitespace-nowrap py-3 text-sm border-b-2 transition-colors ${
                    active
                      ? `font-bold border-brand ${outlined ? 'text-ink' : 'text-brand'}`
                      : 'text-ink border-transparent'
                  }`}
                >
                  {cat.name}
                </Link>
              );
            })}
          </nav>
        </ScrollStrip>

        {hasSubSections && sections.length > 0 && (
          <ScrollStrip className="category-chips bg-smoke">
            <div className="container px-4 flex w-max min-w-full max-w-none gap-2 py-3">
              {sections.map((sub) => (
                <CategoryChip
                  key={sub.id}
                  active={sub.id === activeChip}
                  onClick={() => scrollToSection(sub)}
                >
                  {sub.name}
                </CategoryChip>
              ))}
            </div>
          </ScrollStrip>
        )}
      </div>

      <BlockHookSlot
        name="product.index.before_products_group_with_filter"
        wrapper="s-before-products-list"
        scope={blockScope}
      />

      <div
        ref={sectionsRef}
        className={`container px-4 flex flex-col gap-6 py-4 [&[data-jumping]_.s-items-list-loading-inline]:hidden${outlined ? ' load-more-outlined' : ''}`}
      >
        {sections.length === 0 && <NoFilterMatches onClear={clear} />}
        {sections.map((sub) => (
          // RenderWhenVisible is React.lazy (engine): its own boundary per section keeps the
          // page from suspending while that chunk loads.
          <Suspense
            key={sub.id}
            fallback={
              <div id={sectionDomId(sub)} className={hasSubSections ? 'scroll-mt-44' : undefined}>
                <CategorySectionSkeleton heading={hasSubSections} />
              </div>
            }
          >
            <RenderWhenVisible
              id={sectionDomId(sub)}
              className={hasSubSections ? 'scroll-mt-44' : undefined}
              rootMargin="0px"
              // The placeholder holds the height. The engine's min-height floor would stay on a
              // short rendered section until hydration, then drop and pull the next one up.
              estimatedHeight="0px"
              renderOnMount={inHtml.includes(sub.id)}
              placeholder={
                <SectionPlaceholder category={sub} selection={settled} heading={hasSubSections} />
              }
            >
              <CategorySection
                category={sub}
                heading={hasSubSections}
                priority={sub.id === landing.id}
                selection={settled}
                onClear={clear}
                jumping={jumping}
                flyingOver={flyingTo !== null && flyingTo !== sub.id}
              />
            </RenderWhenVisible>
          </Suspense>
        ))}
      </div>

      <BlockHookSlot
        name="product.index.after_products_group_with_filter"
        wrapper="s-after-products-list"
        scope={blockScope}
      />
    </div>
  );
}

/**
 * Every section's first page once a parent tab is open and unfiltered (just opened, or its
 * filters just cleared), so even the first chip tapped flies smoothly over sized placeholders;
 * a tap that beats them jumps instead. `preloadFor` is null until the tab's own selection is
 * read from the address bar: before that it is the previous tab's, or empty. A filtered tab
 * refetches sections only as they come into view, and a sort change keeps the key, so neither
 * preloads.
 */
function usePreloadSections(
  parentId: Category['id'],
  unfiltered: boolean,
  sections: Category[],
  selection: ListingSelection
) {
  const queryClient = useQueryClient();
  const preloadFor = unfiltered ? parentId : null;
  const preload = useEffectEvent(() => {
    for (const s of sections) {
      void queryClient.ensureQueryData(categorySectionQuery(s, selection)).catch(() => undefined);
    }
  });
  useEffect(() => {
    if (preloadFor !== null) preload();
  }, [preloadFor]);
}

/**
 * Mounted as a chip jump flies past: rendering its cards then would stall the flight, so the
 * section keeps its placeholder, as tall as its cards, until the jump has landed and it is
 * back in view. Left behind above the target, it renders when the shopper scrolls back up to
 * it, not all at once on landing.
 */
function useHeldWhileFlying(flyingOver: boolean, inView: boolean) {
  const [held, setHeld] = useState(flyingOver);
  if (held && !flyingOver && inView) setHeld(false);
  return held;
}

function CategorySection({
  category,
  heading,
  priority = false,
  selection = {},
  onClear,
  jumping,
  flyingOver = false,
}: {
  category: Category;
  heading: boolean;
  priority?: boolean;
  selection?: ListingSelection;
  onClear?: () => void;
  /** The target of the chip jump in flight, if any. */
  jumping?: RefObject<Category | null>;
  /** A chip jump to another section is in flight. */
  flyingOver?: boolean;
}) {
  const { t } = useTranslation();
  const sourceValue = category.id_ ?? category.id;
  const queryClient = useQueryClient();
  const query = categorySectionQuery(category, selection);
  const serverEntry = () =>
    queryClient.getQueriesData<ProductsListResult>({
      queryKey: query.queryKey.slice(0, 3),
    })[0]?.[1];
  const { sort, filters } = selection;
  // Filtered-out sections are hidden by the parent; this covers the single-section tab.
  const narrowed = Boolean(filters);
  const loadMoreButton = useThemeSettings()?.category_load_more_button === true;
  // Once shown, a section stays mounted. A sort or filter change refetches it only
  // while it is on screen; one scrolled past waits until it comes back into view.
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const { data, isPending, isPlaceholderData, isFetching } = useQuery({
    ...query,
    enabled: inView,
    // A new sort or filter keeps the previous grid, as shimmer cards, while its own load:
    // a shorter skeleton would pull the sections below into view, and they would fetch
    // for nothing. Otherwise the SSR entry: the engine keys lists by the
    // active scope, which SSR runs before the SDK knows (scope: null), so the scoped
    // client query starts pending and the cards already in the HTML would flash back
    // to the skeleton. Show the entry with the same params, any scope, until it lands.
    placeholderData: (previous) => previous ?? serverEntry(),
  });
  // Refreshing: the placeholder is the previous selection's result, not the SSR entry.
  const refreshing = isPlaceholderData && isFetching && data !== serverEntry();
  // Changes only with a new result: the placeholder keeps the previous result's identity,
  // so the list keeps every page it has loaded (as shimmer) until the new one is in.
  const resultKey = useMemo(() => ++resultSerial, [data]);
  const products = data?.items ?? [];
  const nextCursorRef = useRef<string | null>(null);

  useEffect(() => {
    nextCursorRef.current = data?.next ?? null;
  }, [data?.next]);

  const loadMore = useCallback(async () => {
    // The server cards' cursor belongs to another scope, and their list is
    // remounted when the scoped result lands. Page only from the scoped list.
    if (isPlaceholderData) return { items: [], next: nextCursorRef.current };
    // A chip jump flying past this section's end: the list pages once the shopper is back.
    if (jumping?.current && jumping.current.id !== category.id) {
      return { items: [], next: nextCursorRef.current };
    }
    const nextUrl = nextCursorRef.current;
    const cursorMatch = nextUrl?.match(/[?&]cursor=([^&]+)/);
    const cursor = cursorMatch ? decodeURIComponent(cursorMatch[1]) : nextUrl;
    const result = await product.list({
      ...categorySectionParams(category, { sort, filters }),
      cursor,
    });

    nextCursorRef.current = result.next;

    return result;
  }, [category, sort, filters, isPlaceholderData, jumping]);

  const held = useHeldWhileFlying(flyingOver, inView);

  if (isPending || held) {
    return (
      <div ref={ref}>
        <CategorySectionSkeleton
          heading={heading}
          count={isPending ? undefined : products.length}
        />
      </div>
    );
  }

  return (
    <div ref={ref} aria-busy={refreshing}>
      {/* Same one-line box as the skeleton. The engine still swaps the merchant
          font in; this keeps a wider fallback from wrapping the title and shoving
          the grid. */}
      {heading && (
        <h2 className="mb-4 h-6 truncate text-base font-bold leading-6">{category.name}</h2>
      )}
      <ItemsList<Product>
        // ItemsList swaps its items when resetKey changes, but only to a non-empty list:
        // an empty result remounts it into the empty state instead.
        key={products.length ? 'list' : `empty-${resultKey}`}
        items={products}
        loader={loadMore}
        mode={data?.next ? (loadMoreButton ? 'button' : 'infinite') : 'static'}
        resetKey={resultKey}
        end=""
        itemsClassName="category-products-grid grid grid-cols-3 gap-x-2 gap-y-4"
        empty={
          narrowed ? (
            <NoFilterMatches onClear={onClear} />
          ) : (
            <NoContent
              icon="sicon-shopping-bag"
              message={t('pages.categories.no_products', 'No products found in this category')}
            />
          )
        }
        t={(key, fallback) => t(key, fallback || key)}
        ariaLabel={category.name}
      >
        {(items) =>
          items.map((p, index) =>
            refreshing ? (
              <ProductCardPlaceholder key={p.id} />
            ) : (
              <ProductCard
                key={p.id}
                product={p}
                imageSizes={CATEGORY_CARD_IMAGE_SIZES}
                imagePriority={priority && index < FIRST_ROW}
              />
            )
          )
        }
      </ItemsList>
    </div>
  );
}

/** Nothing left under the drawer's selection, with the way out. */
function NoFilterMatches({ onClear }: { onClear?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <p className="text-sm text-ink">
        {t('pages.filters.no_results', 'لا توجد منتجات تطابق التصفية المختارة')}
      </p>
      <SallaButton type="button" color="primary" fill="outline" size="small" onClick={onClear}>
        {t('pages.filters.clear', 'مسح الكل')}
      </SallaButton>
    </div>
  );
}

/** A section not rendered yet, as tall as its first page once that is loaded (a finger on
 *  the chip row loads them all): a chip jump flies over it without rendering its cards, and
 *  it renders in place when it scrolls into view. */
function SectionPlaceholder({
  category,
  selection,
  heading,
}: {
  category: Category;
  selection: ListingSelection;
  heading: boolean;
}) {
  const { data } = useQuery({ ...categorySectionQuery(category, selection), enabled: false });
  return <CategorySectionSkeleton heading={heading} count={data?.items.length} />;
}

/**
 * Cards as tall as the real ones, a full first page by default: a full section loads in place.
 * It pulses as one block: an animation per bar is over a hundred per section, and starting
 * them as a chip jump reveals sections stalls the flight.
 */
function CategorySectionSkeleton({
  heading = true,
  count = PRODUCTS_PER_PAGE,
}: { heading?: boolean; count?: number } = {}) {
  return (
    <div className="animate-pulse">
      {heading && <div className="h-6 w-40 rounded bg-gray-100 mb-4" />}
      <div className="category-products-grid grid grid-cols-3 gap-x-2 gap-y-4">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="aspect-[127/120] rounded-xl bg-gray-100" />
            <div className="h-[17px] w-12 rounded bg-gray-100" />
            {/* The two-line title: 34px, no gap between its lines. */}
            <div className="flex flex-col gap-0.5">
              <div className="h-4 w-full rounded bg-gray-100" />
              <div className="h-4 w-2/3 rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Route pending state: same shell as the loaded page so nothing jumps. */
export function CategoryListSkeleton({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  return (
    <div>
      {hideHeader ? null : <CategoryHeader />}
      <div className="border-b border-neutral-100 bg-white">
        <div className="container px-4 flex gap-4 py-3">
          {['w-16', 'w-24', 'w-20', 'w-28'].map((w) => (
            <div key={w} className={`h-5 ${w} rounded bg-gray-100 animate-pulse`} />
          ))}
        </div>
      </div>
      <div className="bg-smoke">
        <div className="container px-4 flex gap-2 py-3">
          {['w-32', 'w-24', 'w-28'].map((w) => (
            <div key={w} className={`h-7 ${w} rounded-lg bg-gray-100 animate-pulse`} />
          ))}
        </div>
      </div>
      <div className="container px-4 py-4">
        <CategorySectionSkeleton />
      </div>
    </div>
  );
}
