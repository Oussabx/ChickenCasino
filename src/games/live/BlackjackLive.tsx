import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LogOut, PlusCircle, UserPlus, Users } from 'lucide-react';
import GameShell, { GameAction } from '../../components/GameShell';
import { toast, useStore } from '../../store';
import { sfx } from '../../lib/sound';
import { fmt, fmtCompact } from '../../lib/format';
import { Card, bjValue, isBlackjack } from '../../lib/cards';
import { Card3D, TableScene } from '../three/table3d';
import { Anchor, HandBadge, ResultBanner, Tone } from '../../components/TableUI';
import { liveTable, roomName } from '../../lib/net/tables';
import { useLiveTable } from '../../lib/net/live';
import { BJ_BET_MS, BJ_TURN_MS, BSeat, BState, BlackjackEngine } from '../../lib/net/bjEngine';
import { dec, decList } from '../../lib/net/cardsCodec';
import BuyIn from '../../components/live/BuyIn';
import { BetClock, ConnBadge, EmoteButton, SeatPod, useSeatSession } from '../../components/live/LiveBits';
import { Coin } from '../../components/Icons';

/* Live blackjack: up to five players, each against the chicken dealer. */

const R = 3.4; // D-table: arc centre is (0, -R)
const ANG = (i: number, n: number) => (Math.PI * (0.16 + (0.68 * (n - 1 - i)) / (n - 1))); // seat 0 = dealer's left (screen right)
const DEALER_Z = -1.95;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function BlackjackLive() {
  const { tableId = '' } = useParams();
  const t = liveTable(tableId);
  if (!t || t.game !== 'blackjack') return <Navigate to="/games/blackjack" replace />;
  return <BjTable key={t.id} tid={t.id} />;
}

interface Shown { r: number; cards: Record<string, Card3D[]>; dealer: Card3D[]; holeUp: boolean; holeDown: boolean; bets: Record<string, number>; settled: boolean }
const freshShown = (r = -1): Shown => ({ r, cards: {}, dealer: [], holeUp: false, holeDown: false, bets: {}, settled: false });

function BjTable({ tid }: { tid: string }) {
  const t = liveTable(tid)!;
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const { snap, table } = useLiveTable<BState>(roomName(t), () => new BlackjackEngine(t));
  const st = snap.state;
  const [buyFor, setBuyFor] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const session = useSeatSession(t, table, snap, (amt) => {
    if (amt > 0) toast({ title: `Cashed out ${fmt(amt, 0)}`, desc: 'Back in your wallet.', tone: 'gold' });
    else toast({ title: 'Out of chips', desc: 'Buy in again to keep playing.', tone: 'neutral' });
  });
  const mySeat = session.mySeat;
  const me: BSeat | null = mySeat >= 0 ? st?.s[mySeat] ?? null : null;
  const N = t.seats;

  useEffect(() => {
    if (params.get('sit') && st && mySeat < 0 && !session.pending) {
      const order = [2, 1, 3, 0, 4];
      const free = order.find((i) => !st.s[i]);
      if (free !== undefined) setBuyFor(free);
      params.delete('sit'); setParams(params, { replace: true });
    }
  }, [st, mySeat]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- geometry ---------- */
  const spot = (i: number, r: number) => { const a = ANG(i, N); return { x: Math.cos(a) * r, z: -R + Math.sin(a) * r, a }; };
  const geo = (i: number) => {
    const a = ANG(i, N);
    const n = { x: Math.cos(a), z: Math.sin(a) };
    const tan = { x: -n.z, z: n.x };
    const at = (r: number, side = 0) => ({ x: n.x * r + tan.x * side, z: -R + n.z * r + tan.z * side });
    return { n, tan, rot: Math.atan2(n.x, n.z), cards: at(4.35), bet: at(5.45), pod: at(7.05), badge: at(3.35) };
  };
  const cardPos = (i: number, h: number, nh: number, k: number) => {
    const g = geo(i);
    // split hands sit side by side, slightly smaller, so both stay readable
    const split = nh > 1;
    const side = (split ? (h === 0 ? 0.68 : -0.68) : 0) + k * (split ? 0.2 : 0.27) - (split ? 0.1 : 0.13);
    return { x: g.cards.x + g.tan.x * side - g.n.x * k * 0.1, z: g.cards.z + g.tan.z * side - g.n.z * k * 0.1, rot: g.rot, scale: split ? 0.82 : 1 };
  };

  /* ---------- 3D table ---------- */
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TableScene | null>(null);
  const [scene, setScene] = useState<TableScene | null>(null);
  const turbo = useStore((s) => s.settings.turbo);
  const wallet = useStore((s) => s.balance);
  useEffect(() => {
    const sc = new TableScene(hostRef.current!, {
      theme: t.theme,
      zones: Array.from({ length: N }, (_, i) => ({ ...spot(i, 5.45), r: 0.46 })),
      texts: [
        { text: t.name.toUpperCase(), z: -0.2, size: 0.34, arc: true },
        { text: 'BLACKJACK PAYS 3 TO 2 · DEALER STANDS ON ALL 17s', z: -0.72, size: 0.15, arc: true, weight: 800, color: 'rgba(248,246,239,.7)' },
      ],
      logoZ: null,
      view: { wide: [-0.55, 15.4, 8.3], narrow: [-0.2, 14.6, 12.4] },
    });
    sc.setTurbo(turbo);
    sceneRef.current = sc; setScene(sc);
    shown.current = freshShown(); applied.current = null;
    return () => { sc.dispose(); sceneRef.current = null; setScene(null); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { sceneRef.current?.setTurbo(turbo); }, [turbo]);

  /* ---------- reconcile ---------- */
  const shown = useRef<Shown>(freshShown());
  const applied = useRef<BState | null>(null);
  const latest = useRef<BState | null>(null);
  const running = useRef(false);
  const [dealtCount, setDealtCount] = useState<Record<string, number>>({});
  /** Round whose cards and chips have finished animating — results wait for it. */
  const [settledR, setSettledR] = useState(-1);
  useEffect(() => { latest.current = st; pump(); }, [st, scene]); // eslint-disable-line react-hooks/exhaustive-deps
  const pump = async () => {
    if (running.current) return;
    running.current = true;
    try {
      while (latest.current && latest.current !== applied.current && sceneRef.current) {
        const s = latest.current;
        await apply(s, sceneRef.current);
        applied.current = s;
      }
    } finally { running.current = false; }
  };

  const apply = async (s: BState, sc: TableScene) => {
    let sh = shown.current;
    if (s.r !== sh.r) {
      // new round: sweep last round's cards
      if (sh.r !== -1) sc.clear();
      shown.current = sh = freshShown(s.r);
      setDealtCount({});
    }
    // bets on the felt while betting is open
    if (s.ph === 'bet') {
      s.s.forEach((x, i) => {
        const b = x?.bet ?? 0;
        if ((sh.bets[`${i}`] ?? 0) !== b) { const p = geo(i).bet; sc.setChips(`s${i}h0`, b, p.x, p.z); sh.bets[`${i}`] = b; if (b) sfx.bet(); }
      });
      return;
    }
    if (s.ph === 'wait') { if (sh.r !== -1) { sc.clear(); shown.current = freshShown(s.r); setDealtCount({}); } return; }
    // hand bets (incl. doubles and splits)
    s.s.forEach((x, i) => x?.hs.forEach((h, k) => {
      const key = `${i}h${k}`;
      if ((sh.bets[key] ?? 0) !== h.bt && !h.r) {
        const p = geo(i).bet, tan = geo(i).tan;
        const side = x.hs.length > 1 ? (k === 0 ? 0.55 : -0.55) : 0;
        sc.setChips(`s${key}`, h.bt, p.x + tan.x * side, p.z + tan.z * side);
        sh.bets[key] = h.bt;
      }
    }));
    // cards, in dealing order: everyone's first card, dealer up-card, everyone's second, hole card, then the rest
    const dealer: string[] = s.d ? s.d.match(/.{2}/g) ?? [] : [];
    const queue: (() => Promise<void>)[] = [];
    const dealTo = (i: number, h: number, nh: number, k: number, c: Card) => async () => {
      const key = `${i}h${h}`;
      const list = (sh.cards[key] ??= []);
      if (list.length > k) return;
      const p = cardPos(i, h, nh, k);
      const m = await sc.deal(c, p.x, p.z, { rot: p.rot, scale: p.scale });
      list.push(m);
      setDealtCount((d) => ({ ...d, [key]: list.length }));
      sfx.tick();
    };
    const dealDealer = (k: number) => async () => {
      if (sh.dealer.length > k) return;
      const code = dealer[k];
      const m = await sc.deal(code === '??' ? null : dec(code), -0.62 + k * 0.62, DEALER_Z, { up: code !== '??' });
      if (code === '??') sh.holeDown = true;
      sh.dealer.push(m);
      setDealtCount((d) => ({ ...d, dealer: sh.dealer.length, ...(code === '??' ? { holeDown: 1 } : {}) }));
      sfx.tick();
    };
    // a split: the pair separates — first card stays as hand 1, second slides over to start hand 2
    s.s.forEach((x, i) => {
      const h0 = sh.cards[`${i}h0`];
      if (!x || x.hs.length < 2 || sh.cards[`${i}h1`] || !h0 || h0.length < 2) return;
      queue.push(async () => {
        const [a, b] = h0;
        sh.cards[`${i}h0`] = [a];
        sh.cards[`${i}h1`] = [b];
        const pa = cardPos(i, 0, 2, 0), pb = cardPos(i, 1, 2, 0);
        a.mesh.scale.setScalar(pa.scale); b.mesh.scale.setScalar(pb.scale);
        await Promise.all([sc.move(a, pa.x, pa.z), sc.move(b, pb.x, pb.z)]);
        const g = geo(i);
        x.hs.forEach((hh, k) => { const side = k === 0 ? 0.55 : -0.55; sc.setChips(`s${i}h${k}`, hh.bt, g.bet.x + g.tan.x * side, g.bet.z + g.tan.z * side); sh.bets[`${i}h${k}`] = hh.bt; });
        setDealtCount((d) => ({ ...d, [`${i}h0`]: 1, [`${i}h1`]: 1 }));
        sfx.bet();
      });
    });
    for (let r = 0; r < 2; r++) {
      s.s.forEach((x, i) => { const h = x?.hs[0]; if (!h) return; if (x.hs.length > 1) return; const cs = decList(h.c); if (cs[r]) queue.push(dealTo(i, 0, 1, r, cs[r])); });
      if (dealer[r]) queue.push(dealDealer(r));
    }
    s.s.forEach((x, i) => x?.hs.forEach((h, k) => decList(h.c).forEach((c, j) => queue.push(dealTo(i, k, x.hs.length, j, c)))));
    // the hole card turns over — only once every player card is on the felt, and before the dealer draws
    if (!dealer.includes('??') && dealer.length > 1) {
      queue.push(async () => {
        if (sh.holeUp || !sh.dealer[1] || !sh.holeDown) return;
        sh.holeUp = true;
        await sc.flip(sh.dealer[1], dec(dealer[1])); sfx.reveal();
        setDealtCount((d) => ({ ...d, holeUp: 1 }));
        await sleep(350);
      });
    }
    for (let k = 2; k < dealer.length; k++) queue.push(dealDealer(k));
    for (const step of queue) await step();
    // settle the chips
    if (s.ph === 'settle' && !sh.settled) {
      sh.settled = true;
      await sleep(300);
      let mine = 0, wager = 0;
      s.s.forEach((x, i) => x?.hs.forEach((h, k) => {
        if (!h.r) return;
        const out = h.r === 'lose' ? 'lose' : h.r === 'push' ? 'push' : 'win';
        sc.settleChips(`s${i}h${k}`, out, Math.max(0, (h.pay ?? 0) - h.bt));
        if (i === mySeat) { mine += h.pay ?? 0; wager += h.bt; }
      }));
      if (mySeat >= 0 && wager > 0) { if (mine > wager) sfx.win(); else if (mine < wager) sfx.lose(); }
      setSettledR(s.r);
    }
  };

  /* ---------- your round → history ---------- */
  const recorded = useRef(-1);
  const [outcome, setOutcome] = useState<{ tone: 'win' | 'lose' | 'push'; title: string; sub: string; key: number } | null>(null);
  useEffect(() => {
    if (!st || st.ph !== 'settle' || settledR !== st.r || !me?.hs.length || recorded.current === st.r) return;
    recorded.current = st.r;
    const wager = me.hs.reduce((a, h) => a + h.bt, 0);
    const pay = me.hs.reduce((a, h) => a + (h.pay ?? 0), 0);
    const res = me.hs.map((h) => h.r).join(' / ');
    useStore.getState().settle('blackjack', wager, +(pay / wager).toFixed(4), `${t.name} · ${res}`, { noCredit: true });
    if (pay > wager) setOutcome(null);
    else setOutcome({ tone: pay === wager ? 'push' : 'lose', title: pay === wager ? 'PUSH' : me.hs.every((h) => bjValue(decList(h.c)).total > 21) ? 'BUST' : 'DEALER WINS', sub: pay === wager ? 'your bet comes back' : '', key: st.r });
  }, [st, settledR]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (st?.ph === 'bet') setOutcome(null); }, [st?.ph]);

  /* ---------- betting & actions ---------- */
  const deadline = st ? snap.stateAt + (st.tl ?? 0) : 0;
  const [bet, setBet] = useState(t.lo);
  const maxBet = me ? Math.min(t.hi, me.k) : t.hi;
  const betting = st?.ph === 'bet' && !!me && !me.lv && me.k >= t.lo;
  useEffect(() => { if (betting) table?.send({ bet: { r: st!.r, a: Math.min(bet, maxBet) } }); }, [betting, st?.r, bet]); // eslint-disable-line react-hooks/exhaustive-deps
  const ready = () => { if (st) { sfx.bet(); table?.send({ bet: { r: st.r, a: Math.min(bet, maxBet) }, act: { h: st.r, q: -1, t: 'deal' } }); } };
  const myTurn = st?.ph === 'play' && st.ta === mySeat && mySeat >= 0;
  const [sentQ, setSentQ] = useState(-1);
  const canAct = !!myTurn && sentQ !== st!.tq;
  useEffect(() => { if (canAct) { sfx.tick(); navigator.vibrate?.(40); } }, [canAct]);
  const hand = canAct ? me!.hs[me!.ah] : null;
  const hc = hand ? decList(hand.c) : [];
  // short on table chips? splitting or doubling tops the seat up from the wallet
  const short = hand ? Math.max(0, +(hand.bt - me!.k).toFixed(2)) : 0;
  const coverable = !!hand && (short === 0 || (wallet >= short && me!.k + short <= t.buyMax));
  const canDouble = !!hand && hc.length === 2 && coverable;
  const ten = (c: Card) => (c.r === 14 ? 11 : Math.min(10, c.r));
  const isPair = !!hand && hc.length === 2 && me!.hs.length === 1 && ten(hc[0]) === ten(hc[1]);
  const canSplit = isPair && coverable;
  const send = (tp: string) => {
    if (!st || !canAct) return;
    if ((tp === 'split' && !canSplit) || (tp === 'double' && !canDouble)) return;
    const act = { h: st.r, q: st.tq, t: tp };
    if ((tp === 'split' || tp === 'double') && short > 0) {
      const sit = session.topUp(short);
      if (!sit) return;
      sfx.bet(); setSentQ(st.tq); table?.send({ sit, act });
      return;
    }
    sfx.click(); setSentQ(st.tq); table?.send({ act });
  };
  const extra = (on: boolean) => (on && short > 0 ? <span className="block whitespace-nowrap text-[10px] font-semibold opacity-80">+{fmtCompact(short)} from wallet</span> : null);
  useEffect(() => {
    if (!canAct) return;
    const k = (e: KeyboardEvent) => { if (e.target instanceof HTMLInputElement) return; const m: Record<string, string> = { h: 'hit', s: 'stand', d: 'double', p: 'split' }; const a = m[e.key.toLowerCase()]; if (a) send(a); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const chips = [1, 2, 5, 10].map((m) => t.lo * m).filter((v) => v <= t.hi);
  let action;
  if (snap.status !== 'live' || !st) action = <button className="btn-dark w-full py-4 text-sm" disabled>Joining the table…</button>;
  else if (mySeat < 0) {
    const free = [2, 1, 3, 0, 4].find((i) => !st.s[i]);
    action = session.pending
      ? <button className="btn-dark w-full py-4 text-sm" disabled>Taking your seat…</button>
      : <button className="btn-gold w-full py-4 text-base" disabled={free === undefined} onClick={() => setBuyFor(free ?? 0)}><UserPlus size={18} />{free === undefined ? 'Table full — watching' : 'Take a seat'}</button>;
  } else if (betting) action = (
    <button className="btn-gold w-full py-4 text-base" disabled={!!me?.rd} onClick={ready}>{me?.rd ? 'Waiting for the others…' : `Deal me in · ${fmtCompact(Math.min(bet, maxBet))}`}</button>
  );
  else if (canAct) action = (
    <div className="grid grid-cols-2 gap-2">
      <button className="btn-gold py-3 text-sm" onClick={() => send('hit')}>Hit</button>
      <button className="btn-red py-3 text-sm" onClick={() => send('stand')}>Stand</button>
      <button className="btn-double flex-col !gap-0 py-3 text-sm leading-tight" disabled={!canDouble} onClick={() => send('double')}>Double{extra(canDouble)}</button>
      <button className="btn-split flex-col !gap-0 py-3 text-sm leading-tight" disabled={!canSplit} onClick={() => send('split')} title={isPair ? undefined : 'Split needs a pair'}>Split{extra(canSplit)}</button>
    </div>
  );
  else {
    const who = st.ta >= 0 ? st.s[st.ta] : null;
    const label = me?.w ? 'You’re in from the next round' : me && me.k < t.lo && st.ph === 'bet' ? 'Not enough chips for the minimum bet' : st.ph === 'wait' ? (st.note ?? 'Shuffling…') : st.ph === 'bet' ? 'Betting…' : who ? `${who.n} is playing…` : st.ph === 'dealer' ? 'Dealer’s turn' : st.ph === 'settle' ? 'Paying out…' : 'Dealing…';
    action = <button className="btn-dark w-full py-4 text-sm" disabled>{label}</button>;
  }

  const controls = (
    <>
      <div className="rounded-xl p-[1.5px]" style={{ background: `linear-gradient(135deg, #${t.theme.trim.toString(16).padStart(6, '0')}, transparent 70%)` }}>
        <div className="rounded-[11px] bg-ink-900 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0"><div className="truncate font-display text-sm font-black">{t.name}</div><div className="text-[11px] text-smoke">Bets {fmtCompact(t.lo)}–{fmtCompact(t.hi)} · Buy-in {fmtCompact(t.buyMin)}–{fmtCompact(t.buyMax)}</div></div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-[11px] font-bold text-smoke"><Users size={12} />{st?.s.filter(Boolean).length ?? 0}/{N}</span>
          </div>
          {me && (
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-center">
              <div className="rounded-lg bg-black/40 px-2 py-1.5"><div className="text-[10px] uppercase tracking-wider text-smoke">Your chips</div><div className="font-display text-sm font-black text-gold tabular">{fmt(me.k, 0)}</div></div>
              <div className="rounded-lg bg-black/40 px-2 py-1.5"><div className="text-[10px] uppercase tracking-wider text-smoke">Wallet</div><div className="font-display text-sm font-black tabular"><WalletAmt /></div></div>
            </div>
          )}
        </div>
      </div>
      {betting && !me?.rd && (
        <div>
          <div className="mb-1.5 flex items-center justify-between"><span className="label">Your bet</span><span className="font-display text-sm font-black text-gold tabular">{fmt(Math.min(bet, maxBet), 0)}</span></div>
          <div className="grid grid-cols-4 gap-1.5">
            {chips.map((v) => <button key={v} type="button" disabled={v > maxBet} onClick={() => setBet(v)} className={`flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-black transition disabled:opacity-30 ${Math.min(bet, maxBet) === v ? 'bg-gold text-ink' : 'bg-ink-700 text-smoke hover:text-cream'}`}><Coin className="h-3 w-3" />{fmtCompact(v)}</button>)}
          </div>
          <input type="range" className="mt-2 w-full accent-[#F4C430]" min={t.lo} max={Math.max(t.lo, maxBet)} step={t.lo} value={Math.min(bet, maxBet)} onChange={(e) => setBet(+e.target.value)} aria-label="Bet amount" />
        </div>
      )}
      <GameAction>{action}</GameAction>
      {me
        ? <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-ghost w-full py-2 text-xs" disabled={!!me.lv} onClick={() => setAddOpen(true)}><PlusCircle size={13} />Add chips</button>
            <button type="button" className="btn-ghost w-full py-2 text-xs" disabled={!!me.lv} onClick={() => { session.standUp(); toast({ title: me.hs.length && st?.ph !== 'settle' ? 'You’ll stand up after this round' : 'Standing up…', tone: 'neutral' }); }}><LogOut size={13} />{me.lv ? 'Standing up…' : 'Stand up'}</button>
          </div>
        : <button type="button" className="btn-ghost w-full py-2 text-xs" onClick={() => nav('/games/blackjack')}><LogOut size={13} />Back to the lobby</button>}
      {canAct && <p className="hidden text-center text-[11px] text-smoke lg:block">Keys: H hit · S stand · D double · P split</p>}
    </>
  );

  const dealerCards: string[] = st?.d ? (st.d.match(/.{2}/g) ?? []) : [];
  // what's on the felt right now: the hole card counts only once it has visibly turned over
  const holeHidden = !!dealtCount.holeDown && !dealtCount.holeUp;
  const dealerKnown = dealerCards.slice(0, dealtCount.dealer ?? 0).filter((c, i) => c !== '??' && !(i === 1 && holeHidden)).map(dec);
  const dv = bjValue(dealerKnown);
  const presence = (p: string) => snap.peers.find((x) => x.peer === p)?.pres;
  const holeUp = !dealerCards.includes('??') && !holeHidden;

  return (
    <GameShell id="blackjack" tall controls={controls} title={t.name} subtitle={`Live blackjack · bets ${fmtCompact(t.lo)}–${fmtCompact(t.hi)}`} back="/games/blackjack" rules={[
      'This is a live table: up to five players, each playing their own hand against the chicken dealer.',
      `Bring between ${fmt(t.buyMin, 0)} and ${fmt(t.buyMax, 0)} coins. Bets are ${fmt(t.lo, 0)} to ${fmt(t.hi, 0)}. Whatever you have when you stand up goes back to your wallet.`,
      `Betting is open for ${BJ_BET_MS / 1000} seconds each round — press “Deal me in” to start sooner once everyone is ready.`,
      `On your turn (${BJ_TURN_MS / 1000}s): Hit, Stand, Double (one more card, bet doubled) or Split a pair into two hands. Time out and you stand.`,
      'The dealer checks for blackjack on an ace or ten, then draws to 16 and stands on all 17s. Blackjack pays 3 to 2; a win pays 1 to 1.',
    ]}>
      <div ref={hostRef} className="absolute inset-0" aria-label={`${t.name} blackjack table`} />
      <div className="table-vignette pointer-events-none absolute inset-0" />
      {st && scene && Array.from({ length: N }, (_, i) => {
        const x = st.s[i];
        const g = geo(i);
        if (!x) return mySeat < 0 && !session.pending ? (
          <Anchor key={`e${i}`} scene={scene} at={[g.pod.x, 0.3, g.pod.z]}>
            <button type="button" onClick={() => setBuyFor(i)} className="pointer-events-auto animate-pop flex items-center gap-1.5 rounded-full border border-dashed border-gold/50 bg-black/60 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-gold backdrop-blur transition hover:bg-gold hover:text-ink"><UserPlus size={13} />Sit</button>
          </Anchor>
        ) : null;
        const active = st.ta === i;
        return (
          <div key={x.id}>
            <Anchor scene={scene} at={[g.pod.x, 0.3, g.pod.z]}>
              <SeatPod name={x.n} av={x.av} fr={x.fr} ns={x.ns} stack={x.k} mine={i === mySeat} active={active} deadline={active ? deadline : 0} total={BJ_TURN_MS}
                emo={presence(x.p)?.emo} dim={!!x.w || !!x.lv} winner={settledR === st.r && x.hs.some((h) => h.r === 'win' || h.r === 'bj')}
                win={settledR === st.r ? Math.max(0, x.hs.reduce((a, h) => a + (h.pay ?? 0) - h.bt, 0)) : 0}
                badge={st.ph === 'bet' && x.rd ? 'Ready' : undefined} badgeTone="good" status={x.w ? 'next round' : x.lv ? 'leaving' : undefined} />
            </Anchor>
            {x.hs.map((h, k) => {
              const shownN = dealtCount[`${i}h${k}`] ?? 0;
              if (!shownN) return null;
              const cs = decList(h.c).slice(0, shownN);
              const v = bjValue(cs);
              const p = cardPos(i, k, x.hs.length, 0);
              const hr = settledR === st.r ? h.r : undefined; // results show once the dealer has finished
              const tone: Tone = hr ? (hr === 'lose' ? 'lose' : hr === 'push' ? 'push' : 'win') : active && x.ah === k ? 'active' : 'neutral';
              const val = v.total > 21 ? 'BUST' : isBlackjack(cs) && x.hs.length === 1 ? 'BJ' : v.total;
              return (
                <Anchor key={k} scene={scene} at={[p.x - g.n.x * 1.15, 0.3, p.z - g.n.z * 1.15]}>
                  <HandBadge value={val} tone={tone} sub={hr ? (hr === 'lose' ? '' : `+${fmtCompact((h.pay ?? 0) - h.bt)}`) : h.d ? '×2' : undefined} />
                </Anchor>
              );
            })}
          </div>
        );
      })}
      {st && scene && dealerKnown.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
          <HandBadge label="Dealer" value={holeUp ? (dv.total > 21 ? 'BUST' : dealerKnown.length === 2 && isBlackjack(dealerKnown) ? 'BJ' : dv.total) : dv.total} sub={!holeUp ? '+ ?' : undefined} tone={settledR === st.r && dv.total > 21 ? 'lose' : 'neutral'} />
        </div>
      )}
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col items-start gap-1">
        <ConnBadge snap={snap} here={snap.peers.length} />
        {st && st.ph !== 'wait' && <span className="rounded-full bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cream/80 backdrop-blur">Round #{st.r}</span>}
        <span className="rounded-full bg-black/60 px-3 py-1 text-[10px] font-semibold text-smoke backdrop-blur">Bets {fmtCompact(t.lo)}–{fmtCompact(t.hi)}</span>
      </div>
      {st?.ph === 'bet' && <BetClock deadline={deadline} />}
      {st?.note && st.ph === 'wait' && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 justify-center px-4">
          <div className="animate-floaty rounded-2xl border border-gold/30 bg-black/75 px-5 py-3 text-center text-sm font-semibold backdrop-blur-md">{st.note}</div>
        </div>
      )}
      {me && <EmoteButton lt={table as never} className="right-3 top-3" />}
      {outcome && <ResultBanner key={outcome.key} tone={outcome.tone} title={outcome.title} sub={outcome.sub} top />}
      <BuyIn table={t} open={addOpen && !!me} addTo={me?.k ?? 0} onClose={() => setAddOpen(false)} onConfirm={(amt) => {
        const sit = session.topUp(amt);
        if (!sit) return;
        table?.send({ sit }); setAddOpen(false); sfx.bet();
        toast({ title: `Adding ${fmt(amt, 0)} chips`, desc: undefined, tone: 'gold' });
      }} />
      <BuyIn table={t} open={buyFor !== null} onClose={() => setBuyFor(null)} onConfirm={(buy) => { if (session.sit(buyFor ?? 2, buy)) setBuyFor(null); }} />
    </GameShell>
  );
}

function WalletAmt() {
  const b = useStore((s) => s.balance);
  return <>{fmtCompact(b)}</>;
}

