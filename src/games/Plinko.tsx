import { useCallback, useEffect, useRef, useState } from 'react';
import GameShell from '../components/GameShell';
import BetControls, { Seg, confirmBet } from '../components/BetControls';
import { useStore } from '../store';
import { rand } from '../lib/rng';
import { sfx } from '../lib/sound';
import { itemById } from '../lib/data';
import { fmtMult } from '../lib/format';

type Risk = 'low' | 'medium' | 'high';
const ROWS = [8, 10, 12, 14, 16] as const;
type Rows = (typeof ROWS)[number];

const TABLE: Record<Rows, Record<Risk, number[]>> = {
  8: { low: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6], medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13], high: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29] },
  10: { low: [8.9, 3, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 3, 8.9], medium: [22, 5, 2, 1.4, 0.6, 0.4, 0.6, 1.4, 2, 5, 22], high: [76, 10, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 10, 76] },
  12: { low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10], medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33], high: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170] },
  14: { low: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 1.4, 1.9, 4, 7.1], medium: [58, 15, 7, 4, 1.9, 1, 0.5, 0.2, 0.5, 1, 1.9, 4, 7, 15, 58], high: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5, 18, 56, 420] },
  16: { low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16], medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110], high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000] },
};

interface Ball { id: number; path: number[]; start: number; bet: number; bucket: number; done: boolean; rows: Rows; mult: number }

const bucketColor = (i: number, n: number) => {
  const d = Math.abs(i - (n - 1) / 2) / ((n - 1) / 2); // 0 center → 1 edge
  const hue = 48 - d * 48; // gold → red
  return `hsl(${hue} ${85 + d * 5}% ${52 - d * 4}%)`;
};

export default function Plinko() {
  const [bet, setBet] = useState(useStore.getState().settings.defaultBet);
  const [risk, setRisk] = useState<Risk>('medium');
  const [rows, setRows] = useState<Rows>(12);
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const [autoCount, setAutoCount] = useState(10);
  const [autoLeft, setAutoLeft] = useState(0);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<{ id: number; m: number; i: number; n: number }[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const balls = useRef<Ball[]>([]);
  const pegHits = useRef<Map<string, number>>(new Map());
  const bucketHits = useRef<Map<number, number>>(new Map());
  const cfg = useRef({ rows, risk });
  cfg.current = { rows, risk };
  const ballSkin = useStore((s) => itemById(s.equipped.ball)?.color ?? '#F4C430');
  const skinRef = useRef(ballSkin);
  skinRef.current = ballSkin;
  const seq = useRef(0);

  const segMs = () => (useStore.getState().settings.turbo ? 60 : 110);

  const drop = useCallback(() => {
    if (!(bet > 0)) return false;
    if (!useStore.getState().placeBet(bet)) return false;
    sfx.bet();
    const r = cfg.current.rows;
    const path = Array.from({ length: r }, () => (rand() < 0.5 ? 0 : 1));
    const bucket = path.reduce<number>((a, b) => a + b, 0);
    const mult = TABLE[r][cfg.current.risk][bucket];
    balls.current.push({ id: ++seq.current, path, start: performance.now(), bet, bucket, done: false, rows: r, mult });
    setActive((a) => a + 1);
    return true;
  }, [bet]);

  // auto-drop loop
  useEffect(() => {
    if (autoLeft <= 0) return;
    const t = setTimeout(() => {
      if (drop()) setAutoLeft((n) => n - 1);
      else setAutoLeft(0);
    }, useStore.getState().settings.turbo ? 120 : 260);
    return () => clearTimeout(t);
  }, [autoLeft, drop]);

  // render loop
  useEffect(() => {
    const cv = canvasRef.current!, wrap = wrapRef.current!;
    const ctx = cv.getContext('2d')!;
    let W = 0, H = 0, raf = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = wrap.clientWidth; H = wrap.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      cv.style.width = `${W}px`; cv.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const geom = (n: number) => {
      const sp = Math.min((W * 0.92) / (n + 2), (H - 70) / (n + 1.2));
      const vs = sp * 0.95;
      const top = Math.max(36, (H - (n * vs + sp * 1.3)) / 2 + 10);
      const cx = W / 2;
      const pegR = Math.max(2.2, sp * 0.1);
      const ballR = Math.max(4, sp * 0.24);
      return { sp, vs, top, cx, pegR, ballR, bucketY: top + n * vs + sp * 0.2 };
    };

    const draw = (now: number) => {
      const n = cfg.current.rows;
      const table = TABLE[n][cfg.current.risk];
      const g = geom(n);
      ctx.clearRect(0, 0, W, H);

      // pegs
      for (let r = 0; r < n; r++) {
        for (let i = 0; i < r + 3; i++) {
          const x = g.cx + (i - (r + 2) / 2) * g.sp, y = g.top + r * g.vs;
          const hit = pegHits.current.get(`${r}:${i}`);
          const k = hit ? Math.max(0, 1 - (now - hit) / 350) : 0;
          if (k > 0) {
            ctx.beginPath(); ctx.arc(x, y, g.pegR * (2.6 + k), 0, 7);
            ctx.fillStyle = `rgba(244,196,48,${0.25 * k})`; ctx.fill();
          }
          ctx.beginPath(); ctx.arc(x, y, g.pegR, 0, 7);
          ctx.fillStyle = k > 0 ? '#FFE08A' : 'rgba(248,246,239,.85)'; ctx.fill();
        }
      }

      // buckets
      const bw = g.sp * 0.9, bh = Math.max(20, g.sp * 0.72);
      for (let i = 0; i <= n; i++) {
        const x = g.cx + (i - n / 2) * g.sp;
        const hit = bucketHits.current.get(i);
        const k = hit ? Math.max(0, 1 - (now - hit) / 300) : 0;
        const y = g.bucketY + Math.sin(k * Math.PI) * 6;
        const col = bucketColor(i, n + 1);
        ctx.save();
        ctx.shadowColor = col; ctx.shadowBlur = 6 + k * 18;
        ctx.fillStyle = col;
        roundRect(ctx, x - bw / 2, y, bw, bh, 5); ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(0,0,0,.28)';
        roundRect(ctx, x - bw / 2, y + bh - 4, bw, 4, 2); ctx.fill();
        ctx.fillStyle = '#0B0B0B';
        const m = table[i];
        const label = m >= 100 ? `${m}` : `${m}×`;
        ctx.font = `800 ${Math.max(8, Math.min(13, bw / (label.length * 0.62)))}px Montserrat, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label, x, y + bh / 2 - 1);
      }

      // balls
      const T = segMs();
      for (const b of balls.current) {
        const bg = b.rows === n ? g : geom(b.rows);
        const el = now - b.start;
        const seg = el / T; // 0..rows+1
        let x: number, y: number;
        const pt = (r: number) => {
          let k = 0; for (let j = 0; j < r; j++) k += b.path[j];
          if (r >= b.rows) return { x: bg.cx + (k - b.rows / 2) * bg.sp, y: bg.bucketY + 2 };
          return { x: bg.cx + (k - r / 2) * bg.sp, y: bg.top + r * bg.vs - bg.pegR - bg.ballR };
        };
        if (seg < 1) {
          const p = pt(0); const t = seg;
          x = p.x; y = bg.top - bg.vs * 1.2 + (p.y - (bg.top - bg.vs * 1.2)) * t * t;
        } else if (seg < b.rows + 1) {
          const r = Math.floor(seg) - 1, t = seg - Math.floor(seg);
          const a = pt(r), c = pt(r + 1);
          // register peg hit at start of segment
          const key = `${r}:${(() => { let k = 0; for (let j = 0; j < r; j++) k += b.path[j]; return k + 1; })()}`;
          if (!pegHits.current.has(key + '#' + b.id)) {
            pegHits.current.set(key + '#' + b.id, now);
            pegHits.current.set(key, now);
            sfx.tick(r);
          }
          x = a.x + (c.x - a.x) * easeOut(t) + (rand() - 0.5) * 0.3;
          y = a.y + (c.y - a.y) * t * t - Math.sin(Math.PI * t) * bg.vs * 0.28;
        } else {
          const p = pt(b.rows); x = p.x; y = p.y;
          if (!b.done) {
            b.done = true;
            bucketHits.current.set(b.bucket, now);
            const st = useStore.getState();
            st.settle('plinko', b.bet, b.mult, `${b.rows} rows · ${cfg.current.risk}`);
            b.mult >= 1 ? (b.mult >= 3 ? sfx.win() : sfx.reveal()) : sfx.lose();
            setRecent((l) => [{ id: b.id, m: b.mult, i: b.bucket, n: b.rows + 1 }, ...l].slice(0, 8));
            setActive((a) => a - 1);
          }
          continue;
        }
        ctx.save();
        ctx.shadowColor = skinRef.current; ctx.shadowBlur = 14;
        const grd = ctx.createRadialGradient(x - bg.ballR * 0.35, y - bg.ballR * 0.4, 1, x, y, bg.ballR);
        grd.addColorStop(0, '#fff'); grd.addColorStop(0.35, skinRef.current); grd.addColorStop(1, shade(skinRef.current));
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.ellipse(x, y, bg.ballR * 0.92, bg.ballR * 1.08, 0, 0, 7); ctx.fill();
        ctx.restore();
      }
      balls.current = balls.current.filter((b) => !b.done);
      // prune old peg hit markers
      if (pegHits.current.size > 600) {
        for (const [k, v] of pegHits.current) if (now - v > 2000) pegHits.current.delete(k);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  const busy = active > 0 || autoLeft > 0;

  const controls = (
    <>
      <Seg options={['manual', 'auto'] as const} value={mode} onChange={setMode} disabled={autoLeft > 0} render={(v) => (v === 'manual' ? 'Manual' : 'Auto')} />
      <BetControls value={bet} onChange={setBet} disabled={autoLeft > 0} />
      <div>
        <div className="label mb-1.5">Risk</div>
        <Seg options={['low', 'medium', 'high'] as const} value={risk} onChange={setRisk} disabled={busy} render={(v) => v[0].toUpperCase() + v.slice(1)} />
      </div>
      <div>
        <div className="label mb-1.5">Rows</div>
        <Seg options={ROWS} value={rows} onChange={setRows} disabled={busy} />
      </div>
      {mode === 'auto' && (
        <div>
          <div className="label mb-1.5">Number of drops</div>
          <Seg options={[10, 25, 50, 100] as const} value={autoCount as 10} onChange={setAutoCount} disabled={autoLeft > 0} />
        </div>
      )}
      {mode === 'manual' ? (
        <button className="btn-gold w-full py-3.5 text-base" onClick={() => confirmBet(bet) && drop()}>Drop egg</button>
      ) : autoLeft > 0 ? (
        <button className="btn-red w-full py-3.5 text-base" onClick={() => setAutoLeft(0)}>Stop auto ({autoLeft})</button>
      ) : (
        <button className="btn-gold w-full py-3.5 text-base" onClick={() => confirmBet(bet) && setAutoLeft(autoCount)}>Start auto-drop</button>
      )}
      <p className="text-[11px] text-smoke">Tip: spam the button — multiple eggs can bounce at once.</p>
    </>
  );

  return (
    <GameShell id="plinko" controls={controls} rules={[
      'Set your bet, pick a risk level and the number of peg rows.',
      'Drop a golden egg — at each peg it bounces left or right with equal odds.',
      'The slot it lands in decides your multiplier. Edges pay the most but are rarest.',
      'Higher risk = bigger edges, smaller middle. More rows = more extreme edges.',
    ]}>
      <div ref={wrapRef} className="absolute inset-0"><canvas ref={canvasRef} className="block" /></div>
      <div className="absolute right-2 top-2 sm:right-3 sm:top-3 flex flex-col gap-1.5">
        {recent.map((r) => (
          <div key={r.id} className="animate-pop rounded-lg px-2 py-1 text-center font-display text-[11px] font-black text-ink min-w-[48px]" style={{ background: bucketColor(r.i, r.n) }}>
            {fmtMult(r.m)}
          </div>
        ))}
      </div>
    </GameShell>
  );
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
function shade(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) * 0.5, g = ((n >> 8) & 255) * 0.5, b = (n & 255) * 0.5;
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
