import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { useStore, useUI, WinEvent } from '../store';
import { sfx } from '../lib/sound';
import { fmt } from '../lib/format';
import { useCountUp } from './TableUI';

/**
 * The one win animation every game uses. It listens for winning rounds
 * (store.settle → pushWin) and plays, by size of win:
 *   WIN  (< 5×)      a gold ribbon drops in at the top with a coin burst
 *   NICE (5–15×)     a centre stamp with a bigger burst
 *   BIG / MEGA / EPIC (15× / 40× / 100×+)  a full-screen show: sunburst,
 *                    the rooster, a counting total and raining coins
 * Rapid small wins (Plinko drops, auto-bets) merge into one ribbon.
 */

type Tier = 'win' | 'nice' | 'big' | 'mega' | 'epic';
const tierOf = (m: number): Tier => (m >= 100 ? 'epic' : m >= 40 ? 'mega' : m >= 15 ? 'big' : m >= 5 ? 'nice' : 'win');
const TITLE: Record<Tier, string> = { win: 'WIN', nice: 'NICE WIN', big: 'BIG WIN', mega: 'MEGA WIN', epic: 'EPIC CLUCK' };
const HOLD: Record<Tier, number> = { win: 2300, nice: 2600, big: 4200, mega: 4800, epic: 5600 };

interface Show { key: number; tier: Tier; payout: number; bet: number; mult: number; detail?: string; count: number }

export default function WinFX() {
  const win = useUI((s) => s.win);
  const seen = useRef(win?.id ?? 0);
  const [show, setShow] = useState<Show | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number>(0);

  useEffect(() => {
    if (!win || win.id <= seen.current) return;
    seen.current = win.id;
    const big = useStore.getState().settings.bigWinCelebration;
    let tier = tierOf(win.mult);
    if (!big && tier !== 'win') tier = tier === 'nice' ? 'nice' : 'win';
    setShow((cur) => merge(cur, win, tier));
    setLeaving(false);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLeaving(true), HOLD[tier]);
    if (tier === 'big' || tier === 'mega' || tier === 'epic') sfx.bigWin();
  }, [win]);

  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => { setShow(null); setLeaving(false); }, 420);
    return () => window.clearTimeout(t);
  }, [leaving]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!show) return null;
  const skip = () => setLeaving(true);
  if (show.tier === 'win') return <Ribbon s={show} leaving={leaving} />;
  if (show.tier === 'nice') return <Stamp s={show} leaving={leaving} />;
  return <Jackpot s={show} leaving={leaving} onSkip={skip} />;
}

/** Small wins in quick succession add up instead of flickering. */
function merge(cur: Show | null, w: WinEvent, tier: Tier): Show {
  if (cur && cur.tier === 'win' && tier === 'win') {
    return { ...cur, key: cur.key, payout: cur.payout + w.payout, bet: cur.bet + w.bet, mult: Math.max(cur.mult, w.mult), count: cur.count + 1, detail: `${cur.count + 1} wins` };
  }
  return { key: w.id, tier, payout: w.payout, bet: w.bet, mult: w.mult, detail: w.detail, count: 1 };
}

const multText = (m: number) => `${m >= 100 ? fmt(m, 0) : fmt(m, m % 1 ? 2 : 0)}×`;

// ---------- pieces ----------

function Coin({ size, spin = true, style }: { size: number; spin?: boolean; style?: CSSProperties }) {
  return (
    <span className="winfx-coin" style={{ width: size, height: size, animation: spin ? 'winfx-coin-spin 1.1s linear infinite' : undefined, ...style }}>
      <span className="winfx-coin-face" />
    </span>
  );
}

/** Coins bursting out from the centre, then falling. */
function Burst({ n, spread, reduced }: { n: number; spread: number; reduced: boolean }) {
  const parts = useMemo(() => Array.from({ length: reduced ? 0 : n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const r = spread * (0.55 + Math.random() * 0.6);
    return { i, x: Math.cos(a) * r, y: Math.sin(a) * r * 0.75 - spread * 0.25, s: 12 + Math.random() * 12, d: Math.random() * 0.12, t: 0.9 + Math.random() * 0.5 };
  }), [n, spread, reduced]);
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
      {parts.map((p) => (
        <span key={p.i} className="absolute" style={{ '--x': `${p.x}px`, '--y': `${p.y}px`, animation: `winfx-burst ${p.t}s ${p.d}s cubic-bezier(.15,.7,.3,1) both` } as CSSProperties}>
          <Coin size={p.s} />
        </span>
      ))}
    </div>
  );
}

/** Coins raining down the whole game area. */
function Rain({ n }: { n: number }) {
  const parts = useMemo(() => Array.from({ length: n }, (_, i) => ({ i, x: Math.random() * 100, s: 14 + Math.random() * 18, d: Math.random() * 2.2, t: 1.4 + Math.random() * 1.1, r: Math.random() < 0.5 ? -1 : 1 })), [n]);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {parts.map((p) => (
        <span key={p.i} className="absolute -top-10" style={{ left: `${p.x}%`, animation: `winfx-rain ${p.t}s ${p.d}s ease-in infinite`, '--r': `${p.r * 540}deg` } as CSSProperties}>
          <Coin size={p.s} spin={false} />
        </span>
      ))}
    </div>
  );
}

function Amount({ value, ms, className = '' }: { value: number; ms: number; className?: string }) {
  const v = useCountUp(value, ms);
  return <span className={`tabular ${className}`}>{fmt(v)}</span>;
}

// WIN — ribbon at the top of the game
function Ribbon({ s, leaving }: { s: Show; leaving: boolean }) {
  const reduced = useStore((st) => st.settings.reduceMotion);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-[45] flex justify-center sm:top-3">
      <div key={s.key} className={`relative ${leaving ? 'winfx-out-up' : 'winfx-drop'}`}>
        <Burst n={14} spread={120} reduced={reduced} />
        <div className="winfx-border relative rounded-2xl p-[2px] shadow-[0_10px_30px_-8px_rgba(0,0,0,.9),0_0_28px_rgba(244,196,48,.45)]">
          <div className="relative flex items-center gap-2.5 overflow-hidden rounded-[14px] bg-gradient-to-b from-[#2b1e04] via-[#120c02] to-black px-3 py-1.5 sm:gap-3 sm:px-4 sm:py-2">
            <span className="shine-sweep" />
            <Coin size={26} />
            <div className="leading-none">
              <div className="font-display text-[9px] font-black tracking-[.35em] text-gold/80 sm:text-[10px]">YOU WIN</div>
              <Amount value={s.payout} ms={650} className="h-display text-xl text-gold-grad sm:text-2xl" />
              {s.detail && <div className="mt-0.5 max-w-[46vw] truncate text-[10px] font-semibold text-cream/75 sm:text-[11px]">{s.detail}</div>}
            </div>
            <span className="rounded-lg bg-gradient-to-b from-[#fff1a8] to-[#d99a00] px-2 py-1 font-display text-xs font-black text-ink shadow sm:text-sm">{multText(s.mult)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// NICE WIN — centre stamp
function Stamp({ s, leaving }: { s: Show; leaving: boolean }) {
  const reduced = useStore((st) => st.settings.reduceMotion);
  return (
    <div className="pointer-events-none absolute inset-0 z-[45] grid place-items-center">
      <div className={`absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(244,196,48,.28),rgba(0,0,0,0)_55%)] ${leaving ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`} />
      <div key={s.key} className={`relative text-center ${leaving ? 'winfx-out-scale' : 'winfx-stamp'}`}>
        <Burst n={28} spread={220} reduced={reduced} />
        <div className="winfx-border relative rounded-3xl p-[3px] shadow-[0_20px_60px_-10px_rgba(0,0,0,.95),0_0_50px_rgba(244,196,48,.55)]">
          <div className="relative overflow-hidden rounded-[21px] bg-gradient-to-b from-[#3a0b10] via-[#140608] to-black px-7 py-3 sm:px-10 sm:py-4">
            <span className="shine-sweep" />
            <div className="h-display text-3xl text-gold-grad drop-shadow-[0_3px_0_rgba(0,0,0,.7)] sm:text-5xl">{TITLE.nice}</div>
            <div className="mt-1 flex items-center justify-center gap-2">
              <Coin size={24} />
              <Amount value={s.payout} ms={1000} className="font-display text-2xl font-black text-cream sm:text-3xl" />
              <span className="rounded-lg bg-gradient-to-b from-[#fff1a8] to-[#d99a00] px-2 py-0.5 font-display text-sm font-black text-ink">{multText(s.mult)}</span>
            </div>
            {s.detail && <div className="mt-1 text-xs font-semibold text-cream/70">{s.detail}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// BIG / MEGA / EPIC — the full show
function Jackpot({ s, leaving, onSkip }: { s: Show; leaving: boolean; onSkip: () => void }) {
  const reduced = useStore((st) => st.settings.reduceMotion);
  const title = TITLE[s.tier];
  const rain = s.tier === 'epic' ? 46 : s.tier === 'mega' ? 34 : 24;
  return (
    <div onClick={onSkip} role="presentation"
      className={`absolute inset-0 z-[46] grid cursor-pointer place-items-center overflow-hidden transition-opacity duration-300 ${leaving ? 'opacity-0' : 'opacity-100 winfx-fade-in'}`}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(58,11,16,.82),rgba(0,0,0,.92)_70%)]" />
      {!reduced && (
        <div className="absolute left-1/2 top-1/2 h-[220%] w-[220%] -translate-x-1/2 -translate-y-1/2"
          style={{ background: `repeating-conic-gradient(from 0deg, rgba(244,196,48,${s.tier === 'epic' ? 0.42 : 0.3}) 0deg 7deg, transparent 7deg 18deg)`, animation: 'winfx-spin 14s linear infinite', maskImage: 'radial-gradient(circle, black 8%, transparent 46%)', WebkitMaskImage: 'radial-gradient(circle, black 8%, transparent 46%)' }} />
      )}
      {!reduced && <Rain n={rain} />}
      <div key={s.key} className="relative flex flex-col items-center text-center">
        <Burst n={36} spread={300} reduced={reduced} />
        <img src="./img/head.webp" alt="" className="winfx-mascot mb-2 h-16 w-16 rounded-full object-cover shadow-[0_0_0_4px_#F4C430,0_0_40px_rgba(244,196,48,.8)] sm:h-24 sm:w-24" />
        <div className="h-display flex text-5xl leading-none drop-shadow-[0_5px_0_rgba(0,0,0,.75)] sm:text-8xl" aria-label={title}>
          {title.split('').map((ch, i) => (
            <span key={i} className="winfx-letter text-gold-grad" style={{ animationDelay: `${120 + i * 55}ms` }}>{ch === ' ' ? ' ' : ch}</span>
          ))}
        </div>
        <div className="winfx-rise mt-3 flex items-center gap-3" style={{ animationDelay: '600ms' }}>
          <Coin size={34} />
          <Amount value={s.payout} ms={2200} className="font-display text-4xl font-black text-cream drop-shadow-[0_3px_0_rgba(0,0,0,.7)] sm:text-6xl" />
        </div>
        <div className="winfx-rise mt-2 flex items-center gap-2" style={{ animationDelay: '800ms' }}>
          <span className="rounded-lg bg-gradient-to-b from-[#fff1a8] to-[#d99a00] px-2.5 py-0.5 font-display text-base font-black text-ink shadow-gold sm:text-lg">{multText(s.mult)}</span>
          {s.detail && <span className="text-sm font-semibold text-cream/80">{s.detail}</span>}
        </div>
        <div className="mt-5 text-[10px] font-bold uppercase tracking-[.3em] text-cream/40">Tap to continue</div>
      </div>
    </div>
  );
}
