import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LogOut, UserPlus, Users } from 'lucide-react';
import GameShell, { GameAction } from '../../components/GameShell';
import { toast, useStore } from '../../store';
import { sfx } from '../../lib/sound';
import { fmt, fmtCompact } from '../../lib/format';
import { Card, HAND_NAMES, bestHand } from '../../lib/cards';
import { Card3D, TableScene } from '../three/table3d';
import { Anchor, ResultBanner } from '../../components/TableUI';
import PlayingCard from '../../components/PlayingCard';
import Avatar, { NAME_CLASS } from '../../components/Avatar';
import { usePhoneLayout } from '../../lib/phone';
import { liveTable, roomName } from '../../lib/net/tables';
import { useLiveTable } from '../../lib/net/live';
import { PSeat, PState, PokerEngine, TURN_MS } from '../../lib/net/pokerEngine';
import { decList } from '../../lib/net/cardsCodec';
import BuyIn from '../../components/live/BuyIn';
import { ConnBadge, EmoteBubble, Reactions, TimerRing, useSeatSession } from '../../components/live/LiveBits';

/* Live Texas Hold'em: real players share the table; the host page deals. */

const SLOTS = [0, 1, 2, 3, 4, 6, 7, 8, 9]; // ten spots round the table; 5 (top) is the dealer
const slotsFor = (n: number) => Array.from({ length: n }, (_, k) => SLOTS[Math.round((k * SLOTS.length) / n) % SLOTS.length]);
const BOARD_X = (i: number) => -2.6 + i * 1.3;
const potAt = (portrait: boolean): [number, number] => (portrait ? [0, -3.5] : [0, -2.05]);
const STREET = ['Pre-flop', 'Flop', 'Turn', 'River', 'Showdown'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function PokerLive() {
  const { tableId = '' } = useParams();
  const t = liveTable(tableId);
  if (!t || t.game !== 'poker') return <Navigate to="/games/poker" replace />;
  return <PokerTable key={t.id} tid={t.id} />;
}

interface Shown { h: number; dealt: boolean; board: number; sr: number; bets: Record<number, number>; folded: Set<number>; show: boolean; revealed: boolean }
const freshShown = (): Shown => ({ h: -1, dealt: false, board: 0, sr: 0, bets: {}, folded: new Set(), show: false, revealed: false });

function PokerTable({ tid }: { tid: string }) {
  const t = liveTable(tid)!;
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const { snap, table } = useLiveTable<PState>(roomName(t), () => new PokerEngine(t));
  const st = snap.state;
  const [buyFor, setBuyFor] = useState<number | null>(null);
  const [bust, setBust] = useState(false);
  const session = useSeatSession(t, table, snap, (amt) => {
    if (amt > 0) toast({ title: `Cashed out ${fmt(amt, 0)}`, desc: 'Back in your wallet.', tone: 'gold' });
    else setBust(true);
  });
  const mySeat = session.mySeat;
  const me: PSeat | null = mySeat >= 0 ? st?.s[mySeat] ?? null : null;
  const myCards = useMemo(() => (me?.in && !me.f ? decList(snap.secret) : []), [me?.in, me?.f, snap.secret]);
  const phoneUI = usePhoneLayout().phone;

  // open the buy-in straight away when arriving from the lobby's Join
  useEffect(() => {
    if (params.get('sit') && st && mySeat < 0 && !session.pending) {
      const free = st.s.findIndex((x) => !x);
      if (free >= 0) setBuyFor(free);
      params.delete('sit'); setParams(params, { replace: true });
    }
  }, [st, mySeat]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- 3D table ---------- */
  const [portrait, setPortrait] = useState(false);
  const [scene, setScene] = useState<TableScene | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TableScene | null>(null);
  const [hostW, setHostW] = useState(800);
  const turbo = useStore((s) => s.settings.turbo);
  const midHand = useRef(false);
  useEffect(() => {
    const sc = new TableScene(hostRef.current!, { theme: t.theme, oval: { portrait }, logoZ: null, title: t.name.toUpperCase() });
    sc.setTurbo(turbo);
    sceneRef.current = sc; setScene(sc);
    gen.current++; shown.current = freshShown(); applied.current = null;
    return () => { sc.dispose(); sceneRef.current = null; setScene(null); };
  }, [portrait]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = hostRef.current!;
    const ro = new ResizeObserver(() => { setHostW(el.clientWidth); if (!midHand.current) setPortrait(el.clientHeight > el.clientWidth * 1.05); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { sceneRef.current?.setTurbo(turbo); }, [turbo]);

  // you always sit at the bottom: the table turns so your seat is nearest
  const N = t.seats;
  // refs, so an animation already running always uses the current seat and orientation
  const seatRef = useRef(mySeat); seatRef.current = mySeat;
  const portraitRef = useRef(portrait); portraitRef.current = portrait;
  const gen = useRef(0);
  const base = useMemo(() => slotsFor(N), [N]);
  const slotOf = (i: number) => base[(i - Math.max(0, seatRef.current) + N) % N];
  const seatGeo = (sc: TableScene, i: number) => {
    const f = slotOf(i) / 10;
    const e = sc.edge(f);
    const inward = e.n.clone().negate();
    const tan = { x: -e.n.z, z: e.n.x };
    const at = (d: number, side = 0) => ({ x: e.p.x + inward.x * d + tan.x * side, z: e.p.z + inward.z * d + tan.z * side });
    const mine = i === seatRef.current;
    return { e, tan, mine, ...(mine
      ? { pod: sc.edge(f, 0.12).p, cards: at(1.7), bet: at(1.7, 2.2), button: at(1.7, -2.1) }
      : { pod: sc.edge(f, -0.05).p, cards: at(1.5), bet: at(2.5), button: at(1.4, 1.3) }) };
  };

  /* ---------- reconcile the 3D table with the host's state ---------- */
  const shown = useRef<Shown>(freshShown());
  const applied = useRef<PState | null>(null);
  const latest = useRef<PState | null>(null);
  const running = useRef(false);
  const holes = useRef<Map<number, Card3D[]>>(new Map());
  const [vis, setVis] = useState({ h: -1, hole: 0, board: 0, reveal: false });
  const recorded = useRef(-1);

  // sitting down turns the table: lay everything out again from your new side
  const seatSeen = useRef(mySeat);
  useEffect(() => {
    if (seatSeen.current === mySeat) return;
    seatSeen.current = mySeat;
    sceneRef.current?.clear();
    gen.current++; holes.current = new Map(); shown.current = freshShown(); applied.current = null;
    setVis({ h: -1, hole: 0, board: 0, reveal: false });
  }, [mySeat]);
  useEffect(() => { latest.current = st; pump(); }, [st, scene, mySeat]); // eslint-disable-line react-hooks/exhaustive-deps

  const pump = async () => {
    if (running.current) return;
    running.current = true;
    try {
      while (latest.current && latest.current !== applied.current && sceneRef.current) {
        const s = latest.current, g0 = gen.current;
        await apply(s, sceneRef.current);
        // the table was reset mid-animation (you sat down, it turned): lay it out again
        if (gen.current === g0) applied.current = s;
      }
    } finally { running.current = false; }
  };

  const apply = async (s: PState, sc: TableScene) => {
    const g0 = gen.current;
    const stale = () => gen.current !== g0;
    const mySeat = seatRef.current, portrait = portraitRef.current;
    const sh = shown.current;
    const fast = s !== latest.current; // already behind: skip the long animations
    // between hands: sweep the table
    if (s.ph === 'wait') {
      midHand.current = false;
      // once per break: sweep cards, chips and any winner's glow
      if (sh.h !== -2) { sc.clear(); sc.resetGlow(); holes.current = new Map(); shown.current = { ...freshShown(), h: -2 }; setVis({ h: -1, hole: 0, board: 0, reveal: false }); }
      return;
    }
    midHand.current = true;
    // a new hand: button, cards
    if (sh.h !== s.h) {
      sc.clear();
      holes.current = new Map();
      shown.current = { ...freshShown(), h: s.h };
      setVis({ h: s.h, hole: 0, board: 0, reveal: false });
      const b = seatGeo(sc, s.btn).button; sc.moveButton(b.x, b.z);
      const order: number[] = [];
      for (let k = 1; k <= N; k++) { const i = (s.btn + k) % N; if (s.s[i]?.in) order.push(i); }
      for (const [i, x] of s.s.entries()) if (x?.b) { const g = seatGeo(sc, i).bet; sc.setChips(`b${i}`, x.b, g.x, g.z); shown.current.bets[i] = x.b; }
      sfx.bet();
      for (let r = 0; r < 2; r++) for (const i of order) {
        const g = seatGeo(sc, i);
        const side = g.mine ? (r ? 0.74 : -0.74) : (r ? 0.34 : -0.34);
        const rot = g.mine ? 0 : Math.atan2(g.e.n.x, g.e.n.z) * 0.9 + (r ? 0.12 : -0.12);
        if (sceneRef.current !== sc || stale()) return;
        const c3 = await sc.deal(null, g.cards.x + g.tan.x * side, g.cards.z + g.tan.z * side, { scale: g.mine ? 1.42 : 0.9, rot, up: false });
        const list = holes.current.get(i) ?? []; list.push(c3); holes.current.set(i, list);
        if (g.mine) { sc.setCardVisible(c3, false); setVis((v) => ({ ...v, hole: v.hole + 1 })); }
        sfx.tick();
      }
      shown.current.dealt = true;
    }
    const cur = shown.current;
    // folds: those cards go to the muck
    s.s.forEach((x, i) => {
      if (x?.f && !cur.folded.has(i)) {
        cur.folded.add(i);
        if (i !== mySeat) (holes.current.get(i) ?? []).forEach((m) => { sc.setCardVisible(m, true); sc.discard(m); });
        sfx.click();
      }
    });
    // bets in front of each player
    const potNow = s.s.reduce((a, x) => a + (x?.tt ?? 0), 0);
    const [px, pz] = potAt(portrait);
    if (s.sr > cur.sr || (s.ph === 'show' && !cur.show)) {
      // street over: everything goes into the middle
      await sc.gatherChips(Array.from({ length: N }, (_, k) => `b${k}`), px, pz, potNow);
      cur.bets = {}; cur.sr = s.sr;
    }
    s.s.forEach((x, i) => {
      const b = x?.b ?? 0;
      if ((cur.bets[i] ?? 0) !== b && s.ph === 'play') {
        const g = seatGeo(sc, i).bet; sc.setChips(`b${i}`, b, g.x, g.z); cur.bets[i] = b;
        if (b) sfx.bet();
      }
    });
    // all-in: everyone still in turns their cards up before the board runs out
    if (s.sh && !cur.revealed) {
      cur.revealed = true;
      Object.keys(s.sh).forEach((k) => { if (+k !== mySeat) (holes.current.get(+k) ?? []).forEach((m) => sc.setCardVisible(m, false)); });
      setVis((v) => ({ ...v, reveal: true }));
      sfx.reveal();
      await sleep(fast ? 100 : 600);
    }
    // board cards
    const board = decList(s.bd);
    if (board.length > cur.board) {
      for (let k = cur.board; k < board.length; k++) {
        const m = await sc.deal(board[k], BOARD_X(k), portrait ? 0.2 : -0.35, { scale: 1.24 });
        sc.setCardVisible(m, false);
        if (stale()) return;
        cur.board = k + 1;
        setVis((v) => ({ ...v, board: k + 1 }));
        sfx.reveal();
        if (!fast) await sleep(120);
      }
    }
    // showdown: cards up, pot to the winner
    if (stale()) return;
    if (s.ph === 'show' && !cur.show) {
      cur.show = true;
      const w = s.win?.[0]?.s[0];
      if (w !== undefined) {
        const g = seatGeo(sc, w);
        sc.dealerGesture(g.bet.x, g.bet.z);
        await sleep(fast ? 50 : 400);
        await sc.pushChips('pot', g.bet.x, g.bet.z);
        if (w === mySeat) { sfx.win(); sc.celebrate(g.cards.x, g.cards.z, true, 2.6, 1.9); }
        else sc.highlight(g.cards.x, g.cards.z, 1.8, 1.6);
      }
    }
  };

  /* ---------- your hand's result → history & stats ---------- */
  const [outcome, setOutcome] = useState<{ tone: 'win' | 'lose' | 'push'; title: string; sub: string; key: number } | null>(null);
  useEffect(() => {
    if (!st || st.ph !== 'show' || recorded.current === st.h || !st.win) return;
    recorded.current = st.h;
    const w = st.win[0];
    const winner = st.s[w.s[0]];
    const hand = w.hn ? `with ${w.hn.toLowerCase()}` : 'everyone else folded';
    if (me?.in) {
      const won = st.win.reduce((a, p) => a + (p.s.includes(mySeat) ? p.a / p.s.length : 0), 0);
      const bet = me.tt;
      if (bet > 0) useStore.getState().settle('poker', bet, +(won / bet).toFixed(4), `${t.name} · ${w.hn || 'won before showdown'} · pot ${fmt(w.a, 0)}`, { noCredit: true });
      if (won > 0) { setOutcome(null); return; }
      setOutcome({ tone: me.f ? 'push' : 'lose', title: `${(winner?.n ?? 'Someone').toUpperCase()} WINS`, sub: hand, key: st.h });
      if (!me.f) sfx.lose();
    } else if (winner) {
      setOutcome({ tone: 'push', title: `${winner.n.toUpperCase()} WINS`, sub: `${fmtCompact(w.a)} ${hand}`, key: st.h });
    }
  }, [st]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (st?.ph === 'play' && outcome && outcome.key !== st.h) setOutcome(null); }, [st?.ph, st?.h]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- your turn ---------- */
  const myTurn = !!st && st.ph === 'play' && st.ta === mySeat && mySeat >= 0;
  const [sentQ, setSentQ] = useState(-1);
  const canAct = myTurn && sentQ !== st!.tq;
  const deadline = st ? snap.stateAt + (st.tl ?? 0) : 0;
  useEffect(() => { if (canAct) { sfx.tick(); navigator.vibrate?.(40); } }, [canAct]);
  const L = canAct && me ? (() => {
    const toCall = Math.min(me.k, Math.max(0, st!.cb - me.b));
    const maxTo = me.b + me.k;
    const minTo = Math.min(maxTo, st!.cb + st!.mr);
    return { toCall, canCheck: toCall === 0, minTo, maxTo, canRaise: maxTo > st!.cb && me.k > toCall, isBet: st!.cb === 0 };
  })() : null;
  const potNow = st ? st.s.reduce((a, x) => a + (x?.tt ?? 0), 0) : 0;
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [raiseTo, setRaiseToRaw] = useState(0);
  const [raiseText, setRaiseText] = useState('');
  const setRaiseTo = (v: number) => { setRaiseToRaw(v); setRaiseText(String(v)); };
  useEffect(() => {
    if (!L) { setRaiseOpen(false); return; }
    const half = Math.round((potNow * 0.5) / t.lo) * t.lo;
    setRaiseTo(Math.min(L.maxTo, Math.max(L.minTo, st!.cb === 0 ? half || L.minTo : L.minTo)));
  }, [canAct, st?.tq]); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = (type: string, to?: number) => {
    if (!st || !canAct) return;
    sfx.click();
    setSentQ(st.tq);
    setRaiseOpen(false);
    table?.send({ act: { h: st.h, q: st.tq, t: type, a: to } });
  };
  const presets = L && st ? ([
    ['Min', L.minTo],
    ['½ pot', st.cb + Math.max(st.mr, (potNow + L.toCall) * 0.5)],
    ['¾ pot', st.cb + Math.max(st.mr, (potNow + L.toCall) * 0.75)],
    ['Pot', st.cb + Math.max(st.mr, potNow + L.toCall)],
    ['All-in', L.maxTo],
  ] as [string, number][]).map(([l, v]) => [l, Math.min(L.maxTo, Math.max(L.minTo, Math.round(v / t.lo) * t.lo))] as [string, number]) : [];
  const clampRaise = (v: number) => (L ? Math.min(L.maxTo, Math.max(L.minTo, Math.round(v))) : v);
  const typed = (txt: string) => { setRaiseText(txt); const v = parseFloat(txt.replace(/,/g, '')); if (!Number.isNaN(v)) setRaiseToRaw(clampRaise(v)); };
  const raisePanel = L && raiseOpen && L.canRaise ? (
    <div className="rounded-xl border border-gold/25 bg-ink-900/95 p-3">
      <div className="label mb-1.5">{L.isBet ? 'Bet amount' : 'Raise to'}</div>
      <div className="flex items-center gap-2">
        <button type="button" className="btn-dark h-9 w-9 shrink-0 !p-0 text-lg" onClick={() => setRaiseTo(clampRaise(raiseTo - t.hi))} aria-label="Less">−</button>
        <input type="text" inputMode="numeric" aria-label="Raise amount" value={raiseText} onChange={(e) => typed(e.target.value)} onBlur={() => setRaiseTo(raiseTo)}
          onKeyDown={(e) => { if (e.key === 'Enter') choose(raiseTo >= L.maxTo ? 'allin' : L.isBet ? 'bet' : 'raise', raiseTo); }}
          className="input h-9 min-w-0 flex-1 !py-1 text-center font-display text-lg font-black text-gold tabular" />
        <button type="button" className="btn-dark h-9 w-9 shrink-0 !p-0 text-lg" onClick={() => setRaiseTo(clampRaise(raiseTo + t.hi))} aria-label="More">+</button>
      </div>
      <input type="range" className="mt-2 w-full accent-[#F4C430]" min={L.minTo} max={L.maxTo} step={t.lo} value={raiseTo} onChange={(e) => setRaiseTo(clampRaise(+e.target.value))} aria-label="Raise slider" />
      <div className="mt-2 grid grid-cols-5 gap-1">
        {presets.map(([l, v]) => <button key={l} type="button" onClick={() => setRaiseTo(v)} className={`rounded-lg py-1.5 text-[11px] font-bold transition ${raiseTo === v ? 'bg-gold text-ink' : 'bg-ink-700 text-smoke hover:text-cream'}`}>{l}</button>)}
      </div>
    </div>
  ) : null;

  const myHand = useMemo(() => (myCards.length === 2 ? bestHand([...myCards, ...decList(st?.bd).slice(0, vis.board)]) : null), [myCards, st?.bd, vis.board]);
  const firstFree = st ? st.s.findIndex((x) => !x) : -1;
  const watching = snap.peers.length - (st?.s.filter((x) => x && x.p).length ?? 0);

  /* ---------- action button ---------- */
  let action;
  if (snap.status !== 'live' || !st) action = <button className="btn-dark w-full py-4 text-sm" disabled>Joining the table…</button>;
  else if (mySeat < 0) action = session.pending
    ? <button className="btn-dark w-full py-4 text-sm" disabled>Taking your seat…</button>
    : <button className="btn-gold w-full py-4 text-base" disabled={firstFree < 0} onClick={() => setBuyFor(firstFree)}><UserPlus size={18} />{firstFree < 0 ? 'Table full — watching' : 'Take a seat'}</button>;
  else if (L) action = (
    <div className="grid grid-cols-3 gap-2">
      <button className="btn-red py-3 text-sm" onClick={() => choose('fold')}><Lbl t="Fold" s="give up" /></button>
      {L.canCheck
        ? <button className="btn-double py-3 text-sm" onClick={() => choose('check')}><Lbl t="Check" s="free" /></button>
        : <button className="btn-double py-3 text-sm" onClick={() => choose('call')}><Lbl t={L.toCall >= me!.k ? 'All-in' : 'Call'} s={fmt(L.toCall, 0)} /></button>}
      {raiseOpen
        ? <button className="btn-gold py-3 text-sm" onClick={() => choose(raiseTo >= L.maxTo ? 'allin' : L.isBet ? 'bet' : 'raise', raiseTo)}><Lbl t={raiseTo >= L.maxTo ? 'All-in' : L.isBet ? 'Bet' : 'Raise'} s={fmt(raiseTo, 0)} /></button>
        : <button className="btn-gold py-3 text-sm" disabled={!L.canRaise} onClick={() => setRaiseOpen(true)}><Lbl t={L.isBet ? 'Bet' : 'Raise'} s={L.canRaise ? `min ${fmtCompact(L.minTo)}` : '—'} /></button>}
    </div>
  );
  else {
    const who = st.ta >= 0 ? st.s[st.ta] : null;
    const label = me?.w ? 'You’re in from the next hand' : me?.lv ? 'Standing up after this hand' : st.ph === 'wait' ? (st.s.filter((x) => x && x.k > 0).length < 2 ? 'Waiting for a 2nd player…' : 'Shuffling up…') : who ? `${who.n} is thinking…` : st.ph === 'show' ? 'Showdown' : 'Dealing…';
    action = <button className="btn-dark w-full py-4 text-sm" disabled>{label}</button>;
  }

  const controls = (
    <>
      <div className="rounded-xl p-[1.5px]" style={{ background: `linear-gradient(135deg, #${t.theme.trim.toString(16).padStart(6, '0')}, transparent 70%)` }}>
        <div className="rounded-[11px] bg-ink-900 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0"><div className="truncate font-display text-sm font-black">{t.name}</div><div className="text-[11px] text-smoke">Blinds {fmtCompact(t.lo)}/{fmtCompact(t.hi)} · Buy-in {fmtCompact(t.buyMin)}–{fmtCompact(t.buyMax)}</div></div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-[11px] font-bold text-smoke"><Users size={12} />{st?.s.filter(Boolean).length ?? 0}/{N}</span>
          </div>
          {me && (
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-center">
              <div className="rounded-lg bg-black/40 px-2 py-1.5"><div className="text-[10px] uppercase tracking-wider text-smoke">Your stack</div><div className="font-display text-sm font-black text-gold tabular">{fmt(me.k, 0)}</div></div>
              <div className="rounded-lg bg-black/40 px-2 py-1.5"><div className="text-[10px] uppercase tracking-wider text-smoke">Wallet</div><div className="font-display text-sm font-black tabular"><Wallet /></div></div>
            </div>
          )}
        </div>
      </div>
      <div className="hidden lg:block">{raisePanel}</div>
      <GameAction extra={raisePanel ?? undefined}>{action}</GameAction>
      {me && <Reactions lt={table as never} />}
      {me
        ? <button type="button" className="btn-ghost w-full py-2 text-xs" onClick={() => { session.standUp(); toast({ title: me.in && st?.ph === 'play' ? 'You’ll stand up after this hand' : 'Standing up…', tone: 'neutral' }); }} disabled={!!me.lv}><LogOut size={13} />{me.lv ? 'Standing up…' : 'Stand up & cash out'}</button>
        : <button type="button" className="btn-ghost w-full py-2 text-xs" onClick={() => nav('/games/poker')}><LogOut size={13} />Back to the lobby</button>}
      {!phoneUI && (
        <div className="rounded-xl bg-ink-900 p-3 text-xs">
          <div className="label mb-2">Hand rankings</div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            {[...HAND_NAMES].reverse().map((n, i) => (
              <div key={n} className={`truncate rounded px-1.5 py-0.5 text-[11px] ${myHand?.name === n ? 'bg-gold/15 font-bold text-gold' : 'text-smoke'}`}><span className="mr-1 opacity-50 tabular">{i + 1}.</span>{n}</div>
            ))}
          </div>
        </div>
      )}
    </>
  );

  const key = (c: Card) => `${c.r}${c.s}`;
  const winCards = useMemo(() => {
    if (!st?.win || !st.sh || st.ph !== 'show') return new Set<string>();
    const w = st.win[0].s[0];
    const hole = w === mySeat ? myCards : decList(st.sh[w]);
    if (hole.length !== 2) return new Set<string>();
    return new Set(bestHand([...hole, ...decList(st.bd)]).cards.map(key));
  }, [st?.ph, st?.h, myCards]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = winCards.size > 0;
  const heroW = Math.round(Math.min(92, Math.max(46, hostW * 0.075)));
  const boardW = Math.round(Math.min(80, Math.max(40, hostW * 0.066)));
  const botW = Math.round(Math.min(52, Math.max(30, hostW * 0.046)));
  const board = decList(st?.bd);
  const presence = (p: string) => snap.peers.find((x) => x.peer === p)?.pres;

  return (
    <GameShell id="poker" tall controls={controls} title={t.name} subtitle={`Live Hold’em · blinds ${fmtCompact(t.lo)}/${fmtCompact(t.hi)}`} back="/games/poker" rules={[
      'This is a live table: everyone with this page open can sit down, stand up and play. Up to 8 players — a hand is dealt as soon as at least 2 are seated with chips.',
      `Bring between ${fmt(t.buyMin, 0)} and ${fmt(t.buyMax, 0)} coins. Whatever you have when you stand up goes back to your wallet.`,
      'The dealer button moves one seat to the left each hand. The two players after it post the small and big blind; everyone gets two private cards that only they can see.',
      'Pre-flop betting starts left of the big blind. Then the flop (3 shared cards), the turn and the river, each followed by a betting round.',
      `You have ${TURN_MS / 1000} seconds to act. Run out of time and you check (or fold if there's a bet); twice in a row and you're stood up.`,
      'Best five-card hand from your two cards plus the board wins. Ties split the pot, and all-ins create side pots.',
    ]}>
      <div ref={hostRef} className="absolute inset-0" aria-label={`${t.name} poker table`} />
      <div className="table-vignette pointer-events-none absolute inset-0" />
      {st && scene && st.s.map((x, i) => {
        const g = seatGeo(scene, i);
        const at: [number, number, number] = [g.pod.x, 0.3, g.pod.z];
        if (!x) return mySeat < 0 && !session.pending ? (
          <Anchor key={`e${i}`} scene={scene} at={at}>
            <button type="button" onClick={() => setBuyFor(i)} className="pointer-events-auto animate-pop flex items-center gap-1.5 rounded-full border border-dashed border-gold/50 bg-black/60 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-gold backdrop-blur transition hover:bg-gold hover:text-ink"><UserPlus size={13} />Sit</button>
          </Anchor>
        ) : null;
        const winner = st.ph === 'show' && !!st.win?.some((w) => w.s.includes(i));
        return (
          <Anchor key={x.id} scene={scene} at={at}>
            <LivePod seat={x} mine={i === mySeat} dealer={st.btn === i && st.ph !== 'wait'} active={st.ta === i} winner={winner} deadline={st.ta === i ? deadline : 0} emo={x.p ? presence(x.p)?.emo : null} />
          </Anchor>
        );
      })}
      {st && scene && st.ph !== 'wait' && potNow > 0 && (
        <Anchor scene={scene} at={[potAt(portrait)[0] + (portrait ? 0 : 1.3), 0.2, potAt(portrait)[1] + (portrait ? 0.75 : 0)]}>
          <span className="rounded-full border border-gold/40 bg-black/75 px-3 py-1 font-display text-xs font-black text-gold shadow-lg backdrop-blur tabular">Pot {fmt(potNow, 0)}</span>
        </Anchor>
      )}
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col items-start gap-1">
        <ConnBadge snap={snap} here={snap.peers.length} />
        {/* on small tables the result banner needs the top edge */}
        {!(phoneUI && outcome) && st && st.ph !== 'wait' && <span className="rounded-full bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cream/80 backdrop-blur">Hand #{st.h} · {STREET[st.sr]}</span>}
        {!(phoneUI && outcome) && <span className="rounded-full bg-black/60 px-3 py-1 text-[10px] font-semibold text-smoke backdrop-blur">Blinds {fmtCompact(t.lo)}/{fmtCompact(t.hi)}{watching > 0 ? ` · ${watching} watching` : ''}</span>}
      </div>
      {myHand && st?.ph !== 'wait' && me && !me.f && scene && (
        <Anchor scene={scene} at={[seatGeo(scene, mySeat).cards.x + (portrait ? 0 : 2.1), 0.3, seatGeo(scene, mySeat).cards.z - (portrait ? 1.35 : 0)]}>
          <span className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-black shadow-lg ${myHand.score[0] >= 1 ? 'bg-gold text-ink' : 'bg-black/75 text-cream'}`}>{myHand.name}</span>
        </Anchor>
      )}
      {st && scene && st.ph !== 'wait' && vis.h === st.h && (
        <>
          {mySeat >= 0 && myCards.length === 2 && vis.hole > 0 && (
            <Anchor scene={scene} at={[seatGeo(scene, mySeat).cards.x, 0.3, seatGeo(scene, mySeat).cards.z]}>
              <div className="flex gap-1.5">{myCards.slice(0, vis.hole).map((c, k) => <PlayingCard key={k} c={c} w={heroW} highlight={winCards.has(key(c))} dim={done && !winCards.has(key(c))} />)}</div>
            </Anchor>
          )}
          {vis.board > 0 && (
            <Anchor scene={scene} at={[0, 0.3, portrait ? 0.2 : -0.35]}>
              <div className="flex gap-1.5">{board.slice(0, vis.board).map((c, k) => <PlayingCard key={k} c={c} w={boardW} highlight={winCards.has(key(c))} dim={done && !winCards.has(key(c))} />)}</div>
            </Anchor>
          )}
          {vis.reveal && st.sh && Object.entries(st.sh).map(([k, v]) => +k !== mySeat && st.s[+k] && (
            <Anchor key={`r${k}`} scene={scene} at={[seatGeo(scene, +k).cards.x, 0.3, seatGeo(scene, +k).cards.z]}>
              <div className="flex gap-1">{decList(v).map((c, j) => <PlayingCard key={j} c={c} w={botW} highlight={winCards.has(key(c))} dim={done && !winCards.has(key(c))} />)}</div>
            </Anchor>
          ))}
        </>
      )}
      {st?.note && st.ph === 'wait' && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 justify-center px-4">
          <div className="animate-floaty rounded-2xl border border-gold/30 bg-black/75 px-5 py-3 text-center text-sm font-semibold backdrop-blur-md">{st.note}</div>
        </div>
      )}
      {outcome && <ResultBanner key={outcome.key} tone={outcome.tone} title={outcome.title} sub={outcome.sub} top />}
      <BuyIn table={t} open={buyFor !== null} onClose={() => setBuyFor(null)} onConfirm={(buy) => { if (session.sit(buyFor ?? 0, buy)) setBuyFor(null); }} />
      <BustPrompt open={bust} onClose={() => setBust(false)} onRebuy={() => { setBust(false); const f = st?.s.findIndex((x) => !x) ?? -1; setBuyFor(f >= 0 ? f : 0); }} />
    </GameShell>
  );
}

function Wallet() {
  const b = useStore((s) => s.balance);
  return <>{fmtCompact(b)}</>;
}

function Lbl({ t, s }: { t: string; s: string }) {
  return <span className="flex flex-col items-center leading-tight"><span>{t}</span><span className="text-[10px] font-semibold opacity-80 tabular">{s}</span></span>;
}

function LivePod({ seat, mine, dealer, active, winner, deadline, emo }: { seat: PSeat; mine: boolean; dealer: boolean; active: boolean; winner: boolean; deadline: number; emo?: { e: string; at: number } | null }) {
  const out = !!seat.f || !!seat.w;
  const nameCls = seat.ns ? NAME_CLASS[seat.ns] ?? '' : '';
  return (
    <div className={`animate-pop relative flex items-center gap-1.5 whitespace-nowrap rounded-full border py-1 pl-1 pr-2.5 shadow-xl backdrop-blur-md transition-all duration-300 sm:gap-2 sm:pr-3 ${winner ? 'border-gold bg-gradient-to-b from-gold-300/90 to-gold/90 text-ink shadow-gold' : active ? 'border-gold bg-black/85 text-cream ring-2 ring-gold/60' : 'border-white/15 bg-black/75 text-cream'} ${out && !winner ? 'opacity-50' : ''} ${mine ? 'scale-110' : ''}`}>
      <span className={`relative grid place-items-center rounded-full ${mine ? 'h-9 w-9 sm:h-11 sm:w-11' : 'h-7 w-7 bg-white/10 text-base sm:h-9 sm:w-9 sm:text-lg'}`}>
        <Avatar size={44} avatar={seat.av || undefined} frame={seat.fr} className="!h-full !w-full" />
        {active && deadline > 0 && <TimerRing deadline={deadline} total={TURN_MS} size={mine ? 54 : 46} />}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="flex max-w-[104px] items-center gap-1 truncate text-[10px] font-bold sm:text-[11px]">
          {mine && <span className="rounded bg-gold px-1 text-[8px] font-black leading-3 text-ink">YOU</span>}
          <span className={`truncate ${winner ? '' : nameCls}`}>{seat.n}</span>
        </span>
        <span className={`font-display text-[11px] font-black tabular sm:text-xs ${winner ? '' : 'text-gold'}`}>{seat.ai && !seat.f ? 'ALL-IN' : fmt(seat.k, 0)}</span>
      </span>
      {dealer && <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-cream text-[9px] font-black text-ink shadow">D</span>}
      {seat.w && <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-sky-600 px-1.5 text-[8px] font-black uppercase text-white">next hand</span>}
      {seat.l && !winner && !seat.w && (
        <span key={seat.l + seat.tt} className={`animate-pop absolute ${mine ? 'left-full top-1/2 ml-1.5 -translate-y-1/2' : '-top-5 left-1/2 -translate-x-1/2'} rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide shadow ${seat.l === 'Fold' || seat.l === 'Timed out' ? 'bg-ink-500 text-smoke' : seat.l === 'Raise' || seat.l === 'Bet' || seat.l === 'All-in' ? 'bg-blood text-white' : seat.l === 'SB' || seat.l === 'BB' ? 'bg-sky-600 text-white' : 'bg-emerald-600 text-white'}`}>{seat.l}</span>
      )}
      <EmoteBubble emo={emo} />
    </div>
  );
}

function BustPrompt({ open, onClose, onRebuy }: { open: boolean; onClose: () => void; onRebuy: () => void }) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="result-in w-full max-w-xs rounded-2xl border border-blood/40 bg-ink-900/95 p-5 text-center shadow-2xl">
        <div className="text-4xl">🐔</div>
        <div className="mt-1 font-display text-xl font-black">Out of chips</div>
        <p className="mt-1 text-sm text-smoke">Buy in again to keep playing at this table.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className="btn-dark py-2.5 text-sm" onClick={onClose}>Watch</button>
          <button type="button" className="btn-gold py-2.5 text-sm" onClick={onRebuy}>Buy in</button>
        </div>
      </div>
    </div>
  );
}
