import { useCallback, useEffect, useRef, useState } from 'react';
import { Shuffle, Trash2 } from 'lucide-react';
import GameShell, { GameAction } from '../components/GameShell';
import BetControls, { MiniBet, Seg, confirmBet } from '../components/BetControls';
import { ResultBanner } from '../components/TableUI';
import { toast, useStore } from '../store';
import { sfx } from '../lib/sound';
import { fmt } from '../lib/format';
import { KENO_DRAWN, KENO_MAX_SPOTS, PAYS, drawBalls, payFor, quickPick } from '../lib/keno';
import { KenoScene } from './three/keno3d';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const AUTO = [0, 5, 10, 25] as const;
const QP = [3, 5, 8, 10] as const;

export default function Keno() {
  const [bet, setBet] = useState(useStore.getState().settings.defaultBet);
  const [picks, setPicks] = useState<number[]>([]);
  const [drawn, setDrawn] = useState<number[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [result, setResult] = useState<{ catches: number; spots: number; win: number; id: number } | null>(null);
  const [qp, setQp] = useState<(typeof QP)[number]>(5);
  const [auto, setAuto] = useState<(typeof AUTO)[number]>(0);
  const [autoLeft, setAutoLeft] = useState(0);
  const [wide, setWide] = useState(true);
  const hostRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<KenoScene | null>(null);
  const busy = useRef(false);
  const seq = useRef(0);
  const autoRef = useRef(0); autoRef.current = autoLeft;

  useEffect(() => {
    const sc = new KenoScene(hostRef.current!);
    sceneRef.current = sc;
    const el = boxRef.current!;
    const ro = new ResizeObserver(() => setWide(el.clientWidth > el.clientHeight * 1.15));
    ro.observe(el);
    return () => { ro.disconnect(); sc.dispose(); sceneRef.current = null; };
  }, []);

  const toggle = (n: number) => {
    if (drawing) return;
    setResult(null);
    setPicks((p) => {
      if (p.includes(n)) { sfx.click(); return p.filter((x) => x !== n); }
      if (p.length >= KENO_MAX_SPOTS) { toast({ title: 'Ten spots is the maximum', tone: 'neutral' }); return p; }
      sfx.tick(p.length);
      return [...p, n];
    });
  };

  const play = useCallback(async () => {
    if (busy.current) return false;
    if (!picks.length) { toast({ title: 'Pick 1 to 10 numbers first', desc: 'Tap the nests on the board, or use Quick pick.', tone: 'neutral' }); return false; }
    if (!(autoRef.current > 0) && !confirmBet(bet)) return false;
    if (!useStore.getState().placeBet(bet)) return false;
    busy.current = true; setDrawing(true); setResult(null); setDrawn([]);
    sfx.bet();
    const sc = sceneRef.current;
    sc?.clear();
    const t = useStore.getState().settings.turbo;
    const gap = t ? 70 : 230;
    const balls = drawBalls();
    const set = new Set(picks);
    let catches = 0;
    await wait(t ? 120 : 380);
    for (const n of balls) {
      const hit = set.has(n);
      if (hit) catches++;
      setDrawn((d) => [...d, n]);
      sc?.lay(n, hit, t ? 260 : 620);
      hit ? sfx.reveal() : sfx.tick(1);
      await wait(gap);
    }
    await wait(t ? 200 : 600);
    const mult = payFor(picks.length, catches);
    const win = bet * mult;
    useStore.getState().settle('keno', bet, mult, `${catches} of ${picks.length} caught`);
    setResult({ catches, spots: picks.length, win, id: ++seq.current });
    if (mult >= 10) { sc?.cheer(true); } else if (mult > 1) { sfx.win(); sc?.cheer(false); } else if (mult === 0) sfx.lose();
    busy.current = false; setDrawing(false);
    return true;
  }, [picks, bet]);

  // the result ribbon clears itself so it never hides the board for long
  useEffect(() => { if (!result) return; const t = setTimeout(() => setResult(null), 3200); return () => clearTimeout(t); }, [result]);

  useEffect(() => {
    if (autoLeft <= 0 || drawing) return;
    const tm = setTimeout(async () => { const ok = await play(); setAutoLeft((n) => (ok ? n - 1 : 0)); }, useStore.getState().settings.turbo ? 500 : 1300);
    return () => clearTimeout(tm);
  }, [autoLeft, drawing, play]);

  const running = drawing || autoLeft > 0;
  const drawnSet = new Set(drawn);
  const pickSet = new Set(picks);
  const catches = picks.filter((p) => drawnSet.has(p)).length;
  const table = PAYS[picks.length];

  const controls = (
    <>
      <BetControls value={bet} onChange={setBet} disabled={running} />
      <div className={running ? 'pointer-events-none opacity-50' : ''}>
        <div className="flex items-center justify-between"><span className="label">Quick pick</span><span className="text-xs text-smoke"><b className="font-display text-cream tabular">{picks.length}</b>/10 picked</span></div>
        <div className="mt-1.5 flex gap-1.5">
          <div className="min-w-0 flex-1"><Seg options={QP} value={qp} onChange={setQp} /></div>
          <button type="button" className="btn-dark px-3 py-2 text-xs" aria-label="Quick pick" onClick={() => { setPicks(quickPick(qp)); setResult(null); setDrawn([]); sfx.reveal(); }}><Shuffle size={14} /></button>
          <button type="button" className="btn-dark px-3 py-2 text-xs" aria-label="Clear picks" onClick={() => { setPicks([]); setResult(null); setDrawn([]); }}><Trash2 size={14} /></button>
        </div>
      </div>
      <div>
        <div className="label mb-1.5">Autoplay draws</div>
        <Seg options={AUTO} value={auto} onChange={setAuto} disabled={running} render={(v) => (v ? String(v) : 'Off')} />
      </div>
      <GameAction extra={<MiniBet value={bet} onChange={setBet} disabled={running} />}>
        {autoLeft > 0 ? (
          <button className="btn-red w-full py-4 text-base" onClick={() => setAutoLeft(0)}>Stop ({autoLeft} left)</button>
        ) : (
          <button className="btn-gold w-full py-4 text-base" disabled={drawing}
            onClick={() => { if (auto) { if (picks.length && confirmBet(bet)) setAutoLeft(auto); else if (!picks.length) play(); } else play(); }}>
            {drawing ? 'Laying eggs…' : picks.length ? `Draw · ${picks.length} spot${picks.length > 1 ? 's' : ''}` : 'Pick your numbers'}
          </button>
        )}
      </GameAction>
      <div className="phone-hide rounded-xl bg-ink-900 p-3 text-xs text-smoke space-y-1">
        <div className="flex justify-between"><span>Numbers / eggs drawn</span><b className="text-cream">1–80 · 20 drawn</b></div>
        <div className="flex justify-between"><span>10 of 10</span><b className="text-gold">100,000×</b></div>
        <div className="flex justify-between"><span>Return to player</span><b className="text-cream">≈ 95% every ticket</b></div>
      </div>
    </>
  );

  const payRows = table ? table.map((p, c) => ({ c, p })).filter((r) => r.p > 0).reverse() : [];
  const payPanel = (
    <div className="rounded-xl border border-white/10 bg-black/55 p-2 backdrop-blur">
      <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-smoke">
        <span>{picks.length ? `${picks.length}-spot pays` : 'Paytable'}</span>{drawn.length > 0 && <span className="text-gold">Caught {catches}</span>}
      </div>
      {payRows.length ? (
        <div className={`grid gap-x-2 gap-y-0.5 ${wide ? 'grid-cols-1' : 'grid-cols-3'}`}>
          {payRows.map(({ c, p }) => (
            <div key={c} className={`flex items-center justify-between rounded px-1.5 py-[1px] font-display text-[11px] font-bold tabular transition ${drawn.length && c === catches ? 'bg-gold text-ink' : 'text-cream/85'}`}>
              <span>{c} hit{c === 1 ? '' : 's'}</span><span>{fmt(p, p % 1 ? 1 : 0)}×</span>
            </div>
          ))}
        </div>
      ) : <div className="py-1 text-[11px] text-smoke">Pick 1–10 nests to see what they pay.</div>}
    </div>
  );

  const board = (
    <div className="grid h-full w-full grid-cols-10 grid-rows-8 gap-[3px] sm:gap-1">
      {Array.from({ length: 80 }, (_, i) => i + 1).map((n) => {
        const p = pickSet.has(n), d = drawnSet.has(n), hit = p && d;
        return (
          <button key={n} type="button" onClick={() => toggle(n)} aria-pressed={p} aria-label={`Number ${n}${hit ? ', caught' : d ? ', drawn' : ''}`}
            className={`relative grid min-h-0 place-items-center rounded-md border font-display font-black tabular leading-none transition-all duration-200 active:scale-95 ${
              hit ? 'animate-pop border-gold bg-gradient-to-b from-gold-300 to-gold text-ink shadow-[0_0_14px_rgba(244,196,48,.75)]'
                : p ? 'border-gold/80 bg-gold/15 text-gold'
                : d ? 'border-white/10 bg-white/[0.07] text-cream/40'
                : 'border-white/10 bg-black/40 text-cream/90 hover:border-gold/50'}`}
            style={{ fontSize: 'clamp(9px, 1.5vmin + 0.4vw, 18px)' }}>
            {d && !hit && <span className="absolute h-[62%] w-[46%] rounded-[50%/60%_60%_40%_40%] bg-cream/15" aria-hidden />}
            <span className="relative">{n}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <GameShell id="keno" tall controls={controls} rules={[
      'Choose your bet, then pick 1 to 10 numbers (“spots”) from 1–80 — tap the nests, or use Quick pick.',
      'Press Draw. The hen lays 20 numbered eggs, drawn at random without repeats.',
      'Every drawn number you picked is a “catch”. You are paid by how many spots you played and how many you caught — the paytable beside the board shows it live.',
      'Payouts are “for 1”: the multiplier is the total you get back for each coin bet. 10 out of 10 pays 100,000×, and a 10-spot ticket that catches nothing returns your bet.',
      'Your picks stay on the board between draws, so you can replay the same ticket with Autoplay.',
      'Every spot count is tuned to about a 95% return, worked out exactly from the hypergeometric odds.',
    ]}>
      <div ref={boxRef} className={`absolute inset-0 flex gap-2 p-2 sm:gap-3 sm:p-3 ${wide ? 'flex-row' : 'flex-col'}`}>
        <div className={`relative min-h-0 min-w-0 ${wide ? 'flex-1' : 'order-2 flex-1'}`}>{board}</div>
        <div className={`flex min-h-0 shrink-0 flex-col gap-2 ${wide ? 'w-[36%] max-w-[320px]' : 'order-1 h-[34%] flex-row'}`}>
          <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-white/10">
            <div ref={hostRef} className="absolute inset-0" aria-label="Hen laying keno eggs" />
            <div className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-black/65 px-2 py-0.5 font-display text-[10px] font-black tracking-wider text-cream backdrop-blur">
              EGGS <span className="text-gold tabular">{drawn.length}/{KENO_DRAWN}</span>
            </div>
          </div>
          <div className={wide ? '' : 'w-[48%] overflow-hidden'}>{payPanel}</div>
        </div>
      </div>
      {result && !drawing && (
        <ResultBanner key={result.id} top tone={result.win > bet ? 'win' : result.win > 0 ? 'push' : 'lose'}
          title={result.win > 0 ? `${result.catches} of ${result.spots} · ${fmt(result.win / bet, result.win / bet % 1 ? 1 : 0)}×` : `${result.catches} of ${result.spots} caught`}
          sub={result.win > 0 ? undefined : 'No win this time'} amount={result.win > 0 ? result.win : undefined} big={result.win >= bet * 50} />
      )}
    </GameShell>
  );
}
