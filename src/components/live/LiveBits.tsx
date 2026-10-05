import { useEffect, useRef, useState } from 'react';
import { Radio, Wifi } from 'lucide-react';
import { LiveTable as TableDef } from '../../lib/net/tables';
import { BaseState, LiveSnapshot, LiveTable, rid as newRid } from '../../lib/net/live';
import { setLobbyPresence } from '../../lib/net/lobby';
import { toast, useStore, useUI } from '../../store';
import { fmt } from '../../lib/format';

type SeatLike = { id: string; p: string; k: number } | null;
type StateLike = BaseState & { s: SeatLike[] };

/**
 * Your seat at a live table: asks the host for a seat, pays the buy-in once it's
 * granted, keeps the wallet's record of your stack current, and cashes you out
 * when you stand up, bust, or leave the page.
 */
export function useSeatSession<S extends StateLike>(t: TableDef, lt: LiveTable<S> | null, snap: LiveSnapshot<S>, onOut?: (amount: number) => void) {
  const [pending, setPending] = useState<{ rid: string; buy: number; at: number } | null>(null);
  const ridRef = useRef<string | null>(null);
  const [rid, setRid] = useState<string | null>(null);
  const st = snap.state;
  const mySeat = st && rid ? st.s.findIndex((x) => x?.id === rid) : -1;
  const outRef = useRef(onOut); outRef.current = onOut;

  useEffect(() => {
    if (!st) return;
    const store = useStore.getState();
    if (pending) {
      const i = st.s.findIndex((x) => x?.id === pending.rid);
      if (i >= 0) {
        if (store.escrow?.rid !== pending.rid) {
          const err = store.escrowOpen({ rid: pending.rid, game: t.game, table: t.id, tableName: t.name, buyIn: pending.buy });
          if (err) { toast({ title: err, tone: 'red' }); lt?.send({ sit: null }); setPending(null); return; }
        }
        ridRef.current = pending.rid; setRid(pending.rid); setPending(null);
      }
    }
    const r = ridRef.current;
    if (!r) return;
    const seat = st.s.find((x) => x?.id === r);
    if (seat) store.escrowSync(r, seat.k);
    const out = st.out.find((o) => o.rid === r);
    if (out) {
      store.escrowSync(r, out.k);
      const amt = store.escrowClose(r);
      ridRef.current = null; setRid(null);
      lt?.send({ sit: null, act: null, bet: null });
      outRef.current?.(amt);
    }
  }, [st]); // eslint-disable-line react-hooks/exhaustive-deps

  // a seat request nobody answers (no host yet, table full): give up after a while
  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => {
      setPending((p) => {
        if (p && p.rid === pending.rid) { lt?.send({ sit: null }); toast({ title: 'Couldn’t get a seat', desc: 'The table may be full — try again in a moment.', tone: 'neutral' }); return null; }
        return p;
      });
    }, 12000);
    return () => clearTimeout(id);
  }, [pending, lt]);

  // lobby: where we are and whether we're sitting
  const taken = st ? st.s.filter(Boolean).length : 0;
  useEffect(() => { setLobbyPresence(t.id, mySeat >= 0, taken); }, [t.id, mySeat, taken]);
  useEffect(() => () => { setLobbyPresence(null); }, []);

  // leaving the page: whatever is in front of you goes back to the wallet
  useEffect(() => () => {
    const r = ridRef.current;
    if (!r) return;
    const amt = useStore.getState().escrowClose(r);
    if (amt > 0) toast({ title: `Cashed out ${fmt(amt, 0)}`, desc: `You left ${t.name}.`, tone: 'gold' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sit = (seat: number, buy: number) => {
    const s = useStore.getState();
    const err = s.betError(buy);
    if (err === 'signup') { useUI.getState().openAuth('signup'); return false; }
    if (err) { toast({ title: err, tone: 'red' }); return false; }
    const r = newRid();
    setPending({ rid: r, buy, at: Date.now() });
    lt?.send({ sit: { rid: r, seat, buy } });
    return true;
  };
  const standUp = () => { lt?.send({ sit: null, act: null, bet: null }); };
  return { mySeat, rid, pending: !!pending, sit, standUp };
}

/** Countdown ring for whoever is on the clock. */
export function TimerRing({ deadline, total, size = 56 }: { deadline: number; total: number; size?: number }) {
  const ref = useRef<SVGCircleElement>(null);
  const r = size / 2 - 3, c = 2 * Math.PI * r;
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const left = Math.max(0, deadline - Date.now());
      const k = Math.min(1, left / total);
      const el = ref.current;
      if (el) {
        el.style.strokeDashoffset = String(c * (1 - k));
        el.style.stroke = k > 0.5 ? '#34d399' : k > 0.22 ? '#F4C430' : '#E63946';
      }
      if (left > 0) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [deadline, total, c]);
  return (
    <svg className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90" width={size} height={size} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,.45)" strokeWidth={4} />
      <circle ref={ref} cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={4} strokeLinecap="round" strokeDasharray={c} />
    </svg>
  );
}

export const EMOTES = ['👏', '😂', '🔥', '😱', '🐔', '💰'];

/** Quick reactions everyone at the table sees over your seat. */
export function Reactions({ lt, disabled }: { lt: LiveTable<never> | LiveTable<BaseState> | null; disabled?: boolean }) {
  const [cool, setCool] = useState(false);
  return (
    <div className="flex items-center justify-between gap-1 rounded-xl bg-ink-900 p-1.5">
      {EMOTES.map((e) => (
        <button key={e} type="button" disabled={disabled || cool} aria-label={`React ${e}`}
          onClick={() => { (lt as LiveTable<BaseState> | null)?.send({ emo: { e, at: Date.now() } }); setCool(true); setTimeout(() => setCool(false), 1500); }}
          className="grid h-9 flex-1 place-items-center rounded-lg text-lg transition hover:bg-white/10 disabled:opacity-40">{e}</button>
      ))}
    </div>
  );
}

/** The emoji a player just sent, floating over their seat for a few seconds. */
export function EmoteBubble({ emo }: { emo?: { e: string; at: number } | null }) {
  const [show, setShow] = useState<string | null>(null);
  useEffect(() => {
    if (!emo || Date.now() - emo.at > 6000) return;
    setShow(emo.e);
    const id = setTimeout(() => setShow(null), 2600);
    return () => clearTimeout(id);
  }, [emo?.at]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!show) return null;
  return <span className="emote-pop pointer-events-none absolute -top-9 left-1/2 z-20 -translate-x-1/2 text-3xl drop-shadow-[0_4px_8px_rgba(0,0,0,.6)]">{show}</span>;
}

/** Live / local connection pill. */
export function ConnBadge({ snap, here }: { snap: LiveSnapshot<StateLike>; here: number }) {
  const live = snap.kind === 'live';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur ${snap.status !== 'live' ? 'bg-black/60 text-smoke' : live ? 'bg-emerald-500/20 text-emerald-300' : 'bg-black/60 text-cream/80'}`}>
      {live ? <Radio size={11} /> : <Wifi size={11} />}
      {snap.status !== 'live' ? 'Connecting…' : live ? `Live · ${here} here` : 'This browser only'}
    </span>
  );
}
