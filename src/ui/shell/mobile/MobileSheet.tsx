import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { BackArrowIcon } from './MobileIcons';

/** Vertical downward travel (CSS px) on the sheet header/handle that dismisses the sheet. */
export const SHEET_SWIPE_DISMISS_PX = 48;

interface MobileSheetProps {
  title: string;
  testId: string;
  onDismiss: () => void;
  onBack?: () => void;
  backTestId?: string;
  backLabel?: string;
  children: ReactNode;
}

/**
 * Modal sheet rendered inside the mobile workspace over a translucent backdrop.
 * Dismisses on backdrop tap, downward swipe on the header/pill, or Escape key.
 */
export function MobileSheet({
  title,
  testId,
  onDismiss,
  onBack,
  backTestId,
  backLabel = 'Back',
  children,
}: MobileSheetProps) {
  const swipeStart = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.key !== 'Escape') return;
      e.preventDefault();
      onDismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);

  const onHeaderPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    swipeStart.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };

  const onHeaderPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (dy >= SHEET_SWIPE_DISMISS_PX && dy > Math.abs(dx)) {
      onDismiss();
    }
  };

  return (
    <div
      className="mobile-sheet-backdrop"
      data-testid="sheet.backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss();
      }}
    >
      <section
        className="mobile-sheet"
        data-testid={testId}
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mobile-sheet-header"
          data-testid="sheet.header"
          onPointerDown={onHeaderPointerDown}
          onPointerUp={onHeaderPointerUp}
        >
          <div className="mobile-sheet-pill" aria-hidden="true" />
          <div className="mobile-sheet-title-row">
            {onBack && (
              <button
                type="button"
                className="mobile-back-button"
                data-testid={backTestId ?? 'sheet.backButton'}
                aria-label={backLabel}
                onClick={onBack}
              >
                <BackArrowIcon />
                <span>{backLabel}</span>
              </button>
            )}
            <h2 className="mobile-sheet-title">{title}</h2>
          </div>
        </div>
        <div className="mobile-sheet-body">{children}</div>
      </section>
    </div>
  );
}
