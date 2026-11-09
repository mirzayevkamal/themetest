import type { CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { menu } from '@salla.sa/twilight-theme-engine/api/menu';
import { Link } from '@salla.sa/twilight-theme-engine/common';
import { useTheme } from '@salla.sa/twilight-theme-engine/hooks/useTheme';
import { useTranslation } from '@salla.sa/twilight-theme-engine/i18n';
import type { MenuItem } from '@salla.sa/twilight-theme-engine/types';
import { useIsWebWide } from '../../hooks/useIsWebDesktop';

// Raed's header menu: past this many links the rest go under "More".
const VISIBLE_COUNT = 7;

function renderItem(item: MenuItem, isChild = false) {
  const hasChildren = Boolean(item.children?.length);
  return (
    <li
      key={item.id}
      className={`${isChild ? 'relative' : 'root-level'} ${hasChildren ? 'has-children' : ''}`}
    >
      <Link to={item.url}>
        <span>{item.title}</span>
      </Link>
      {hasChildren && (
        <div className="sub-menu w-56">
          <ul>{item.children?.map((child) => renderItem(child, true))}</ul>
        </div>
      )}
    </li>
  );
}

function HeaderMenuLinks({ color }: { color?: string }) {
  const { t } = useTranslation();
  const { data: menus = [] } = useQuery(menu.queries.header());
  if (!menus.length) return null;

  const visible = menus.slice(0, VISIBLE_COUNT);
  const hidden = menus.slice(VISIBLE_COUNT);

  return (
    <nav
      className={`desktop-header__menu w-full ${color ? 'desktop-header__menu--bar' : ''}`}
      style={color ? ({ '--header-menu-color': color } as CSSProperties) : undefined}
    >
      <ul className="main-menu">
        {visible.map((item) => renderItem(item))}
        {hidden.length > 0 && (
          <li id="more-menu-dropdown" className="root-level has-children">
            <Link to="#">
              <span>{t('common.titles.more', 'المزيد')}</span>
            </Link>
            <div className="sub-menu w-56">
              <ul>{hidden.map((item) => renderItem(item, true))}</ul>
            </div>
          </li>
        )}
      </ul>
    </nav>
  );
}

/** The store's header menu under the desktop header; off unless the merchant turns it on. */
export function HeaderMenu() {
  // Theme-specific key (twilight.json) the engine's ThemeSettings type doesn't list.
  const settings = useTheme().settings as Record<string, unknown> | undefined;
  // CSS shows the menu only on 1024px+ web desktop; the gate keeps the fetch off elsewhere.
  const wide = useIsWebWide();
  if (settings?.header_menu_enabled !== true || !wide) return null;
  // Empty keeps the menu as a row in the header; a color turns it into a full-width bar.
  const color = settings.header_menu_color;
  return <HeaderMenuLinks color={typeof color === 'string' && color ? color : undefined} />;
}
