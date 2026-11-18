import { HamburgerIcon } from './MobileIcons';
import type { MobileSheetId } from './MobileTopBar';

interface MobileBottomBarProps {
  activeSheet: MobileSheetId;
  blocked: boolean;
  onToggleSheet: (sheet: 'file' | 'edit' | 'image' | 'select' | 'menu') => void;
}

const MENU_BUTTONS: readonly {
  readonly sheet: 'file' | 'edit' | 'image' | 'select';
  readonly label: string;
  readonly testId: string;
}[] = [
  { sheet: 'file', label: 'File', testId: 'canvas.fileButton' },
  { sheet: 'edit', label: 'Edit', testId: 'canvas.editButton' },
  { sheet: 'image', label: 'Image', testId: 'canvas.imageButton' },
  { sheet: 'select', label: 'Select', testId: 'canvas.selectButton' },
];

export function MobileBottomBar({ activeSheet, blocked, onToggleSheet }: MobileBottomBarProps) {
  const isOpen = (sheet: 'file' | 'edit' | 'image' | 'select' | 'menu') =>
    activeSheet === sheet || (sheet === 'edit' && activeSheet === 'edit-transform');

  return (
    <nav className="mobile-bottom-bar" data-testid="canvas.bottomBar" aria-label="Main menus">
      {MENU_BUTTONS.map(({ sheet, label, testId }) => {
        const open = isOpen(sheet);
        return (
          <button
            key={sheet}
            type="button"
            className="mobile-bottom-button"
            data-testid={testId}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-pressed={open}
            disabled={blocked}
            onClick={() => onToggleSheet(sheet)}
          >
            {label}
          </button>
        );
      })}
      <button
        type="button"
        className="mobile-bottom-button mobile-menu-icon-button"
        data-testid="canvas.menuButton"
        aria-label="Menu"
        aria-haspopup="dialog"
        aria-expanded={isOpen('menu')}
        aria-pressed={isOpen('menu')}
        disabled={blocked}
        onClick={() => onToggleSheet('menu')}
      >
        <HamburgerIcon />
      </button>
    </nav>
  );
}
