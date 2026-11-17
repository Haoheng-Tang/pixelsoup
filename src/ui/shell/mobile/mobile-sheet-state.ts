import type { MobileSheetId } from './MobileTopBar';

/**
 * Toggles a mobile sheet from a top/bottom bar button. Re-tapping the button that opened
 * the active sheet (including sub-sheets `'onelayer'` under `'layers'` and `'edit-transform'`
 * under `'edit'`) closes it back to `'none'`.
 */
export function toggleMobileSheet(current: MobileSheetId, target: MobileSheetId): MobileSheetId {
  if (target === 'layers' && (current === 'layers' || current === 'onelayer')) {
    return 'none';
  }
  if (target === 'edit' && (current === 'edit' || current === 'edit-transform')) {
    return 'none';
  }
  return current === target ? 'none' : target;
}

/**
 * Dismisses the active mobile sheet one level up (backdrop tap, downward swipe, or Escape):
 * `'onelayer'` returns to `'layers'`, `'edit-transform'` returns to `'edit'`, and top-level
 * sheets return to `'none'`.
 */
export function dismissMobileSheet(current: MobileSheetId): MobileSheetId {
  if (current === 'onelayer') return 'layers';
  if (current === 'edit-transform') return 'edit';
  return 'none';
}
