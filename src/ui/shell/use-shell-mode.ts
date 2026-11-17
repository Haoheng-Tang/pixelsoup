import { useEffect, useState } from 'react';

export type ShellMode = 'desktop' | 'mobile';

export const MOBILE_BREAKPOINT_PX = 768;
export const COARSE_POINTER_QUERY = '(pointer: coarse)';

export function selectShellMode(viewportWidth: number, coarsePointer: boolean): ShellMode {
  return viewportWidth < MOBILE_BREAKPOINT_PX || coarsePointer ? 'mobile' : 'desktop';
}

export function readCurrentShellMode(win: Window = window): ShellMode {
  const width = win.innerWidth;
  const coarse =
    typeof win.matchMedia === 'function' ? win.matchMedia(COARSE_POINTER_QUERY).matches : false;
  return selectShellMode(width, coarse);
}

export function useShellMode(): ShellMode {
  const [mode, setMode] = useState<ShellMode>(() =>
    typeof window === 'undefined' ? 'desktop' : readCurrentShellMode(window),
  );

  useEffect(() => {
    const update = (): void => {
      setMode(readCurrentShellMode(window));
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    const media =
      typeof window.matchMedia === 'function' ? window.matchMedia(COARSE_POINTER_QUERY) : null;
    media?.addEventListener?.('change', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      media?.removeEventListener?.('change', update);
    };
  }, []);

  return mode;
}
