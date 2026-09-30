import { createContext, useContext, useEffect, useState } from 'react';

/** True inside a game rendered in the phone "landscape game mode". */
export const PhoneGameCtx = createContext(false);
export const usePhoneGame = () => useContext(PhoneGameCtx);

const isPhone = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(pointer: coarse)').matches &&
  Math.min(window.innerWidth, window.innerHeight) <= 540;
export const isPhoneDevice = () => isPhone();
const isPortrait = () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth;

/** Phone-sized touch device (tablets and desktops excluded), and whether it's held upright. */
export function usePhoneLayout() {
  const read = () => ({ phone: isPhone(), portrait: isPortrait(), w: typeof window === 'undefined' ? 0 : window.innerWidth, h: typeof window === 'undefined' ? 0 : window.innerHeight });
  const [state, setState] = useState(read);
  useEffect(() => {
    const update = () => setState((s) => {
      const next = read();
      return next.phone === s.phone && next.portrait === s.portrait && next.w === s.w && next.h === s.h ? s : next;
    });
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    update();
    return () => { window.removeEventListener('resize', update); window.removeEventListener('orientationchange', update); };
  }, []);
  return state;
}

/**
 * Go fullscreen and lock to landscape where the browser allows it (Android Chrome).
 * Returns false when fullscreen isn't available (iPhone Safari, sandboxed previews).
 */
export async function enterLandscape(): Promise<boolean> {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
  let ok = !!document.fullscreenElement;
  try {
    if (!ok && (el.requestFullscreen || el.webkitRequestFullscreen)) { await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.()); ok = true; }
  } catch { ok = false; }
  try {
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    if (ok) await o.lock?.('landscape');
  } catch { /* not supported */ }
  return ok;
}

/** Fullscreen button: toggles fullscreen, explains when the browser doesn't allow it. */
export async function toggleFullscreen(onUnavailable: () => void) {
  if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch { /* ignore */ } return; }
  if (!(await enterLandscape())) onUnavailable();
}
