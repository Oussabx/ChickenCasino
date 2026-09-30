import { useEffect, useRef, useState } from 'react';
import GameShell, { GameAction } from '../components/GameShell';
import { BetSpot, ChipPicker } from '../components/ChipBets';
import { confirmBet } from '../components/BetControls';
import { toast, useStore } from '../store';
import { sfx } from '../lib/sound';
import { fmt } from '../lib/format';
import { Card, Shoe, bacTotal, dealBaccarat } from '../lib/cards';
import { Card3D, TableScene } from './three/table3d';

type Spot = 'player' | 'banker' | 'tie' | 'pp' | 'bp';
type Bets = Partial<Record<Spot, number>>;
const PAYS: Record<Spot, number> = { player: 2, banker: 1.95, tie: 9, pp: 12, bp: 12 };
const SPOT_POS: Record<Spot, [number, number]> = { player: [-2.6, 1.7], tie: [0, 2.1], banker: [2.6, 1.7], pp: [-4.6, 1.1], bp: [4.6, 1.1] };
const P_X = -2.1, B_X = 2.1, CARD_Z = -0.7;

interface Result { winner: 'player' | 'banker' | 'tie'; pt: number; bt: number; pp: boolean; bp: boolean }

export default function Baccarat({ variant = 'classic' }: { variant?: 'classic' | 'punto' }) {
  const punto = variant === 'punto';
  const id = punto ? 'punto-banco' : 'baccarat';
  const spots: Spot[] = punto ? ['pp', 'player', 'tie', 'banker', 'bp'] : ['player', 'tie', 'banker'];
  const [chip, setChip] = useState(5);
  const [bets, setBets] = useState<Bets>({});
  const [history, setHistory] = useState<Spot[]>([]); // placement order for undo
  const [last, setLast] = useState<Bets | null>(null);
  const [dealing, setDealing] = useState(false);
  const [totals, setTotals] = useState<{ p: number | null; b: number | null }>({ p: null, b: null });
  const [result, setResult] = useState<(Result & { payout: number; total: number }) | null>(null);
  const [road, setRoad] = useState<Result[]>([]);

  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TableScene | null>(null);
  const shoe = useRef(new Shoe(8));
  const turbo = useStore((s) => s.settings.turbo);
  const total = Object.values(bets).reduce((a, b) => a + (b ?? 0), 0);

  useEffect(() => {
    const sc = new TableScene(hostRef.current!, {
      felt: punto ? 0x123a6b : 0x6b1020,
      text: punto ? ['PUNTO BANCO', 'PAIRS PAY 11 TO 1 · TIE PAYS 8 TO 1'] : ['BACCARAT', 'BANKER PAYS 0.95 TO 1 · TIE PAYS 8 TO 1'],
      sub: 'PLAYER                                   BANKER',
    });
    sceneRef.current = sc;
    return () => { sc.dispose(); sceneRef.current = null; };
  }, [punto]);
  useEffect(() => { sceneRef.current?.setTurbo(turbo); }, [turbo]);

  const place = (s: Spot) => {
    if (dealing) return;
    if (result) { sceneRef.current?.clear(); setResult(null); setTotals({ p: null, b: null }); }
    const bal = useStore.getState().balance;
    if (total + chip > bal) { toast({ title: 'Insufficient balance', tone: 'red' }); return; }
    sfx.bet();
    const next = { ...bets, [s]: (bets[s] ?? 0) + chip };
    setBets(next); setHistory((h) => [...h, s]);
    sceneRef.current?.setChips(s, next[s]!, ...SPOT_POS[s]);
  };
  const undo = () => {
    const s = history[history.length - 1]; if (!s || dealing) return;
    const next = { ...bets, [s]: Math.max(0, (bets[s] ?? 0) - chip) };
    setBets(next); setHistory((h) => h.slice(0, -1));
    sceneRef.current?.setChips(s, next[s]!, ...SPOT_POS[s]);
  };
  const clear = () => { if (dealing) return; setBets({}); setHistory([]); spots.forEach((s) => sceneRef.current?.setChips(s, 0, 0, 0)); };
  const rebet = () => {
    if (!last || dealing) return;
    sceneRef.current?.clear(); setResult(null); setTotals({ p: null, b: null });
    setBets(last); setHistory(Object.keys(last) as Spot[]);
    (Object.entries(last) as [Spot, number][]).forEach(([s, v]) => sceneRef.current?.setChips(s, v, ...SPOT_POS[s]));
  };

  const deal = async () => {
    const sc = sceneRef.current;
    if (!sc || dealing) return;
    if (total <= 0) { toast({ title: 'Place a bet on Player, Banker or Tie first', tone: 'neutral' }); return; }
    if (!confirmBet(total) || !useStore.getState().placeBet(total)) return;
    setDealing(true); setResult(null); setTotals({ p: null, b: null });
    // sweep old cards but keep this round's chips
    const keep = { ...bets };
    sc.clear();
    (Object.entries(keep) as [Spot, number][]).forEach(([s, v]) => sc.setChips(s, v, ...SPOT_POS[s]));

    const coup = dealBaccarat(() => shoe.current.draw());
    const shown: { player: Card[]; banker: Card[] } = { player: [], banker: [] };
    const idx = { player: 0, banker: 0 };
    const meshes: { c3: Card3D; card: Card; side: 'player' | 'banker' }[] = [];
    for (const step of coup.order) {
      const i = idx[step.side]++;
      const third = i === 2;
      const x = (step.side === 'player' ? P_X : B_X) + (third ? (step.side === 'player' ? -1.25 : 1.25) : (i - 0.5) * 0.95);
      const z = CARD_Z + (third ? 0.25 : 0);
      if (punto) {
        await sc.deal(step.card, x, z, { rot: third ? Math.PI / 2 : 0 });
        shown[step.side].push(step.card);
        setTotals({ p: shown.player.length ? bacTotal(shown.player) : null, b: shown.banker.length ? bacTotal(shown.banker) : null });
        sfx.tick();
      } else {
        const c3 = await sc.deal(null, x, z, { rot: third ? Math.PI / 2 : 0 });
        meshes.push({ c3, card: step.card, side: step.side });
        sfx.tick();
        // classic: squeeze the first four together, then any third cards one by one
        if (meshes.length === 4 || i === 2) {
          for (const m of meshes.splice(0)) {
            await sc.flip(m.c3, m.card, true);
            shown[m.side].push(m.card);
            setTotals({ p: shown.player.length ? bacTotal(shown.player) : null, b: shown.banker.length ? bacTotal(shown.banker) : null });
            sfx.reveal();
          }
        }
      }
    }

    const r: Result = { winner: coup.winner, pt: coup.pt, bt: coup.bt, pp: coup.player[0].r === coup.player[1].r, bp: coup.banker[0].r === coup.banker[1].r };
    let payout = 0;
    const b = keep;
    if (r.winner === 'player') payout += (b.player ?? 0) * PAYS.player;
    if (r.winner === 'banker') payout += (b.banker ?? 0) * PAYS.banker;
    if (r.winner === 'tie') payout += (b.tie ?? 0) * PAYS.tie + (b.player ?? 0) + (b.banker ?? 0); // P/B push on a tie
    if (r.pp) payout += (b.pp ?? 0) * PAYS.pp;
    if (r.bp) payout += (b.bp ?? 0) * PAYS.bp;
    const label = r.winner === 'tie' ? `Tie ${r.pt}–${r.bt}` : `${r.winner === 'player' ? 'Player' : 'Banker'} ${Math.max(r.pt, r.bt)}–${Math.min(r.pt, r.bt)}`;
    useStore.getState().settle(id, total, payout / total, label);
    setResult({ ...r, payout, total });
    setRoad((l) => [...l, r].slice(-60));
    setLast(keep);
    setBets({}); setHistory([]);
    payout > total ? sfx.win() : payout === total ? sfx.click() : sfx.lose();
    sc.celebrate(r.winner === 'player' ? P_X : r.winner === 'banker' ? B_X : 0, CARD_Z, payout > total, r.winner === 'tie' ? 3.4 : 1.4);
    setDealing(false);
  };

  const spotResult = (s: Spot): 'win' | 'lose' | null => {
    if (!result) return null;
    const won = s === result.winner || (s === 'pp' && result.pp) || (s === 'bp' && result.bp);
    return won ? 'win' : 'lose';
  };

  const betArea = (
    <div className={`grid gap-2 ${punto ? 'grid-cols-5' : 'grid-cols-3'}`}>
      {spots.map((s) => (
        <BetSpot key={s} disabled={dealing} amount={bets[s] ?? 0} onClick={() => place(s)} highlight={spotResult(s)}
          label={{ player: 'Player', banker: 'Banker', tie: 'Tie', pp: 'P Pair', bp: 'B Pair' }[s]}
          sub={{ player: '1:1', banker: '0.95:1', tie: '8:1', pp: '11:1', bp: '11:1' }[s]}
          className={s === 'player' ? '!border-sky-400/40' : s === 'banker' ? '!border-blood/50' : s === 'tie' ? '!border-emerald-400/40' : ''} />
      ))}
    </div>
  );

  const controls = (
    <>
      <ChipPicker chip={chip} setChip={setChip} total={total} onClear={clear} onUndo={undo} onRebet={last ? rebet : undefined} disabled={dealing} />
      <div className="hidden lg:block">
        <div className="label mb-1.5">Place your bets</div>
        {betArea}
      </div>
      <GameAction extra={<div className="lg:hidden">{betArea}</div>}>
        <button className="btn-gold w-full py-4 text-base" disabled={dealing} onClick={deal}>{dealing ? 'Dealing…' : total > 0 ? `Deal · ${fmt(total, 0)}` : 'Deal'}</button>
      </GameAction>
      <Road road={road} />
    </>
  );

  return (
    <GameShell id={id} controls={controls} rules={punto ? [
      'Click Player, Banker or Tie (and optionally the pair side bets) to place chips, then Deal.',
      'Two cards each; the hand closest to 9 wins. Tens and faces count 0, aces 1. Third cards follow the fixed Punto Banco table.',
      'Player pays 1:1, Banker 0.95:1 (5% commission), Tie 8:1. On a tie, Player/Banker bets are returned.',
      'Player Pair / Banker Pair pay 11:1 if that side’s first two cards are the same rank.',
    ] : [
      'Place chips on Player, Banker or Tie, then Deal.',
      'Cards are dealt face down and squeezed open slowly. The hand closest to 9 wins; tens and faces count 0, aces 1.',
      'Third cards are drawn automatically by the standard baccarat rules.',
      'Player pays 1:1, Banker 0.95:1, Tie 8:1 (Player/Banker bets push on a tie). The bead road tracks every coup.',
    ]}>
      <div ref={hostRef} className="absolute inset-0" aria-label={`${punto ? 'Punto Banco' : 'Baccarat'} table`} />
      <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center gap-4">
        <TotalBadge label="Player" value={totals.p} color="text-sky-300" win={result?.winner === 'player'} />
        <TotalBadge label="Banker" value={totals.b} color="text-blood" win={result?.winner === 'banker'} />
      </div>
      {result && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
          <div className={`animate-pop rounded-2xl border px-6 py-3 text-center backdrop-blur-md ${result.payout > result.total ? 'border-gold/60 bg-black/60' : 'border-white/20 bg-black/60'}`}>
            <div className="h-display text-3xl sm:text-4xl">
              {result.winner === 'tie' ? <span className="text-emerald-400">TIE {result.pt}–{result.bt}</span>
                : <span className={result.winner === 'player' ? 'text-sky-300' : 'text-blood'}>{result.winner.toUpperCase()} WINS {Math.max(result.pt, result.bt)}</span>}
            </div>
            <div className="mt-1 text-sm text-cream/85">{result.payout > 0 ? `Paid ${fmt(result.payout)}` : `Lost ${fmt(result.total)}`}{(result.pp || result.bp) && punto ? ` · ${[result.pp && 'Player pair', result.bp && 'Banker pair'].filter(Boolean).join(' & ')}!` : ''}</div>
          </div>
        </div>
      )}
      {!result && !dealing && total === 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
          <div className="animate-floaty rounded-full bg-black/60 px-4 py-2 text-xs font-semibold backdrop-blur">Pick a chip and tap Player, Banker or Tie</div>
        </div>
      )}
    </GameShell>
  );
}

function TotalBadge({ label, value, color, win }: { label: string; value: number | null; color: string; win?: boolean }) {
  return (
    <div className={`min-w-[84px] rounded-xl px-3 py-1.5 text-center backdrop-blur transition ${win ? 'bg-gold/90 text-ink shadow-gold scale-110' : 'bg-black/60'}`}>
      <div className={`text-[10px] font-bold uppercase tracking-wider ${win ? 'text-ink/70' : color}`}>{label}</div>
      <div className="font-display text-2xl font-black tabular leading-none">{value ?? '–'}</div>
    </div>
  );
}

/** Bead plate: one dot per coup, 6 rows high, filled column by column. */
function Road({ road }: { road: Result[] }) {
  const cols = 12, rows = 6;
  const start = Math.max(0, road.length - cols * rows);
  const cells = road.slice(start);
  const p = road.filter((r) => r.winner === 'player').length, b = road.filter((r) => r.winner === 'banker').length, t = road.length - p - b;
  return (
    <div className="rounded-xl bg-ink-900 p-3">
      <div className="flex items-center justify-between text-[11px]">
        <span className="label">Bead road</span>
        <span className="flex gap-2 font-bold tabular"><span className="text-sky-300">P {p}</span><span className="text-blood">B {b}</span><span className="text-emerald-400">T {t}</span></span>
      </div>
      <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, 1fr)`, gridAutoFlow: 'column' }}>
        {Array.from({ length: cols * rows }).map((_, i) => {
          const r = cells[i];
          return (
            <span key={i} className={`grid aspect-square place-items-center rounded-full text-[8px] font-black ${!r ? 'bg-white/[0.04]' : r.winner === 'player' ? 'bg-sky-500 text-white' : r.winner === 'banker' ? 'bg-blood text-white' : 'bg-emerald-500 text-ink'}`}>
              {r ? (r.winner === 'tie' ? r.pt : r.winner === 'player' ? r.pt : r.bt) : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}
