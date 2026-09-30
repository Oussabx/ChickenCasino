import { useEffect, useRef, useState } from 'react';
import GameShell, { GameAction } from '../components/GameShell';
import { ChipPicker } from '../components/ChipBets';
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
  const clear = () => { if (!spinning) { setBets({}); setOrder([]); } };
  const rebet = () => { if (last && !spinning) { setBets(last); setOrder(Object.keys(last)); setResult(null); } };

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
    setBets({}); setOrder([]);
    payout > total ? sfx.win() : payout > 0 ? sfx.reveal() : sfx.lose();
    setSpinning(false);
  };

  const winning = result?.n;
  const cell = (key: string, label: React.ReactNode, cls: string, extra = '') => {
    const amt = bets[key] ?? 0;
    const hit = winning !== undefined && covers(key, winning);
    return (
      <button key={key} type="button" onClick={() => place(key)} disabled={spinning} aria-label={`Bet ${key.replace('n:', '')}`}
        className={`relative grid place-items-center border border-white/15 font-display font-black transition active:scale-95 ${cls} ${hit ? 'ring-2 ring-gold ring-inset z-10 animate-pulse' : 'hover:brightness-125'} ${extra}`}>
        {label}
        {amt > 0 && <span className="pointer-events-none absolute -right-1 -top-1 z-20 min-w-[18px] animate-pop rounded-full bg-gold px-1 text-[9px] font-black leading-[18px] text-ink shadow-gold tabular">{amt >= 1000 ? `${Math.round(amt / 100) / 10}k` : amt}</span>}
      </button>
    );
  };
  const numCls = (n: number) => (REDS.has(n) ? 'bg-[#b3192a]' : 'bg-[#141414]');

  const board = (
    <div className="grid select-none text-[10px] sm:text-xs" style={{ gridTemplateColumns: 'minmax(22px,1.1fr) repeat(12, minmax(0,1fr)) minmax(26px,1.2fr)', gridTemplateRows: 'repeat(3, minmax(26px, 1fr)) minmax(24px, .9fr) minmax(24px, .9fr)' }}>
      {cell('n:0', '0', 'bg-[#0e8f4a] rounded-l-lg', 'row-span-3')}
      {[3, 2, 1].map((row, i) => [
        ...Array.from({ length: 12 }, (_, c) => { const n = c * 3 + row; return cell(`n:${n}`, n, numCls(n), ''); }),
        cell(`c${row}`, '2:1', 'bg-ink-700', `${i === 0 ? 'rounded-tr-lg' : ''} ${i === 2 ? 'rounded-br-lg' : ''}`),
      ])}
      <span />
      {cell('d1', '1st 12', 'bg-ink-700', 'col-span-4')}
      {cell('d2', '2nd 12', 'bg-ink-700', 'col-span-4')}
      {cell('d3', '3rd 12', 'bg-ink-700', 'col-span-4')}
      <span /><span />
      {cell('low', '1-18', 'bg-ink-700', 'col-span-2 rounded-bl-lg')}
      {cell('even', 'EVEN', 'bg-ink-700', 'col-span-2')}
      {cell('red', <span className="h-3 w-5 rounded-sm bg-[#d62839]" />, 'bg-ink-700', 'col-span-2')}
      {cell('black', <span className="h-3 w-5 rounded-sm bg-black ring-1 ring-white/30" />, 'bg-ink-700', 'col-span-2')}
      {cell('odd', 'ODD', 'bg-ink-700', 'col-span-2')}
      {cell('high', '19-36', 'bg-ink-700', 'col-span-2 rounded-br-lg')}
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
      <div className="pointer-events-none absolute left-3 top-3 flex max-w-[60%] flex-wrap gap-1">
        {history.map((n, i) => (
          <span key={i} className={`grid h-6 min-w-[24px] place-items-center rounded-md px-1 font-display text-[11px] font-black text-white ${i === 0 ? 'animate-pop ring-2 ring-gold' : 'opacity-80'} ${n === 0 ? 'bg-[#0e8f4a]' : REDS.has(n) ? 'bg-[#b3192a]' : 'bg-[#141414] ring-1 ring-white/20'}`}>{n}</span>
        ))}
      </div>
      {result && (
        <div className={`pointer-events-none absolute ${layout === 'side' ? 'left-[21%] top-1/2 -translate-x-1/2 -translate-y-1/2' : 'left-1/2 top-[27%] -translate-x-1/2 -translate-y-1/2'}`}>
          <div className="animate-pop rounded-2xl border border-white/20 bg-black/65 px-5 py-2.5 text-center backdrop-blur-md">
            <div className={`h-display text-4xl ${result.n === 0 ? 'text-emerald-400' : REDS.has(result.n) ? 'text-blood' : 'text-cream'}`}>{result.n}</div>
            <div className={`text-sm font-bold ${result.payout > result.total ? 'text-gold' : 'text-smoke'}`}>{result.payout > 0 ? `+${fmt(result.payout)}` : 'No win'}</div>
          </div>
        </div>
      )}
      <div className={`absolute rounded-2xl border border-white/10 bg-black/55 p-2 backdrop-blur-md ${layout === 'side' ? 'right-3 top-1/2 w-[56%] -translate-y-1/2' : 'inset-x-2 bottom-2'}`}>
        {board}
      </div>
    </GameShell>
  );
}
