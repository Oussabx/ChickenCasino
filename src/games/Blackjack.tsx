import { useEffect, useRef, useState } from 'react';
import GameShell, { GameAction } from '../components/GameShell';
import BetControls, { MiniBet, confirmBet } from '../components/BetControls';
import { useStore } from '../store';
import { sfx } from '../lib/sound';
import { fmt } from '../lib/format';
import { Card, Shoe, bjValue, isBlackjack } from '../lib/cards';
import { Card3D, TableScene } from './three/table3d';

interface Hand { cards: Card[]; bet: number; done: boolean; doubled: boolean; fromSplit: boolean; result?: 'win' | 'lose' | 'push' | 'bj' }
type Phase = 'bet' | 'dealing' | 'player' | 'dealer' | 'done';

const DEALER_Z = -1.7, PLAYER_Z = 1.0;
const dealerX = (i: number) => -0.9 + i * 0.62;
const handBaseX = (h: number, n: number) => (n === 1 ? 0 : h === 0 ? -2.2 : 2.2);
const cardX = (base: number, i: number) => base - 0.45 + i * 0.5;

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
  const shoe = useRef(new Shoe(6));
  const hole = useRef<{ c3: Card3D; card: Card } | null>(null);
  const handsRef = useRef<Hand[]>([]);
  const dealerHand = useRef<Card[]>([]);
  const firstCards = useRef<Card3D[]>([]);
  const turbo = useStore((s) => s.settings.turbo);

  useEffect(() => {
    const sc = new TableScene(hostRef.current!, { felt: 0x0e5a3a, text: ['BLACKJACK PAYS 3 TO 2', 'DEALER STANDS ON ALL 17s'], sub: 'CHICKEN CASINO' });
    sceneRef.current = sc;
    return () => { sc.dispose(); sceneRef.current = null; };
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
    sc.setChips('h0', bet, 0, 2.15);
    const m1 = await sc.deal(p1, cardX(0, 0), PLAYER_Z); sfx.tick(); h.cards.push(p1); sync([h]);
    await sc.deal(d1, dealerX(0), DEALER_Z); sfx.tick(); setDealer([d1]);
    const m2 = await sc.deal(p2, cardX(0, 1), PLAYER_Z - 0.06); sfx.tick(); h.cards.push(p2); sync([h]);
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
      sc.setChips(`h${active}`, h.bet, handBaseX(active, hs.length), 2.15);
    }
    setPhase('dealing');
    const c = shoe.current.draw();
    await sc.deal(c, cardX(handBaseX(active, hs.length), h.cards.length), PLAYER_Z - h.cards.length * 0.06);
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
    await Promise.all([sc.move(m1, cardX(-2.2, 0), PLAYER_Z), sc.move(m2, cardX(2.2, 0), PLAYER_Z)]);
    sc.setChips('h0', h.bet, -2.2, 2.15); sc.setChips('h1', h.bet, 2.2, 2.15);
    const c1 = shoe.current.draw(), c2 = shoe.current.draw();
    await sc.deal(c1, cardX(-2.2, 1), PLAYER_Z - 0.06); a.cards.push(c1);
    await sc.deal(c2, cardX(2.2, 1), PLAYER_Z - 0.06); b.cards.push(c2);
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
    sc?.celebrate(0, tone === 'win' ? PLAYER_Z : DEALER_Z, tone === 'win', hs.length > 1 ? 3.2 : 1.6);
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
      <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
        {dv && <Badge label="Dealer" value={dv.total > 21 ? 'BUST' : String(dv.total)} soft={dv.soft && dv.total < 21 && holeShown} />}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-3">
        {hands.map((hh, i) => {
          const v = bjValue(hh.cards);
          return <Badge key={i} label={hands.length > 1 ? `Hand ${i + 1}` : 'You'} value={v.total > 21 ? 'BUST' : isBlackjack(hh.cards) && !hh.fromSplit ? 'BJ' : String(v.total)} soft={v.soft && v.total < 21} active={phase === 'player' && i === active && hands.length > 1} />;
        })}
      </div>
      {summary && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className={`animate-pop rounded-2xl border px-6 py-3 text-center backdrop-blur-md ${summary.tone === 'win' ? 'border-gold/60 bg-black/60' : summary.tone === 'push' ? 'border-white/30 bg-black/60' : 'border-blood/60 bg-blood/20'}`}>
            <div className={`h-display text-4xl ${summary.tone === 'win' ? 'text-gold-grad' : summary.tone === 'push' ? 'text-cream' : 'text-blood neon-red'}`}>{summary.text}</div>
            <div className="mt-1 text-sm text-cream/85">{summary.payout > 0 ? `Paid ${fmt(summary.payout)}` : 'Better luck next hand'}</div>
          </div>
        </div>
      )}
    </GameShell>
  );
}

function Badge({ label, value, soft, active }: { label: string; value: string; soft?: boolean; active?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-1.5 text-center backdrop-blur ${active ? 'bg-gold text-ink shadow-gold' : 'bg-black/60'}`}>
      <div className={`text-[10px] font-semibold uppercase tracking-wider ${active ? 'text-ink/70' : 'text-smoke'}`}>{label}</div>
      <div className="font-display text-xl font-black tabular leading-none">{value}{soft && <span className="ml-1 text-[10px] opacity-70">soft</span>}</div>
    </div>
  );
}

