import { ReactNode, forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { LINE_COLORS, PAYLINES, REELS, ROWS, STRIPS, SYMBOLS, Sym } from '../lib/slots';
import { loadSlotArt, symbolUrl } from './three/slotArt';
import { fmt } from '../lib/format';

/**
 * Golden Coop's machine, drawn in the page (not WebGL) so every symbol is
 * pixel-sharp and win frames sit exactly on their cells. Each reel is a
 * moving strip: windup, spin with motion blur, then a bouncy stop.
 */

export interface MachineHandle {
  spin(stops: number[], o?: { turbo?: boolean; tease?: boolean[]; onStop?: (r: number) => void }): Promise<void>;
  showWins(lines: number[], cells: [number, number][], scatter?: [number, number][]): void;
  clear(): void;
}

const VISIBLE = ROWS + 2; // one spare cell above and below the window
const mod = (a: number, n: number) => ((a % n) + n) % n;
const easeOutBack = (k: number, c = 1.25) => 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);

// ---- symbol images (2× resolution, plus a motion-blurred copy) ----
type Urls = { sharp: Record<Sym, string>; blur: Record<Sym, string> };
let urlCache: Urls | null = null;
let urlPromise: Promise<Urls> | null = null;
export function loadMachineArt() {
  if (urlCache) return Promise.resolve(urlCache);
  urlPromise ??= loadSlotArt().then(() => document.fonts?.ready).then(() => {
    const scale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    urlCache = {
      sharp: Object.fromEntries(SYMBOLS.map((s) => [s, symbolUrl(s, { scale })])) as Record<Sym, string>,
      blur: Object.fromEntries(SYMBOLS.map((s) => [s, symbolUrl(s, { blur: true })])) as Record<Sym, string>,
    };
    return urlCache;
  });
  return urlPromise;
}

interface Reel { p: number; shift: number; vel: number; phase: 'idle' | 'windup' | 'spin' | 'stop'; t0: number; from: number; to: number; dur: number; stopAt: number; target: number; speed: number; done?: () => void }

const SlotMachine = forwardRef<MachineHandle, {
  free: boolean;
  jackpot: number;
  freeInfo?: ReactNode;
  footer: ReactNode;
  initialStops?: number[];
}>(function SlotMachine({ free, jackpot, freeInfo, footer, initialStops }, ref) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [cell, setCell] = useState(90);
  const [compact, setCompact] = useState(false);
  const cellRef = useRef(90);
  const imgs = useRef<HTMLImageElement[][]>(Array.from({ length: REELS }, () => []));
  const strips = useRef<HTMLDivElement[]>([]);
  const reels = useRef<Reel[]>(STRIPS.map((s, r) => ({ p: initialStops?.[r] ?? Math.floor(Math.random() * s.length), shift: 0, vel: 0, phase: 'idle', t0: 0, from: 0, to: 0, dur: 0, stopAt: 0, target: 0, speed: 20 })));
  const urls = useRef<Urls | null>(urlCache);
  const [ready, setReady] = useState(!!urlCache);
  const [win, setWin] = useState<{ lines: number[]; cells: Set<string>; scatter: Set<string>; id: number } | null>(null);
  const [tease, setTease] = useState<boolean[]>([]);
  const winSeq = useRef(0);

  // size everything from one number: the cell edge in px
  useLayoutEffect(() => {
    const el = rootRef.current!;
    const fit = () => {
      const W = el.clientWidth, H = el.clientHeight;
      const tight = H < 480;
      const c = Math.floor(Math.min((W - 20) / 5.62, (H - 12) / (tight ? 4.62 : 5.05)));
      cellRef.current = Math.max(36, c); setCell(cellRef.current); setCompact(tight);
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { loadMachineArt().then((u) => { urls.current = u; setReady(true); }); }, []);

  /** Write one reel's strip position + symbols straight to the DOM. */
  const draw = (r: number) => {
    const u = urls.current; if (!u) return;
    const reel = reels.current[r], L = STRIPS[r].length, c = cellRef.current;
    const base = Math.floor(reel.p), f = reel.p - base;
    const blur = Math.abs(reel.vel) > 7;
    const strip = strips.current[r];
    if (strip) strip.style.transform = `translate3d(0, ${((f - 1) * c).toFixed(2)}px, 0)`;
    imgs.current[r].forEach((img, k) => {
      const sym = STRIPS[r][mod(base + 2 - k + reel.shift, L)];
      const src = blur ? u.blur[sym] : u.sharp[sym];
      if (img.dataset.src !== src) { img.src = src; img.dataset.src = src; img.dataset.sym = sym; }
    });
  };

  useEffect(() => { if (ready) for (let r = 0; r < REELS; r++) draw(r); });

  // animation loop
  useEffect(() => {
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      reels.current.forEach((reel, r) => {
        if (reel.phase === 'idle' || now < reel.t0) return;
        const L = STRIPS[r].length;
        if (reel.phase === 'windup') {
          const k = Math.min(1, (now - reel.t0) / 150);
          reel.p = reel.from - Math.sin(k * Math.PI) * 0.22; reel.vel = 0;
          if (k >= 1) { reel.phase = 'spin'; reel.vel = 5; }
        } else if (reel.phase === 'spin') {
          reel.vel = Math.min(reel.speed, reel.vel + dt * 80);
          reel.p += reel.vel * dt;
          if (now >= reel.stopAt) {
            const dur = 0.4, c = 1.25;
            const T = Math.ceil(reel.p + Math.max(1.5, (reel.vel * dur) / (c + 3)));
            reel.shift = mod(reel.target - T, L); // remapped while blurred — invisible
            reel.phase = 'stop'; reel.from = reel.p; reel.to = T; reel.t0 = now; reel.dur = dur * 1000;
          }
        } else {
          const k = Math.min(1, (now - reel.t0) / reel.dur);
          const prev = reel.p;
          reel.p = reel.from + (reel.to - reel.from) * easeOutBack(k);
          reel.vel = (reel.p - prev) / Math.max(dt, 1e-3);
          if (k >= 1) {
            reel.p = reel.to; reel.vel = 0; reel.phase = 'idle';
            const b = Math.floor(reel.p / L) * L; reel.p -= b; reel.shift = mod(reel.shift + b, L);
            draw(r);
            const d = reel.done; reel.done = undefined; d?.();
            return;
          }
        }
        draw(r);
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useImperativeHandle(ref, () => ({
    spin(stops, o = {}) {
      setWin(null);
      const now = performance.now();
      let extra = 0;
      const t = !!o.turbo;
      setTease([]);
      return Promise.all(reels.current.map((reel, r) => new Promise<void>((res) => {
        if (o.tease?.[r]) extra += t ? 500 : 1100;
        Object.assign(reel, { phase: 'windup', t0: now + r * (t ? 25 : 60), from: reel.p, target: stops[r], speed: t ? 30 : 22, stopAt: now + (t ? 340 : 820) + r * (t ? 110 : 290) + extra });
        reel.done = () => {
          o.onStop?.(r);
          setTease((tz) => { const n = [...tz]; n[r] = false; if (o.tease?.[r + 1]) n[r + 1] = true; return n; });
          res();
        };
      }))).then(() => setTease([]));
    },
    showWins(lines, cells, scatter = []) {
      setWin({ lines, cells: new Set(cells.map(([r, row]) => `${r}:${row}`)), scatter: new Set(scatter.map(([r, row]) => `${r}:${row}`)), id: ++winSeq.current });
    },
    clear() { setWin(null); },
  }), []);

  // win styling on the resting symbols (cell k = row + 1)
  useEffect(() => {
    imgs.current.forEach((col, r) => col.forEach((img, k) => {
      const row = k - 1;
      const on = !!win && (win.cells.has(`${r}:${row}`) || win.scatter.has(`${r}:${row}`));
      img.classList.toggle('slot-pop', on);
      img.style.filter = win && !on && row >= 0 && row < ROWS ? 'saturate(.35) brightness(.5)' : '';
    }));
  }, [win]);

  const gap = Math.round(cell * 0.06);
  const pad = Math.round(cell * 0.075);
  const W = REELS * cell + (REELS - 1) * gap, H = ROWS * cell;
  const cx = (r: number) => r * (cell + gap) + cell / 2;
  const cy = (row: number) => row * cell + cell / 2;
  const radius = Math.round(cell * 0.2);

  return (
    <div ref={rootRef} className="absolute inset-0 overflow-hidden select-none"
      style={{ background: free ? 'radial-gradient(ellipse at 50% 40%, #6b0f22 0%, #2a0610 55%, #08030a 100%)' : 'radial-gradient(ellipse at 50% 38%, #4a0d18 0%, #1c0709 55%, #070405 100%)' }}>
      {/* slow light rays + floating sparkles behind the machine */}
      <div className="pointer-events-none absolute left-1/2 top-[42%] h-[180%] w-[180%] -translate-x-1/2 -translate-y-1/2 opacity-40"
        style={{ background: 'repeating-conic-gradient(from 0deg, rgba(244,196,48,.22) 0deg 6deg, transparent 6deg 18deg)', animation: 'winfx-spin 60s linear infinite', maskImage: 'radial-gradient(circle, black 10%, transparent 55%)', WebkitMaskImage: 'radial-gradient(circle, black 10%, transparent 55%)' }} />
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} className="pointer-events-none absolute h-1 w-1 rounded-full bg-gold/70 shadow-[0_0_8px_2px_rgba(244,196,48,.6)]"
          style={{ left: `${(i * 53) % 100}%`, bottom: '-4%', animation: `slot-float ${7 + (i % 5)}s ${i * 0.7}s linear infinite` }} />
      ))}

      <div className="relative flex h-full w-full flex-col items-center justify-center" style={{ gap: compact ? cell * 0.06 : cell * 0.1 }}>
        {/* header: mascot + title + jackpot */}
        <div className="flex items-center justify-center" style={{ gap: cell * 0.16, height: compact ? cell * 0.62 : cell * 0.8 }}>
          <img src="./img/head.webp" alt="" className="rounded-full object-cover shadow-[0_0_0_3px_#F4C430,0_0_24px_rgba(244,196,48,.6)]" style={{ width: compact ? cell * 0.56 : cell * 0.74, height: compact ? cell * 0.56 : cell * 0.74 }} />
          <div className="h-display whitespace-nowrap text-gold-grad leading-none drop-shadow-[0_3px_0_rgba(0,0,0,.7)]" style={{ fontSize: compact ? cell * 0.36 : cell * 0.42 }}>Golden Coop</div>
          <div className="relative overflow-hidden rounded-xl border-2 border-gold bg-black/65 text-center shadow-[0_0_18px_rgba(244,196,48,.35)]" style={{ padding: `${cell * 0.04}px ${cell * 0.14}px` }}>
            <span className="shine-sweep" />
            <div className="font-display font-black uppercase tracking-[.25em] text-gold/80" style={{ fontSize: Math.max(10, cell * 0.11) }}>Mega jackpot</div>
            <div className="font-display font-black text-gold-grad tabular leading-tight" style={{ fontSize: Math.max(12, cell * 0.24) }}><Ticker value={jackpot} /></div>
          </div>
        </div>

        {/* gold frame */}
        <div className="relative" style={{
          padding: pad, borderRadius: radius + pad,
          background: free ? 'linear-gradient(135deg,#ffd0d5,#e63946 28%,#ffe27a 50%,#b3192a 74%,#ffd0d5)' : 'linear-gradient(135deg,#fff3b8,#c98a00 28%,#ffe27a 50%,#9c6200 74%,#ffeaa8)',
          boxShadow: `0 ${cell * 0.3}px ${cell * 0.6}px -${cell * 0.2}px rgba(0,0,0,.9), 0 0 ${cell * 0.6}px ${free ? 'rgba(230,57,70,.45)' : 'rgba(244,196,48,.28)'}`,
        }}>
          {freeInfo && <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1/2">{freeInfo}</div>}
          <div className="relative" style={{ padding: pad, borderRadius: radius, background: 'linear-gradient(180deg,#14070a,#0a0405)', boxShadow: 'inset 0 2px 10px rgba(0,0,0,.9)' }}>
            <div className="relative flex" style={{ gap, width: W, height: H }}>
              {Array.from({ length: REELS }, (_, r) => (
                <div key={r} className={`relative overflow-hidden ${tease[r] ? 'slot-tease' : ''}`}
                  style={{ width: cell, height: H, borderRadius: cell * 0.12, background: 'linear-gradient(180deg,#25090f 0%,#3a1019 50%,#25090f 100%)' }}>
                  <div ref={(el) => { if (el) strips.current[r] = el; }} className="absolute inset-x-0 top-0 will-change-transform">
                    {Array.from({ length: VISIBLE }, (_, k) => (
                      <div key={k} className="grid place-items-center" style={{ height: cell }}>
                        <img ref={(el) => { if (el) imgs.current[r][k] = el; }} alt="" draggable={false}
                          className="pointer-events-none drop-shadow-[0_4px_6px_rgba(0,0,0,.6)] transition-[filter] duration-300" style={{ width: cell * 0.9, height: cell * 0.85, objectFit: 'contain' }} />
                      </div>
                    ))}
                  </div>
                  {/* drum shading: dark top & bottom, a soft sheen across the middle */}
                  <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.72) 0%, rgba(0,0,0,0) 22%, rgba(255,255,255,.05) 50%, rgba(0,0,0,0) 78%, rgba(0,0,0,.72) 100%)' }} />
                </div>
              ))}

              {/* winning cell frames */}
              {win && [...win.cells, ...win.scatter].map((key) => {
                const [r, row] = key.split(':').map(Number);
                const sc = win.scatter.has(key) && !win.cells.has(key);
                return (
                  <div key={`${win.id}-${key}`} className="slot-frame pointer-events-none absolute rounded-xl border-[3px]"
                    style={{ left: r * (cell + gap) + 2, top: row * cell + 2, width: cell - 4, height: cell - 4, borderColor: sc ? '#ff5a67' : '#ffd84d', boxShadow: `0 0 ${cell * 0.18}px ${sc ? 'rgba(230,57,70,.85)' : 'rgba(244,196,48,.85)'}, inset 0 0 ${cell * 0.15}px ${sc ? 'rgba(230,57,70,.5)' : 'rgba(244,196,48,.45)'}` }} />
                );
              })}

              {/* paylines */}
              {win && win.lines.length > 0 && (
                <svg key={win.id} className="pointer-events-none absolute inset-0 overflow-visible" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
                  <defs>
                    <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={cell * 0.05} result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                  </defs>
                  {win.lines.map((li) => {
                    const pts = PAYLINES[li].map((row, r) => `${cx(r)},${cy(row)}`);
                    const all = [`${-pad},${cy(PAYLINES[li][0])}`, ...pts, `${W + pad},${cy(PAYLINES[li][4])}`].join(' ');
                    return (
                      <g key={li} filter="url(#lineGlow)">
                        <polyline points={all} fill="none" stroke="rgba(0,0,0,.55)" strokeWidth={cell * 0.085} strokeLinejoin="round" strokeLinecap="round" />
                        <polyline points={all} fill="none" stroke={LINE_COLORS[li]} strokeWidth={cell * 0.05} strokeLinejoin="round" strokeLinecap="round" className="slot-line" pathLength={1} />
                      </g>
                    );
                  })}
                </svg>
              )}
              {/* line numbers for the winning lines */}
              {win && win.lines.map((li) => (
                <span key={`n${li}`} className="pointer-events-none absolute z-10 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full font-display font-black text-ink shadow"
                  style={{ left: -pad / 2 - 1, top: cy(PAYLINES[li][0]), width: cell * 0.26, height: cell * 0.26, fontSize: cell * 0.13, background: LINE_COLORS[li] }}>{li + 1}</span>
              ))}
            </div>
          </div>
        </div>

        {/* win meter */}
        <div style={{ minHeight: compact ? cell * 0.5 : cell * 0.66 }} className="flex items-center">{footer}</div>
      </div>
    </div>
  );
});

export default SlotMachine;

/** A number that rolls up smoothly to its new value (the growing jackpot). */
export function Ticker({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const a = from.current, b = value;
    if (a === b) return;
    let raf = 0; const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 900);
      const v = a + (b - a) * (1 - Math.pow(1 - k, 3));
      setShown(v); from.current = v;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{fmt(shown, shown >= 100 ? 0 : 2)}</>;
}
