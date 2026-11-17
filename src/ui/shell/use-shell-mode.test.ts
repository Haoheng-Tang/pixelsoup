import { describe, expect, it } from 'vitest';
import {
  COARSE_POINTER_QUERY,
  MOBILE_BREAKPOINT_PX,
  readCurrentShellMode,
  selectShellMode,
} from './use-shell-mode';

describe('selectShellMode', () => {
  it('selects desktop when width >= 768 and pointer is fine', () => {
    expect(selectShellMode(768, false)).toBe('desktop');
    expect(selectShellMode(1440, false)).toBe('desktop');
  });

  it('selects mobile when width < 768 even with a fine pointer', () => {
    expect(selectShellMode(767, false)).toBe('mobile');
    expect(selectShellMode(375, false)).toBe('mobile');
  });

  it('selects mobile when primary pointer is coarse even on wide screens', () => {
    expect(selectShellMode(1024, true)).toBe('mobile');
    expect(selectShellMode(768, true)).toBe('mobile');
    expect(selectShellMode(390, true)).toBe('mobile');
  });

  it('exposes the 768px breakpoint and coarse pointer media query', () => {
    expect(MOBILE_BREAKPOINT_PX).toBe(768);
    expect(COARSE_POINTER_QUERY).toBe('(pointer: coarse)');
  });
});

describe('readCurrentShellMode', () => {
  it('reads innerWidth and matchMedia from the given window', () => {
    const desktopWin = {
      innerWidth: 1280,
      matchMedia: (q: string) => ({ matches: q === COARSE_POINTER_QUERY ? false : false }),
    } as unknown as Window;
    expect(readCurrentShellMode(desktopWin)).toBe('desktop');

    const tabletWin = {
      innerWidth: 1024,
      matchMedia: (q: string) => ({ matches: q === COARSE_POINTER_QUERY }),
    } as unknown as Window;
    expect(readCurrentShellMode(tabletWin)).toBe('mobile');

    const narrowNoMatchMedia = {
      innerWidth: 600,
    } as unknown as Window;
    expect(readCurrentShellMode(narrowNoMatchMedia)).toBe('mobile');
  });
});
