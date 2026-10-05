import { useEffect, useRef, useState } from 'react';
import GameShell, { GameAction } from '../components/GameShell';
import { ALL_IN, BIG_CHIPS, ChipPicker, ChipRow } from '../components/ChipBets';
import { confirmBet } from '../components/BetControls';
import { toast, useStore } from '../store';
import { sfx } from '../lib/sound';
import { fmt } from '../lib/format';
import { rand } from '../lib/rng';
import { REDS, RouletteScene, colorOf, covers, returns } from './three/roulette3d';

type Bets = Record<string, number>;

export const QUICK: [string, string][] = [['red', 'Red'], ['black', 'Black'], ['odd', 'Odd'], ['even', 'Even'], ['low', '1–18'], ['high', '19–36'], ['d1', '1st 12'], ['d2', '2nd 12'], ['d3', '3rd 12']];

export default function Roulette() {
  const [chip, setChip] = useState(100);
  const [bets, setBets] = useState<Bets>({});
  const [order, setOrder] = useState<string[]>([]);
  const [last, setLast] = useState<Bets | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ n: number; payout: number; total: number } | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [layout, setLayout] = useState<'side' | 'top'>('side');

  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<RouletteScene | null>(null);
  const turbo = useStore((s) => s.settings.turbo);
  const total = Object.values(bets).reduce((a, b) => a + b, 0);
  const placeRef = useRef<(k: string) => void>(() => {});
  const spinningRef = useRef(false);
  spinningRef.current = spinning;

  useEffect(() => {
    const el = hostRef.current!;
    const sc = new RouletteScene(el);
    sceneRef.current = sc;
    sc.onBet((k) => placeRef.current(k), () => !spinningRef.current);
    const ro = new ResizeObserver(() => {
      const l = el.clientWidth > el.clientHeight * 1.15 ? 'side' : 'top';
      setLayout(l); sc.setLayout(l);
    });
    ro.observe(el);
    return () => { ro.disconnect(); sc.dispose(); sceneRef.current = null; };
  }, []);
  useEffect(() => { sceneRef.current?.setTurbo(turbo); }, [turbo]);

  const place = (key: string) => {
    if (spinning) return;
    if (result) setResult(null);
    const left = Math.floor(useStore.getState().balance - total);
    // All-in: everything not already on the layout
    const amount = chip === ALL_IN ? left : chip;
    if (amount <= 0 || amount > left) { toast({ title: amount <= 0 ? 'Nothing left to bet' : 'Insufficient balance', tone: 'red' }); return; }
    sfx.bet();
    setBets((b) => ({ ...b, [key]: (b[key] ?? 0) + amount }));
    setOrder((o) => [...o, `${key}|${amount}`]);
  };
  placeRef.current = place;
  // keep the 3D chips in step with the bets
  useEffect(() => { if (!spinning && !result) sceneRef.current?.setBets(bets); }, [bets, spinning, result]);
  const undo = () => {
    const last1 = order[order.length - 1]; if (!last1 || spinning) return;
    const [k, amt] = last1.split('|');
    setBets((b) => { const v = Math.max(0, (b[k] ?? 0) - +amt); const n = { ...b }; if (v) n[k] = v; else delete n[k]; return n; });
    setOrder((o) => o.slice(0, -1));
  };
  const clear = () => { if (!spinning) { setBets({}); setOrder([]); setResult(null); } };
  const rebet = () => { if (last && !spinning) { setBets(last); setOrder(Object.entries(last).map(([k, v]) => `${k}|${v}`)); setResult(null); } };

  const spin = async () => {
    const sc = sceneRef.current;
    if (!sc || spinning) return;
    if (total <= 0) { toast({ title: 'Place chips on the board first', tone: 'neutral' }); return; }
    if (!confirmBet(total) || !useStore.getState().placeBet(total)) return;
    sfx.bet();
    setSpinning(true); setResult(null);
    const n = Math.floor(rand() * 37);
    const placed = { ...bets };
    await sc.spin(n, turbo ? 2600 : 6200, () => sfx.tick(3));
    let payout = 0;
    for (const [k, v] of Object.entries(placed)) if (covers(k, n)) payout += v * returns(k);
    useStore.getState().settle('roulette', total, payout / total, `${n} ${colorOf(n)}`);
    sc.showResult(n); sc.markSettled();
    setResult({ n, payout, total });
    setHistory((h) => [n, ...h].slice(0, 14));
    setLast(placed);
    setBets({}); setOrder([]);
    payout > total ? sfx.win() : payout > 0 ? sfx.reveal() : sfx.lose();
    setSpinning(false);
  };

  const controls = (
    <>
      <div className="hidden lg:block"><ChipPicker chip={chip} setChip={setChip} total={total} onClear={clear} onUndo={undo} onRebet={last ? rebet : undefined} disabled={spinning} values={BIG_CHIPS} allIn /></div>
      <div className={spinning ? 'pointer-events-none opacity-50' : ''}>
        <div className="label mb-1.5">Quick bets <span className="normal-case tracking-normal text-smoke/70">· or tap the table</span></div>
        <div className="grid grid-cols-3 gap-1.5">
          {QUICK.map(([k, l]) => (
            <button key={k} type="button" aria-label={`Bet ${k}`} onClick={() => place(k)}
              className={`relative rounded-lg border px-2 py-2 font-display text-xs font-black transition active:scale-95 ${k === 'red' ? 'border-blood/50 bg-blood/20 text-white' : k === 'black' ? 'border-white/20 bg-black text-white' : 'border-gold/25 bg-[#0b4a2e]/60 text-gold'}`}>
              {l}
              {bets[k] ? <span className="absolute -right-1.5 -top-1.5 animate-pop rounded-full bg-gold px-1.5 text-[10px] leading-4 text-ink tabular">{bets[k] >= 1000 ? `${Math.round(bets[k] / 100) / 10}k` : bets[k]}</span> : null}
            </button>
          ))}
        </div>
      </div>
      <GameAction extra={<ChipRow chip={chip} setChip={setChip} onUndo={undo} onClear={clear} disabled={spinning} values={BIG_CHIPS} allIn />}>
        <button className="btn-gold w-full py-4 text-base" disabled={spinning} onClick={spin}>{spinning ? 'No more bets…' : total > 0 ? `Spin · ${fmt(total, 0)}` : 'Spin'}</button>
      </GameAction>
      <div className="rounded-xl bg-ink-900 p-3 text-xs text-smoke space-y-1">
        <div className="flex justify-between"><span>Single number</span><b className="text-gold">35 : 1</b></div>
        <div className="flex justify-between"><span>Dozen / column</span><b className="text-cream">2 : 1</b></div>
        <div className="flex justify-between"><span>Red/black, odd/even, 1-18/19-36</span><b className="text-cream">1 : 1</b></div>
        <div className="flex justify-between"><span>Wheel</span><b className="text-cream">European · single zero</b></div>
      </div>
    </>
  );

  return (
    <GameShell id="roulette" tall controls={controls} title="Roulette practice" subtitle="Just you and the wheel · offline" back="/games/roulette" rules={[
      'Pick a chip value and tap the board to place bets — tap again to stack more.',
      'Press Spin. The ball is launched against the wheel and drops into one of 37 pockets (0–36).',
      'Single numbers pay 35:1, dozens and columns 2:1, and red/black, odd/even, 1-18/19-36 pay 1:1. Zero loses all outside bets.',
      'Undo removes your last chip, Clear wipes the board, Rebet repeats your previous layout.',
    ]}>
      <div ref={hostRef} className="absolute inset-0" aria-label="Roulette wheel" />
      <div className="table-vignette pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[70%] flex-wrap items-center gap-1">
        {history.length > 0 && <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-smoke">Last</span>}
        {history.map((n, i) => (
          <span key={history.length - i} className={`grid h-6 min-w-[24px] place-items-center rounded-full px-1 font-display text-[11px] font-black text-white shadow ${i === 0 ? 'animate-pop ring-2 ring-gold' : 'opacity-75'} ${n === 0 ? 'bg-[#0e8f4a]' : REDS.has(n) ? 'bg-[#b3192a]' : 'bg-[#141414] ring-1 ring-white/20'}`}>{n}</span>
        ))}
      </div>
      {result && <WinDisc key={history.length} n={result.n} payout={result.payout} total={result.total} side={layout === 'side'} />}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center">
        <span className={`flex items-center gap-2 rounded-full border bg-black/70 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest backdrop-blur-md ${spinning ? 'border-blood/50 text-blood' : 'border-emerald-400/40 text-emerald-300'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${spinning ? 'bg-blood animate-pulse' : 'bg-emerald-400'}`} />
          {spinning ? 'No more bets' : total > 0 ? <>Total <b className="font-display text-gold tabular">{fmt(total, 0)}</b></> : 'Tap the table to place chips'}
        </span>
      </div>
    </GameShell>
  );
}

/** The winning number as a glowing pocket disc (the win itself is shown by WinFX). */
export function WinDisc({ n, payout, total, side }: { n: number; payout: number; total: number; side: boolean }) {
  const [docked, setDocked] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDocked(true), 1800); return () => clearTimeout(t); }, []);
  const col = n === 0 ? 'from-[#15b863] to-[#0a6b39]' : REDS.has(n) ? 'from-[#e8313f] to-[#8e1320]' : 'from-[#3a3a3a] to-[#080808]';
  const win = payout > total;
  return (
    <div className={`pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-[cubic-bezier(.2,.8,.2,1)] ${docked ? 'left-[calc(100%-64px)] top-[74px] scale-[.6]' : side ? 'left-[84%] top-1/2' : 'left-1/2 top-[80%]'}`}>
      <div className="result-in flex flex-col items-center">
        <div className={`relative grid h-24 w-24 place-items-center rounded-full bg-gradient-to-b ${col} shadow-[0_0_0_4px_#F4C430,0_0_40px_6px_rgba(244,196,48,.5)] sm:h-28 sm:w-28`}>
          {win && <span className="absolute inset-0 animate-ping rounded-full ring-4 ring-gold/60" />}
          <span className="font-display text-5xl font-black text-white drop-shadow-lg sm:text-6xl">{n}</span>
        </div>
        <div className={`mt-2 rounded-full border px-3 py-1 text-sm font-black backdrop-blur-md ${win ? 'border-gold/60 bg-black/70 text-gold' : payout > 0 ? 'border-white/20 bg-black/70 text-cream' : 'border-white/10 bg-black/60 text-smoke'}`}>
          {payout > 0 ? <span className="font-display tabular">{payout > total ? 'Winner!' : payout === total ? 'Bet back' : `${fmt(payout, 0)} back`}</span> : 'No win'}
        </div>
      </div>
    </div>
  );
}
