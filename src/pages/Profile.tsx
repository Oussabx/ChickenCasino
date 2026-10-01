import { Link } from 'react-router-dom';
import { Award, Settings, ShoppingBag, Lock } from 'lucide-react';
import { useLevel, useStore, useUI } from '../store';
import { GAMES, itemById, xpForLevel } from '../lib/data';
import { fmt, fmtMult } from '../lib/format';
import Avatar, { PlayerName } from '../components/Avatar';
import { ChickenArt } from '../components/CosmeticArt';
import GameArt from '../components/GameArt';
import { Coin, Egg } from '../components/Icons';

export default function Profile() {
  const s = useStore();
  const { level, tier, xp } = useLevel();
  const openAuth = useUI((x) => x.openAuth);
  if (!s.user) {
    return (
      <div className="mx-auto max-w-md px-4 pt-16 text-center">
        <img src="./img/head.webp" alt="" className="mx-auto h-28 w-28 rounded-full animate-floaty" />
        <h1 className="mt-6 h-display text-3xl">No chicken yet</h1>
        <p className="mt-2 text-smoke">Create a free account to track stats, collect achievements and flex in the shop.</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button className="btn-ghost py-3" onClick={() => openAuth('login')}>Log in</button>
          <button className="btn-gold py-3" onClick={() => openAuth('signup')}>Sign up</button>
        </div>
      </div>
    );
  }
  const pct = Math.min(100, ((xp - xpForLevel(level)) / (xpForLevel(level + 1) - xpForLevel(level))) * 100);
  const title = itemById(s.equipped.title);
  const played = new Set(Object.keys(s.stats.perGame));
  const ACH = [
    { t: 'First Peck', d: 'Play your first round', ok: s.stats.rounds >= 1 },
    { t: 'Regular', d: 'Play 100 rounds', ok: s.stats.rounds >= 100 },
    { t: 'Coop Tourist', d: 'Play 6 different games', ok: played.size >= 6 },
    { t: 'Double Yolk', d: 'Hit a 10× multiplier', ok: s.stats.biggestMult >= 10 },
    { t: 'Golden Goose', d: 'Hit a 100× multiplier', ok: s.stats.biggestMult >= 100 },
    { t: 'Big Cluckin’ Win', d: 'Win 10,000+ in one round', ok: s.stats.biggestWin >= 10000 },
    { t: 'High Roller', d: 'Wager 100,000 total', ok: s.stats.wagered >= 100000 },
    { t: 'Collector', d: 'Own 10 shop items', ok: s.inventory.length >= 10 },
    { t: 'Rooster Rank', d: 'Reach level 10', ok: level >= 10 },
    { t: 'Streaker', d: '7-day login streak', ok: s.daily.streak >= 7 },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 pt-6 space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/5 bg-ink-900 grain">
        <img src="./img/strip-closeup.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/70 to-transparent" />
        <div className="relative p-6 sm:p-10 flex flex-col sm:flex-row sm:items-end gap-5">
          <Avatar size={112} />
          <div className="flex-1 min-w-0">
            <div className="chip bg-white/5 border border-white/10 uppercase tracking-wider !text-[10px] text-gold">{title?.name}</div>
            <h1 className="h-display text-4xl sm:text-5xl mt-2 truncate normal-case"><PlayerName name={s.user.name} /></h1>
            <div className="mt-1 text-sm"><span className="font-bold" style={{ color: tier.color }}>{tier.name}</span> <span className="text-smoke">· Level {level} · Member since {new Date(s.user.joinedAt).toLocaleDateString()}</span></div>
            <div className="mt-3 max-w-md"><div className="h-2 rounded-full bg-ink-500 overflow-hidden"><div className="h-full bg-gradient-to-r from-gold-600 to-gold" style={{ width: `${pct}%` }} /></div>
              <div className="mt-1 text-[11px] text-smoke">{fmt(xp, 0)} / {fmt(xpForLevel(level + 1), 0)} XP</div></div>
          </div>
          <Link to="/shop?tab=locker" className="group relative hidden shrink-0 sm:block" aria-label="Open My Locker">
            <div className="absolute inset-x-4 bottom-1 h-4 rounded-[50%] bg-black/60 blur-md" />
            <div className="transition group-hover:-translate-y-1"><ChickenArt skin={s.equipped.chicken} hat={s.equipped.hat} size={130} /></div>
          </Link>
          <div className="flex gap-2">
            <Link to="/shop?tab=locker" className="btn-ghost px-4 py-2.5 text-sm"><ShoppingBag size={15} />My Locker</Link>
            <Link to="/settings" className="btn-dark px-3 py-2.5" aria-label="Settings"><Settings size={16} /></Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { l: 'Balance', v: <span className="flex items-center gap-1.5"><Coin className="h-5 w-5" />{fmt(s.balance)}</span> },
          { l: 'Golden eggs', v: <span className="flex items-center gap-1.5"><Egg className="h-5 w-5" />{s.eggs}</span> },
          { l: 'Biggest win', v: fmt(s.stats.biggestWin) },
          { l: 'Best multiplier', v: <span className="text-gold">{s.stats.biggestMult ? fmtMult(s.stats.biggestMult) : '—'}</span> },
        ].map((x) => (
          <div key={x.l} className="card p-4"><div className="label !text-[10px]">{x.l}</div><div className="mt-1 font-display text-xl font-black tabular">{x.v}</div></div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="card p-5">
          <h2 className="font-display text-lg font-extrabold">Game stats</h2>
          <div className="mt-3 space-y-2">
            {GAMES.map((g) => {
              const st = s.stats.perGame[g.id];
              return (
                <Link to={`/games/${g.id}`} key={g.id} className="flex items-center gap-3 rounded-2xl bg-ink-700/50 p-2.5 pr-4 hover:bg-ink-700">
                  <GameArt id={g.id} className="h-12 w-12 rounded-xl shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{g.name}</div>
                    <div className="text-[11px] text-smoke">{st ? `${st.rounds} rounds · wagered ${fmt(st.wagered, 0)} · best ${fmtMult(st.best)}` : 'Not played yet'}</div>
                  </div>
                  {st && <div className={`font-display font-bold text-sm tabular ${st.profit >= 0 ? 'text-emerald-400' : 'text-blood'}`}>{st.profit >= 0 ? '+' : ''}{fmt(st.profit)}</div>}
                </Link>
              );
            })}
          </div>
        </section>
        <section className="card p-5">
          <h2 className="font-display text-lg font-extrabold flex items-center gap-2"><Award size={18} className="text-gold" />Achievements <span className="text-sm text-smoke font-semibold">{ACH.filter((a) => a.ok).length}/{ACH.length}</span></h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {ACH.map((a) => (
              <div key={a.t} className={`rounded-2xl border p-3 ${a.ok ? 'border-gold/40 bg-gold/5' : 'border-white/5 bg-ink-700/40 opacity-60'}`}>
                <div className="flex items-center gap-2">
                  <div className={`grid h-8 w-8 place-items-center rounded-full ${a.ok ? 'bg-gold text-ink' : 'bg-ink-500 text-smoke'}`}>{a.ok ? <Award size={15} /> : <Lock size={13} />}</div>
                  <div className="font-display text-sm font-bold leading-tight">{a.t}</div>
                </div>
                <div className="mt-1.5 text-[11px] text-smoke">{a.d}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
