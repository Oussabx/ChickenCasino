import { createContext, useContext, useEffect, useState } from 'react';

/** True inside a game rendered in the phone "landscape game mode". */
export const PhoneGameCtx = createContext(false);
export const usePhoneGame = () => useContext(PhoneGameCtx);

const isPhone = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(pointer: coarse)').matches &&
  Math.min(window.innerWidth, window.innerHeight) <= 540;
const isPortrait = () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth;

/** Phone-sized touch device (tablets and desktops excluded), and whether it's held upright. */
export function usePhoneLayout() {
  const [state, setState] = useState(() => ({ phone: isPhone(), portrait: isPortrait() }));
  useEffect(() => {
    const update = () => setState((s) => {
      const next = { phone: isPhone(), portrait: isPortrait() };
      return next.phone === s.phone && next.portrait === s.portrait ? s : next;
    });
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    update();
    return () => { window.removeEventListener('resize', update); window.removeEventListener('orientationchange', update); };
  }, []);
  return state;
}

/** Try to go fullscreen and lock to landscape (works on Android; iOS just rotates). */
export async function enterLandscape() {
  try {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    if (!document.fullscreenElement) await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
  } catch { /* not allowed */ }
  try {
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o.lock?.('landscape');
  } catch { /* not supported */ }
}
