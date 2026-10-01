import { ReactNode, useEffect, useRef, useState } from 'react';
import { Stage3D } from '../games/three/stage';
import { fmt } from '../lib/format';

/** Pins its children over a 3D world point; follows the camera every frame. */
export function Anchor({ scene, at, children, className = '' }: { scene: Stage3D | null; at: [number, number, number]; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = at.join(',');
  useEffect(() => {
    const el = ref.current;
    if (!scene || !el) return;
    scene.anchor(el, at);
    return () => scene.anchor(el, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, key]);
  return <div ref={ref} className={`pointer-events-none absolute left-0 top-0 z-10 will-change-transform ${scene ? '' : 'invisible'} ${className}`}>{children}</div>;
}

export type Tone = 'neutral' | 'win' | 'lose' | 'push' | 'active' | 'player' | 'banker';
const TONES: Record<Tone, string> = {
  neutral: 'bg-black/70 text-cream border-white/15',
  active: 'bg-gold text-ink border-gold shadow-gold',
  win: 'bg-gradient-to-b from-gold-300 to-gold text-ink border-gold shadow-gold',
  lose: 'bg-blood/90 text-white border-blood',
  push: 'bg-cream/90 text-ink border-cream',
  player: 'bg-sky-600/90 text-white border-sky-300/60',
  banker: 'bg-blood-600/90 text-white border-blood/60',
};

/** Compact score chip that bumps whenever its value changes. */
export function HandBadge({ label, value, tone = 'neutral', sub }: { label?: string; value: ReactNode; tone?: Tone; sub?: ReactNode }) {
  return (
    <div className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-0.5 py-0.5 pr-2 shadow-lg backdrop-blur-md transition-colors duration-300 sm:gap-2 sm:px-1 sm:py-1 sm:pr-3 ${TONES[tone]} ${tone === 'lose' ? 'animate-shake' : ''}`}>
      <span key={String(value)} className={`grid h-6 min-w-[24px] place-items-center rounded-full px-1.5 font-display text-xs font-black tabular animate-pop sm:h-7 sm:min-w-[28px] sm:text-sm ${tone === 'neutral' ? 'bg-white/10' : 'bg-black/15'}`}>{value}</span>
      {label && <span className="text-[10px] font-bold uppercase tracking-wider opacity-90 sm:text-[11px]">{label}</span>}
      {sub && <span className="text-[10px] font-semibold opacity-70 sm:text-[10px]">{sub}</span>}
    </div>
  );
}

export function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!target) { setV(0); return; }
    let raf = 0; const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      setV(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

/**
 * Round result: pops in over the middle of the table, then glides down and
 * shrinks to a ribbon so the cards stay visible.
 */
export function ResultBanner({ tone, title, sub, amount, top }: { tone: 'win' | 'lose' | 'push'; title: ReactNode; sub?: ReactNode; amount?: number; big?: boolean; top?: boolean }) {
  // `top`: start docked at the top so the cards underneath stay visible (poker showdowns)
  const [docked, setDocked] = useState(!!top);
  useEffect(() => { const t = setTimeout(() => setDocked(true), 1700); return () => clearTimeout(t); }, []);
  const shown = useCountUp(amount ?? 0);
  // wins are shown by the shared WinFX animation (same in every game); this banner covers losses and pushes
  if (tone === 'win') return null;
  return (
    <div className={`pointer-events-none absolute left-1/2 z-20 transition-all duration-700 ease-[cubic-bezier(.2,.8,.2,1)] ${docked ? 'top-2 -translate-x-1/2 translate-y-0 scale-[.7] origin-top' : 'top-1/2 -translate-x-1/2 -translate-y-1/2 scale-100'}`}>
      <div className={`result-in relative overflow-hidden rounded-2xl border-2 px-5 py-2.5 text-center shadow-2xl backdrop-blur-md sm:px-7 sm:py-3 ${tone === 'push' ? 'border-white/30 bg-black/75' : 'border-blood/60 bg-gradient-to-b from-black/80 to-blood-900/85'}`}>
        <div className={`h-display whitespace-nowrap text-2xl sm:text-4xl ${tone === 'push' ? 'text-cream' : 'text-blood'}`}>{title}</div>
        {(sub || amount) && (
          <div className="mt-1 flex items-center justify-center gap-2 text-sm text-cream/85">
            {sub && <span>{sub}</span>}
            {!!amount && <b className="font-display tabular text-cream">+{fmt(shown)}</b>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Floating hint pill at the bottom of the table. */
export function TableHint({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
      <div className="animate-floaty rounded-full border border-gold/30 bg-black/70 px-4 py-2 text-center text-xs font-semibold backdrop-blur-md">{children}</div>
    </div>
  );
}
