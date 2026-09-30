import { useEffect, useMemo, useRef, useState } from 'react';
import { LogOut, Users } from 'lucide-react';
import GameShell, { GameAction } from '../components/GameShell';
import { Seg } from '../components/BetControls';
import { toast, useStore } from '../store';
import { sfx } from '../lib/sound';
import { fmt } from '../lib/format';
import { Card, HAND_NAMES, Shoe, bestHand } from '../lib/cards';
import { BOT_ROSTER, Game, PotResult, Seat, act, alive, botDecision, inHand, legal, nextStreet, pot, returnUncalled, roundOver, showdown, startHand } from '../lib/holdem';
import { Card3D, TableScene } from './three/table3d';
import { Anchor, ResultBanner } from '../components/TableUI';

/* Texas Hold'em (no limit) against chicken bots. The chicken croupier deals but never plays. */

const STAKES: [number, number][] = [[1, 2], [5, 10], [25, 50], [100, 200]];
const SLOTS = [0, 1, 2, 3, 4, 6, 7, 8, 9]; // 10 positions round the table; 5 (top) is the dealer
const slotsFor = (n: number) => Array.from({ length: n }, (_, k) => SLOTS[Math.round((k * SLOTS.length) / n) % SLOTS.length]);
const BOARD_X = (i: number) => -2.3 + i * 1.15;
const potAt = (portrait: boolean): [number, number] => (portrait ? [0, -3.3] : [0, -1.45]);

type Phase = 'lobby' | 'joining' | 'playing' | 'between';
interface Outcome { tone: 'win' | 'lose' | 'push'; title: string; sub: string; amount: number }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Poker() {
  const [stakeIdx, setStakeIdx] = useState(1);
  const [players, setPlayers] = useState(6);
  const [phase, setPhase] = useState<Phase>('lobby');
  const [portrait, setPortrait] = useState(false);
  const [scene, setScene] = useState<TableScene | null>(null);
  const [, setTick] = useState(0);
  const rerender = () => setTick((t) => t + 1);
  const [turn, setTurn] = useState<number | null>(null);
  const [myTurn, setMyTurn] = useState(false);
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [raiseTo, setRaiseTo] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [results, setResults] = useState<PotResult[]>([]);
  const [session, setSession] = useState({ hands: 0, net: 0, biggest: 0 });
  const [countdown, setCountdown] = useState(0);

  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TableScene | null>(null);
  const game = useRef<Game | null>(null);
  const slots = useRef<number[]>([]);
  const holeMeshes = useRef<Map<number, Card3D[]>>(new Map());
  const boardMeshes = useRef<Card3D[]>([]);
  const decide = useRef<((a: { type: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin'; to?: number }) => void) | null>(null);
  const alivePage = useRef(true);
  const leaving = useRef(false);
  const inHandRef = useRef(false);
  const turbo = useStore((s) => s.settings.turbo);
  const turboRef = useRef(turbo);
  const portraitRef = useRef(portrait);
  portraitRef.current = portrait;
  turboRef.current = turbo;
  const [sb, bb] = STAKES[stakeIdx];

  // (re)build the 3D table; orientation only changes between hands
  useEffect(() => {
    const el = hostRef.current!;
    const sc = new TableScene(el, { felt: 0x0f4d33, oval: { portrait }, logoZ: null });
    sc.setTurbo(turboRef.current);
    sceneRef.current = sc; setScene(sc);
    const g = game.current;
    if (g && slots.current.length) placeStatic(sc, g);
    return () => { sc.dispose(); sceneRef.current = null; setScene(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portrait]);
  useEffect(() => {
    const el = hostRef.current!;
    const ro = new ResizeObserver(() => { if (!inHandRef.current) setPortrait(el.clientHeight > el.clientWidth * 1.05); });
    ro.observe(el);
    return () => { ro.disconnect(); alivePage.current = false; decide.current = null; };
  }, []);
  useEffect(() => { sceneRef.current?.setTurbo(turbo); }, [turbo]);

  // ---------- geometry ----------
  const seatGeo = (sc: TableScene, i: number) => {
    const f = slots.current[i] / 10;
    const e = sc.edge(f);
    const inward = e.n.clone().negate();
    const tan = { x: -e.n.z, z: e.n.x };
    const at = (d: number, side = 0) => ({ x: e.p.x + inward.x * d + tan.x * side, z: e.p.z + inward.z * d + tan.z * side });
    return { pod: sc.edge(f, 0.95).p, cards: at(1.45), bet: at(2.45), button: at(1.35, 1.25), human: game.current?.seats[i]?.human };
  };
  /** After a table rebuild, put the dealer button and stacks back without animation. */
  const placeStatic = (sc: TableScene, g: Game) => {
    const b = seatGeo(sc, g.button).button; sc.moveButton(b.x, b.z);
  };

  // ---------- lobby / seating ----------
  const newBot = (g: Game | null, taken: Set<string>) => {
    const pool = BOT_ROSTER.filter((b) => !taken.has(b.name));
    const b = pool[Math.floor(Math.random() * pool.length)] ?? BOT_ROSTER[0];
    return { id: Math.random(), name: b.name, avatar: b.avatar, human: false, stack: (g?.bb ?? bb) * (80 + Math.floor(Math.random() * 60)), hole: [], bet: 0, total: 0, folded: false, allIn: false, acted: false, sittingOut: false, style: { loose: b.loose, aggro: b.aggro } } as Seat;
  };

  const sitDown = async () => {
    const st = useStore.getState();
    const err = st.betError(bb * 10);
    if (err) { if (err === 'signup') st.placeBet(bb); else toast({ title: bb * 10 > st.balance ? `You need at least ${fmt(bb * 10)} to sit at these stakes` : err, tone: 'red' }); return; }
    const you: Seat = { id: 0, name: st.user?.name ?? 'You', avatar: '🧑', human: true, stack: st.balance, hole: [], bet: 0, total: 0, folded: false, allIn: false, acted: false, sittingOut: false, style: { loose: 0, aggro: 0 } };
    const g: Game = { seats: [you], button: 0, sb, bb, board: [], street: 'preflop', toAct: 0, currentBet: 0, minRaise: bb, shoe: Shoe.fresh(), handNo: 0 };
    game.current = g;
    slots.current = slotsFor(players);
    leaving.current = false;
    setPhase('joining'); setOutcome(null); setResults([]);
    sceneRef.current?.clear();
    rerender();
    // the other players arrive one by one
    const taken = new Set<string>();
    for (let k = 1; k < players; k++) {
      await sleep(turboRef.current ? 150 : 420);
      if (!alivePage.current) return;
      const bot = newBot(g, taken); taken.add(bot.name);
      g.seats.push(bot);
      sfx.tick(); rerender();
    }
    g.button = Math.floor(Math.random() * g.seats.length);
    await sleep(400);
    runHands();
  };

  const leaveTable = () => {
    if (inHandRef.current) { leaving.current = true; toast({ title: 'You’ll leave after this hand', tone: 'neutral' }); return; }
    game.current = null; setPhase('lobby'); setOutcome(null); setResults([]); setCountdown(0);
    sceneRef.current?.clear(); rerender();
  };

  // ---------- the hand loop ----------
  const runHands = async () => {
    while (alivePage.current && game.current && !leaving.current) {
      await playHand();
      if (!alivePage.current || !game.current || leaving.current) break;
      const g = game.current;
      // busted bots leave, new ones take their seats
      const taken = new Set(g.seats.map((s) => s.name));
      for (let i = 0; i < g.seats.length; i++) {
        if (!g.seats[i].human && g.seats[i].stack <= 0) {
          toast({ title: `${g.seats[i].name} busted and left the table`, tone: 'neutral' });
          g.seats[i] = newBot(g, taken); taken.add(g.seats[i].name);
          toast({ title: `${g.seats[i].name} joined the table`, tone: 'gold' });
        }
      }
      rerender();
      setPhase('between');
      // short break, auto-deal the next hand
      const wait = turboRef.current ? 3 : 6;
      let go = false;
      nextNow.current = () => { go = true; };
      for (let c = wait; c > 0 && !go && alivePage.current && !leaving.current; c--) { setCountdown(c); await sleep(1000); }
      setCountdown(0);
      if (useStore.getState().balance < (game.current?.bb ?? 0)) { toast({ title: 'Not enough coins for the big blind', tone: 'red' }); leaving.current = true; }
    }
    if (leaving.current) { leaving.current = false; game.current = null; setPhase('lobby'); sceneRef.current?.clear(); rerender(); }
  };
  const nextNow = useRef<() => void>(() => {});

  const think = () => sleep(turboRef.current ? 220 + Math.random() * 200 : 650 + Math.random() * 850);

  const playHand = async () => {
    const g = game.current!; const sc = sceneRef.current!;
    if (!sc) return;
    inHandRef.current = true;
    setPhase('playing'); setOutcome(null); setResults([]); setRaiseOpen(false);
    const human = g.seats[0];
    human.stack = useStore.getState().balance;
    g.sb = sb; g.bb = bb;
    sc.clear();
    holeMeshes.current = new Map(); boardMeshes.current = [];
    const { posts } = startHand(g);
    const humanPaid = (amt: number) => { if (amt > 0) useStore.setState((s) => ({ balance: +(s.balance - amt).toFixed(2) })); };
    rerender();
    // button, blinds
    const bgeo = seatGeo(sc, g.button).button; await sc.moveButton(bgeo.x, bgeo.z);
    for (const p of posts) {
      const geo = seatGeo(sc, p.seat).bet; sc.setChips(`b${p.seat}`, g.seats[p.seat].bet, geo.x, geo.z); sfx.bet();
      if (g.seats[p.seat].human) humanPaid(p.amount);
    }
    rerender();
    // deal the hole cards, one at a time from the left of the button
    const order: number[] = []; let i = g.button;
    for (let k = 0; k < g.seats.length; k++) { i = (i + 1) % g.seats.length; if (!g.seats[i].sittingOut) order.push(i); }
    for (let r = 0; r < 2; r++) for (const s of order) {
      const seat = g.seats[s], geo = seatGeo(sc, s).cards;
      const side = seat.human ? (r ? 0.58 : -0.58) : (r ? 0.28 : -0.28);
      const e = sc.edge(slots.current[s] / 10);
      const rot = seat.human ? 0 : Math.atan2(e.n.x, e.n.z) * 0.9 + (r ? 0.12 : -0.12);
      const tan = { x: -e.n.z, z: e.n.x };
      const c3 = await sc.deal(seat.human ? seat.hole[r] : null, geo.x + tan.x * side, geo.z + tan.z * side, { scale: seat.human ? 1.12 : 0.72, rot, up: seat.human });
      const list = holeMeshes.current.get(s) ?? []; list.push(c3); holeMeshes.current.set(s, list);
      sfx.tick();
      if (!alivePage.current) return;
    }

    // betting rounds
    while (true) {
      while (!roundOver(g)) {
        const who = g.toAct;
        if (who < 0) break;
        const seat = g.seats[who];
        setTurn(who); rerender();
        let choice: { type: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin'; to?: number };
        if (seat.human) {
          const L = legal(g, who);
          setRaiseTo(Math.min(L.maxTo, Math.max(L.minTo, g.currentBet === 0 ? Math.round(pot(g) * 0.5 / g.sb) * g.sb || L.minTo : L.minTo)));
          setMyTurn(true);
          choice = await new Promise((res) => { decide.current = res; });
          decide.current = null; setMyTurn(false); setRaiseOpen(false);
        } else {
          await think();
          if (!alivePage.current) return;
          choice = botDecision(g, who);
        }
        const moved = act(g, choice.type, choice.to);
        if (seat.human) humanPaid(moved);
        const geo = seatGeo(sc, who);
        if (seat.folded) {
          (holeMeshes.current.get(who) ?? []).forEach((m) => sc.discard(m)); sfx.click();
        } else if (moved > 0) { sc.setChips(`b${who}`, seat.bet, geo.bet.x, geo.bet.z); sfx.bet(); }
        else sfx.tick();
        rerender();
        if (!alivePage.current) return;
      }
      setTurn(null);
      const ret = returnUncalled(g);
      if (ret) {
        const [who, amt] = ret; const geo = seatGeo(sc, who).bet;
        sc.setChips(`b${who}`, g.seats[who].bet, geo.x, geo.z);
        if (g.seats[who].human) useStore.setState((s) => ({ balance: +(s.balance + amt).toFixed(2) }));
      }
      await sleep(turboRef.current ? 120 : 350);
      { const [px, pz] = potAt(portraitRef.current); await sc.gatherChips(g.seats.map((_, k) => `b${k}`), px, pz, pot(g)); }
      rerender();
      if (alive(g).length <= 1 || g.street === 'river') break;
      // everyone left is all-in: turn the cards over and run the board out
      const actors = g.seats.filter((s) => inHand(s) && !s.allIn).length;
      if (actors <= 1) await revealAll(g, sc);
      const dealt = nextStreet(g);
      rerender();
      for (const c of dealt) {
        const k = g.board.indexOf(c);
        boardMeshes.current.push(await sc.deal(c, BOARD_X(k), 0.05, { scale: 1.05 }));
        sfx.reveal();
      }
      await sleep(turboRef.current ? 150 : 450);
      rerender();
    }

    // showdown
    setTurn(null);
    const contenders = alive(g);
    if (contenders.length > 1) await revealAll(g, sc);
    const humanTotal = human.total;
    const humanBefore = human.stack;
    const res = showdown(g);
    setResults(res);
    const won = +(human.stack - humanBefore).toFixed(2);
    // lift the winning cards and push the pot
    const main = res[0];
    const winner = main.winners[0];
    if (contenders.length > 1) {
      const best = bestHand([...g.seats[winner].hole, ...g.board]).cards;
      const mine = holeMeshes.current.get(winner) ?? [];
      best.forEach((c) => {
        const bi = g.board.indexOf(c); const hi = g.seats[winner].hole.indexOf(c);
        const m = bi >= 0 ? boardMeshes.current[bi] : hi >= 0 ? mine[hi] : null;
        if (m) sc.lift(m, true);
      });
    }
    const wgeo = seatGeo(sc, winner);
    sc.dealerGesture(wgeo.bet.x, wgeo.bet.z);
    await sleep(turboRef.current ? 200 : 700);
    await sc.pushChips('pot', wgeo.bet.x, wgeo.bet.z);
    if (won > 0) useStore.setState((s) => ({ balance: +(s.balance + won).toFixed(2) }));
    // record the hand for the history & stats
    if (humanTotal > 0) {
      // the chips were taken live; settle() adds the payout back, so take it out first
      useStore.setState((s) => ({ balance: +(s.balance - won).toFixed(2) }));
      useStore.getState().settle('poker', humanTotal, won / humanTotal, `${HAND_NAMES_OR(g, 0)} · pot ${fmt(pot(g))}`);
    }
    const net = +(won - humanTotal).toFixed(2);
    setSession((s) => ({ hands: s.hands + 1, net: +(s.net + net).toFixed(2), biggest: Math.max(s.biggest, pot(g)) }));
    const handName = main.hand;
    if (main.winners.includes(0) && won > 0) {
      setOutcome({ tone: net > 0 ? 'win' : 'push', title: main.winners.length > 1 ? 'SPLIT POT' : 'YOU WIN!', sub: handName ? `with ${handName.toLowerCase()} · won` : 'everyone folded · won', amount: won });
      sfx.win(); sc.celebrate(wgeo.cards.x, wgeo.cards.z, true, 2.6, 1.9);
    } else {
      const w = g.seats[winner];
      setOutcome({ tone: human.folded ? 'push' : 'lose', title: `${w.name.toUpperCase()} WINS`, sub: handName ? `with ${handName.toLowerCase()}` : 'everyone else folded', amount: 0 });
      if (!human.folded && humanTotal > 0) sfx.lose();
      sc.highlight(wgeo.cards.x, wgeo.cards.z, 1.8, 1.6);
    }
    human.stack = useStore.getState().balance;
    inHandRef.current = false;
    rerender();
  };

  const revealAll = async (g: Game, sc: TableScene) => {
    for (let s = 0; s < g.seats.length; s++) {
      const seat = g.seats[s];
      if (seat.human || !inHand(seat)) continue;
      const ms = holeMeshes.current.get(s) ?? [];
      await Promise.all(ms.map((m, k) => (m.up ? Promise.resolve() : sc.flip(m, seat.hole[k]))));
    }
    rerender();
  };

  // ---------- human actions ----------
  const g = game.current;
  const me = g?.seats[0];
  const L = g && myTurn ? legal(g, 0) : null;
  const potNow = g ? pot(g) : 0;
  const choose = (type: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin', to?: number) => { sfx.click(); decide.current?.({ type, to }); };
  const presets = L ? ([
    ['Min', L.minTo],
    ['½ pot', g!.currentBet + Math.max(g!.minRaise, (potNow + L.toCall) * 0.5)],
    ['¾ pot', g!.currentBet + Math.max(g!.minRaise, (potNow + L.toCall) * 0.75)],
    ['Pot', g!.currentBet + Math.max(g!.minRaise, potNow + L.toCall)],
    ['All-in', L.maxTo],
  ] as [string, number][]).map(([l, v]) => [l, Math.min(L.maxTo, Math.max(L.minTo, Math.round(v / g!.sb) * g!.sb))] as [string, number]) : [];

  const myHand = useMemo(() => (me && me.hole.length === 2 ? bestHand([...me.hole, ...(g?.board ?? [])]) : null), [me?.hole, g?.board.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const raisePanel = L && raiseOpen && L.canRaise ? (
    <div className="rounded-xl border border-gold/25 bg-ink-900/95 p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="label">{L.isBet ? 'Bet' : 'Raise to'}</span>
        <b className="font-display text-lg text-gold tabular">{fmt(raiseTo)}</b>
      </div>
      <input type="range" className="mt-2 w-full accent-[#F4C430]" min={L.minTo} max={L.maxTo} step={g!.sb} value={raiseTo} onChange={(e) => setRaiseTo(+e.target.value)} aria-label="Raise amount" />
      <div className="mt-2 grid grid-cols-5 gap-1">
        {presets.map(([l, v]) => (
          <button key={l} type="button" onClick={() => setRaiseTo(v)} className={`rounded-lg py-1.5 text-[11px] font-bold transition ${raiseTo === v ? 'bg-gold text-ink' : 'bg-ink-700 text-smoke hover:text-cream'}`}>{l}</button>
        ))}
      </div>
    </div>
  ) : null;

  let action;
  if (phase === 'lobby') action = <button className="btn-gold w-full py-4 text-base" onClick={sitDown}><Users size={18} />Take a seat · {players} players</button>;
  else if (phase === 'joining') action = <button className="btn-gold w-full py-4 text-base" disabled>Players joining…</button>;
  else if (phase === 'between') action = (
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <button className="btn-gold py-4 text-base" onClick={() => nextNow.current()}>Next hand{countdown ? ` · ${countdown}` : ''}</button>
      <button className="btn-dark px-4 py-4 text-sm" onClick={leaveTable} aria-label="Leave table" title="Leave table"><LogOut size={16} /></button>
    </div>
  );
  else if (L) action = (
    <div className="grid grid-cols-3 gap-2">
      <button className="btn-red py-3 text-sm" onClick={() => choose('fold')}><Lbl t="Fold" s="give up" /></button>
      {L.canCheck
        ? <button className="btn-double py-3 text-sm" onClick={() => choose('check')}><Lbl t="Check" s="free" /></button>
        : <button className="btn-double py-3 text-sm" onClick={() => choose('call')}><Lbl t={L.toCall >= me!.stack ? 'All-in' : 'Call'} s={fmt(L.toCall)} /></button>}
      {raiseOpen
        ? <button className="btn-gold py-3 text-sm" onClick={() => choose(raiseTo >= L.maxTo ? 'allin' : L.isBet ? 'bet' : 'raise', raiseTo)}><Lbl t={raiseTo >= L.maxTo ? 'All-in' : L.isBet ? 'Bet' : 'Raise'} s={fmt(raiseTo)} /></button>
        : <button className="btn-gold py-3 text-sm" disabled={!L.canRaise} onClick={() => setRaiseOpen(true)}><Lbl t={L.isBet ? 'Bet' : 'Raise'} s={L.canRaise ? `min ${fmt(L.minTo)}` : '—'} /></button>}
    </div>
  );
  else action = <button className="btn-dark w-full py-4 text-sm" disabled>{turn !== null && g ? `${g.seats[turn]?.name} is thinking…` : 'Dealing…'}</button>;

  const controls = (
    <>
      <div className={phase === 'lobby' ? '' : 'pointer-events-none opacity-50'}>
        <div className="label mb-1.5">Blinds</div>
        <Seg options={STAKES.map((_, i) => i)} value={stakeIdx} onChange={setStakeIdx} render={(i) => `${STAKES[i][0]}/${STAKES[i][1]}`} />
        <div className="label mb-1.5 mt-3">Players at the table</div>
        <Seg options={[2, 3, 4, 5, 6, 7, 8]} value={players} onChange={setPlayers} />
      </div>
      <div className="hidden lg:block">{raisePanel}</div>
      <GameAction extra={raisePanel ?? undefined}>{action}</GameAction>
      {phase !== 'lobby' && <button type="button" className="btn-ghost hidden w-full py-2 text-xs lg:flex" onClick={leaveTable}><LogOut size={13} />Leave table</button>}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <Stat label="Hands" value={String(session.hands)} />
        <Stat label="Net" value={`${session.net >= 0 ? '+' : ''}${fmt(session.net, 0)}`} tone={session.net > 0 ? 'text-emerald-400' : session.net < 0 ? 'text-blood' : ''} />
        <Stat label="Top pot" value={fmt(session.biggest, 0)} />
      </div>
      <div className="rounded-xl bg-ink-900 p-3 text-xs">
        <div className="label mb-2">Hand rankings</div>
        {[...HAND_NAMES].reverse().map((n) => (
          <div key={n} className={`flex justify-between rounded px-1.5 py-0.5 ${myHand?.name === n ? 'bg-gold/15 text-gold' : 'text-smoke'}`}><span>{n}</span></div>
        ))}
      </div>
    </>
  );

  const streetLabel = g ? { preflop: 'Pre-flop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Showdown' }[g.street] : '';

  return (
    <GameShell id="poker" tall controls={controls} rules={[
      'Pick the blinds and how many players (2–8), then take a seat. The chicken croupier deals every hand but never plays.',
      'The dealer button moves one seat to the left each hand. The two players after it post the small and big blind; everyone gets two private cards.',
      'Pre-flop betting starts left of the big blind. Then the flop (3 shared cards), the turn (4th) and the river (5th) are dealt, each followed by a betting round that starts left of the button. A card is burned before each street.',
      'On your turn: Fold, Check (when nothing is owed), Call, or Bet/Raise — a raise must be at least the size of the last bet or raise, or you can go all-in.',
      'After the river, the remaining players show down: the best five-card hand from their two cards plus the board wins. Ties split the pot, and all-ins create side pots.',
    ]}>
      <div ref={hostRef} className="absolute inset-0" aria-label="Texas Hold'em table" />
      <div className="table-vignette pointer-events-none absolute inset-0" />
      {g && scene && g.seats.map((s, i) => slots.current[i] !== undefined && (
        <Anchor key={s.id} scene={scene} at={[seatGeo(scene, i).pod.x, 0.3, seatGeo(scene, i).pod.z]}>
          <SeatPod seat={s} dealer={g.button === i && phase !== 'joining'} active={turn === i} shown={results.length > 0 && results[0].hand !== ''}
            winner={results.some((r) => r.winners.includes(i))} />
        </Anchor>
      ))}
      {g && scene && phase !== 'lobby' && potNow > 0 && (
        <Anchor scene={scene} at={[potAt(portrait)[0] + (portrait ? 0 : 1.3), 0.2, potAt(portrait)[1] + (portrait ? 0.75 : 0)]}>
          <span className="rounded-full border border-gold/40 bg-black/75 px-3 py-1 font-display text-xs font-black text-gold shadow-lg backdrop-blur tabular">Pot {fmt(potNow)}</span>
        </Anchor>
      )}
      {phase !== 'lobby' && g && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col gap-1">
          <span className="rounded-full bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cream/80 backdrop-blur">{g.handNo ? `Hand #${g.handNo} · ${streetLabel}` : 'Players joining'}</span>
          <span className="rounded-full bg-black/60 px-3 py-1 text-[10px] font-semibold text-smoke backdrop-blur">Blinds {fmt(g.sb, 0)}/{fmt(g.bb, 0)}</span>
        </div>
      )}
      {myHand && phase === 'playing' && me && !me.folded && scene && (
        <Anchor scene={scene} at={[seatGeo(scene, 0).cards.x + (portrait ? 0 : 2.1), 0.3, seatGeo(scene, 0).cards.z - (portrait ? 1.35 : 0)]}>
          <span className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-black shadow-lg ${myHand.score[0] >= 1 ? 'bg-gold text-ink' : 'bg-black/75 text-cream'}`}>{myHand.name}</span>
        </Anchor>
      )}
      {outcome && <ResultBanner key={g?.handNo} tone={outcome.tone} title={outcome.title} sub={outcome.sub} amount={outcome.amount} big={outcome.amount >= (g?.bb ?? 1) * 50} />}
      {phase === 'lobby' && (
        <div className="absolute inset-0 z-10 grid place-items-center p-4">
          <div className="result-in max-w-sm rounded-2xl border border-gold/30 bg-black/75 p-5 text-center shadow-2xl backdrop-blur-md">
            <div className="h-display text-2xl text-gold-grad sm:text-3xl">Texas Hold’em</div>
            <p className="mt-2 text-sm text-cream/80">No-limit poker against up to 7 chicken bots. The croupier chicken deals — it never plays.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5 text-[11px] font-bold">
              <span className="rounded-full bg-white/10 px-2.5 py-1">Blinds {STAKES[stakeIdx][0]}/{STAKES[stakeIdx][1]}</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1">{players} players</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1">Your coins = your stack</span>
            </div>
            <button className="btn-gold mt-4 w-full py-3" onClick={sitDown}><Users size={16} />Take a seat</button>
          </div>
        </div>
      )}
    </GameShell>
  );
}

const HAND_NAMES_OR = (g: Game, i: number) => {
  const s = g.seats[i];
  if (s.folded) return 'Folded';
  return g.board.length === 5 ? bestHand([...s.hole, ...g.board]).name : `Won before showdown`;
};

function Lbl({ t, s }: { t: string; s: string }) {
  return <span className="flex flex-col items-center leading-tight"><span>{t}</span><span className="text-[10px] font-semibold opacity-80 tabular">{s}</span></span>;
}

function Stat({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return <div className="rounded-xl bg-ink-900 px-2 py-2"><div className="text-[10px] uppercase tracking-wider text-smoke">{label}</div><div className={`font-display text-sm font-black tabular ${tone}`}>{value}</div></div>;
}

function SeatPod({ seat, dealer, active, winner, shown }: { seat: Seat; dealer: boolean; active: boolean; winner: boolean; shown: boolean }) {
  const out = seat.folded || seat.sittingOut;
  const showCards = shown && !seat.human && !seat.folded && seat.hole.length === 2;
  return (
    <div className={`animate-pop relative flex items-center gap-1.5 whitespace-nowrap rounded-full border py-1 pl-1 pr-2.5 shadow-xl backdrop-blur-md transition-all duration-300 sm:gap-2 sm:pr-3 ${winner ? 'border-gold bg-gradient-to-b from-gold-300/90 to-gold/90 text-ink shadow-gold' : active ? 'border-gold bg-black/85 text-cream ring-2 ring-gold/60' : 'border-white/15 bg-black/75 text-cream'} ${out && !winner ? 'opacity-45' : ''} ${seat.human ? 'scale-110' : ''}`}>
      <span className={`relative grid h-7 w-7 place-items-center rounded-full text-base sm:h-9 sm:w-9 sm:text-lg ${seat.human ? 'bg-gold/25' : 'bg-white/10'}`}>
        {seat.avatar}
        {active && <span className="absolute inset-0 animate-ping rounded-full ring-2 ring-gold" />}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="max-w-[80px] truncate text-[10px] font-bold sm:text-[11px]">{seat.human ? 'You' : seat.name}</span>
        <span className={`font-display text-[11px] font-black tabular sm:text-xs ${winner ? '' : 'text-gold'}`}>{seat.allIn && !out ? 'ALL-IN' : fmt(seat.stack, 0)}</span>
      </span>
      {dealer && <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-cream text-[8px] font-black text-ink shadow">D</span>}
      {seat.last && !winner && (
        <span key={seat.last + seat.total} className={`animate-pop absolute -top-5 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide shadow ${seat.last === 'Fold' ? 'bg-ink-500 text-smoke' : seat.last === 'Raise' || seat.last === 'Bet' || seat.last === 'All-in' ? 'bg-blood text-white' : seat.last === 'SB' || seat.last === 'BB' ? 'bg-sky-600 text-white' : 'bg-emerald-600 text-white'}`}>{seat.last}</span>
      )}
      {showCards && (
        <span className="absolute -bottom-5 left-1/2 flex -translate-x-1/2 gap-0.5">
          {seat.hole.map((c, k) => <MiniCard key={k} c={c} />)}
        </span>
      )}
    </div>
  );
}

function MiniCard({ c }: { c: Card }) {
  const red = c.s === 'H' || c.s === 'D';
  return <span className={`rounded bg-cream px-1 text-[10px] font-black leading-4 shadow ${red ? 'text-[#C8102E]' : 'text-ink'}`}>{c.r <= 10 ? c.r : 'JQKA'[c.r - 11]}{{ S: '♠', H: '♥', D: '♦', C: '♣' }[c.s]}</span>;
}
