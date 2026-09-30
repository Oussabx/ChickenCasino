import { useEffect, useRef, useState } from 'react';
import GameShell, { GameAction } from '../components/GameShell';
import BetControls, { MiniBet, confirmBet } from '../components/BetControls';
import { useStore } from '../store';
import { sfx } from '../lib/sound';
import { Card, Shoe, bjValue, isBlackjack } from '../lib/cards';
import { Card3D, TableScene } from './three/table3d';
import { Anchor, HandBadge, ResultBanner, TableHint } from '../components/TableUI';

interface Hand { cards: Card[]; bet: number; done: boolean; doubled: boolean; fromSplit: boolean; result?: 'win' | 'lose' | 'push' | 'bj' }
type Phase = 'bet' | 'dealing' | 'player' | 'dealer' | 'done';

const DEALER_Z = -1.85, PLAYER_Z = 1.05, BET_Z = 2.35, SPLIT_X = 2.3;
const dealerX = (i: number) => -0.62 + i * 0.62;
const handBaseX = (h: number, n: number) => (n === 1 ? 0 : h === 0 ? -SPLIT_X : SPLIT_X);
const cardX = (base: number, i: number) => base - 0.3 + i * 0.52;
const chipZ = (n: number) => (n === 1 ? BET_Z : BET_Z - 0.3);

export const TABLE = {
  felt: 0x0c5234,
  zones: [
    { x: 0, z: BET_Z, r: 0.5 },
    { x: -SPLIT_X, z: BET_Z - 0.3, r: 0.42, dashed: true, color: 'rgba(244,196,48,.45)' },
    { x: SPLIT_X, z: BET_Z - 0.3, r: 0.42, dashed: true, color: 'rgba(244,196,48,.45)' },
  ],
  texts: [
    { text: 'BLACKJACK PAYS 3 TO 2', z: -0.12, size: 0.36, arc: true },
    { text: 'DEALER MUST DRAW TO 16 AND STAND ON ALL 17s', z: -0.56, size: 0.13, arc: true, weight: 700, color: 'rgba(248,246,239,.55)' },
  ],
  logoZ: null,
  view: { wide: [-0.25, 9.6, 5.9] as [number, number, number], narrow: [-0.2, 6.3, 6.4] as [number, number, number] },
};

export default function Blackjack() {
  const [bet, setBet] = useState(useStore.getState().settings.defaultBet);
  const [phase, setPhase] = useState<Phase>('bet');
  const [hands, setHands] = useState<Hand[]>([]);
  const [active, setActive] = useState(0);
  const [dealer, setDealer] = useState<Card[]>([]);
  const [holeShown, setHoleShown] = useState(false);
  const [summary, setSummary] = useState<{ text: string; tone: 'win' | 'lose' | 'push'; payout: number } | null>(null);

  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TableScene | null>(null);
  const [scene, setScene] = useState<TableScene | null>(null);
  const shoe = useRef(new Shoe(6));
  const hole = useRef<{ c3: Card3D; card: Card } | null>(null);
  const handsRef = useRef<Hand[]>([]);
  const dealerHand = useRef<Card[]>([]);
  const firstCards = useRef<Card3D[]>([]);
  const turbo = useStore((s) => s.settings.turbo);

  useEffect(() => {
    const sc = new TableScene(hostRef.current!, TABLE);
    sceneRef.current = sc; setScene(sc);
    return () => { sc.dispose(); sceneRef.current = null; setScene(null); };
  }, []);
  useEffect(() => { sceneRef.current?.setTurbo(turbo); }, [turbo]);

  const sync = (h: Hand[]) => { handsRef.current = h.map((x) => ({ ...x, cards: [...x.cards] })); setHands(handsRef.current); };
  const wait = (ms: number) => new Promise((r) => setTimeout(r, turbo ? ms / 2 : ms));

  const deal = async () => {
    const sc = sceneRef.current;
    if (!sc || !confirmBet(bet) || !useStore.getState().placeBet(bet)) return;
    sfx.bet();
    sc.clear();
    setSummary(null); setHoleShown(false); hole.current = null;
    setPhase('dealing');
    const p1 = shoe.current.draw(), d1 = shoe.current.draw(), p2 = shoe.current.draw(), d2 = shoe.current.draw();
    const h: Hand = { cards: [], bet, done: false, doubled: false, fromSplit: false };
    sync([h]); setActive(0); setDealer([]);
    sc.setChips('h0', bet, 0, BET_Z);
    const m1 = await sc.deal(p1, cardX(0, 0), PLAYER_Z); sfx.tick(); h.cards.push(p1); sync([h]);
    await sc.deal(d1, dealerX(0), DEALER_Z); sfx.tick(); setDealer([d1]);
    const m2 = await sc.deal(p2, cardX(0, 1), PLAYER_Z - 0.08); sfx.tick(); h.cards.push(p2); sync([h]);
    firstCards.current = [m1, m2];
    const c3 = await sc.deal(null, dealerX(1), DEALER_Z); sfx.tick();
    hole.current = { c3, card: d2 };
    dealerHand.current = [d1, d2];
    setDealer([d1, d2]);

    const dealerBJ = isBlackjack([d1, d2]);
    const playerBJ = isBlackjack(h.cards);
    if (dealerBJ || playerBJ) {
      // dealer peeks on A/10; naturals settle immediately
      if (dealerBJ) { await revealHole(); }
      h.result = playerBJ && dealerBJ ? 'push' : playerBJ ? 'bj' : 'lose';
      h.done = true; sync([h]);
      if (!dealerBJ && playerBJ) await revealHole();
      finish([h], [d1, d2]);
      return;
    }
    setPhase('player');
  };

  const revealHole = async () => {
    if (!hole.current || !sceneRef.current) return;
    await sceneRef.current.flip(hole.current.c3, hole.current.card);
    setHoleShown(true);
  };

  const nextHand = (hs: Hand[], idx: number) => {
    const n = hs.findIndex((x, i) => i > idx && !x.done);
    if (n >= 0) { setActive(n); setPhase('player'); return; }
    dealerPlay(hs);
  };

  const hit = async (double = false) => {
    const sc = sceneRef.current; if (!sc || phase !== 'player') return;
    const hs = handsRef.current.map((x) => ({ ...x, cards: [...x.cards] }));
    const h = hs[active];
    if (double) {
      if (!useStore.getState().placeBet(h.bet)) return;
      h.bet *= 2; h.doubled = true; sfx.bet();
      sc.setChips(`h${active}`, h.bet, handBaseX(active, hs.length), chipZ(hs.length));
    }
    setPhase('dealing');
    const c = shoe.current.draw();
    await sc.deal(c, cardX(handBaseX(active, hs.length), h.cards.length), PLAYER_Z - h.cards.length * 0.08);
    sfx.step();
    h.cards.push(c);
    const v = bjValue(h.cards).total;
    if (v > 21) { h.done = true; h.result = 'lose'; sfx.lose(); }
    else if (v === 21 || double) h.done = true;
    sync(hs);
    if (h.done) nextHand(hs, active); else setPhase('player');
  };

  const stand = () => {
    if (phase !== 'player') return;
    const hs = handsRef.current.map((x) => ({ ...x, cards: [...x.cards] }));
    hs[active].done = true; sync(hs); sfx.click();
    nextHand(hs, active);
  };

  const split = async () => {
    const sc = sceneRef.current; if (!sc || phase !== 'player') return;
    const hs = handsRef.current;
    const h = hs[0];
    if (!useStore.getState().placeBet(h.bet)) return;
    sfx.bet(); setPhase('dealing');
    const a: Hand = { cards: [h.cards[0]], bet: h.bet, done: false, doubled: false, fromSplit: true };
    const b: Hand = { cards: [h.cards[1]], bet: h.bet, done: false, doubled: false, fromSplit: true };
    // slide the two cards apart
    const [m1, m2] = firstCards.current;
    await Promise.all([sc.move(m1, cardX(-SPLIT_X, 0), PLAYER_Z), sc.move(m2, cardX(SPLIT_X, 0), PLAYER_Z)]);
    sc.setChips('h0', h.bet, -SPLIT_X, chipZ(2)); sc.setChips('h1', h.bet, SPLIT_X, chipZ(2));
    const c1 = shoe.current.draw(), c2 = shoe.current.draw();
    await sc.deal(c1, cardX(-SPLIT_X, 1), PLAYER_Z - 0.08); a.cards.push(c1);
    await sc.deal(c2, cardX(SPLIT_X, 1), PLAYER_Z - 0.08); b.cards.push(c2);
    const aces = a.cards[0].r === 14;
    for (const x of [a, b]) if (aces || bjValue(x.cards).total === 21) x.done = true;
    const next = [a, b];
    sync(next); setActive(0);
    if (a.done) nextHand(next, 0); else setPhase('player');
  };

  const dealerPlay = async (hs: Hand[]) => {
    const sc = sceneRef.current; if (!sc) return;
    setPhase('dealer');
    await revealHole();
    const dh = [...dealerHand.current];
    const anyLive = hs.some((x) => x.result !== 'lose');
    while (anyLive && (bjValue(dh).total < 17)) {
      await wait(350);
      const c = shoe.current.draw();
      await sc.deal(c, dealerX(dh.length), DEALER_Z);
      sfx.tick();
      dh.push(c); dealerHand.current = [...dh]; setDealer([...dh]);
    }
    const dv = bjValue(dh).total;
    for (const h of hs) {
      if (h.result) continue;
      const pv = bjValue(h.cards).total;
      h.result = dv > 21 || pv > dv ? 'win' : pv === dv ? 'push' : 'lose';
    }
    sync(hs);
    finish(hs, dh);
  };

  const finish = (hs: Hand[], dh: Card[]) => {
    const sc = sceneRef.current;
    let totalBet = 0, payout = 0;
    for (const h of hs) {
      totalBet += h.bet;
      payout += h.result === 'bj' ? h.bet * 2.5 : h.result === 'win' ? h.bet * 2 : h.result === 'push' ? h.bet : 0;
    }
    const mult = payout / totalBet;
    const dv = bjValue(dh).total;
    useStore.getState().settle('blackjack', totalBet, mult, `You ${hs.map((h) => bjValue(h.cards).total).join('/')} vs dealer ${dv}${hs.length > 1 ? ' · split' : ''}`);
    const tone = payout > totalBet ? 'win' : payout === totalBet ? 'push' : 'lose';
    const text = hs.some((h) => h.result === 'bj') ? 'BLACKJACK!' : tone === 'win' ? (dv > 21 ? 'DEALER BUSTS!' : 'YOU WIN!') : tone === 'push' ? 'PUSH' : hs.every((h) => bjValue(h.cards).total > 21) ? 'BUST' : 'DEALER WINS';
    setSummary({ text, tone, payout });
    tone === 'win' ? sfx.win() : tone === 'push' ? sfx.click() : sfx.lose();
    if (sc) {
      hs.forEach((h, i) => {
        const bx = handBaseX(i, hs.length), n = h.cards.length;
        const won = h.result === 'win' || h.result === 'bj';
        if (won || h.result === 'lose') sc.celebrate(bx - 0.3 + (n - 1) * 0.26, PLAYER_Z - (n - 1) * 0.04, won, 1.1 + (n - 1) * 0.52, 1.55 + (n - 1) * 0.08);
        sc.settleChips(`h${i}`, won ? 'win' : h.result === 'push' ? 'push' : 'lose', h.result === 'bj' ? h.bet * 1.5 : h.bet);
      });
      if (tone === 'lose' && dv <= 21) sc.highlight(dealerX(0) + (dh.length - 1) * 0.31, DEALER_Z, 1.1 + (dh.length - 1) * 0.62, 1.55);
    }
    setPhase('done');
  };

  const h = hands[active];
  const canDouble = phase === 'player' && h && h.cards.length === 2 && !h.doubled;
  const canSplit = phase === 'player' && hands.length === 1 && h && h.cards.length === 2 && Math.min(10, h.cards[0].r === 14 ? 11 : h.cards[0].r) === Math.min(10, h.cards[1].r === 14 ? 11 : h.cards[1].r);
  const dealerShown = holeShown ? dealer : dealer.slice(0, 1);
  const dv = dealerShown.length ? bjValue(dealerShown) : null;

  const action = phase === 'player' || (phase === 'dealing' && hands.length) ? (
    <div className="grid grid-cols-4 gap-2">
      <button className="btn-gold py-3.5 text-sm" disabled={phase !== 'player'} onClick={() => hit()}>Hit</button>
      <button className="btn-red py-3.5 text-sm" disabled={phase !== 'player'} onClick={stand}>Stand</button>
      <button className="btn-dark py-3.5 text-sm" disabled={!canDouble} onClick={() => hit(true)}>Double</button>
      <button className="btn-dark py-3.5 text-sm" disabled={!canSplit} onClick={split}>Split</button>
    </div>
  ) : (
    <button className="btn-gold w-full py-4 text-base" disabled={phase === 'dealer'} onClick={deal}>{phase === 'done' ? 'Deal again' : 'Deal'}</button>
  );

  const controls = (
    <>
      <BetControls value={bet} onChange={setBet} disabled={phase !== 'bet' && phase !== 'done'} />
      <GameAction extra={<MiniBet value={bet} onChange={setBet} disabled={phase !== 'bet' && phase !== 'done'} />}>{action}</GameAction>
      <div className="rounded-xl bg-ink-900 p-3 text-xs text-smoke space-y-1">
        <div className="flex justify-between"><span>Blackjack</span><b className="text-gold">3 : 2</b></div>
        <div className="flex justify-between"><span>Win</span><b className="text-cream">1 : 1</b></div>
        <div className="flex justify-between"><span>Dealer</span><b className="text-cream">Stands on soft 17</b></div>
        <div className="flex justify-between"><span>Shoe</span><b className="text-cream">6 decks</b></div>
      </div>
    </>
  );

  return (
    <GameShell id="blackjack" controls={controls} rules={[
      'Place your bet and press Deal. You and the dealer get two cards; one dealer card stays face down.',
      'Get closer to 21 than the dealer without going over. Face cards count 10, aces 1 or 11.',
      'Hit to take a card, Stand to hold, Double to double your bet for exactly one more card, Split a pair into two hands.',
      'The dealer draws to 16 and stands on all 17s. Wins pay 1:1, a blackjack (ace + ten) pays 3:2, ties push.',
    ]}>
      <div ref={hostRef} className="absolute inset-0" aria-label="Blackjack table" />
      <div className="table-vignette pointer-events-none absolute inset-0" />
      {dv && (
        <Anchor scene={scene} at={[dealerX(0) - 1.25, 0.2, DEALER_Z - 0.2]}>
          <HandBadge label="Dealer" value={dv.total > 21 ? 'BUST' : dealer.length === 2 && holeShown && isBlackjack(dealer) ? 'BJ' : dv.total} sub={dv.soft && dv.total < 21 && holeShown ? 'soft' : undefined}
            tone={dv.total > 21 ? 'lose' : phase === 'done' && summary?.tone === 'lose' ? 'win' : 'neutral'} />
        </Anchor>
      )}
      {hands.map((hh, i) => {
        const v = bjValue(hh.cards);
        const base = handBaseX(i, hands.length);
        const tone = hh.result === 'win' || hh.result === 'bj' ? 'win' : hh.result === 'lose' ? 'lose' : hh.result === 'push' ? 'push' : phase === 'player' && i === active ? 'active' : 'neutral';
        return (
          <Anchor key={i} scene={scene} at={hands.length > 1 ? [base, 0.2, PLAYER_Z - 1.05] : [base - 1.25, 0.2, PLAYER_Z]}>
            <HandBadge label={hands.length > 1 ? `Hand ${i + 1}` : 'You'} tone={tone}
              value={v.total > 21 ? 'BUST' : isBlackjack(hh.cards) && !hh.fromSplit ? 'BJ' : v.total} sub={v.soft && v.total < 21 ? 'soft' : hh.doubled ? '2×' : undefined} />
          </Anchor>
        );
      })}
      {summary && <ResultBanner key={dealer.length + summary.text} tone={summary.tone} title={summary.text} amount={summary.payout} sub={summary.payout > 0 ? 'Paid' : 'Better luck next hand'} big={summary.text === 'BLACKJACK!'} />}
      {phase === 'bet' && <TableHint>Set your bet and press <b className="text-gold">Deal</b></TableHint>}
    </GameShell>
  );
}
