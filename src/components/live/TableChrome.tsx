import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Spade, Users } from 'lucide-react';
import { BJ_TABLES, LiveTable, POKER_TABLES, ROULETTE_TABLES, hex } from '../../lib/net/tables';
import { useLobby } from '../../lib/net/lobby';
import { fmtCompact } from '../../lib/format';
import { useStore } from '../../store';
import { TableCard } from '../../pages/live/LiveLobby';
import type { ShellLook } from '../GameShell';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** The table's colours, crest and badges for the page header. */
export function tableLook(t: LiveTable, here: number, live: boolean): ShellLook {
  const accent = hex(t.theme.glow ?? t.theme.trim);
  const felt = hex(t.theme.felt);
  const stakes = t.game === 'poker' ? `Blinds ${fmtCompact(t.lo)}/${fmtCompact(t.hi)}` : t.game === 'blackjack' ? `Bets ${fmtCompact(t.lo)}–${fmtCompact(t.hi)}` : `Chips ${fmtCompact(t.lo)}–${fmtCompact(t.hi)}`;
  return {
    accent, felt,
    watermark: ROMAN[t.tier],
    crest: <Crest t={t} />,
    badges: (
      <>
        <Badge tone={live ? 'live' : 'plain'}><span className={`h-1.5 w-1.5 rounded-full ${live ? 'animate-pulse bg-emerald-400' : 'bg-smoke'}`} />{live ? `Live · ${here} here` : 'This browser only'}</Badge>
        <Badge accent={accent}>Table {ROMAN[t.tier]}</Badge>
        <Badge>{stakes}</Badge>
        {t.game !== 'roulette' ? <Badge>Buy-in <b className="text-gold">{fmtCompact(t.buyMin)}–{fmtCompact(t.buyMax)}</b></Badge> : <Badge>No buy-in</Badge>}
        <Badge><Users size={11} />{t.seats} {t.game === 'roulette' ? 'players' : 'seats'}</Badge>
      </>
    ),
  };
}

function Badge({ children, tone = 'plain', accent }: { children: ReactNode; tone?: 'plain' | 'live'; accent?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] ${tone === 'live' ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-black/35 text-cream/80'}`}
      style={accent ? { borderColor: `${accent}66`, background: `${accent}1f`, color: accent } : undefined}>
      {children}
    </span>
  );
}

/** A badge for the game in the table's colours: a spade, "21", or a little wheel. */
function Crest({ t }: { t: LiveTable }) {
  const trim = hex(t.theme.trim), felt = hex(t.theme.felt), edge = hex(t.theme.edge);
  const glow = t.theme.glow ? hex(t.theme.glow) : trim;
  return (
    <div className="relative grid h-16 w-16 place-items-center rounded-2xl p-[2px]" style={{ background: `linear-gradient(140deg, ${trim}, ${edge} 60%, ${trim})`, boxShadow: `0 10px 30px -10px ${glow}, 0 0 0 1px rgba(0,0,0,.4)` }}>
      <div className="grid h-full w-full place-items-center overflow-hidden rounded-[14px]" style={{ background: `radial-gradient(circle at 50% 30%, ${felt}, ${edge})` }}>
        {t.game === 'poker' && <Spade size={30} strokeWidth={2.2} style={{ color: t.theme.ink, filter: `drop-shadow(0 0 8px ${glow})` }} fill="currentColor" />}
        {t.game === 'blackjack' && <span className="font-display text-2xl font-black" style={{ color: t.theme.ink, textShadow: `0 0 12px ${glow}` }}>21</span>}
        {t.game === 'roulette' && (
          <span className="relative h-11 w-11 animate-[spin_14s_linear_infinite] rounded-full" style={{ background: `conic-gradient(${Array.from({ length: 18 }, (_, i) => `${i === 0 ? '#0e8f4a' : i % 2 ? '#b3192a' : '#141414'} ${i * 20}deg ${(i + 1) * 20}deg`).join(',')})`, boxShadow: `0 0 0 2px ${trim}` }}>
            <span className="absolute inset-[30%] rounded-full" style={{ background: `radial-gradient(circle, ${trim}, #6b4a12)` }} />
          </span>
        )}
      </div>
      <span className="absolute -bottom-1.5 -right-1.5 grid h-6 min-w-6 place-items-center rounded-full border border-black/40 px-1 font-display text-[10px] font-black text-ink" style={{ background: trim }}>{t.tier + 1}</span>
    </div>
  );
}

/** Under the game: the neighbouring tables of the same game, so you can hop up or down in stakes. */
export function MoreTables({ t }: { t: LiveTable }) {
  const all = t.game === 'poker' ? POKER_TABLES : t.game === 'blackjack' ? BJ_TABLES : ROULETTE_TABLES;
  const { counts } = useLobby();
  const balance = useStore((s) => s.balance);
  const nav = useNavigate();
  const base = `/games/${t.game}`;
  // the next tables up and down from this one
  const near = all.filter((x) => x.id !== t.id).sort((a, b) => Math.abs(a.tier - t.tier) - Math.abs(b.tier - t.tier) || b.tier - a.tier).slice(0, 4).sort((a, b) => a.tier - b.tier);
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-black sm:text-xl">More {t.game === 'poker' ? 'Hold’em' : t.game === 'blackjack' ? 'blackjack' : 'roulette'} tables</h2>
          <p className="text-xs text-smoke">{t.game === 'roulette' ? 'Same chips everywhere — pick the wheel you like.' : 'Move up or down in stakes. Your chips here are cashed out when you switch.'}</p>
        </div>
        <Link to={base} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-ink-700 px-3 py-2 text-xs font-bold text-cream hover:bg-ink-600">All tables<ArrowRight size={13} /></Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {near.map((x) => <TableCard key={x.id} t={x} count={counts[x.id]} balance={balance} best={false} vip={x.tier >= 8} onOpen={() => nav(`${base}/${x.id}${balance >= x.buyMin ? '?sit=1' : ''}`)} />)}
      </div>
    </section>
  );
}
