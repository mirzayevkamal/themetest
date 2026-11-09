import type { ReactNode } from 'react';
import { BackButton } from './BackButton';
import { CloseButton } from './CloseButton';
import { MobileOnly } from './MobileOnly';

/** Centered-title page header from Figma; `back={false}` for bottom-nav tabs,
 *  `backTo` for a fixed destination instead of popping history, `action` for
 *  an end-side button. The back control is mobile chrome; a drawer passes
 *  `onClose` to swap it for a close control and label the dialog. */
export function PageHeader({
  title,
  back = true,
  backTo,
  action,
  onClose,
}: {
  title: string;
  back?: boolean;
  backTo?: string;
  action?: ReactNode;
  onClose?: () => void;
}) {
  return (
    <header
      className={
        onClose
          ? 'sticky top-0 z-20 flex shrink-0 items-center gap-2 bg-white p-4 shadow-bar'
          : 'mobile-sticky-bar sticky top-0 z-20 flex shrink-0 items-center gap-2 bg-white px-4 py-2 shadow-bar'
      }
    >
      {onClose ? (
        <CloseButton onClick={onClose} />
      ) : (
        <MobileOnly>
          {back ? (
            <BackButton to={backTo} />
          ) : (
            <span className="w-11 shrink-0" aria-hidden="true" />
          )}
        </MobileOnly>
      )}
      <h1
        id={onClose ? 'drawer-title' : undefined}
        className="min-w-0 flex-1 truncate text-center text-base font-bold text-ink"
      >
        {title}
      </h1>
      {action ??
        (onClose ? (
          <span className="w-11 shrink-0" aria-hidden="true" />
        ) : (
          <MobileOnly>
            <span className="w-11 shrink-0" aria-hidden="true" />
          </MobileOnly>
        ))}
    </header>
  );
}
