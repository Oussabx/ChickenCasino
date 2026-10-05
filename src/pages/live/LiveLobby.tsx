import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Bot, ChevronLeft, Crown, Lock, Radio, Zap } from 'lucide-react';
import { BJ_TABLES, LiveTable, POKER_TABLES, ROULETTE_TABLES, hex } from '../../lib/net/tables';
import { useLobby } from '../../lib/net/lobby';
import { fmt, fmtCompact } from '../../lib/format';
import { useStore, useUI } from '../../store';
import { Coin } from '../../components/Icons';

/** Stakes bands for the filter and the section headings. */
const BANDS = [
  { id: 'low', label: 'Low stakes', sub: 'Learn the ropes, build a stack', tiers: [0, 1, 2] },
  { id: 'mid', label: 'Mid stakes', sub: 'Where the regulars play', tiers: [3, 4, 5] },
  { id: 'high', label: 'High stakes', sub: 'Big blinds, bigger pots', tiers: [6, 7] },
  { id: 'vip', label: 'VIP room', sub: 'For the high rollers only', tiers: [8, 9] },
] as const;
type Band = 'all' | (typeof BANDS)[number]['id'];
/** Roulette tables share one chip range, so they're one list. */
const ROULETTE_BAND = [{ id: 'all', label: 'All tables', sub: 'Same chips at every table (100 to 1M) — pick the look you like', tiers: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] }] as const;

/** Zynga-style lobby: ten live tables per game, from friendly stakes to the high-roller room. */
export default function LiveLobby({ game }: { game: 'poker' | 'blackjack' | 'roulette' }) {
  const roulette = game === 'roulette';
  const tables = game === 'poker' ? POKER_TABLES : game === 'blackjack' ? BJ_TABLES : ROULETTE_TABLES;
  const { counts, kind, online } = useLobby();
  const balance = useStore((s) => s.balance);
  const escrow = useStore((s) => s.escrow);
  const nav = useNavigate();
  const [band, setBand] = useState<Band>('all');
  // "Play now": the biggest table you can comfortably afford (4+ minimum buy-ins)
  const best = roulette
    ? [...tables].filter((t) => (counts[t.id]?.seated ?? 0) > 0).sort((a, b) => (counts[b.id]?.seated ?? 0) - (counts[a.id]?.seated ?? 0))[0]
    : [...tables].reverse().find((t) => balance >= t.buyMin * 4) ?? [...tables].reverse().find((t) => balance >= t.buyMin);
  const featured = best ?? tables[0];
  const title = game === 'poker' ? 'Texas Hold’em' : game === 'blackjack' ? 'Blackjack' : 'Roulette';
  const base = `/games/${game}`;
  const seatedAll = Object.values(counts).reduce((a, c) => a + c.seated, 0);
  const open = (t: LiveTable) => nav(`${base}/${t.id}${balance >= t.buyMin ? '?sit=1' : ''}`);
  const shown = roulette ? ROULETTE_BAND : BANDS.filter((b) => band === 'all' || b.id === band);

  return (
    <div className="mx-auto max-w-7xl px-3 pb-28 pt-4 sm:px-4 lg:px-6 lg:pt-6">
      <div className="mb-4 flex items-center gap-2">
        <Link to="/games" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-700 hover:bg-ink-600" aria-label="Back to games"><ChevronLeft size={18} /></Link>
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-black leading-tight sm:text-2xl">{title} · Live tables</h1>
          <p className="truncate text-xs text-smoke">{game === 'poker' ? 'Real players, real bluffs. Pick your stakes and your buy-in.' : game === 'blackjack' ? 'Up to five players against the chicken dealer.' : 'Up to 25 players on one wheel. Chips from 100 to a million.'}</p>
        </div>
      </div>

      {/* ---------- hero: the featured table ---------- */}
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.07]" style={{ background: `radial-gradient(ellipse at 78% 60%, ${hex(featured.theme.felt)}66, transparent 55%), radial-gradient(ellipse at 0% 0%, rgba(244,196,48,.14), transparent 50%), #0d0b0c` }}>
        <div className="grid items-center gap-2 p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-6 lg:p-8">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.16em] ${kind === 'live' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-smoke'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${kind === 'live' ? 'animate-pulse bg-emerald-400' : 'bg-smoke'}`} />{kind === 'live' ? 'Live' : 'This browser only'}
              </span>
              {best && <span className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.16em] text-ink" style={{ background: hex(featured.theme.trim) }}>{roulette ? 'Hot table' : 'Recommended for you'}</span>}
            </div>
            <h2 className="mt-3 font-display text-3xl font-black leading-[1.05] sm:text-4xl lg:text-5xl">{featured.name}</h2>
            <p className="mt-1 text-sm text-cream/70">{featured.tagline} · Table {featured.tier + 1} of 10</p>
            <div className="mt-4 grid max-w-md grid-cols-3 gap-2">
              <Stat k={game === 'poker' ? 'Blinds' : roulette ? 'Chips' : 'Bets'} v={`${fmtCompact(featured.lo)}${game === 'poker' ? '/' : '–'}${fmtCompact(featured.hi)}`} />
              <Stat k="Buy-in" v={roulette ? 'None' : `${fmtCompact(featured.buyMin)}–${fmtCompact(featured.buyMax)}`} gold />
              <Stat k={roulette ? 'Players' : 'Seated'} v={`${counts[featured.id]?.seated ?? 0}/${featured.seats}`} />
            </div>
            <div className="mt-5 hidden flex-col gap-2 sm:flex sm:flex-row">
              <HeroButtons best={roulette ? featured : best} base={base} onOpen={open} />
            </div>
          </div>
          <button type="button" onClick={() => open(featured)} className="group relative mx-auto w-full max-w-[520px] focus-visible:outline-none" aria-label={`Open ${featured.name}`}>
            <TablePreview t={featured} seated={counts[featured.id]?.seated ?? 0} size="lg" />
          </button>
          <div className="flex flex-col gap-2 sm:hidden">
            <HeroButtons best={roulette ? featured : best} base={base} onOpen={open} />
          </div>
        </div>
        {/* quick facts */}
        <div className="grid grid-cols-3 border-t border-white/[0.06] bg-black/25 text-center">
          <Fact k="Online now" v={kind === 'live' ? String(Math.max(1, online)) : '—'} />
          <Fact k="Seated now" v={String(seatedAll)} />
          <Fact k="Your coins" v={fmtCompact(balance)} gold />
        </div>
      </section>
      {escrow?.game === game && (
        <button type="button" onClick={() => nav(`${base}/${escrow.table}`)} className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-left text-sm">
          <Radio size={16} className="shrink-0 text-emerald-300" /><span className="min-w-0 flex-1 truncate">You still have <b className="text-gold">{fmt(escrow.stack, 0)}</b> on the table at <b>{escrow.tableName}</b></span><ArrowRight size={15} />
        </button>
      )}

      {/* ---------- stakes filter ---------- */}
      <div className={`no-scrollbar ${roulette ? 'hidden' : ''} -mx-3 mt-5 flex gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:px-0`}>
        {(['all', ...BANDS.map((b) => b.id)] as Band[]).map((b) => {
          const label = b === 'all' ? 'All tables' : BANDS.find((x) => x.id === b)!.label;
          return (
            <button key={b} type="button" onClick={() => setBand(b)} aria-pressed={band === b}
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-4 py-2 text-xs font-bold transition ${band === b ? 'border-gold bg-gold text-ink' : 'border-white/10 bg-ink-800 text-smoke hover:text-cream'}`}>
              {b === 'vip' && <Crown size={12} />}{label}
            </button>
          );
        })}
      </div>

      {shown.map((b) => (
        <section key={b.id} className="mt-5">
          <div className="mb-2.5 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h3 className={`flex items-center gap-2 font-display text-lg font-black sm:text-xl ${b.id === 'vip' ? 'text-gold-grad' : ''}`}>{b.id === 'vip' && <Crown size={18} className="text-gold" />}{b.label}</h3>
              <p className="truncate text-xs text-smoke">{b.sub}</p>
            </div>
            {!roulette && <span className="shrink-0 text-[11px] font-semibold text-smoke tabular">Buy-ins {fmtCompact(tables[b.tiers[0]].buyMin)}–{fmtCompact(tables[b.tiers[b.tiers.length - 1]].buyMax)}</span>}
          </div>
          <div className={`grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 ${b.tiers.length !== 2 ? 'lg:grid-cols-3' : ''}`}>
            {b.tiers.map((i) => tables[i]).map((t) => (
              <TableCard key={t.id} t={t} count={counts[t.id]} balance={balance} best={best?.id === t.id} vip={b.id === 'vip'} onOpen={() => open(t)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function HeroButtons({ best, base, onOpen }: { best?: LiveTable; base: string; onOpen: (t: LiveTable) => void }) {
  return (
    <>
      {best
        ? <button type="button" className="btn-gold px-6 py-3 text-base" onClick={() => onOpen(best)}><Zap size={17} />Play now</button>
        : <button type="button" className="btn-gold px-6 py-3 text-base" onClick={() => useUI.getState().openStore({ tab: 'coins' })}><Coin className="h-4 w-4" />Get coins to play</button>}
      <Link to={`${base}/practice`} className="btn-ghost px-5 py-3 text-sm"><Bot size={15} />Practice vs bots</Link>
    </>
  );
}

function Stat({ k, v, gold }: { k: string; v: string; gold?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.06] bg-black/40 px-2.5 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-smoke">{k}</div>
      <div className={`truncate font-display text-sm font-black tabular sm:text-base ${gold ? 'text-gold' : ''}`}>{v}</div>
    </div>
  );
}

function Fact({ k, v, gold }: { k: string; v: string; gold?: boolean }) {
  return (
    <div className="px-2 py-2.5 sm:py-3">
      <div className={`font-display text-base font-black tabular sm:text-lg ${gold ? 'text-gold' : ''}`}>{v}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-smoke">{k}</div>
    </div>
  );
}

export function TableCard({ t, count, balance, best, vip, onOpen }: { t: LiveTable; count?: { seated: number; watching: number }; balance: number; best: boolean; vip: boolean; onOpen: () => void }) {
  const locked = balance < t.buyMin;
  const seated = count?.seated ?? 0;
  const trim = hex(t.theme.trim);
  const progress = Math.min(1, balance / t.buyMin);
  return (
    <button type="button" onClick={onOpen}
      className={`group relative flex overflow-hidden rounded-2xl border text-left transition duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:flex-col ${vip ? 'border-gold/40 bg-gradient-to-b from-[#1d1608] to-ink-800' : 'border-white/[0.07] bg-ink-800'}`}
      style={{ boxShadow: best ? `0 0 0 1.5px ${trim}, 0 14px 40px -18px ${trim}` : undefined }}>
      {/* art */}
      <div className="relative w-[118px] shrink-0 self-stretch overflow-hidden sm:w-auto" style={{ background: `radial-gradient(ellipse at 50% 85%, ${hex(t.theme.felt)}55, transparent 70%)` }}>
        <span className="pointer-events-none absolute -right-1 -top-3 select-none font-display text-[64px] font-black leading-none text-white/[0.05] sm:text-[96px]">{t.tier + 1}</span>
        <div className={`flex h-full items-center transition duration-500 group-hover:scale-[1.04] ${locked ? 'opacity-55 grayscale-[.6]' : ''}`}>
          <TablePreview t={t} seated={seated} size="sm" />
        </div>
        {locked && <span className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/70 text-cream backdrop-blur sm:h-11 sm:w-11"><Lock size={16} /></span>}
      </div>
      {/* info */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 border-l border-white/[0.06] p-3 sm:border-l-0 sm:border-t sm:p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {vip && <Crown size={13} className="shrink-0 text-gold" />}
              <span className="truncate font-display text-[15px] font-black sm:text-base">{t.name}</span>
            </div>
            <div className="truncate text-[11px] text-smoke sm:text-xs">{t.tagline}</div>
          </div>
          {best
            ? <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-ink" style={{ background: trim }}>Best for you</span>
            : <span className="hidden shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-smoke sm:inline">Table {t.tier + 1}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          <span><span className="text-smoke">{t.game === 'poker' ? 'Blinds ' : t.game === 'roulette' ? 'Chips ' : 'Bets '}</span><b className="font-display tabular">{fmtCompact(t.lo)}{t.game === 'poker' ? '/' : '–'}{fmtCompact(t.hi)}</b></span>
          {t.game === 'roulette'
            ? <span className="text-smoke">No buy-in</span>
            : <span><span className="text-smoke">Buy-in </span><b className="font-display tabular text-gold">{fmtCompact(t.buyMin)}–{fmtCompact(t.buyMax)}</b></span>}
        </div>
        {locked ? (
          <div className="mt-auto">
            <div className="flex items-center justify-between gap-2 text-[11px]"><span className="truncate text-smoke">You have {fmtCompact(balance)}</span><span className="shrink-0 font-bold text-cream/80">Need {fmtCompact(t.buyMin - balance)} more</span></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full" style={{ width: `${Math.max(4, progress * 100)}%`, background: `linear-gradient(90deg, ${trim}88, ${trim})` }} /></div>
          </div>
        ) : (
          <div className="mt-auto flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-smoke">
              {t.seats <= 8 && <span className="flex shrink-0 gap-0.5">{Array.from({ length: t.seats }, (_, i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < seated ? 'bg-emerald-400' : 'bg-white/15'}`} />)}</span>}
              <span className="truncate">{t.seats > 8 ? `${seated}/${t.seats} players` : seated ? `${seated} playing` : 'Open table'}{count?.watching ? ` · ${count.watching} watching` : ''}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-gold px-3 py-1.5 text-xs font-black text-ink transition group-hover:bg-gold-300">Join<ArrowRight size={13} /></span>
          </div>
        )}
      </div>
      <span className="sr-only">{fmt(t.buyMin, 0)} minimum buy-in</span>
    </button>
  );
}

/**
 * A little table in the table's own colours, tilted as if you're walking up to
 * it: felt, rail, chips in the pot, seats round the edge, chicken dealer at the head.
 */
export function TablePreview({ t, seated, size = 'sm' }: { t: LiveTable; seated: number; size?: 'sm' | 'lg' }) {
  if (t.game === 'roulette') return <WheelPreview t={t} seated={seated} size={size} />;
  const th = t.theme;
  const poker = t.game === 'poker';
  const lg = size === 'lg';
  const seats = Array.from({ length: t.seats }, (_, i) => {
    if (poker) { const a = Math.PI / 2 + ((i + 0.5) / t.seats) * Math.PI * 2; return { x: 50 + Math.cos(a) * 50, y: 50 + Math.sin(a) * 50 }; }
    const a = Math.PI * (0.1 + (i / (t.seats - 1)) * 0.8); return { x: 50 + Math.cos(a) * 49, y: 4 + Math.sin(a) * 94 };
  });
  const chips = ['#E63946', '#F4C430', '#10B981'];
  return (
    <div className={`relative w-full ${lg ? 'h-[190px] sm:h-[250px]' : 'h-[100px] sm:h-[132px]'}`} style={{ perspective: lg ? 900 : 520 }}>
      <img src="./img/head.webp" alt="" draggable={false}
        className={`absolute left-1/2 z-10 -translate-x-1/2 rounded-full drop-shadow-[0_6px_10px_rgba(0,0,0,.7)] ${lg ? 'top-0 h-11 w-11 sm:h-14 sm:w-14' : 'top-1 h-6 w-6 sm:h-8 sm:w-8'}`} />
      <div className={`absolute ${lg ? 'inset-x-[5%] top-8 h-[140px] sm:top-11 sm:h-[180px]' : 'inset-x-[8%] top-[22px] h-[66px] sm:top-7 sm:h-[90px]'}`}
        style={{ transform: 'rotateX(36deg)', transformStyle: 'preserve-3d' }}>
        <div className={`absolute inset-0 ${poker ? 'rounded-[999px]' : 'rounded-b-[999px] rounded-t-[12px]'}`}
          style={{ background: `linear-gradient(180deg, ${hex(th.rail)}, ${hex(th.edge)})`, padding: lg ? 11 : 5, boxShadow: `0 ${lg ? 26 : 12}px ${lg ? 40 : 20}px -12px rgba(0,0,0,.85)${th.glow ? `, 0 0 ${lg ? 40 : 20}px ${hex(th.glow)}55` : ''}` }}>
          <div className={`relative grid h-full w-full place-items-center overflow-hidden ${poker ? 'rounded-[999px]' : 'rounded-b-[999px] rounded-t-[8px]'}`}
            style={{ background: `radial-gradient(ellipse at 50% 35%, ${hex(th.felt)}, ${hex(th.edge)} 115%)`, boxShadow: `inset 0 0 0 ${lg ? 2 : 1.5}px ${hex(th.trim)}aa, inset 0 0 30px rgba(0,0,0,.45)` }}>
            {lg && <span className="px-[14%] text-center font-display text-sm font-black uppercase leading-tight tracking-[.24em] sm:text-base" style={{ color: th.ink, opacity: 0.8 }}>{t.name}</span>}
            <div className={`absolute flex items-end gap-[3px] ${lg ? 'bottom-[20%] w-16' : 'bottom-[22%] w-7 sm:w-9'}`}>
              {[5, 7, 4].map((n, k) => (
                <span key={k} className="flex flex-1 flex-col-reverse gap-[1px]">
                  {Array.from({ length: lg ? n : Math.ceil(n / 2) }, (_, j) => <span key={j} className="block h-[3px] w-full rounded-full" style={{ background: chips[(k + j) % 3], boxShadow: '0 1px 0 rgba(0,0,0,.45)' }} />)}
                </span>
              ))}
            </div>
          </div>
        </div>
        {seats.map((p, i) => (
          <span key={i} className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${lg ? 'h-5 w-5' : 'h-2.5 w-2.5 sm:h-3 sm:w-3'} ${i < seated ? 'border-black/50 bg-gold shadow-[0_0_10px_rgba(244,196,48,.9)]' : 'border-white/20 bg-ink-900'}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} />
        ))}
      </div>
    </div>
  );
}

/** Roulette preview: the wheel, spinning slowly, beside a strip of the layout in the table's felt. */
function WheelPreview({ t, seated, size }: { t: LiveTable; seated: number; size: 'sm' | 'lg' }) {
  const th = t.theme;
  const lg = size === 'lg';
  const W = lg ? 'h-[150px] w-[150px] sm:h-[200px] sm:w-[200px]' : 'h-[84px] w-[84px] sm:h-[116px] sm:w-[116px]';
  // 37 pockets: green zero, then red/black alternating
  const seg = 360 / 37;
  const stops = Array.from({ length: 37 }, (_, i) => `${i === 0 ? '#0e8f4a' : i % 2 ? '#b3192a' : '#141414'} ${i * seg}deg ${(i + 1) * seg}deg`).join(',');
  return (
    <div className={`relative flex w-full items-center justify-center gap-3 ${lg ? 'h-[190px] sm:h-[250px]' : 'h-[100px] sm:h-[132px]'}`}>
      <div className={`relative shrink-0 rounded-full p-[5%] ${W}`} style={{ background: `radial-gradient(circle, ${hex(th.rail)} 60%, #1a0d06)`, boxShadow: `0 14px 30px -10px rgba(0,0,0,.85)${th.glow ? `, 0 0 26px ${hex(th.glow)}66` : ''}` }}>
        <div className="wheel-idle relative h-full w-full rounded-full" style={{ background: `conic-gradient(${stops})`, boxShadow: `inset 0 0 0 2px ${hex(th.trim)}` }}>
          <div className="absolute inset-[26%] rounded-full" style={{ background: `radial-gradient(circle, ${hex(th.trim)}, #6b4a12)`, boxShadow: '0 0 10px rgba(0,0,0,.6)' }} />
          <span className="absolute left-1/2 top-[8%] h-[7%] w-[7%] -translate-x-1/2 rounded-full bg-white shadow" />
        </div>
      </div>
      {lg && (
        <div className="hidden flex-col gap-1 sm:flex" style={{ transform: 'perspective(600px) rotateY(-14deg)' }}>
          <div className="grid grid-cols-6 gap-[3px] rounded-lg p-2" style={{ background: `linear-gradient(160deg, ${hex(th.felt)}, ${hex(th.edge)})`, boxShadow: `inset 0 0 0 1.5px ${hex(th.trim)}99` }}>
            {Array.from({ length: 18 }, (_, i) => { const n = i + 1; const red = [1, 3, 5, 7, 9, 12, 14, 16, 18].includes(n); return <span key={n} className="grid h-6 w-6 place-items-center rounded-[3px] font-display text-[10px] font-black text-white" style={{ background: red ? '#b3192a' : '#141414' }}>{n}</span>; })}
          </div>
          <span className="text-center text-[11px] font-bold text-cream/70">{seated}/{t.seats} players</span>
        </div>
      )}
    </div>
  );
}
