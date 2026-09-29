import { useEffect, useRef, useState } from 'react';
import GameShell from '../components/GameShell';
import BetControls, { confirmBet } from '../components/BetControls';
import { useStore } from '../store';
import { rand, pick, randInt } from '../lib/rng';
import { sfx } from '../lib/sound';
import { BOT_NAMES } from '../lib/data';
import { fmt, fmtMult } from '../lib/format';
import { Coin } from '../components/Icons';
import { Users } from 'lucide-react';

type Phase = 'waiting' | 'running' | 'crashed';
const WAIT_MS = 6000;
const GROWTH = 0.00007; // multiplier = e^(GROWTH * ms)

const genCrash = () => {
  const u = rand();
  if (u < 0.01) return 1; // instant bust
  return Math.max(1, Math.floor((0.99 / (1 - u)) * 100) / 100);
};
const multAt = (ms: number) => Math.exp(GROWTH * ms);
const msFor = (m: number) => Math.log(m) / GROWTH;

interface Player { name: string; bet: number; target: number; cashed: number | null; you?: boolean }

export default function Crash() {
  const [bet, setBet] = useState(useStore.getState().settings.defaultBet);
  const [auto, setAuto] = useState(2);
  const [autoOn, setAutoOn] = useState(false);
  const [phase, setPhase] = useState<Phase>('waiting');
  const [mult, setMult] = useState(1);
  const [countdown, setCountdown] = useState(WAIT_MS);
  const [history, setHistory] = useState<number[]>(() => Array.from({ length: 12 }, genCrash));
  const [players, setPlayers] = useState<Player[]>([]);
  const [my, setMy] = useState<{ bet: number; cashed: number | null } | null>(null);
  const [queued, setQueued] = useState<number | null>(null);

  const cv = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const st = useRef({ phase: 'waiting' as Phase, start: performance.now(), crash: genCrash(), crashAt: 0, mult: 1 });
  const myRef = useRef(my); myRef.current = my;
  const autoRef = useRef({ autoOn, auto }); autoRef.current = { autoOn, auto };
  const queuedRef = useRef(queued); queuedRef.current = queued;
  const imgRef = useRef<HTMLImageElement>();
  const feathers = useRef<{ x: number; y: number; vx: number; vy: number; r: number; vr: number; c: string }[]>([]);

  useEffect(() => { const i = new Image(); i.src = './img/head.webp'; imgRef.current = i; }, []);

  const spawnBots = () =>
    Array.from({ length: randInt(6, 12) }, () => ({
      name: pick(BOT_NAMES), bet: pick([5, 10, 25, 50, 100, 250, 500, 1000]),
      target: +(1.1 + Math.pow(rand(), 2) * 6).toFixed(2), cashed: null,
    }));

  const joinRound = (amount: number) => {
    if (!useStore.getState().placeBet(amount)) return false;
    sfx.bet();
    setMy({ bet: amount, cashed: null });
    setPlayers((p) => [{ name: useStore.getState().user?.name ?? 'You', bet: amount, target: 0, cashed: null, you: true }, ...p.filter((x) => !x.you)]);
    return true;
  };

  const cashOut = (at?: number) => {
    const m = myRef.current;
    if (!m || m.cashed || st.current.phase !== 'running') return;
    const x = +(at ?? st.current.mult).toFixed(2);
    setMy({ ...m, cashed: x });
    setPlayers((p) => p.map((pl) => (pl.you ? { ...pl, cashed: x } : pl)));
    useStore.getState().settle('crash', m.bet, x, `Cashed at ${x}×`);
    sfx.cashout();
  };

  // game loop
  useEffect(() => {
    const c = cv.current!, w = wrap.current!, ctx = c.getContext('2d')!;
    let W = 0, H = 0, raf = 0, lastTick = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = w.clientWidth; H = w.clientHeight;
      c.width = W * dpr; c.height = H * dpr; c.style.width = `${W}px`; c.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(w);
    setPlayers(spawnBots());
    const stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() * 1.4 + 0.3 }));

    const loop = (now: number) => {
      const s = st.current;
      const el = now - s.start;
      if (s.phase === 'waiting') {
        const left = WAIT_MS - el;
        setCountdown(left);
        if (left <= 0) {
          s.phase = 'running'; s.start = now; s.mult = 1;
          setPhase('running');
          if (s.crash <= 1) { /* instant bust handled below */ }
        }
      } else if (s.phase === 'running') {
        s.mult = multAt(el);
        const m = myRef.current;
        if (m && !m.cashed && autoRef.current.autoOn && autoRef.current.auto > 1 && s.mult >= autoRef.current.auto && autoRef.current.auto <= s.crash) {
          cashOut(autoRef.current.auto);
        }
        if (s.mult >= s.crash) {
          s.mult = s.crash; s.phase = 'crashed'; s.crashAt = now; s.start = now;
          setPhase('crashed'); setMult(s.crash);
          setHistory((h) => [s.crash, ...h].slice(0, 20));
          sfx.crash();
          const m2 = myRef.current;
          if (m2 && !m2.cashed) useStore.getState().settle('crash', m2.bet, 0, `Fried at ${s.crash}×`);
          // feathers
          const tip = tipPos(W, H, s.crash, s.crash);
          feathers.current = Array.from({ length: 40 }, () => ({ x: tip.x, y: tip.y, vx: (Math.random() - 0.5) * 9, vy: (Math.random() - 0.9) * 8, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: pick(['#F8F6EF', '#F4C430', '#E63946', '#fff']) }));
        } else {
          if (now - lastTick > 90) { setMult(s.mult); lastTick = now; }
          setPlayers((p) => (p.some((pl) => !pl.you && !pl.cashed && pl.target <= s.mult) ? p.map((pl) => (!pl.you && !pl.cashed && pl.target <= s.mult ? { ...pl, cashed: pl.target } : pl)) : p));
        }
      } else if (s.phase === 'crashed' && el > 3200) {
        s.phase = 'waiting'; s.start = now; s.crash = genCrash(); s.mult = 1;
        setPhase('waiting'); setMult(1); setMy(null);
        setPlayers(spawnBots());
        // queued bet from previous round
        const q = queuedRef.current;
        if (q) { setQueued(null); setTimeout(() => joinRound(q), 50); }
      }
      draw(ctx, W, H, s, now, stars);
      raf = requestAnimationFrame(loop);
    };

    const draw = (ctx: CanvasRenderingContext2D, W: number, H: number, s: typeof st.current, now: number, stars: { x: number; y: number; s: number }[]) => {
      ctx.clearRect(0, 0, W, H);
      const m = s.phase === 'waiting' ? 1 : s.mult;
      const scaleM = Math.max(2, m * 1.15);
      // parallax stars
      const speed = s.phase === 'running' ? (now - s.start) / 40 : 0;
      ctx.fillStyle = '#fff';
      for (const st of stars) {
        const x = ((st.x * W - speed * st.s * 0.6) % W + W) % W;
        const y = ((st.y * H + speed * st.s * 0.25) % H);
        ctx.globalAlpha = 0.15 + st.s * 0.25; ctx.fillRect(x, y, st.s, st.s);
      }
      ctx.globalAlpha = 1;
      // grid + axis labels
      const pad = { l: 44, b: 30, t: 20, r: 20 };
      ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
      ctx.font = '600 10px Inter, sans-serif'; ctx.fillStyle = 'rgba(160,160,160,.7)'; ctx.textAlign = 'right';
      const steps = niceSteps(scaleM);
      for (const v of steps) {
        const y = H - pad.b - ((v - 1) / (scaleM - 1)) * (H - pad.b - pad.t);
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
        ctx.fillText(`${v}×`, pad.l - 6, y + 3);
      }
      if (s.phase === 'waiting') return;
      // curve
      const tMax = msFor(m);
      const tScale = Math.max(msFor(scaleM), 8000);
      const pts: [number, number][] = [];
      const N = 80;
      for (let i = 0; i <= N; i++) {
        const t = (tMax * i) / N;
        const mm = multAt(t);
        pts.push([pad.l + (t / tScale) * (W - pad.l - pad.r), H - pad.b - ((mm - 1) / (scaleM - 1)) * (H - pad.b - pad.t)]);
      }
      const crashed = s.phase === 'crashed';
      const col = crashed ? '#E63946' : '#F4C430';
      const grd = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
      grd.addColorStop(0, crashed ? 'rgba(230,57,70,.45)' : 'rgba(244,196,48,.4)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.moveTo(pts[0][0], H - pad.b);
      pts.forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.lineTo(pts[N][0], H - pad.b); ctx.closePath(); ctx.fillStyle = grd; ctx.fill();
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.shadowColor = col; ctx.shadowBlur = 16; ctx.stroke(); ctx.shadowBlur = 0;
      // rooster at tip
      const [tx, ty] = pts[N];
      const [px, py] = pts[N - 3];
      const ang = Math.atan2(ty - py, tx - px);
      if (!crashed) {
        ctx.save(); ctx.translate(tx, ty); ctx.rotate(ang);
        // flame
        const fl = 18 + Math.sin(now / 40) * 6;
        const fg = ctx.createLinearGradient(-fl - 20, 0, -14, 0);
        fg.addColorStop(0, 'rgba(230,57,70,0)'); fg.addColorStop(0.5, '#E63946'); fg.addColorStop(1, '#FFE08A');
        ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(-14, -6); ctx.quadraticCurveTo(-fl - 20, 0, -14, 6); ctx.fill();
        ctx.restore();
        const img = imgRef.current;
        const sz = Math.min(64, Math.max(40, W / 12));
        ctx.save(); ctx.translate(tx, ty); ctx.rotate(ang * 0.4);
        ctx.shadowColor = '#F4C430'; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(0, 0, sz / 2, 0, 7); ctx.fillStyle = '#0B0B0B'; ctx.fill();
        ctx.strokeStyle = '#F4C430'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.shadowBlur = 0;
        ctx.clip();
        if (img?.complete) ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
        ctx.restore();
      } else {
        // explosion
        const k = Math.min(1, (now - s.crashAt) / 400);
        ctx.beginPath(); ctx.arc(tx, ty, 10 + k * 50, 0, 7);
        ctx.fillStyle = `rgba(230,57,70,${0.5 * (1 - k)})`; ctx.fill();
        for (const f of feathers.current) {
          f.x += f.vx; f.y += f.vy; f.vy += 0.15; f.vx *= 0.98; f.r += f.vr;
          ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.r);
          ctx.fillStyle = f.c; ctx.beginPath(); ctx.ellipse(0, 0, 7, 2.5, 0, 0, 7); ctx.fill();
          ctx.restore();
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inRound = !!my && !my.cashed && phase === 'running';
  const canBetNow = phase === 'waiting' && !my;

  let action;
  if (inRound) {
    action = (
      <button className="btn-gold w-full py-4 text-base animate-pulse" onClick={() => cashOut()}>
        Cash out <span className="tabular">{fmt(my!.bet * mult)}</span>
      </button>
    );
  } else if (canBetNow) {
    action = <button className="btn-gold w-full py-4 text-base" onClick={() => confirmBet(bet) && joinRound(bet)}>Place bet</button>;
  } else if (my && phase === 'waiting') {
    action = <button className="btn-dark w-full py-4 text-base" disabled>Bet placed — waiting…</button>;
  } else if (queued) {
    action = <button className="btn-red w-full py-4 text-base" onClick={() => setQueued(null)}>Cancel next-round bet</button>;
  } else {
    action = <button className="btn-ghost w-full py-4 text-base" onClick={() => setQueued(bet)}>Bet next round</button>;
  }

  const controls = (
    <>
      <BetControls value={bet} onChange={setBet} disabled={!!my && phase !== 'crashed'} />
      <div>
        <div className="flex items-center justify-between">
          <span className="label">Auto cash out</span>
          <button onClick={() => setAutoOn((a) => !a)} className={`relative h-6 w-11 rounded-full transition ${autoOn ? 'bg-gold' : 'bg-ink-500'}`} aria-label="Toggle auto cash out" aria-pressed={autoOn}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-ink transition-all ${autoOn ? 'left-[22px]' : 'left-0.5 bg-cream'}`} />
          </button>
        </div>
        <div className={`mt-1.5 flex items-center rounded-xl border border-white/10 bg-ink-900 px-3 ${autoOn ? '' : 'opacity-50'}`}>
          <input type="number" step="0.1" min="1.01" value={auto} onChange={(e) => setAuto(Math.max(1.01, parseFloat(e.target.value) || 1.01))}
            className="w-full bg-transparent py-2.5 font-display font-bold outline-none tabular" disabled={!autoOn} aria-label="Auto cash out multiplier" />
          <span className="text-smoke font-bold">×</span>
        </div>
      </div>
      {action}
      {my && (
        <div className={`rounded-xl p-3 text-sm ${my.cashed ? 'bg-emerald-500/10 text-emerald-300' : phase === 'crashed' ? 'bg-blood/10 text-blood' : 'bg-ink-700'}`}>
          {my.cashed ? `Cashed out at ${fmtMult(my.cashed)} · +${fmt(my.bet * my.cashed - my.bet)}` : phase === 'crashed' ? `Fried! Lost ${fmt(my.bet)}` : `In play: ${fmt(my.bet)}`}
        </div>
      )}
      <div>
        <div className="flex items-center justify-between label mb-2"><span className="flex items-center gap-1.5"><Users size={12} />{players.length} players</span><span>{fmt(players.reduce((a, p) => a + p.bet, 0), 0)}</span></div>
        <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
          {players.map((p, i) => (
            <div key={i} className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs ${p.you ? 'bg-gold/10 border border-gold/30' : 'bg-ink-700/60'}`}>
              <span className={`truncate max-w-[110px] ${p.you ? 'font-bold text-gold' : ''}`}>{p.name}</span>
              <span className="flex items-center gap-1 tabular"><Coin className="h-3 w-3" />{p.bet}</span>
              <span className={`w-14 text-right font-bold tabular ${p.cashed ? 'text-emerald-400' : phase === 'crashed' ? 'text-blood' : 'text-smoke'}`}>
                {p.cashed ? fmtMult(p.cashed) : phase === 'crashed' ? '💥' : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <GameShell id="crash" controls={controls} rules={[
      'Place a bet during the countdown (or queue one for the next round).',
      'The rooster takes off and the multiplier climbs from 1.00×.',
      'Cash out at any time to lock in bet × current multiplier.',
      'If the rooster gets fried before you cash out, the bet is lost. Set auto cash out to play it safe.',
    ]}>
      <div className="absolute inset-x-0 top-0 z-10 flex gap-1.5 overflow-x-auto no-scrollbar p-3">
        {history.map((h, i) => (
          <span key={i} className={`chip shrink-0 tabular ${h >= 10 ? 'bg-gold text-ink' : h >= 2 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-blood/15 text-blood'} ${i === 0 ? 'animate-pop' : ''}`}>{fmtMult(h)}</span>
        ))}
      </div>
      <div ref={wrap} className="absolute inset-0 top-10"><canvas ref={cv} className="block" /></div>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {phase === 'waiting' ? (
          <div className="text-center">
            <div className="label">Next flight in</div>
            <div className="h-display text-5xl sm:text-6xl text-cream tabular">{(countdown / 1000).toFixed(1)}s</div>
            <div className="mx-auto mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-ink-500"><div className="h-full bg-gold" style={{ width: `${(countdown / WAIT_MS) * 100}%` }} /></div>
          </div>
        ) : (
          <div className={`text-center ${phase === 'crashed' ? 'animate-shake' : ''}`}>
            <div className={`h-display text-6xl sm:text-8xl tabular ${phase === 'crashed' ? 'text-blood neon-red' : 'text-cream'}`}>{fmt(mult)}×</div>
            {phase === 'crashed' && <div className="mt-2 font-display font-black tracking-[.3em] text-blood">FRIED!</div>}
          </div>
        )}
      </div>
    </GameShell>
  );
}

function tipPos(W: number, H: number, m: number, scale: number) {
  const scaleM = Math.max(2, scale * 1.15);
  const pad = { l: 44, b: 30, t: 20, r: 20 };
  const tScale = Math.max(msFor(scaleM), 8000);
  return { x: pad.l + (msFor(m) / tScale) * (W - pad.l - pad.r), y: H - pad.b - ((m - 1) / (scaleM - 1)) * (H - pad.b - pad.t) };
}

function niceSteps(max: number) {
  const span = max - 1;
  const raw = span / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = 1; v <= max + 1e-9; v += step) out.push(+v.toFixed(2));
  return out;
}
