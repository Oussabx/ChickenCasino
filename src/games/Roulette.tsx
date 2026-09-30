import { useEffect, useRef, useState } from 'react';
import GameShell, { GameAction } from '../components/GameShell';
import { ChipPicker, ChipToken } from '../components/ChipBets';
import { useCountUp } from '../components/TableUI';
import { confirmBet } from '../components/BetControls';
import { toast, useStore } from '../store';
import { sfx } from '../lib/sound';
import { fmt } from '../lib/format';
import { rand } from '../lib/rng';
import { REDS, RouletteScene, colorOf } from './three/roulette3d';

/** Bet keys: n:<0-36>, red, black, odd, even, low, high, d1-d3 (dozens), c1-c3 (columns). */
type Bets = Record<string, number>;

const covers = (key: string, n: number) => {
  if (key.startsWith('n:')) return +key.slice(2) === n;
  if (n === 0) return false;
  switch (key) {
    case 'red': return REDS.has(n);
    case 'black': return !REDS.has(n);
    case 'odd': return n % 2 === 1;
    case 'even': return n % 2 === 0;
    case 'low': return n <= 18;
    case 'high': return n >= 19;
    case 'd1': return n <= 12;
    case 'd2': return n > 12 && n <= 24;
    case 'd3': return n > 24;
    case 'c1': return n % 3 === 1;
    case 'c2': return n % 3 === 2;
    case 'c3': return n % 3 === 0;
  }
  return false;
};
/** Total returned (stake included) per unit staked. */
const returns = (key: string) => (key.startsWith('n:') ? 36 : key[0] === 'd' || key[0] === 'c' ? 3 : 2);

export default function Roulette() {
  const [chip, setChip] = useState(5);
  const [bets, setBets] = useState<Bets>({});
  const [order, setOrder] = useState<string[]>([]);
  const [last, setLast] = useState<Bets | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ n: number; payout: number; total: number } | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [layout, setLayout] = useState<'side' | 'top'>('side');
  const [hover, setHover] = useState<string | null>(null);
  const [settled, setSettled] = useState<{ bets: Bets; n: number } | null>(null);

  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<RouletteScene | null>(null);
  const turbo = useStore((s) => s.settings.turbo);
  const total = Object.values(bets).reduce((a, b) => a + b, 0);

  useEffect(() => {
    const el = hostRef.current!;
    const sc = new RouletteScene(el);
    sceneRef.current = sc;
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
    setSettled(null);
    if (total + chip > useStore.getState().balance) { toast({ title: 'Insufficient balance', tone: 'red' }); return; }
    sfx.bet();
    setBets((b) => ({ ...b, [key]: (b[key] ?? 0) + chip }));
    setOrder((o) => [...o, key]);
  };
  const undo = () => {
    const k = order[order.length - 1]; if (!k || spinning) return;
    setBets((b) => { const v = Math.max(0, (b[k] ?? 0) - chip); const n = { ...b }; if (v) n[k] = v; else delete n[k]; return n; });
    setOrder((o) => o.slice(0, -1));
  };
  const clear = () => { if (!spinning) { setBets({}); setOrder([]); setSettled(null); } };
  const rebet = () => { if (last && !spinning) { setBets(last); setOrder(Object.keys(last)); setResult(null); setSettled(null); } };

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
    setResult({ n, payout, total });
    setHistory((h) => [n, ...h].slice(0, 14));
    setLast(placed);
    setSettled({ bets: placed, n });
    setBets({}); setOrder([]);
    payout > total ? sfx.win() : payout > 0 ? sfx.reveal() : sfx.lose();
    setSpinning(false);
  };

  const winning = result?.n;
  const chipFor = (amt: number) => (amt >= 500 ? 500 : amt >= 100 ? 100 : amt >= 25 ? 25 : amt >= 5 ? 5 : 1);
  const cell = (key: string, label: React.ReactNode, cls: string, extra = '') => {
    const amt = bets[key] ?? 0;
    const ghost = !amt && settled?.bets[key] ? settled.bets[key] : 0;
    const hit = winning !== undefined && covers(key, winning);
    const lit = hover && hover !== key && key.startsWith('n:') && covers(hover, +key.slice(2));
    return (
      <button key={key} type="button" onClick={() => place(key)} disabled={spinning} aria-label={`Bet ${key.replace('n:', '')}`}
        onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(key)} onPointerLeave={() => setHover(null)}
        className={`relative grid place-items-center border-[0.5px] border-gold/30 font-display font-black text-cream transition duration-150 active:scale-95 ${cls} ${hit ? 'win-cell' : lit ? 'brightness-150 ring-1 ring-inset ring-gold/80' : 'hover:brightness-125'} ${extra}`}>
        <span className="relative z-[1] drop-shadow">{label}</span>
        {amt > 0 && (
          <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
            <span key={amt} className="chip-drop relative block">
              <ChipToken value={chipFor(amt)} size={20} />
              <span className="absolute -right-2 -top-2 rounded-full bg-black/85 px-1 text-[8px] font-black leading-[13px] text-gold tabular">{amt >= 1000 ? `${Math.round(amt / 100) / 10}k` : amt}</span>
            </span>
          </span>
        )}
        {ghost > 0 && (
          <span className={`pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 ${hit ? 'chip-win' : 'chip-lose'}`}>
            <ChipToken value={chipFor(ghost)} size={20} />
          </span>
        )}
      </button>
    );
  };
  const numCls = (n: number) => (REDS.has(n) ? 'bg-gradient-to-b from-[#d4232f] to-[#95111c]' : 'bg-gradient-to-b from-[#2a2a2a] to-[#0c0c0c]');
  const outside = 'bg-[#0b4a2e]/80 text-gold';

  const board = (
    <div className="grid select-none text-[10px] sm:text-xs" onPointerLeave={() => setHover(null)} style={{ gridTemplateColumns: 'minmax(22px,1.1fr) repeat(12, minmax(0,1fr)) minmax(26px,1.2fr)', gridTemplateRows: 'repeat(3, minmax(28px, 1fr)) minmax(26px, .9fr) minmax(26px, .9fr)' }}>
      {cell('n:0', '0', 'bg-gradient-to-b from-[#12a55a] to-[#0a6b39] rounded-l-xl', 'row-span-3')}
      {[3, 2, 1].map((row, i) => [
        ...Array.from({ length: 12 }, (_, c) => { const n = c * 3 + row; return cell(`n:${n}`, n, numCls(n), ''); }),
        cell(`c${row}`, '2:1', outside, `${i === 0 ? 'rounded-tr-xl' : ''} ${i === 2 ? 'rounded-br-xl' : ''}`),
      ])}
      <span />
      {cell('d1', '1st 12', outside, 'col-span-4')}
      {cell('d2', '2nd 12', outside, 'col-span-4')}
      {cell('d3', '3rd 12', outside, 'col-span-4')}
      <span /><span />
      {cell('low', '1-18', outside, 'col-span-2 rounded-bl-xl')}
      {cell('even', 'EVEN', outside, 'col-span-2')}
      {cell('red', <span className="block h-3 w-5 rotate-45 scale-75 rounded-sm bg-[#d62839] shadow" />, outside, 'col-span-2')}
      {cell('black', <span className="block h-3 w-5 rotate-45 scale-75 rounded-sm bg-black shadow ring-1 ring-white/40" />, outside, 'col-span-2')}
      {cell('odd', 'ODD', outside, 'col-span-2')}
      {cell('high', '19-36', outside, 'col-span-2 rounded-br-xl')}
    </div>
  );

  const controls = (
    <>
      <ChipPicker chip={chip} setChip={setChip} total={total} onClear={clear} onUndo={undo} onRebet={last ? rebet : undefined} disabled={spinning} />
      <GameAction>
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
    <GameShell id="roulette" controls={controls} rules={[
      'Pick a chip value and tap the board to place bets — tap again to stack more.',
      'Press Spin. The ball is launched against the wheel and drops into one of 37 pockets (0–36).',
      'Single numbers pay 35:1, dozens and columns 2:1, and red/black, odd/even, 1-18/19-36 pay 1:1. Zero loses all outside bets.',
      'Undo removes your last chip, Clear wipes the board, Rebet repeats your previous layout.',
    ]}>
      <div ref={hostRef} className="absolute inset-0" aria-label="Roulette wheel" />
      <div className="table-vignette pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[62%] flex-wrap items-center gap-1">
        {history.length > 0 && <span className="mr-1 text-[9px] font-bold uppercase tracking-widest text-smoke">Last</span>}
        {history.map((n, i) => (
          <span key={history.length - i} className={`grid h-6 min-w-[24px] place-items-center rounded-full px-1 font-display text-[11px] font-black text-white shadow ${i === 0 ? 'animate-pop ring-2 ring-gold' : 'opacity-75'} ${n === 0 ? 'bg-[#0e8f4a]' : REDS.has(n) ? 'bg-[#b3192a]' : 'bg-[#141414] ring-1 ring-white/20'}`}>{n}</span>
        ))}
      </div>
      {result && <WinDisc key={history.length} n={result.n} payout={result.payout} total={result.total} side={layout === 'side'} />}
      <div className={`absolute z-10 rounded-2xl border border-gold/25 bg-gradient-to-b from-[#0d3b27]/90 to-[#08261a]/90 p-2 shadow-2xl backdrop-blur-md ${layout === 'side' ? 'right-3 top-1/2 w-[56%] -translate-y-1/2' : 'inset-x-2 bottom-2'}`}>
        <div className="mb-1.5 flex items-center justify-between px-1">
          <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${spinning ? 'text-blood' : 'text-emerald-300'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${spinning ? 'bg-blood animate-pulse' : 'bg-emerald-400'}`} />{spinning ? 'No more bets' : 'Place your bets'}
          </span>
          <span className="text-[10px] font-semibold text-smoke">Total <b className="font-display text-gold tabular">{fmt(total, 0)}</b></span>
        </div>
        {board}
      </div>
    </GameShell>
  );
}

/** The winning number as a glowing pocket disc; wins count up underneath. */
function WinDisc({ n, payout, total, side }: { n: number; payout: number; total: number; side: boolean }) {
  const [docked, setDocked] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDocked(true), 1800); return () => clearTimeout(t); }, []);
  const shown = useCountUp(payout);
  const col = n === 0 ? 'from-[#15b863] to-[#0a6b39]' : REDS.has(n) ? 'from-[#e8313f] to-[#8e1320]' : 'from-[#3a3a3a] to-[#080808]';
  const win = payout > total;
  return (
    <div className={`pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-[cubic-bezier(.2,.8,.2,1)] ${side ? 'left-[22%]' : 'left-1/2'} ${docked ? (side ? 'top-[84%] scale-75' : 'top-[42%] scale-75') : side ? 'top-1/2' : 'top-[26%]'}`}>
      <div className="result-in flex flex-col items-center">
        <div className={`relative grid h-24 w-24 place-items-center rounded-full bg-gradient-to-b ${col} shadow-[0_0_0_4px_#F4C430,0_0_40px_6px_rgba(244,196,48,.5)] sm:h-28 sm:w-28`}>
          {win && <span className="absolute inset-0 animate-ping rounded-full ring-4 ring-gold/60" />}
          <span className="font-display text-5xl font-black text-white drop-shadow-lg sm:text-6xl">{n}</span>
        </div>
        <div className={`mt-2 rounded-full border px-3 py-1 text-sm font-black backdrop-blur-md ${win ? 'border-gold/60 bg-black/70 text-gold' : payout > 0 ? 'border-white/20 bg-black/70 text-cream' : 'border-white/10 bg-black/60 text-smoke'}`}>
          {payout > 0 ? <span className="font-display tabular">+{fmt(shown)}</span> : 'No win'}
        </div>
      </div>
    </div>
  );
}
