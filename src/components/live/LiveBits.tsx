import { useEffect, useRef, useState } from 'react';
import { Radio, SmilePlus, Wifi } from 'lucide-react';
import { LiveTable as TableDef } from '../../lib/net/tables';
import { BaseState, LiveSnapshot, LiveTable, rid as newRid } from '../../lib/net/live';
import { setLobbyPresence } from '../../lib/net/lobby';
import { toast, useStore, useUI } from '../../store';
import { fmt } from '../../lib/format';
import Avatar, { NAME_CLASS } from '../Avatar';

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

export const EMOTES = ['👏', '😂', '🔥', '😱', '🐔', '💰', '😎', '🤔', '😭', '🙏', '💪', '🤡'];

/**
 * Emote button that sits on the table (same in every live game): tap it, pick
 * an emoji, and it pops up over your seat for everyone at the table.
 */
export function EmoteButton({ lt, className = '' }: { lt: LiveTable<never> | LiveTable<BaseState> | null; className?: string }) {
  const [open, setOpen] = useState(false);
  const [cool, setCool] = useState(false);
  const send = (e: string) => {
    (lt as LiveTable<BaseState> | null)?.send({ emo: { e, at: Date.now() } });
    setOpen(false); setCool(true); setTimeout(() => setCool(false), 1500);
  };
  return (
    <div className={`pointer-events-auto absolute z-30 ${className}`}>
      {open && (
        <>
          <button type="button" aria-label="Close emotes" className="fixed inset-0 cursor-default" onClick={() => setOpen(false)} />
          <div className="emote-tray absolute right-0 top-full mt-2 grid w-[208px] grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-ink-900/95 p-2 shadow-2xl backdrop-blur-md">
            {EMOTES.map((e) => (
              <button key={e} type="button" aria-label={`Send ${e}`} onClick={() => send(e)}
                className="grid h-11 place-items-center rounded-xl text-2xl transition hover:scale-110 hover:bg-white/10 active:scale-95">{e}</button>
            ))}
          </div>
        </>
      )}
      <button type="button" disabled={cool} onClick={() => setOpen((o) => !o)} aria-label="Emotes" aria-expanded={open}
        className={`grid h-11 w-11 place-items-center rounded-full border shadow-xl backdrop-blur-md transition hover:scale-105 active:scale-95 disabled:opacity-50 ${open ? 'border-gold bg-gold text-ink' : 'border-white/15 bg-black/70 text-gold'}`}>
        <SmilePlus size={20} />
      </button>
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
  return (
    <span className="emote-pop pointer-events-none absolute -top-12 left-1/2 z-20 grid h-12 w-12 -translate-x-1/2 place-items-center rounded-full border border-white/20 bg-white/95 text-3xl shadow-[0_8px_24px_rgba(0,0,0,.55)]">
      {show}
      <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-white/95" />
    </span>
  );
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

export type BadgeTone = 'neutral' | 'hot' | 'cool' | 'good' | 'muted';
const BADGE: Record<BadgeTone, string> = {
  neutral: 'bg-white text-ink',
  hot: 'bg-gradient-to-b from-[#ff5a6a] to-blood text-white',
  cool: 'bg-gradient-to-b from-sky-400 to-sky-600 text-white',
  good: 'bg-gradient-to-b from-emerald-400 to-emerald-600 text-white',
  muted: 'bg-ink-500 text-smoke',
};

/**
 * A player's seat at a live table: round avatar with a countdown ring, name
 * plate with their chips, card backs while they're in the hand, their last
 * action, and a "+winnings" that floats up when they take a pot.
 */
export function SeatPod({ name, av, fr, ns, stack, mine, active, deadline = 0, total = 20000, winner, win = 0, badge, badgeTone = 'neutral', dim, dealer, emo, backs = 0, allIn, status, statusTone = 'cool' }: {
  name: string; av?: string; fr?: string; ns?: string; stack: number; mine?: boolean; active?: boolean; deadline?: number; total?: number;
  winner?: boolean; win?: number; badge?: string; badgeTone?: BadgeTone; dim?: boolean; dealer?: boolean; emo?: { e: string; at: number } | null;
  backs?: number; allIn?: boolean; status?: string; statusTone?: BadgeTone;
}) {
  const nameCls = ns ? NAME_CLASS[ns] ?? '' : '';
  const big = mine;
  return (
    <div className={`animate-pop relative flex flex-col items-center transition-opacity duration-300 ${dim && !winner ? 'opacity-45' : ''}`}>
      {/* last action */}
      {badge && !winner && (
        <span key={badge + stack} className={`animate-pop absolute -top-6 z-10 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide shadow-lg ${BADGE[badgeTone]}`}>{badge}</span>
      )}
      {win > 0 && <span key={win} className="win-float pointer-events-none absolute -top-9 z-20 whitespace-nowrap font-display text-lg font-black text-gold drop-shadow-[0_2px_6px_rgba(0,0,0,.9)] sm:text-xl">+{fmt(win, 0)}</span>}
      <div className={`relative grid place-items-center rounded-full p-[3px] ${big ? 'h-[52px] w-[52px] sm:h-16 sm:w-16' : 'h-11 w-11 sm:h-[52px] sm:w-[52px]'} ${winner ? 'seat-win bg-gradient-to-br from-gold-300 via-gold to-[#b8860b]' : active ? 'bg-gradient-to-br from-emerald-300 to-emerald-600 shadow-[0_0_22px_rgba(52,211,153,.7)]' : mine ? 'bg-gradient-to-br from-gold-300 to-[#a8740a]' : 'bg-gradient-to-br from-white/40 to-white/10'}`}>
        <Avatar size={64} avatar={av || undefined} frame={fr} className="!h-full !w-full !ring-0" />
        {active && deadline > 0 && <TimerRing deadline={deadline} total={total} size={big ? 74 : 62} />}
        {dealer && <span className="absolute -left-1 -top-1 grid h-5 w-5 place-items-center rounded-full border border-black/30 bg-gradient-to-b from-white to-[#ddd] text-[10px] font-black text-ink shadow-md">D</span>}
        {backs > 0 && (
          <span className="absolute -right-3 top-0 flex">
            {Array.from({ length: backs }, (_, k) => (
              <span key={k} className="seat-back block h-[22px] w-[16px] rounded-[3px] border border-white/80 shadow-md sm:h-[26px] sm:w-[19px]" style={{ transform: `rotate(${k ? 14 : -6}deg) translateX(${k ? -7 : 0}px)` }} />
            ))}
          </span>
        )}
      </div>
      <div className={`relative -mt-1.5 min-w-[78px] max-w-[112px] rounded-xl border px-2 py-0.5 text-center shadow-xl backdrop-blur-md ${winner ? 'border-gold bg-gradient-to-b from-[#3a2a05]/95 to-black/90' : mine ? 'border-gold/60 bg-black/85' : 'border-white/15 bg-black/80'}`}>
        <div className="flex items-center justify-center gap-1 truncate text-[10px] font-bold leading-tight text-cream sm:text-[11px]">
          {mine && <span className="rounded bg-gold px-1 text-[8px] font-black leading-3 text-ink">YOU</span>}
          <span className={`truncate ${nameCls}`}>{name}</span>
        </div>
        <div className={`font-display text-[11px] font-black leading-tight tabular sm:text-xs ${allIn ? 'animate-pulse text-blood' : 'text-gold'}`}>{allIn ? 'ALL IN' : fmt(stack, 0)}</div>
      </div>
      {status && <span className={`mt-0.5 whitespace-nowrap rounded-full px-1.5 text-[8px] font-black uppercase leading-4 ${BADGE[statusTone]}`}>{status}</span>}
      <EmoteBubble emo={emo} />
    </div>
  );
}

/** How strong your hand is right now (high card … royal flush), as a little meter. */
export function HandMeter({ name, rank }: { name: string; rank: number }) {
  const pct = (rank + 1) / 10;
  const col = rank >= 6 ? '#F4C430' : rank >= 3 ? '#34d399' : rank >= 1 ? '#38bdf8' : '#9ca3af';
  return (
    <div className="flex min-w-[118px] flex-col gap-1 rounded-xl border border-white/10 bg-black/80 px-2.5 py-1.5 shadow-xl backdrop-blur-md">
      <span className="whitespace-nowrap text-[11px] font-black" style={{ color: col }}>{name}</span>
      <span className="flex gap-[2px]">{Array.from({ length: 10 }, (_, i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < Math.round(pct * 10) ? col : 'rgba(255,255,255,.12)' }} />)}</span>
    </div>
  );
}
