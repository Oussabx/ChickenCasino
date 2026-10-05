import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { LogOut, Users } from 'lucide-react';
import GameShell, { GameAction } from '../../components/GameShell';
import { ALL_IN, BIG_CHIPS, ChipPicker, ChipRow } from '../../components/ChipBets';
import { toast, useStore } from '../../store';
import { sfx } from '../../lib/sound';
import { fmt, fmtCompact } from '../../lib/format';
import Avatar, { NAME_CLASS } from '../../components/Avatar';
import { REDS, RouletteScene, colorOf, covers, returns } from '../three/roulette3d';
import { liveTable, roomName } from '../../lib/net/tables';
import { useLiveTable } from '../../lib/net/live';
import { setLobbyPresence } from '../../lib/net/lobby';
import { RL_MAX_PLAYERS, RL_SPIN_MS, RState, RouletteEngine } from '../../lib/net/rouletteEngine';
import { BetClock, ConnBadge, EmoteButton } from '../../components/live/LiveBits';
import { QUICK, WinDisc } from '../Roulette';

/* Live roulette: one wheel, up to 25 players betting on it together. */

type Bets = Record<string, number>;
const sum = (b: Bets) => Object.values(b).reduce((a, v) => a + v, 0);

export default function RouletteLive() {
  const { tableId = '' } = useParams();
  const t = liveTable(tableId);
  if (!t || t.game !== 'roulette') return <Navigate to="/games/roulette" replace />;
  return <RouletteTable key={t.id} tid={t.id} />;
}

function RouletteTable({ tid }: { tid: string }) {
  const t = liveTable(tid)!;
  const nav = useNavigate();
  const { snap, table } = useLiveTable<RState>(roomName(t), () => new RouletteEngine(t));
  const st = snap.state;
  const [chip, setChip] = useState(100);
  const [mine, setMine] = useState<Bets>({});
  const [order, setOrder] = useState<[string, number][]>([]);
  const [myRound, setMyRound] = useState(-1);
  const [last, setLast] = useState<Bets | null>(null);
  const [result, setResult] = useState<{ n: number; payout: number; total: number; key: number } | null>(null);
  const [layout, setLayout] = useState<'side' | 'top'>('side');
  const total = sum(mine);
  const settled = useRef(-1);
  const mineRef = useRef(mine); mineRef.current = mine;
  const roundRef = useRef(myRound); roundRef.current = myRound;
  const stRef = useRef(st); stRef.current = st;

  /* ---------- who's betting this round ---------- */
  const players = useMemo(() => {
    if (!st) return [];
    return snap.peers
      .filter((p) => p.isMe ? total > 0 : p.pres.rb?.r === st.r && Object.keys(p.pres.rb.b ?? {}).length)
      .map((p) => ({ peer: p.peer, isMe: p.isMe, name: String(p.pres.id?.nm ?? 'Player'), av: p.pres.id?.av, fr: p.pres.id?.fr, ns: p.pres.id?.ns, total: p.isMe ? total : sum(p.pres.rb?.b ?? {}), emo: p.pres.emo }))
      .sort((a, b) => Number(b.isMe) - Number(a.isMe) || b.total - a.total);
  }, [snap.peers, st, total]);
  const others = players.filter((p) => !p.isMe).length;
  const full = others >= RL_MAX_PLAYERS && total === 0;
  // everyone's chips on the layout this round (yours included)
  const board = useMemo(() => {
    const b: Bets = { ...mine };
    if (st) for (const p of snap.peers) if (!p.isMe && p.pres.rb?.r === st.r) for (const [k, v] of Object.entries(p.pres.rb.b ?? {})) b[k] = (b[k] ?? 0) + (+v || 0);
    return b;
  }, [snap.peers, st, mine]);

  // lobby: where we are, and how many are betting here
  useEffect(() => { setLobbyPresence(t.id, total > 0, players.length); }, [t.id, total > 0, players.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { setLobbyPresence(null); }, []);

  /* ---------- 3D wheel and layout ---------- */
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<RouletteScene | null>(null);
  const turbo = useStore((s) => s.settings.turbo);
  const placeRef = useRef<(k: string) => void>(() => {});
  useEffect(() => {
    const el = hostRef.current!;
    const sc = new RouletteScene(el, { theme: t.theme });
    sceneRef.current = sc;
    sc.onBet((k) => placeRef.current(k), () => stRef.current?.ph === 'bet');
    const ro = new ResizeObserver(() => { const l = el.clientWidth > el.clientHeight * 1.15 ? 'side' : 'top'; setLayout(l); sc.setLayout(l); });
    ro.observe(el);
    return () => { ro.disconnect(); sc.dispose(); sceneRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { sceneRef.current?.setTurbo(turbo); }, [turbo]);
  useEffect(() => { if (st?.ph === 'bet') sceneRef.current?.setBets(board); }, [board, st?.ph]);

  /* ---------- the round: spin, result, next ---------- */
  const spun = useRef(-1);
  const shownResult = useRef(-1);
  useEffect(() => {
    const sc = sceneRef.current;
    if (!st || !sc) return;
    if (st.ph === 'spin' && spun.current !== st.r && st.n >= 0) {
      spun.current = st.r;
      const left = Math.min(RL_SPIN_MS, st.tl ?? RL_SPIN_MS) - 300;
      if (left > 1500) sc.spin(st.n, left, () => sfx.tick(3)).catch(() => {});
      sfx.bet();
    }
    if (st.ph === 'result' && shownResult.current !== st.r && st.n >= 0) {
      shownResult.current = st.r;
      sc.showResult(st.n); sc.markSettled();
    }
    // a new round: last round's result makes way for fresh chips
    if (st.ph === 'bet') setResult((r) => (r && r.key < st.r ? null : r));
    settleIfDue(st);
  }, [st]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Pay yourself from the winning number (once per round you bet in). */
  const settleIfDue = (s: RState) => {
    const r = roundRef.current, b = mineRef.current, tot = sum(b);
    if (r < 0) return;
    let n = -1;
    if (s.r === r && s.ph !== 'bet' && s.n >= 0) n = s.n;
    else if (s.r > r) n = s.hist[0] ?? -1;
    if (n < 0) return;
    if (tot > 0 && settled.current !== r) {
      settled.current = r;
      let payout = 0;
      for (const [k, v] of Object.entries(b)) if (covers(k, n)) payout += v * returns(k);
      // wait for the ball to land before paying out
      const delay = s.ph === 'spin' ? Math.max(0, (s.tl ?? 0) - 200) : 0;
      setTimeout(() => {
        useStore.getState().settle('roulette', tot, payout / tot, `${t.name} · ${n} ${colorOf(n)}`);
        setResult({ n, payout, total: tot, key: r });
        payout > tot ? sfx.win() : payout > 0 ? sfx.reveal() : sfx.lose();
      }, delay);
      setLast(b);
    }
    if (s.r > r) { setMine({}); setOrder([]); setMyRound(-1); table?.send({ rb: null }); }
  };

  // leaving: chips still on the layout come back, or get paid if the wheel already spun
  useEffect(() => () => {
    const s = stRef.current, r = roundRef.current, b = mineRef.current, tot = sum(b);
    if (r < 0 || tot <= 0 || settled.current === r) return;
    if (s && s.r === r && s.ph !== 'bet' && s.n >= 0) {
      let payout = 0;
      for (const [k, v] of Object.entries(b)) if (covers(k, s.n)) payout += v * returns(k);
      useStore.getState().settle('roulette', tot, payout / tot, `${t.name} · ${s.n} ${colorOf(s.n)}`);
    } else useStore.getState().refund(tot);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- betting ---------- */
  const publish = (b: Bets, r: number) => table?.send({ rb: Object.keys(b).length ? { r, b } : null });
  const place = (key: string) => {
    if (!st) return;
    if (st.ph !== 'bet') { toast({ title: 'No more bets — wait for the next round', tone: 'neutral' }); return; }
    if (full) { toast({ title: `Table full — ${RL_MAX_PLAYERS} players are betting`, desc: 'You can watch, or pick another table.', tone: 'neutral' }); return; }
    const bal = useStore.getState().balance;
    const amount = chip === ALL_IN ? Math.floor(bal) : chip;
    if (amount <= 0) { toast({ title: 'Nothing left to bet', tone: 'red' }); return; }
    if (amount > bal + 1e-9) { toast({ title: 'Insufficient balance', desc: 'Pick a smaller chip or go all-in.', tone: 'red' }); return; }
    if (!useStore.getState().placeBet(amount)) return;
    sfx.bet();
    const r = st.r;
    const next = { ...mineRef.current, [key]: (mineRef.current[key] ?? 0) + amount };
    setMine(next); setOrder((o) => [...o, [key, amount]]); setMyRound(r);
    publish(next, r);
    if (chip === ALL_IN) toast({ title: `All in! ${fmt(amount, 0)} on ${label(key)}`, tone: 'gold' });
  };
  placeRef.current = place;
  const undo = () => {
    if (st?.ph !== 'bet' || !order.length) return;
    const [k, a] = order[order.length - 1];
    useStore.getState().refund(a);
    const next = { ...mine }; next[k] -= a; if (next[k] <= 0) delete next[k];
    setMine(next); setOrder(order.slice(0, -1)); publish(next, st.r);
  };
  const clear = () => {
    if (st?.ph !== 'bet' || !total) return;
    useStore.getState().refund(total);
    setMine({}); setOrder([]); publish({}, st.r);
  };
  const rebet = () => {
    if (!last || st?.ph !== 'bet' || total) return;
    const tot = sum(last);
    if (!useStore.getState().placeBet(tot)) return;
    setMine(last); setOrder(Object.entries(last)); setMyRound(st.r); publish(last, st.r);
  };

  /* ---------- UI ---------- */
  const deadline = st ? snap.stateAt + (st.tl ?? 0) : 0;
  const status = !st ? 'Joining the table…' : st.ph === 'bet' ? (total > 0 ? `Your bet ${fmt(total, 0)} · good luck!` : full ? 'Table full — watching' : 'Tap the table to place chips') : st.ph === 'spin' ? 'No more bets — spinning…' : 'Paying out…';
  const controls = (
    <>
      <div className="rounded-xl p-[1.5px]" style={{ background: `linear-gradient(135deg, #${t.theme.trim.toString(16).padStart(6, '0')}, transparent 70%)` }}>
        <div className="rounded-[11px] bg-ink-900 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0"><div className="truncate font-display text-sm font-black">{t.name}</div><div className="text-[11px] text-smoke">Chips 100–1M · no buy-in · up to {RL_MAX_PLAYERS} players</div></div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-[11px] font-bold text-smoke"><Users size={12} />{players.length}/{RL_MAX_PLAYERS}</span>
          </div>
        </div>
      </div>
      <div className="hidden lg:block"><ChipPicker chip={chip} setChip={setChip} total={total} onClear={clear} onUndo={undo} onRebet={last && !total ? rebet : undefined} disabled={st?.ph !== 'bet'} values={BIG_CHIPS} allIn /></div>
      <div className={st?.ph !== 'bet' ? 'pointer-events-none opacity-50' : ''}>
        <div className="label mb-1.5">Quick bets <span className="normal-case tracking-normal text-smoke/70">· or tap any number</span></div>
        <div className="grid grid-cols-3 gap-1.5">
          {QUICK.map(([k, l]) => (
            <button key={k} type="button" aria-label={`Bet ${k}`} onClick={() => place(k)}
              className={`relative rounded-lg border px-2 py-2 font-display text-xs font-black transition active:scale-95 ${k === 'red' ? 'border-blood/50 bg-blood/20 text-white' : k === 'black' ? 'border-white/20 bg-black text-white' : 'border-gold/25 bg-[#0b4a2e]/60 text-gold'}`}>
              {l}
              {mine[k] ? <span className="absolute -right-1.5 -top-1.5 animate-pop rounded-full bg-gold px-1.5 text-[10px] leading-4 text-ink tabular">{fmtCompact(mine[k])}</span> : null}
            </button>
          ))}
        </div>
      </div>
      <GameAction extra={<ChipRow chip={chip} setChip={setChip} onUndo={undo} onClear={clear} disabled={st?.ph !== 'bet'} values={BIG_CHIPS} allIn />}>
        <div className={`flex w-full items-center justify-center rounded-xl border px-3 py-4 text-center text-sm font-black ${st?.ph === 'bet' ? 'border-gold/40 bg-gold/10 text-gold' : 'border-blood/40 bg-blood/10 text-blood'}`}>{status}</div>
      </GameAction>
      {/* who's in this round */}
      <div className="rounded-xl bg-ink-900 p-3">
        <div className="label mb-2 flex items-center justify-between"><span>Players this round</span><span className="normal-case tracking-normal">{players.length}/{RL_MAX_PLAYERS}</span></div>
        {players.length ? (
          <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
            {players.map((p) => (
              <div key={p.peer} className={`flex items-center gap-2 rounded-lg px-1.5 py-1 ${p.isMe ? 'bg-gold/10' : ''}`}>
                <Avatar size={24} avatar={p.av || undefined} frame={p.fr} />
                <span className={`min-w-0 flex-1 truncate text-xs font-bold ${p.ns ? NAME_CLASS[p.ns] ?? '' : ''}`}>{p.isMe ? 'You' : p.name}</span>
                <span className="font-display text-xs font-black text-gold tabular">{fmtCompact(p.total)}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-xs text-smoke">No bets yet — be the first.</p>}
      </div>
      <button type="button" className="btn-ghost w-full py-2 text-xs" onClick={() => nav('/games/roulette')}><LogOut size={13} />Back to the lobby</button>
      <div className="space-y-1 rounded-xl bg-ink-900 p-3 text-xs text-smoke">
        <div className="flex justify-between"><span>Single number</span><b className="text-gold">35 : 1</b></div>
        <div className="flex justify-between"><span>Dozen / column</span><b className="text-cream">2 : 1</b></div>
        <div className="flex justify-between"><span>Red/black, odd/even, 1-18/19-36</span><b className="text-cream">1 : 1</b></div>
      </div>
    </>
  );

  const hist = st?.hist ?? [];
  // reactions from anyone at the table (watchers too)
  const recent = snap.peers
    .filter((p) => p.pres.emo && Date.now() - p.pres.emo.at < 4000)
    .map((p) => ({ peer: p.peer, isMe: p.isMe, name: String(p.pres.id?.nm ?? 'Player'), av: p.pres.id?.av, fr: p.pres.id?.fr, emo: p.pres.emo! }))
    .slice(0, 5);
  return (
    <GameShell id="roulette" tall controls={controls} title={t.name} subtitle="Live roulette · chips 100 to 1M" back="/games/roulette" rules={[
      `This is a live table: up to ${RL_MAX_PLAYERS} players bet on the same wheel. Everyone's chips show on the layout.`,
      'Pick a chip (100 up to 1,000,000, or All-in for everything you have) and tap any number, split of the layout or outside bet. Tap again to stack more.',
      'Betting is open for 20 seconds each round, then the wheel spins for everyone. There is no buy-in — chips come straight from your wallet and wins go straight back.',
      'Single numbers pay 35:1, dozens and columns 2:1, and red/black, odd/even, 1-18/19-36 pay 1:1. Zero loses all outside bets.',
    ]}>
      <div ref={hostRef} className="absolute inset-0" aria-label={`${t.name} roulette table`} />
      <div className="table-vignette pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col items-start gap-1">
        <ConnBadge snap={snap as never} here={snap.peers.length} />
        {st && <span className="rounded-full bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cream/80 backdrop-blur">Round #{st.r} · {players.length}/{RL_MAX_PLAYERS} betting</span>}
      </div>
      {st?.ph === 'bet' && <BetClock deadline={deadline} />}
      {st?.ph === 'spin' && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
          <span className="rounded-full border border-blood/50 bg-black/75 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-blood backdrop-blur">No more bets</span>
        </div>
      )}
      {/* recent numbers */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex max-w-[70%] flex-wrap items-center gap-1">
        {hist.length > 0 && <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-smoke">Last</span>}
        {hist.slice(0, 12).map((n, i) => (
          <span key={`${st?.r}-${i}`} className={`grid h-6 min-w-[24px] place-items-center rounded-full px-1 font-display text-[11px] font-black text-white shadow ${i === 0 && st?.ph !== 'spin' ? 'animate-pop ring-2 ring-gold' : 'opacity-75'} ${n === 0 ? 'bg-[#0e8f4a]' : REDS.has(n) ? 'bg-[#b3192a]' : 'bg-[#141414] ring-1 ring-white/20'}`}>{n}</span>
        ))}
      </div>
      {/* reactions from the table */}
      <div className="pointer-events-none absolute bottom-12 left-3 z-10 flex flex-col items-start gap-1">
        {recent.map((p) => (
          <span key={p.peer + p.emo.at} className="emote-pop-in flex items-center gap-1.5 rounded-full border border-white/10 bg-black/75 py-0.5 pl-0.5 pr-2.5 text-xs font-bold backdrop-blur">
            <Avatar size={22} avatar={p.av || undefined} frame={p.fr} /><span className="max-w-[90px] truncate">{p.isMe ? 'You' : p.name}</span><span className="text-xl leading-none">{p.emo.e}</span>
          </span>
        ))}
      </div>
      <EmoteButton lt={table as never} className="bottom-3 right-3" up />
      {result && <WinDisc key={result.key} n={result.n} payout={result.payout} total={result.total} side={layout === 'side'} />}
    </GameShell>
  );
}

const label = (k: string) => {
  if (k.startsWith('n:')) return `number ${k.slice(2)}`;
  return QUICK.find(([q]) => q === k)?.[1] ?? k;
};
