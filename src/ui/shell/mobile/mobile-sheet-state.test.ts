import { describe, expect, it } from 'vitest';
import { dismissMobileSheet, toggleMobileSheet } from './mobile-sheet-state';

describe('mobile-sheet-state', () => {
  it('opens a sheet and closes it when its button is tapped again', () => {
    expect(toggleMobileSheet('none', 'file')).toBe('file');
    expect(toggleMobileSheet('file', 'file')).toBe('none');
    expect(toggleMobileSheet('file', 'select')).toBe('select');
  });

  it('closes sub-sheets when their parent bar button is tapped again', () => {
    expect(toggleMobileSheet('layers', 'layers')).toBe('none');
    expect(toggleMobileSheet('onelayer', 'layers')).toBe('none');
    expect(toggleMobileSheet('edit', 'edit')).toBe('none');
    expect(toggleMobileSheet('edit-transform', 'edit')).toBe('none');
  });

  it('dismisses one level up from onelayer and edit-transform, and to none from top-level sheets', () => {
    expect(dismissMobileSheet('onelayer')).toBe('layers');
    expect(dismissMobileSheet('layers')).toBe('none');
    expect(dismissMobileSheet('edit-transform')).toBe('edit');
    expect(dismissMobileSheet('edit')).toBe('none');
    expect(dismissMobileSheet('file')).toBe('none');
    expect(dismissMobileSheet('select')).toBe('none');
    expect(dismissMobileSheet('image')).toBe('none');
    expect(dismissMobileSheet('menu')).toBe('none');
    expect(dismissMobileSheet('options')).toBe('none');
  });
});
