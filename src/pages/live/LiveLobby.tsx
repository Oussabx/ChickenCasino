import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Bot, ChevronLeft, Lock, Radio, Users, Zap } from 'lucide-react';
import { BJ_TABLES, LiveTable, POKER_TABLES, hex } from '../../lib/net/tables';
import { useLobby } from '../../lib/net/lobby';
import { fmt, fmtCompact } from '../../lib/format';
import { useStore, useUI } from '../../store';
import { Coin } from '../../components/Icons';

/** Zynga-style lobby: ten live tables per game, from friendly stakes to the high-roller room. */
export default function LiveLobby({ game }: { game: 'poker' | 'blackjack' }) {
  const tables = game === 'poker' ? POKER_TABLES : BJ_TABLES;
  const { counts, kind, online } = useLobby();
  const balance = useStore((s) => s.balance);
  const escrow = useStore((s) => s.escrow);
  const nav = useNavigate();
  // "Play now": the biggest table you can comfortably afford (4+ minimum buy-ins)
  const best = [...tables].reverse().find((t) => balance >= t.buyMin * 4) ?? [...tables].reverse().find((t) => balance >= t.buyMin);
  const title = game === 'poker' ? 'Texas Hold’em' : 'Blackjack';
  const base = `/games/${game}`;

  return (
    <div className="mx-auto max-w-7xl px-3 pb-28 pt-4 sm:px-4 lg:px-6 lg:pt-6">
      <div className="mb-4 flex items-center gap-2">
        <Link to="/games" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-700 hover:bg-ink-600" aria-label="Back to games"><ChevronLeft size={18} /></Link>
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-black leading-tight sm:text-2xl">{title} · Live tables</h1>
          <p className="truncate text-xs text-smoke">{game === 'poker' ? 'Sit with real players. Pick your stakes, pick your buy-in.' : 'Up to five players against the chicken dealer.'}</p>
        </div>
      </div>

      {/* hero strip */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-[radial-gradient(ellipse_at_20%_0%,rgba(244,196,48,.16),transparent_55%),radial-gradient(ellipse_at_100%_100%,rgba(230,57,70,.14),transparent_50%)] p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em]">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${kind === 'live' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-smoke'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${kind === 'live' ? 'animate-pulse bg-emerald-400' : 'bg-smoke'}`} />{kind === 'live' ? `${online || 1} online now` : 'This browser'}
              </span>
              <span className="text-smoke">10 tables · {fmtCompact(tables[0].buyMin)} to {fmtCompact(tables[9].buyMax)} buy-ins</span>
            </div>
            <div className="mt-2 font-display text-2xl font-black leading-tight sm:text-3xl">Choose your table</div>
            <p className="mt-1 max-w-xl text-sm text-cream/75">
              Every table has its own look and stakes. Bring between the minimum and maximum buy-in — {game === 'poker' ? 'blinds' : 'bet limits'} rise with each table. {kind === 'live' ? 'Anyone with this page open can join you.' : 'Live play needs the shared artifact link — here, only tabs in this browser share a table.'}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:w-56">
            {escrow?.game === game ? (
              <button type="button" className="btn-gold py-3" onClick={() => nav(`${base}/${escrow.table}`)}><Radio size={16} />Back to {escrow.tableName}</button>
            ) : best ? (
              <button type="button" className="btn-gold py-3" onClick={() => nav(`${base}/${best.id}?sit=1`)}><Zap size={16} />Play now · {best.name.split(' ')[0]}</button>
            ) : (
              <button type="button" className="btn-gold py-3" onClick={() => useUI.getState().openStore({ tab: 'coins' })}><Coin className="h-4 w-4" />Get coins to play</button>
            )}
            <Link to={`${base}/practice`} className="btn-ghost py-2.5 text-sm"><Bot size={15} />Practice vs bots</Link>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tables.map((t) => <TableCard key={t.id} t={t} count={counts[t.id]} balance={balance} best={best?.id === t.id} onOpen={() => nav(`${base}/${t.id}${balance >= t.buyMin ? '?sit=1' : ''}`)} />)}
      </div>
    </div>
  );
}

function TableCard({ t, count, balance, best, onOpen }: { t: LiveTable; count?: { seated: number; watching: number }; balance: number; best: boolean; onOpen: () => void }) {
  const locked = balance < t.buyMin;
  const seated = count?.seated ?? 0;
  const trim = hex(t.theme.trim);
  return (
    <button type="button" onClick={onOpen}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-800 text-left transition duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      style={{ boxShadow: best ? `0 0 0 1.5px ${trim}, 0 12px 40px -18px ${trim}` : undefined }}>
      <div className="relative px-4 pb-3 pt-4" style={{ background: `radial-gradient(ellipse at 50% 120%, ${hex(t.theme.felt)}55, transparent 70%)` }}>
        <span className="absolute left-3 top-3 z-10 rounded-full bg-black/55 px-2 py-0.5 font-display text-[10px] font-black uppercase tracking-wider text-cream/85">Table {t.tier + 1}</span>
        {best && <span className="absolute right-3 top-3 z-10 rounded-full px-2 py-0.5 font-display text-[10px] font-black uppercase tracking-wider text-ink" style={{ background: trim }}>Best for you</span>}
        <TablePreview t={t} seated={seated} />
      </div>
      <div className="flex flex-1 flex-col gap-2 border-t border-white/[0.06] p-3.5">
        <div className="min-w-0">
          <div className="truncate font-display text-base font-black">{t.name}</div>
          <div className="truncate text-xs text-smoke">{t.tagline}</div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <div className="rounded-lg bg-ink-900 px-2 py-1.5"><div className="text-smoke">{t.game === 'poker' ? 'Blinds' : 'Bets'}</div><div className="font-display text-sm font-black tabular text-cream">{fmtCompact(t.lo)}{t.game === 'poker' ? '/' : '–'}{fmtCompact(t.hi)}</div></div>
          <div className="rounded-lg bg-ink-900 px-2 py-1.5"><div className="text-smoke">Buy-in</div><div className="font-display text-sm font-black tabular text-gold">{fmtCompact(t.buyMin)}–{fmtCompact(t.buyMax)}</div></div>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="inline-flex items-center gap-1.5 text-xs text-smoke"><Users size={13} />{seated}/{t.seats} seated{count?.watching ? ` · ${count.watching} watching` : ''}</span>
          {locked
            ? <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] font-bold text-smoke"><Lock size={12} />Need {fmtCompact(t.buyMin - balance)}</span>
            : <span className="inline-flex items-center gap-1 rounded-lg bg-gold px-3 py-1.5 text-xs font-black text-ink transition group-hover:bg-gold-300">Join<ArrowRight size={13} /></span>}
        </div>
      </div>
      {locked && <div className="pointer-events-none absolute inset-x-0 top-0 h-[150px] bg-black/35" />}
      <span className="sr-only">{fmt(t.buyMin, 0)} minimum buy-in</span>
    </button>
  );
}

/** A little top-down table in the table's own colours, with its seats around the rail. */
export function TablePreview({ t, seated, className = '' }: { t: LiveTable; seated: number; className?: string }) {
  const th = t.theme;
  const poker = t.game === 'poker';
  const seats = Array.from({ length: t.seats }, (_, i) => {
    if (poker) { const a = Math.PI / 2 + (i / t.seats) * Math.PI * 2; return { x: 50 + Math.cos(a) * 47, y: 50 + Math.sin(a) * 44 }; }
    const a = Math.PI * (0.12 + (i / (t.seats - 1)) * 0.76); return { x: 50 + Math.cos(a) * 44, y: 22 + Math.sin(a) * 66 };
  });
  return (
    <div className={`relative mx-auto h-[118px] w-full max-w-[260px] ${className}`}>
      <div className={`absolute inset-x-3 ${poker ? 'inset-y-2 rounded-[999px]' : 'bottom-1 top-0 rounded-b-[999px] rounded-t-xl'} transition duration-500 group-hover:scale-[1.03]`}
        style={{ background: hex(th.rail), padding: 7, boxShadow: th.glow ? `0 0 22px ${hex(th.glow)}66` : '0 10px 24px -10px rgba(0,0,0,.8)' }}>
        <div className={`relative grid h-full w-full place-items-center overflow-hidden ${poker ? 'rounded-[999px]' : 'rounded-b-[999px] rounded-t-lg'}`}
          style={{ background: `radial-gradient(ellipse at 50% 40%, ${hex(th.felt)}, ${hex(th.edge)})`, boxShadow: `inset 0 0 0 1.5px ${hex(th.trim)}aa` }}>
          <span className="px-6 text-center font-display text-[11px] font-black uppercase leading-tight tracking-[.18em]" style={{ color: th.ink, opacity: 0.85 }}>{t.name}</span>
        </div>
      </div>
      {seats.map((p, i) => (
        <span key={i} className={`absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${i < seated ? 'border-black/60 bg-gold shadow-[0_0_8px_rgba(244,196,48,.8)]' : 'border-white/25 bg-ink-900'}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} />
      ))}
    </div>
  );
}
