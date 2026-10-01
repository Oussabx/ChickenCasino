import { useEffect, useRef, useState } from 'react';
import GameShell, { GameAction } from '../components/GameShell';
import { BetSpot, ChipPicker } from '../components/ChipBets';
import { confirmBet } from '../components/BetControls';
import { toast, useStore } from '../store';
import { sfx } from '../lib/sound';
import { fmt } from '../lib/format';
import { Card, Shoe, bacTotal, dealBaccarat } from '../lib/cards';
import { Card3D, TableScene, Zone } from './three/table3d';
import { Anchor, HandBadge, ResultBanner, TableHint } from '../components/TableUI';

type Spot = 'player' | 'banker' | 'tie' | 'pp' | 'bp';
type Bets = Partial<Record<Spot, number>>;
const PAYS: Record<Spot, number> = { player: 2, banker: 1.95, tie: 9, pp: 12, bp: 12 };
const BET_Z = 1.4;
const SPOT_POS: Record<Spot, [number, number]> = { player: [-2.45, BET_Z], tie: [0, BET_Z], banker: [2.45, BET_Z], pp: [-0.72, 0.34], bp: [0.72, 0.34] };
const P_X = -2.05, B_X = 2.05, CARD_Z = -1.05;
const SKY = 'rgba(125,211,252,.85)', RED = 'rgba(255,107,117,.9)', GREEN = 'rgba(110,231,183,.85)', GOLD = 'rgba(244,196,48,.85)';

export function tableFor(punto: boolean) {
  const zones: Zone[] = [
    { x: P_X, z: CARD_Z, w: 2.5, h: 1.85, label: 'PLAYER', labelAt: 'above', color: SKY, fill: 'rgba(56,189,248,.06)' },
    { x: B_X, z: CARD_Z, w: 2.5, h: 1.85, label: 'BANKER', labelAt: 'above', color: RED, fill: 'rgba(230,57,70,.07)' },
    { id: 'player', x: SPOT_POS.player[0], z: BET_Z, w: 2.3, h: 1.05, label: 'PLAYER', sub: 'PAYS 1 : 1', color: SKY, fill: 'rgba(56,189,248,.12)' },
    { id: 'tie', x: 0, z: BET_Z, w: 2.2, h: 1.05, label: 'TIE', sub: 'PAYS 8 : 1', color: GREEN, fill: 'rgba(16,185,129,.12)' },
    { id: 'banker', x: SPOT_POS.banker[0], z: BET_Z, w: 2.3, h: 1.05, label: 'BANKER', sub: 'PAYS 0.95 : 1', color: RED, fill: 'rgba(230,57,70,.14)' },
  ];
  if (punto) zones.push(
    { id: 'pp', x: SPOT_POS.pp[0], z: SPOT_POS.pp[1], r: 0.38, label: 'P PAIR', sub: '11 : 1', color: GOLD },
    { id: 'bp', x: SPOT_POS.bp[0], z: SPOT_POS.bp[1], r: 0.38, label: 'B PAIR', sub: '11 : 1', color: GOLD },
  );
  return {
    felt: punto ? 0x103866 : 0x6a0f1e, zones, logoZ: null,
    texts: [{ text: punto ? 'PUNTO BANCO' : 'BACCARAT', z: -2.28, size: punto ? 0.22 : 0.28 }],
    view: { wide: [-0.3, 10.2, 5.9] as [number, number, number], narrow: [-0.4, 7.9, 6.2] as [number, number, number] },
  };
}

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
  const [scene, setScene] = useState<TableScene | null>(null);
  const placeRef = useRef<(s: Spot) => void>(() => {});
  const dealingRef = useRef(false);
  dealingRef.current = dealing;
  const shoe = useRef(new Shoe(8));
  const turbo = useStore((s) => s.settings.turbo);
  const total = Object.values(bets).reduce((a, b) => a + (b ?? 0), 0);

  useEffect(() => {
    const sc = new TableScene(hostRef.current!, tableFor(punto));
    sc.onZoneClick((id) => placeRef.current(id as Spot), () => !dealingRef.current);
    sceneRef.current = sc; setScene(sc);
    return () => { sc.dispose(); sceneRef.current = null; setScene(null); };
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
    sceneRef.current?.pulseZone(s);
  };
  placeRef.current = place;
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
    sc.clear(true);

    const coup = dealBaccarat(() => shoe.current.draw());
    const shown: { player: Card[]; banker: Card[] } = { player: [], banker: [] };
    const idx = { player: 0, banker: 0 };
    const meshes: { c3: Card3D; card: Card; side: 'player' | 'banker' }[] = [];
    for (const step of coup.order) {
      const i = idx[step.side]++;
      const third = i === 2;
      const x = (step.side === 'player' ? P_X : B_X) + (third ? (step.side === 'player' ? -1.55 : 1.55) : (i - 0.5) * 1.1);
      const z = CARD_Z + (third ? 0.1 : 0);
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
          // flip each side's cards together: player first, then banker
          const batch = meshes.splice(0);
          for (const side of ['player', 'banker'] as const) {
            const group = batch.filter((m) => m.side === side);
            if (!group.length) continue;
            await Promise.all(group.map((m) => sc.flip(m.c3, m.card, true)));
            group.forEach((m) => shown[side].push(m.card));
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
    if (r.winner === 'tie') { sc.celebrate(P_X, CARD_Z, payout > total, 2.5, 1.85); sc.celebrate(B_X, CARD_Z, payout > total, 2.5, 1.85); }
    else sc.celebrate(r.winner === 'player' ? P_X : B_X, CARD_Z, payout > total, 2.5, 1.85);
    for (const [spot, v] of Object.entries(b) as [Spot, number][]) {
      if (!v) continue;
      const won = spot === r.winner || (spot === 'pp' && r.pp) || (spot === 'bp' && r.bp);
      const push = r.winner === 'tie' && (spot === 'player' || spot === 'banker');
      sc.markZone(spot, won);
      sc.settleChips(spot, won ? 'win' : push ? 'push' : 'lose', won ? v * (PAYS[spot] - 1) : 0);
    }
    setDealing(false);
  };

  const spotResult = (s: Spot): 'win' | 'lose' | null => {
    if (!result) return null;
    const won = s === result.winner || (s === 'pp' && result.pp) || (s === 'bp' && result.bp);
    return won ? 'win' : 'lose';
  };

  const spot = (s: Spot) => (
    <BetSpot key={s} disabled={dealing} amount={bets[s] ?? 0} onClick={() => place(s)} highlight={spotResult(s)}
      label={{ player: 'Player', banker: 'Banker', tie: 'Tie', pp: 'Player Pair', bp: 'Banker Pair' }[s]}
      sub={{ player: 'pays 1:1', banker: 'pays 0.95:1', tie: 'pays 8:1', pp: 'pays 11:1', bp: 'pays 11:1' }[s]}
      className={s === 'player' ? '!border-sky-400/50' : s === 'banker' ? '!border-blood/60' : s === 'tie' ? '!border-emerald-400/50' : '!border-gold/40'} />
  );
  const betArea = (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">{(['player', 'tie', 'banker'] as Spot[]).map(spot)}</div>
      {punto && <div className="grid grid-cols-2 gap-2">{(['pp', 'bp'] as Spot[]).map(spot)}</div>}
    </div>
  );

  const controls = (
    <>
      <ChipPicker chip={chip} setChip={setChip} total={total} onClear={clear} onUndo={undo} onRebet={last ? rebet : undefined} disabled={dealing} />
      <div className="hidden lg:block">
        <div className="label mb-1.5">Place your bets</div>
        {betArea}
      </div>
      <GameAction>
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
      <div className="table-vignette pointer-events-none absolute inset-0" />
      {totals.p !== null && (
        <Anchor scene={scene} at={[P_X - 0.35, 0.2, CARD_Z + 1.2]}>
          <HandBadge label="Player" value={totals.p} tone={result ? (result.winner === 'player' ? 'win' : result.winner === 'tie' ? 'push' : 'neutral') : 'player'} />
        </Anchor>
      )}
      {totals.b !== null && (
        <Anchor scene={scene} at={[B_X + 0.35, 0.2, CARD_Z + 1.2]}>
          <HandBadge label="Banker" value={totals.b} tone={result ? (result.winner === 'banker' ? 'win' : result.winner === 'tie' ? 'push' : 'neutral') : 'banker'} />
        </Anchor>
      )}
      {result && (
        <ResultBanner key={road.length} tone={result.payout > result.total ? 'win' : result.payout === result.total ? 'push' : 'lose'}
          title={result.winner === 'tie' ? `TIE ${result.pt}–${result.bt}` : `${result.winner.toUpperCase()} WINS ${Math.max(result.pt, result.bt)}`}
          sub={result.payout > 0 ? `${(result.pp || result.bp) && punto ? [result.pp && 'Player pair', result.bp && 'Banker pair'].filter(Boolean).join(' & ') + '! · ' : ''}Paid` : `Lost ${fmt(result.total)}`}
          amount={result.payout} />
      )}
      {!result && !dealing && total === 0 && <TableHint>Pick a chip, then tap <b className="text-sky-300">Player</b>, <b className="text-emerald-300">Tie</b> or <b className="text-blood">Banker</b> on the table</TableHint>}
    </GameShell>
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
            <span key={i} className={`grid aspect-square place-items-center rounded-full text-[9px] font-black ${!r ? 'bg-white/[0.04]' : r.winner === 'player' ? 'bg-sky-500 text-white' : r.winner === 'banker' ? 'bg-blood text-white' : 'bg-emerald-500 text-ink'}`}>
              {r ? (r.winner === 'tie' ? r.pt : r.winner === 'player' ? r.pt : r.bt) : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}
