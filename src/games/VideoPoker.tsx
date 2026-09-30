import { useEffect, useRef, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import GameShell, { GameAction } from '../components/GameShell';
import BetControls, { MiniBet, confirmBet } from '../components/BetControls';
import { useStore } from '../store';
import { sfx } from '../lib/sound';
import { fmt } from '../lib/format';
import { Card, Shoe, eval5 } from '../lib/cards';
import { Card3D, TableScene } from './three/table3d';

/** Jacks or Better 9/6 — total return per unit bet (99.5% with perfect play). */
const PAYTABLE: { name: string; pays: number; test: (s: number[]) => boolean }[] = [
  { name: 'Royal flush', pays: 800, test: (s) => s[0] === 9 },
  { name: 'Straight flush', pays: 50, test: (s) => s[0] === 8 },
  { name: 'Four of a kind', pays: 25, test: (s) => s[0] === 7 },
  { name: 'Full house', pays: 9, test: (s) => s[0] === 6 },
  { name: 'Flush', pays: 6, test: (s) => s[0] === 5 },
  { name: 'Straight', pays: 4, test: (s) => s[0] === 4 },
  { name: 'Three of a kind', pays: 3, test: (s) => s[0] === 3 },
  { name: 'Two pair', pays: 2, test: (s) => s[0] === 2 },
  { name: 'Jacks or better', pays: 1, test: (s) => s[0] === 1 && s[1] >= 11 },
];
const rank = (cards: Card[]) => PAYTABLE.find((p) => p.test(eval5(cards))) ?? null;

/** A simple (not perfect) hold suggestion. */
function suggestHolds(cards: Card[]): boolean[] {
  const r = rank(cards);
  const s = eval5(cards);
  if (r && s[0] >= 4) return cards.map(() => true); // straight or better: keep everything
  const counts = new Map<number, number>();
  cards.forEach((c) => counts.set(c.r, (counts.get(c.r) ?? 0) + 1));
  if (s[0] === 7 || s[0] === 3 || s[0] === 2) return cards.map((c) => (counts.get(c.r) ?? 0) >= 2);
  // 4 to a flush
  for (const suit of ['S', 'H', 'D', 'C']) {
    const same = cards.filter((c) => c.s === suit);
    if (same.length === 4) return cards.map((c) => c.s === suit);
  }
  if (s[0] === 1) return cards.map((c) => (counts.get(c.r) ?? 0) === 2); // any pair
  // 4 to an open straight
  const rs = [...new Set(cards.map((c) => c.r))].sort((a, b) => a - b);
  for (let lo = 2; lo <= 11; lo++) {
    const run = [lo, lo + 1, lo + 2, lo + 3];
    if (run.every((x) => rs.includes(x))) { const used = new Set<number>(); return cards.map((c) => (run.includes(c.r) && !used.has(c.r) ? (used.add(c.r), true) : false)); }
  }
  // high cards (J+), at most two
  const high = cards.map((c, i) => ({ c, i })).filter((x) => x.c.r >= 11).sort((a, b) => b.c.r - a.c.r).slice(0, 2).map((x) => x.i);
  return cards.map((_, i) => high.includes(i));
}

type Phase = 'bet' | 'dealing' | 'hold' | 'done';
const X = (i: number) => -2.3 + i * 1.15;
const Z = 0.1;

export default function VideoPoker() {
  const [bet, setBet] = useState(useStore.getState().settings.defaultBet);
  const [phase, setPhase] = useState<Phase>('bet');
  const [cards, setCards] = useState<Card[]>([]);
  const [held, setHeld] = useState<boolean[]>([false, false, false, false, false]);
  const [result, setResult] = useState<{ name: string | null; pays: number } | null>(null);

  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TableScene | null>(null);
  const shoe = useRef<Shoe>(Shoe.fresh());
  const meshes = useRef<Card3D[]>([]);
  const stateRef = useRef({ phase, held });
  stateRef.current = { phase, held };
  const turbo = useStore((s) => s.settings.turbo);

  useEffect(() => {
    const sc = new TableScene(hostRef.current!, { felt: 0x3b1466, text: ['5 CARD POKER', 'JACKS OR BETTER · ROYAL FLUSH PAYS 800×'], sub: 'TAP A CARD TO HOLD IT' });
    sceneRef.current = sc;
    sc.onCardClick((c) => {
      const i = meshes.current.indexOf(c);
      if (i >= 0 && stateRef.current.phase === 'hold') toggle(i);
    });
    return () => { sc.dispose(); sceneRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { sceneRef.current?.setTurbo(turbo); }, [turbo]);

  const toggle = (i: number) => {
    sfx.click();
    setHeld((h) => {
      const n = [...h]; n[i] = !n[i];
      const m = meshes.current[i]; if (m) sceneRef.current?.lift(m, n[i]);
      return n;
    });
  };

  const applyHolds = (h: boolean[]) => {
    setHeld(h);
    h.forEach((v, i) => { const m = meshes.current[i]; if (m) sceneRef.current?.lift(m, v); });
  };

  const deal = async () => {
    const sc = sceneRef.current;
    if (!sc || !confirmBet(bet) || !useStore.getState().placeBet(bet)) return;
    sfx.bet();
    sc.clear(); setResult(null); setHeld([false, false, false, false, false]);
    setPhase('dealing');
    shoe.current = Shoe.fresh();
    const hand = Array.from({ length: 5 }, () => shoe.current.draw());
    meshes.current = [];
    for (let i = 0; i < 5; i++) { meshes.current.push(await sc.deal(hand[i], X(i), Z, { delay: 0 })); sfx.tick(); }
    setCards(hand);
    setPhase('hold');
  };

  const draw = async () => {
    const sc = sceneRef.current; if (!sc || phase !== 'hold') return;
    setPhase('dealing');
    const hand = [...cards];
    for (let i = 0; i < 5; i++) if (!held[i]) sc.discard(meshes.current[i]);
    await new Promise((r) => setTimeout(r, turbo ? 120 : 260));
    for (let i = 0; i < 5; i++) {
      if (held[i]) continue;
      hand[i] = shoe.current.draw();
      meshes.current[i] = await sc.deal(hand[i], X(i), Z);
      sfx.tick();
    }
    setCards(hand);
    const r = rank(hand);
    const pays = r?.pays ?? 0;
    useStore.getState().settle('video-poker', bet, pays, r ? r.name : 'No win');
    setResult({ name: r?.name ?? null, pays });
    pays > 1 ? sfx.win() : pays === 1 ? sfx.reveal() : sfx.lose();
    if (pays >= 1) sc.celebrate(0, Z, pays > 1, 3.6);
    setPhase('done');
  };

  const pre = phase === 'hold' && cards.length ? rank(cards) : null;
  const shownRank = result ? (result.name ? PAYTABLE.find((p) => p.name === result.name) : null) : pre;
  const betLocked = phase === 'dealing' || phase === 'hold';

  const holdRow = (
    <div className="grid grid-cols-5 gap-1.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <button key={i} type="button" disabled={phase !== 'hold'} onClick={() => toggle(i)} aria-pressed={held[i]} aria-label={`Hold card ${i + 1}`}
          className={`rounded-lg py-2 text-[11px] font-black tracking-wider transition ${held[i] ? 'bg-gold text-ink shadow-gold' : 'bg-ink-700 text-smoke'} disabled:opacity-40`}>
          {held[i] ? 'HELD' : 'HOLD'}
        </button>
      ))}
    </div>
  );

  const action = phase === 'hold' ? (
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <button className="btn-gold py-4 text-base" onClick={draw}>Draw</button>
      <button className="btn-dark px-4 py-4 text-sm" onClick={() => applyHolds(suggestHolds(cards))} aria-label="Suggest holds" title="Suggest holds"><Lightbulb size={16} /></button>
    </div>
  ) : (
    <button className="btn-gold w-full py-4 text-base" disabled={phase === 'dealing'} onClick={deal}>{phase === 'done' ? 'Deal again' : 'Deal'}</button>
  );

  const controls = (
    <>
      <BetControls value={bet} onChange={setBet} disabled={betLocked} />
      <div className="hidden lg:block">{holdRow}</div>
      <GameAction extra={<>{phase === 'hold' ? holdRow : <MiniBet value={bet} onChange={setBet} disabled={betLocked} />}</>}>{action}</GameAction>
      <div className="rounded-xl bg-ink-900 p-3 text-xs">
        <div className="label mb-2">Pays (per 1 bet)</div>
        {PAYTABLE.map((p) => (
          <div key={p.name} className={`flex justify-between rounded px-1.5 py-0.5 transition ${shownRank?.name === p.name ? 'bg-gold/20 text-gold' : 'text-smoke'}`}>
            <span>{p.name}</span><b className={shownRank?.name === p.name ? 'text-gold' : 'text-cream'}>{p.pays}×</b>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <GameShell id="video-poker" controls={controls} rules={[
      'Set your bet and press Deal to get five cards.',
      'Tap the cards (or the HOLD buttons) you want to keep. The bulb button suggests a basic hold.',
      'Press Draw: every card you didn’t hold is replaced once.',
      'Your final hand pays by the table — a pair of jacks or better returns your bet, a royal flush pays 800×.',
    ]}>
      <div ref={hostRef} className="absolute inset-0" aria-label="5 card poker table" />
      <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
        <div className="rounded-xl bg-black/60 px-4 py-1.5 text-center backdrop-blur">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-smoke">{phase === 'hold' ? 'You have' : phase === 'done' ? 'Final hand' : 'Five card draw'}</div>
          <div className={`font-display text-lg font-black ${shownRank ? 'text-gold' : ''}`}>{shownRank ? shownRank.name : phase === 'hold' || phase === 'done' ? 'Nothing yet' : 'Jacks or Better'}</div>
        </div>
      </div>
      {result && (
        <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center px-4">
          <div className={`animate-pop rounded-2xl border px-6 py-3 text-center backdrop-blur-md ${result.pays > 1 ? 'border-gold/60 bg-black/60' : 'border-white/20 bg-black/60'}`}>
            <div className={`h-display text-3xl ${result.pays > 1 ? 'text-gold-grad' : result.pays === 1 ? 'text-cream' : 'text-smoke'}`}>{result.name ? `${result.name.toUpperCase()}` : 'NO WIN'}</div>
            <div className="mt-1 text-sm text-cream/85">{result.pays > 0 ? `${result.pays}× · paid ${fmt(bet * result.pays)}` : 'Deal again?'}</div>
          </div>
        </div>
      )}
    </GameShell>
  );
}
