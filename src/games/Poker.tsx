import { useEffect, useRef, useState } from 'react';
import GameShell, { GameAction } from '../components/GameShell';
import BetControls, { MiniBet, confirmBet } from '../components/BetControls';
import { useStore } from '../store';
import { sfx } from '../lib/sound';
import { fmt } from '../lib/format';
import { Card, Shoe, bestHand, cmpScore } from '../lib/cards';
import { Card3D, TableScene } from './three/table3d';
import { Anchor, HandBadge, ResultBanner, TableHint } from '../components/TableUI';

type Phase = 'bet' | 'dealing' | 'decide' | 'showdown' | 'done';

/** Ante pays (to 1) by the player's final hand when they win or the dealer doesn't qualify. */
const ANTE_PAYS: [string, number][] = [['Royal flush', 100], ['Straight flush', 20], ['Four of a kind', 10], ['Full house', 3], ['Flush', 2], ['Straight or less', 1]];
const antePay = (cat: number) => (cat === 9 ? 100 : cat === 8 ? 20 : cat === 7 ? 10 : cat === 6 ? 3 : cat === 5 ? 2 : 1);
/** Dealer needs a pair of 4s or better. */
const qualifies = (score: number[]) => score[0] >= 2 || (score[0] === 1 && score[1] >= 4);

const DZ = -2.1, BZ = -0.45, PZ = 1.15;
const boardX = (i: number) => -2.3 + i * 1.15;
const ANTE: [number, number] = [-2.15, 1.45], CALL: [number, number] = [2.15, 1.45];
export const TABLE = {
  felt: 0x17295e,
  zones: [
    { x: 0, z: BZ, w: 6.2, h: 1.85, dashed: true, color: 'rgba(244,196,48,.4)', fill: 'rgba(0,0,0,.1)' },
    { x: ANTE[0], z: ANTE[1], r: 0.52, label: 'ANTE' },
    { x: CALL[0], z: CALL[1], r: 0.52, label: 'CALL', sub: '2× ANTE' },
  ],
  texts: [
    { text: "CASINO HOLD'EM", z: 2.28, size: 0.3, arc: true },
    { text: 'DEALER QUALIFIES WITH A PAIR OF 4s OR BETTER', z: 2.64, size: 0.13, arc: true, weight: 700, color: 'rgba(248,246,239,.55)' },
  ],
  logoZ: null,
  view: { wide: [-0.4, 9.4, 6.3] as [number, number, number], narrow: [-0.45, 6.4, 6.8] as [number, number, number] },
};

export default function Poker() {
  const [ante, setAnte] = useState(useStore.getState().settings.defaultBet);
  const [phase, setPhase] = useState<Phase>('bet');
  const [player, setPlayer] = useState<Card[]>([]);
  const [board, setBoard] = useState<Card[]>([]);
  const [dealerShown, setDealerShown] = useState<Card[]>([]);
  const [outcome, setOutcome] = useState<{ title: string; sub: string; tone: 'win' | 'lose' | 'push'; payout: number } | null>(null);

  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TableScene | null>(null);
  const [scene, setScene] = useState<TableScene | null>(null);
  const hand = useRef<{ shoe: Shoe; player: Card[]; dealer: Card[]; board: Card[]; dealerMeshes: Card3D[]; meshes: Map<Card, Card3D> } | null>(null);
  const turbo = useStore((s) => s.settings.turbo);

  useEffect(() => {
    const sc = new TableScene(hostRef.current!, TABLE);
    sceneRef.current = sc; setScene(sc);
    return () => { sc.dispose(); sceneRef.current = null; setScene(null); };
  }, []);
  useEffect(() => { sceneRef.current?.setTurbo(turbo); }, [turbo]);

  const deal = async () => {
    const sc = sceneRef.current;
    if (!sc || !confirmBet(ante) || !useStore.getState().placeBet(ante)) return;
    sfx.bet();
    sc.clear(); setOutcome(null); setPlayer([]); setBoard([]); setDealerShown([]);
    setPhase('dealing');
    const shoe = Shoe.fresh();
    const p = [shoe.draw(), shoe.draw()], d = [shoe.draw(), shoe.draw()], b = [shoe.draw(), shoe.draw(), shoe.draw(), shoe.draw(), shoe.draw()];
    const meshes = new Map<Card, Card3D>();
    hand.current = { shoe, player: p, dealer: d, board: b, dealerMeshes: [], meshes };
    sc.setChips('ante', ante, ...ANTE);
    meshes.set(p[0], await sc.deal(p[0], -0.56, PZ)); sfx.tick();
    hand.current.dealerMeshes.push(await sc.deal(null, -0.56, DZ)); sfx.tick();
    meshes.set(p[1], await sc.deal(p[1], 0.56, PZ)); sfx.tick();
    hand.current.dealerMeshes.push(await sc.deal(null, 0.56, DZ)); sfx.tick();
    setPlayer(p);
    for (let i = 0; i < 3; i++) { meshes.set(b[i], await sc.deal(b[i], boardX(i), BZ)); sfx.tick(); }
    setBoard(b.slice(0, 3));
    setPhase('decide');
  };

  const fold = async () => {
    const h = hand.current, sc = sceneRef.current; if (!h || !sc || phase !== 'decide') return;
    setPhase('dealing');
    useStore.getState().settle('poker', ante, 0, 'Folded');
    sc.settleChips('ante', 'lose');
    await Promise.all(h.dealerMeshes.map((m, i) => sc.flip(m, h.dealer[i])));
    setDealerShown(h.dealer);
    setOutcome({ title: 'FOLDED', sub: `Ante lost (${fmt(ante)})`, tone: 'lose', payout: 0 });
    sfx.lose();
    setPhase('done');
  };

  const call = async () => {
    const h = hand.current, sc = sceneRef.current; if (!h || !sc || phase !== 'decide') return;
    if (!useStore.getState().placeBet(ante * 2)) return;
    sfx.bet(); setPhase('dealing');
    sc.setChips('call', ante * 2, ...CALL);
    for (let i = 3; i < 5; i++) { h.meshes.set(h.board[i], await sc.deal(h.board[i], boardX(i), BZ)); sfx.tick(); }
    setBoard(h.board);
    await new Promise((r) => setTimeout(r, turbo ? 150 : 350));
    for (let i = 0; i < 2; i++) { await sc.flip(h.dealerMeshes[i], h.dealer[i]); sfx.reveal(); }
    setDealerShown(h.dealer);
    setPhase('showdown');

    const pb = bestHand([...h.player, ...h.board]);
    const db = bestHand([...h.dealer, ...h.board]);
    const total = ante * 3;
    let payout = 0, title = '', sub = '', tone: 'win' | 'lose' | 'push' = 'lose';
    const cmp = cmpScore(pb.score, db.score);
    if (!qualifies(db.score)) {
      payout = ante + ante * antePay(pb.score[0]) + ante * 2; // ante paid, call pushes
      title = 'DEALER DOESN’T QUALIFY'; sub = `Ante pays ${antePay(pb.score[0])}:1 · call returned`; tone = 'win';
    } else if (cmp > 0) {
      payout = ante + ante * antePay(pb.score[0]) + ante * 4;
      title = `YOU WIN · ${pb.name.toUpperCase()}`; sub = `vs dealer ${db.name.toLowerCase()}`; tone = 'win';
    } else if (cmp === 0) {
      payout = total; title = 'PUSH'; sub = `Both ${pb.name.toLowerCase()}`; tone = 'push';
    } else {
      title = `DEALER WINS · ${db.name.toUpperCase()}`; sub = `Your ${pb.name.toLowerCase()} loses`;
    }
    // lift the five cards that made the winning hand
    const win = tone === 'lose' ? db.cards : pb.cards;
    if (tone !== 'push') win.forEach((c) => { const m = h.meshes.get(c) ?? h.dealerMeshes[h.dealer.indexOf(c)]; if (m) sc.lift(m, true); });
    const q = qualifies(db.score);
    sc.settleChips('ante', tone === 'win' ? 'win' : tone === 'push' ? 'push' : 'lose', ante * antePay(pb.score[0]));
    sc.settleChips('call', !q ? 'push' : tone === 'win' ? 'win' : tone === 'push' ? 'push' : 'lose', ante * 2);
    useStore.getState().settle('poker', total, payout / total, `${pb.name} vs ${db.name}${qualifies(db.score) ? '' : ' (no qualify)'}`);
    setOutcome({ title, sub, tone, payout });
    tone === 'win' ? sfx.win() : tone === 'push' ? sfx.click() : sfx.lose();
    if (tone !== 'push') sc.celebrate(0, tone === 'lose' ? DZ : PZ, tone === 'win', 2.4, 1.8);
    setPhase('done');
  };

  const current = player.length ? bestHand([...player, ...board]) : null;
  const dealerHand = dealerShown.length ? bestHand([...dealerShown, ...board]) : null;
  const betLocked = phase !== 'bet' && phase !== 'done';

  const action = phase === 'decide' ? (
    <div className="grid grid-cols-2 gap-2">
      <button className="btn-gold py-4 text-base" onClick={call}><span className="flex flex-col leading-tight"><span>Call</span><span className="text-[11px] opacity-70 tabular">{fmt(ante * 2)}</span></span></button>
      <button className="btn-red py-4 text-base" onClick={fold}>Fold</button>
    </div>
  ) : (
    <button className="btn-gold w-full py-4 text-base" disabled={betLocked} onClick={deal}>{phase === 'done' ? 'Deal again' : `Deal · ante ${fmt(ante, 0)}`}</button>
  );

  const controls = (
    <>
      <BetControls value={ante} onChange={setAnte} disabled={betLocked} label="Ante" />
      <p className="-mt-2 text-[11px] text-smoke">Calling costs 2× the ante, so a full hand risks {fmt(ante * 3, 0)}.</p>
      <GameAction extra={<MiniBet value={ante} onChange={setAnte} disabled={betLocked} />}>{action}</GameAction>
      <div className="rounded-xl bg-ink-900 p-3 text-xs">
        <div className="label mb-2">Ante pays</div>
        {ANTE_PAYS.map(([name, pays]) => {
          const hit = current && phase === 'done' && outcome?.tone === 'win' && ((name === 'Straight or less' && current.score[0] <= 4) || name === current.name);
          return (
            <div key={name} className={`flex justify-between rounded px-1.5 py-0.5 ${hit ? 'bg-gold/15 text-gold' : 'text-smoke'}`}>
              <span>{name}</span><b className={hit ? 'text-gold' : 'text-cream'}>{pays} : 1</b>
            </div>
          );
        })}
        <div className="mt-2 border-t border-white/5 pt-2 text-smoke">Call pays 1:1 when you beat a qualifying dealer.</div>
      </div>
    </>
  );

  return (
    <GameShell id="poker" controls={controls} rules={[
      'Post an ante and press Deal. You get two cards, the dealer two face-down cards, and three community cards (the flop) are dealt.',
      'Call (2× your ante) to see the turn and river, or Fold and give up the ante.',
      'Best five-card hand from your two cards plus the five on the board wins. The dealer must have a pair of 4s or better to qualify.',
      'Dealer doesn’t qualify: your ante pays by the table and the call is returned. You beat a qualifying dealer: ante pays by the table and the call pays 1:1. Ties push.',
    ]}>
      <div ref={hostRef} className="absolute inset-0" aria-label="Casino Hold'em table" />
      <div className="table-vignette pointer-events-none absolute inset-0" />
      {player.length > 0 && (
        <Anchor scene={scene} at={[-1.95, 0.2, DZ]}>
          <HandBadge label="Dealer" value={dealerHand ? dealerHand.name : '? ?'} tone={outcome?.tone === 'lose' && phase === 'done' && dealerShown.length ? 'win' : 'neutral'} />
        </Anchor>
      )}
      {current && (
        <Anchor scene={scene} at={[0, 0.2, PZ + 1.0]}>
          <HandBadge label="You" value={current.name} tone={outcome ? (outcome.tone === 'win' ? 'win' : outcome.tone === 'push' ? 'push' : 'lose') : current.score[0] >= 1 ? 'active' : 'neutral'} />
        </Anchor>
      )}
      {outcome && <ResultBanner key={outcome.title + outcome.payout} tone={outcome.tone} title={outcome.title} sub={outcome.sub} amount={outcome.payout} big={outcome.payout >= ante * 12} />}
      {phase === 'bet' && <TableHint>Post an ante and press <b className="text-gold">Deal</b></TableHint>}
    </GameShell>
  );
}
