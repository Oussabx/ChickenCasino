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
function Rain({ n, kind = 'coin' }: { n: number; kind?: Particle }) {
  const parts = useMemo(() => Array.from({ length: n }, (_, i) => ({ i, x: Math.random() * 100, s: 14 + Math.random() * 18, d: Math.random() * 2.2, t: 1.4 + Math.random() * 1.1, r: Math.random() < 0.5 ? -1 : 1 })), [n]);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {parts.map((p) => (
        <span key={p.i} className="absolute -top-10" style={{ left: `${p.x}%`, animation: `winfx-rain ${p.t}s ${p.d}s ease-in infinite`, '--r': `${p.r * 540}deg` } as CSSProperties}>
          {kind === 'coin' ? <Coin size={p.s} spin={false} /> : <Glyph kind={kind} s={p.s} />}
        </span>
      ))}
    </div>
  );
}

type Particle = 'coin' | 'ember' | 'star' | 'diamond';
function Glyph({ kind, s }: { kind: Particle; s: number }) {
  if (kind === 'ember') return <span className="block rounded-full" style={{ width: s * 0.55, height: s * 0.55, background: 'radial-gradient(circle,#fff7c2,#ffb347 45%,#ff3d00 75%,transparent)', boxShadow: '0 0 12px #ff5a1f' }} />;
  if (kind === 'star') return <svg width={s} height={s} viewBox="0 0 20 20"><path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8Z" fill="#fff" /></svg>;
  return <svg width={s * 0.8} height={s} viewBox="0 0 16 20"><path d="M8 0 L16 8 L8 20 L0 8Z" fill="#a5f3fc" stroke="#e0f2fe" strokeWidth="1" /></svg>;
}

/** Big-win show themes (shop "Win FX" items). */
interface FxTheme { bg: string; rays: string; ring: string; letters?: string; rain: Particle; mixCoins: boolean; crown?: string }
const FX: Record<string, FxTheme> = {
  'fx-classic': { bg: 'radial-gradient(ellipse at center, rgba(58,11,16,.82), rgba(0,0,0,.92) 70%)', rays: 'repeating-conic-gradient(from 0deg, rgba(244,196,48,.34) 0deg 7deg, transparent 7deg 18deg)', ring: '0 0 0 4px #F4C430, 0 0 40px rgba(244,196,48,.8)', rain: 'coin', mixCoins: false },
  'fx-royal': { bg: 'radial-gradient(ellipse at center, rgba(76,29,149,.85), rgba(0,0,0,.92) 70%)', rays: 'repeating-conic-gradient(from 0deg, rgba(192,132,252,.4) 0deg 7deg, rgba(244,196,48,.25) 7deg 10deg, transparent 10deg 18deg)', ring: '0 0 0 4px #c084fc, 0 0 40px rgba(192,132,252,.9)', rain: 'coin', mixCoins: false, crown: '#F4C430' },
  'fx-inferno': { bg: 'radial-gradient(ellipse at center, rgba(160,32,6,.9), rgba(20,2,0,.95) 72%)', rays: 'repeating-conic-gradient(from 0deg, rgba(255,140,40,.45) 0deg 6deg, rgba(255,230,120,.25) 6deg 9deg, transparent 9deg 16deg)', ring: '0 0 0 4px #ff7a1a, 0 0 50px rgba(255,90,31,1)', letters: 'linear-gradient(180deg,#fff7c2 10%,#ffb347 45%,#ff3d00 90%)', rain: 'ember', mixCoins: true },
  'fx-galaxy': { bg: 'radial-gradient(ellipse at center, rgba(76,29,149,.9), rgba(3,2,15,.96) 72%)', rays: 'repeating-conic-gradient(from 0deg, rgba(56,189,248,.28) 0deg 6deg, rgba(244,114,182,.25) 6deg 10deg, transparent 10deg 18deg)', ring: '0 0 0 4px #a78bfa, 0 0 46px rgba(167,139,250,1)', letters: 'linear-gradient(180deg,#ffffff 15%,#c4b5fd 55%,#f472b6)', rain: 'star', mixCoins: true },
  'fx-diamond': { bg: 'radial-gradient(ellipse at center, rgba(14,116,144,.85), rgba(2,10,16,.95) 72%)', rays: 'repeating-conic-gradient(from 0deg, rgba(224,242,254,.4) 0deg 6deg, transparent 6deg 16deg)', ring: '0 0 0 4px #7dd3fc, 0 0 46px rgba(125,211,252,1)', letters: 'linear-gradient(180deg,#ffffff 15%,#a5f3fc 55%,#38bdf8)', rain: 'diamond', mixCoins: true },
};

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
              <div className="font-display text-[10px] font-black tracking-[.35em] text-gold/80 sm:text-[10px]">YOU WIN</div>
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
  // the equipped win show (Classic, Royal Rooster, Inferno, Cosmic, Diamond…)
  const fx = useStore((st) => FX[st.equipped.fx] ?? FX['fx-classic']);
  const title = TITLE[s.tier];
  const rain = s.tier === 'epic' ? 46 : s.tier === 'mega' ? 34 : 24;
  return (
    <div onClick={onSkip} role="presentation"
      className={`absolute inset-0 z-[46] grid cursor-pointer place-items-center overflow-hidden transition-opacity duration-300 ${leaving ? 'opacity-0' : 'opacity-100 winfx-fade-in'}`}>
      <div className="absolute inset-0" style={{ background: fx.bg }} />
      {!reduced && (
        <div className="absolute left-1/2 top-1/2 h-[220%] w-[220%] -translate-x-1/2 -translate-y-1/2"
          style={{ background: fx.rays, animation: 'winfx-spin 14s linear infinite', willChange: 'transform', maskImage: 'radial-gradient(circle, black 8%, transparent 46%)', WebkitMaskImage: 'radial-gradient(circle, black 8%, transparent 46%)' }} />
      )}
      {!reduced && <Rain n={fx.mixCoins ? Math.round(rain * 0.6) : rain} kind={fx.rain} />}
      {!reduced && fx.mixCoins && <Rain n={Math.round(rain * 0.4)} />}
      <div key={s.key} className="relative flex flex-col items-center text-center">
        <Burst n={36} spread={300} reduced={reduced} />
        <div className="relative">
          {fx.crown && <svg viewBox="0 0 60 30" className="winfx-mascot absolute -top-5 left-1/2 z-10 w-12 -translate-x-1/2 sm:-top-7 sm:w-16"><path d="M4 28 L2 6 L16 16 L30 2 L44 16 L58 6 L56 28Z" fill={fx.crown} stroke="#7a4f00" strokeWidth="2" strokeLinejoin="round" /><circle cx="30" cy="20" r="3.5" fill="#c084fc" /></svg>}
          <img src="./img/head.webp" alt="" className="winfx-mascot mb-2 h-16 w-16 rounded-full object-cover sm:h-24 sm:w-24" style={{ boxShadow: fx.ring }} />
        </div>
        <div className="h-display flex text-5xl leading-none drop-shadow-[0_5px_0_rgba(0,0,0,.75)] sm:text-8xl" aria-label={title}>
          {title.split('').map((ch, i) => (
            <span key={i} className={`winfx-letter ${fx.letters ? '' : 'text-gold-grad'}`} style={{ animationDelay: `${120 + i * 55}ms`, ...(fx.letters ? { backgroundImage: fx.letters, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : null) }}>{ch === ' ' ? ' ' : ch}</span>
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
