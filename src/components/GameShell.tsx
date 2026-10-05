import { ConfirmHost } from './Confirm';
import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ChevronLeft, Info, Maximize2, Star, Volume2, VolumeX, Zap } from 'lucide-react';
import { PhoneGameCtx, toggleFullscreen, usePhoneGame, usePhoneLayout } from '../lib/phone';
import { GameId, gameById } from '../lib/data';
import { toast, useStore } from '../store';
import { fmt, fmtMult, timeAgo } from '../lib/format';
import Modal from './Modal';
import WinFX from './WinFX';
import { useLiveFeed } from '../lib/useLiveFeed';
import { Coin } from './Icons';

export default function GameShell({ id, controls, children, rules, tall, title, subtitle, back = '/games' }: { id: GameId; controls: ReactNode; children: ReactNode; rules: string[]; tall?: boolean; title?: string; subtitle?: string; back?: string }) {
  const g = gameById(id)!;
  const fav = useStore((s) => s.favorites.includes(id));
  const toggleFav = useStore((s) => s.toggleFav);
  const { sound, turbo } = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const [info, setInfo] = useState(false);
  const { phone, portrait, w: vw, h: vh } = usePhoneLayout();
  const balance = useStore((s) => s.balance);

  // phones: a full-screen landscape game with the controls beside it — nothing on the page scrolls
  useEffect(() => {
    if (!phone) return;
    const html = document.documentElement, body = document.body;
    const prev = [html.style.overflow, body.style.overflow, html.style.overscrollBehavior];
    html.style.overflow = 'hidden'; body.style.overflow = 'hidden'; html.style.overscrollBehavior = 'none';
    window.scrollTo(0, 0);
    return () => { [html.style.overflow, body.style.overflow, html.style.overscrollBehavior] = prev; };
  }, [phone]);
  // held upright: show the game turned sideways straight away (no "rotate your phone" step)
  const rotated = phone && portrait;
  useEffect(() => {
    const d = document.documentElement.dataset;
    if (rotated) d.gameRotated = '1'; else delete d.gameRotated;
    return () => { delete d.gameRotated; };
  }, [rotated]);

  const rulesModal = (
    <Modal open={info} onClose={() => setInfo(false)} title={`How to play ${g.name}`}>
      <p className="text-sm text-smoke">{g.description}</p>
      <ol className="mt-4 space-y-2.5">
        {rules.map((r, i) => (
          <li key={i} className="flex gap-3 text-sm"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold/15 font-display text-xs font-black text-gold">{i + 1}</span><span>{r}</span></li>
        ))}
      </ol>
      <div className="mt-5 rounded-xl bg-ink-900 p-3 text-xs text-smoke">Outcomes use your browser's cryptographic RNG (<code>crypto.getRandomValues</code>). Max win: <b className="text-gold">{g.maxWin}</b>. RTP {g.rtp ?? '≈ 99%'}.</div>
    </Modal>
  );

  if (phone) {
    return (
      <PhoneGameCtx.Provider value={true}>
        {createPortal(
          <div className="fixed left-0 top-0 z-[65] flex bg-ink"
            style={rotated
              ? { width: vh, height: vw, transform: 'rotate(90deg) translateY(-100%)', transformOrigin: 'top left' }
              : { width: '100vw', height: '100dvh' }}>
            <section className="relative min-w-0 flex-1 felt grain">{children}<WinFX /></section>
            <aside className="flex min-h-0 w-[clamp(250px,34%,330px)] shrink-0 flex-col overflow-hidden border-l border-white/[0.06] bg-ink-800">
              <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-2 py-1.5" style={{ paddingTop: 'max(6px, env(safe-area-inset-top))' }}>
                <Link to={back} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-700" aria-label={back === '/games' ? 'Back to games' : 'Back to the lobby'}><ChevronLeft size={16} /></Link>
                <div className="flex min-w-0 flex-1 items-center gap-1 rounded-lg bg-ink-900 px-2 py-1.5 font-display text-xs font-black text-gold tabular" title={title ?? g.name}>
                  <Coin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{fmt(balance, 0)}</span>
                </div>
                <IconBtn small onClick={() => update({ turbo: !turbo })} active={turbo} label="Turbo mode"><Zap size={14} /></IconBtn>
                <IconBtn small onClick={() => update({ sound: !sound })} active={sound} label="Sound">{sound ? <Volume2 size={14} /> : <VolumeX size={14} />}</IconBtn>
                <IconBtn small onClick={() => setInfo(true)} label="How to play"><Info size={14} /></IconBtn>
                <IconBtn small onClick={() => toggleFullscreen(() => toast({ title: 'Fullscreen isn’t available in this browser', desc: 'The game already fills your screen — on iPhone, “Add to Home Screen” hides the browser bars.', tone: 'neutral' }))} label="Fullscreen"><Maximize2 size={14} /></IconBtn>
              </div>
              <div className="phone-controls min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 pt-3" style={{ paddingRight: 'max(12px, env(safe-area-inset-right))' }}>{controls}</div>
            </aside>
            {rulesModal}
            <ConfirmHost />
          </div>,
          document.body,
        )}
      </PhoneGameCtx.Provider>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6 pt-4 lg:pt-6 pb-48 lg:pb-0">
      <div className="mb-4 flex items-center gap-2">
        <Link to={back} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-700 hover:bg-ink-600" aria-label={back === '/games' ? 'Back to games' : 'Back to the lobby'}><ChevronLeft size={18} /></Link>
        <div className="min-w-0">
          <h1 className="font-display text-lg sm:text-2xl font-black leading-tight truncate">{title ?? g.name}</h1>
          <p className="text-xs text-smoke truncate">{subtitle ?? g.tagline}</p>
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
        <section className={`order-1 lg:order-2 relative ${tall ? 'min-h-[max(420px,calc(100svh-316px))]' : 'min-h-[max(380px,calc(100svh-400px))]'} sm:min-h-[500px] lg:min-h-[600px] felt grain`}>{children}<WinFX /></section>
      </div>

      <BelowGame id={id} />

      {rulesModal}
    </div>
  );
}

/**
 * The game's main button(s). On desktop it renders in place inside the
 * controls panel; on phones it's pinned above the bottom nav so it's always
 * reachable without scrolling.
 */
export function GameAction({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  const phone = usePhoneGame();
  // phone game mode: pinned to the bottom of the side panel, always visible
  if (phone) return (
    <div className="sticky bottom-0 z-10 -mx-3 space-y-2 border-t border-white/[0.06] bg-ink-800/95 px-3 pb-2 pt-2 backdrop-blur" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
      {extra}
      {children}
    </div>
  );
  return (
    <>
      <div className="hidden lg:block">{children}</div>
      {createPortal(
        <div className="lg:hidden fixed inset-x-0 z-40 glass-bar border-t border-white/[0.07] px-3 pt-2.5 pb-2 shadow-[0_-12px_30px_-10px_rgba(0,0,0,.8)]"
          style={{ bottom: 'calc(58px + env(safe-area-inset-bottom))' }}>
          {extra && <div className="mb-2">{extra}</div>}
          {children}
        </div>,
        document.body,
      )}
    </>
  );
}

function IconBtn({ children, onClick, active, label, small }: { children: ReactNode; onClick: () => void; active?: boolean; label: string; small?: boolean }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} aria-pressed={active}
      className={`grid ${small ? 'h-8 w-8 shrink-0 rounded-lg' : 'h-9 w-9 rounded-xl'} place-items-center border transition ${active ? 'border-gold/40 bg-gold/10 text-gold' : 'border-white/5 bg-ink-700 text-smoke hover:text-cream'}`}>
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

