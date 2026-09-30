import { ReactNode, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ChevronLeft, Info, Star, Volume2, VolumeX, Zap } from 'lucide-react';
import { GameId, gameById } from '../lib/data';
import { useStore } from '../store';
import { fmt, fmtMult, timeAgo } from '../lib/format';
import Modal from './Modal';
import { useLiveFeed } from '../lib/useLiveFeed';
import { Coin } from './Icons';

export default function GameShell({ id, controls, children, rules }: { id: GameId; controls: ReactNode; children: ReactNode; rules: string[] }) {
  const g = gameById(id)!;
  const fav = useStore((s) => s.favorites.includes(id));
  const toggleFav = useStore((s) => s.toggleFav);
  const { sound, turbo } = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const [info, setInfo] = useState(false);

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6 pt-4 lg:pt-6 pb-48 lg:pb-0">
      <div className="mb-4 flex items-center gap-2">
        <Link to="/games" className="grid h-9 w-9 place-items-center rounded-xl bg-ink-700 hover:bg-ink-600" aria-label="Back to games"><ChevronLeft size={18} /></Link>
        <div className="min-w-0">
          <h1 className="font-display text-lg sm:text-2xl font-black leading-tight truncate">{g.name}</h1>
          <p className="text-xs text-smoke truncate">{g.tagline}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <IconBtn onClick={() => update({ turbo: !turbo })} active={turbo} label="Turbo mode"><Zap size={16} /></IconBtn>
          <IconBtn onClick={() => update({ sound: !sound })} active={sound} label="Sound">{sound ? <Volume2 size={16} /> : <VolumeX size={16} />}</IconBtn>
          <IconBtn onClick={() => toggleFav(id)} active={fav} label="Favourite"><Star size={16} fill={fav ? 'currentColor' : 'none'} /></IconBtn>
          <IconBtn onClick={() => setInfo(true)} label="How to play"><Info size={16} /></IconBtn>
        </div>
      </div>

      <div className="card overflow-hidden grid lg:grid-cols-[340px_1fr]">
        <aside className="order-2 lg:order-1 border-t lg:border-t-0 lg:border-r border-white/[0.06] bg-ink-800 p-4 space-y-4">{controls}</aside>
        <section className="order-1 lg:order-2 relative min-h-[380px] sm:min-h-[500px] lg:min-h-[580px] felt grain">{children}</section>
      </div>

      <BelowGame id={id} />

      <Modal open={info} onClose={() => setInfo(false)} title={`How to play ${g.name}`}>
        <p className="text-sm text-smoke">{g.description}</p>
        <ol className="mt-4 space-y-2.5">
          {rules.map((r, i) => (
            <li key={i} className="flex gap-3 text-sm"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold/15 font-display text-xs font-black text-gold">{i + 1}</span><span>{r}</span></li>
          ))}
        </ol>
        <div className="mt-5 rounded-xl bg-ink-900 p-3 text-xs text-smoke">Outcomes use your browser's cryptographic RNG (<code>crypto.getRandomValues</code>). Max win: <b className="text-gold">{g.maxWin}</b>. RTP ≈ 99%.</div>
      </Modal>
    </div>
  );
}

/**
 * The game's main button(s). On desktop it renders in place inside the
 * controls panel; on phones it's pinned above the bottom nav so it's always
 * reachable without scrolling.
 */
export function GameAction({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <>
      <div className="hidden lg:block">{children}</div>
      {createPortal(
        <div className="lg:hidden fixed inset-x-0 z-40 px-3 pt-6 pb-2 bg-gradient-to-t from-ink via-ink/95 to-transparent"
          style={{ bottom: 'calc(58px + env(safe-area-inset-bottom))' }}>
          {extra && <div className="mb-2">{extra}</div>}
          {children}
        </div>,
        document.body,
      )}
    </>
  );
}

function IconBtn({ children, onClick, active, label }: { children: ReactNode; onClick: () => void; active?: boolean; label: string }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} aria-pressed={active}
      className={`grid h-9 w-9 place-items-center rounded-xl border transition ${active ? 'border-gold/40 bg-gold/10 text-gold' : 'border-white/5 bg-ink-700 text-smoke hover:text-cream'}`}>
      {children}
    </button>
  );
}

function BelowGame({ id }: { id: GameId }) {
  const [tab, setTab] = useState<'mine' | 'live'>('mine');
  const rounds = useStore((s) => s.rounds).filter((r) => r.game === id).slice(0, 12);
  const feed = useLiveFeed(12, 1400);
  return (
    <div className="mt-6 card p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <div className="seg w-full sm:w-auto">
          <button data-active={tab === 'mine'} onClick={() => setTab('mine')} className="!px-4">My bets</button>
          <button data-active={tab === 'live'} onClick={() => setTab('live')} className="!px-4">
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />Live bets</span>
          </button>
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-smoke">
            <tr><th className="py-2 font-semibold">{tab === 'mine' ? 'Time' : 'Player'}</th><th className="font-semibold">Bet</th><th className="font-semibold">Multi</th><th className="text-right font-semibold">Payout</th></tr>
          </thead>
          <tbody className="tabular">
            {tab === 'mine' ? (
              rounds.length ? rounds.map((r) => (
                <tr key={r.id} className="border-t border-white/[0.04]">
                  <td className="py-2.5 text-smoke">{timeAgo(r.at)}</td>
                  <td><span className="inline-flex items-center gap-1"><Coin className="h-3.5 w-3.5" />{fmt(r.bet)}</span></td>
                  <td className={r.multiplier >= 1 ? 'text-emerald-400' : 'text-smoke'}>{fmtMult(r.multiplier)}</td>
                  <td className={`text-right font-semibold ${r.payout > r.bet ? 'text-emerald-400' : r.payout < r.bet ? 'text-blood' : ''}`}>{r.payout > r.bet ? '+' : ''}{fmt(r.payout - r.bet)}</td>
                </tr>
              )) : <tr><td colSpan={4} className="py-8 text-center text-smoke">No bets yet — your history shows up here.</td></tr>
            ) : feed.map((f) => (
              <tr key={f.id} className="border-t border-white/[0.04] animate-slideUp">
                <td className="py-2.5 font-medium">{f.name}</td>
                <td><span className="inline-flex items-center gap-1"><Coin className="h-3.5 w-3.5" />{fmt(f.bet)}</span></td>
                <td className="text-emerald-400">{fmtMult(f.mult)}</td>
                <td className="text-right font-semibold text-emerald-400">+{fmt(f.bet * f.mult - f.bet)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
