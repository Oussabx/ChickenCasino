import { Link } from 'react-router-dom';
import { ArrowRight, Zap, ShieldCheck, Smartphone, Trophy, ChevronRight } from 'lucide-react';
import { GAMES, gameById } from '../lib/data';
import GameCard from '../components/GameCard';
import { useStore, useUI } from '../store';
import { useCountdown, useLiveFeed } from '../lib/useLiveFeed';
import { fmt, pad2 } from '../lib/format';
import { Coin, Club, Diamond, Heart, Spade } from '../components/Icons';

const WEEK_END = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7 || 7)); d.setUTCHours(0, 0, 0, 0); return d.getTime(); })();

export default function Home() {
  const user = useStore((s) => s.user);
  const openAuth = useUI((s) => s.openAuth);
  const favorites = useStore((s) => s.favorites);
  const cd = useCountdown(WEEK_END);
  const feed = useLiveFeed(6);

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6">
      {/* HERO */}
      <section className="relative mt-4 lg:mt-6 overflow-hidden rounded-3xl border border-white/[0.06] bg-ink-900 grain">
        <div className="absolute inset-0 bg-[radial-gradient(70%_90%_at_75%_40%,rgba(230,57,70,.28),transparent_60%)]" />
        <img src="./img/hero.webp" alt="Cool rooster in sunglasses with poker chips"
          className="absolute right-0 bottom-0 h-[70%] sm:h-full w-auto max-w-none object-cover [mask-image:linear-gradient(to_right,transparent,black_25%)] sm:[mask-image:linear-gradient(to_right,transparent,black_30%)] opacity-95" />
        <div className="absolute inset-0 sm:hidden bg-gradient-to-b from-ink-900/40 via-ink-900/60 to-ink-900/90" />
        <div className="relative z-10 px-6 py-10 sm:px-10 sm:py-16 lg:py-20 max-w-xl min-h-[520px] sm:min-h-0">
          <span className="chip bg-blood/15 text-blood border border-blood/30 mb-5"><span className="h-1.5 w-1.5 rounded-full bg-blood animate-pulse" />{fmt(1284 + (Date.now() / 60000) % 400, 0)} players online</span>
          <h1 className="h-display text-5xl sm:text-6xl lg:text-7xl">
            Play big.<br /><span className="text-gold-grad">Win bigger.</span>
          </h1>
          <p className="mt-5 text-lg text-cream/80 max-w-sm">Your favorite casino games, with a little more chicken.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {user ? (
              <Link to="/games/chicken-cross" className="btn-gold px-6 py-3.5 text-base">Play Chicken Cross <ArrowRight size={18} /></Link>
            ) : (
              <button onClick={() => openAuth('signup')} className="btn-gold px-6 py-3.5 text-base">Join Now <ArrowRight size={18} /></button>
            )}
            <Link to="/games" className="btn-ghost px-6 py-3.5 text-base">Browse games</Link>
          </div>
          <div className="mt-10 flex gap-6 sm:gap-10">
            {[{ i: Zap, t: 'Instant Payouts' }, { i: ShieldCheck, t: 'Crypto-grade RNG' }, { i: Smartphone, t: 'Play Anywhere' }].map((f) => (
              <div key={f.t} className="text-center sm:text-left">
                <f.i className="text-gold mx-auto sm:mx-0" size={24} />
                <div className="mt-2 text-xs sm:text-sm font-medium text-cream/80">{f.t}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ticker */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-800/60">
        <div className="flex w-max animate-marquee gap-8 py-2.5 px-4 text-sm">
          {[...feed, ...feed].map((f, i) => (
            <span key={i} className="flex items-center gap-2 whitespace-nowrap">
              <span className="font-semibold">{f.name}</span>
              <span className="text-smoke">won</span>
              <span className="flex items-center gap-1 font-bold text-emerald-400"><Coin className="h-3.5 w-3.5" />{fmt(f.bet * f.mult)}</span>
              <span className="text-smoke">on {gameById(f.game)?.name}</span>
              <Spade className="h-3 w-3 text-white/20" />
            </span>
          ))}
        </div>
      </div>

      {/* FEATURED + TOURNAMENT */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl sm:text-2xl font-extrabold">Featured Games</h2>
            <Link to="/games" className="text-xs font-semibold text-gold hover:underline flex items-center gap-1">View all <ChevronRight size={14} /></Link>
          </div>
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {GAMES.map((g) => <GameCard key={g.id} g={g} />)}
          </div>

          {/* welcome bonus */}
          <div className="relative mt-6 overflow-hidden rounded-2xl border border-blood/30 bg-gradient-to-r from-ink-900 via-blood-900 to-blood-700">
            <img src="./img/bonus-chicken.webp" alt="" className="absolute left-0 bottom-0 h-full w-auto object-cover opacity-90 [mask-image:linear-gradient(to_right,black_60%,transparent)]" />
            <div className="relative ml-auto w-[62%] sm:w-[55%] py-6 pr-5">
              <div className="font-display text-sm font-extrabold tracking-wider">WELCOME BONUS</div>
              <div className="h-display text-3xl sm:text-4xl text-gold-grad mt-1">10,000 coins</div>
              <div className="text-sm text-cream/80">+10 golden eggs on sign-up</div>
              {user ? (
                <Link to="/promotions" className="btn-gold mt-4 px-4 py-2 text-sm">See promotions <ArrowRight size={14} /></Link>
              ) : (
                <button onClick={() => openAuth('signup')} className="btn-gold mt-4 px-4 py-2 text-sm">Claim Now <ArrowRight size={14} /></button>
              )}
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold">Popular Tournaments</h2>
              <Link to="/tournaments" className="text-xs font-semibold text-gold hover:underline">View all</Link>
            </div>
            <div className="mt-4 rounded-2xl bg-ink-700/60 border border-white/5 p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-gold/15"><Trophy className="text-gold" /></div>
                <div>
                  <div className="font-display font-bold">Chicken Showdown</div>
                  <div className="text-xs text-gold font-semibold">250,000 coin prize pool</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                {[['Days', cd.days], ['Hours', cd.hours], ['Mins', cd.mins], ['Secs', cd.secs]].map(([l, v]) => (
                  <div key={l as string} className="rounded-xl bg-ink-900 py-2">
                    <div className="font-display text-xl font-black tabular">{pad2(v as number)}</div>
                    <div className="text-[10px] text-smoke">{l}</div>
                  </div>
                ))}
              </div>
              <Link to="/tournaments" className="btn-gold mt-4 w-full py-2.5 text-sm">Join Now <ArrowRight size={14} /></Link>
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold">Latest Winners</h2>
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />LIVE</span>
            </div>
            <ul className="mt-3 divide-y divide-white/[0.05]">
              {feed.slice(0, 5).map((f) => (
                <li key={f.id} className="flex items-center gap-3 py-2.5 animate-slideUp">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-gold/10 text-gold text-sm">♛</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{f.name}</div>
                    <div className="text-[11px] text-smoke">{gameById(f.game)?.name} · {f.mult}×</div>
                  </div>
                  <div className="font-display font-extrabold text-gold tabular">{fmt(f.bet * f.mult, 0)}</div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {favorites.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-extrabold mb-4">Your favourites</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {favorites.map((id) => <GameCard key={id} g={gameById(id)!} />)}
          </div>
        </section>
      )}

      {/* mood strip */}
      <section className="mt-10 grid grid-cols-2 md:grid-cols-[1fr_1fr_2fr_2fr] gap-3">
        {['strip-chips', 'strip-cards', 'strip-neon', 'strip-closeup'].map((s, i) => (
          <div key={s} className={`relative overflow-hidden rounded-2xl border border-white/5 ${i > 1 ? 'col-span-1' : ''} aspect-[4/3] md:aspect-auto md:h-44`}>
            <img src={`./img/${s}.webp`} alt="" className={`h-full w-full object-cover ${s === 'strip-neon' ? 'animate-flicker' : ''}`} loading="lazy" />
          </div>
        ))}
      </section>

      {/* why */}
      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {[
          { icon: <Spade className="h-6 w-6" />, t: 'Originals you won’t find elsewhere', d: 'Chicken Cross, Egg Hunt and Rocket Rooster are built from scratch for the coop.' },
          { icon: <Heart className="h-6 w-6 text-blood" />, t: 'Rewards that actually reward', d: 'Daily streaks, missions, rakeback and a shop full of flex — all earned by playing.' },
          { icon: <Diamond className="h-6 w-6 text-blood" />, t: 'Play responsibly', d: 'Loss limits, session reminders and take-a-break controls live in Settings.' },
        ].map((c) => (
          <div key={c.t} className="card p-5">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/5">{c.icon}</div>
            <div className="mt-4 font-display font-bold">{c.t}</div>
            <p className="mt-1 text-sm text-smoke">{c.d}</p>
          </div>
        ))}
      </section>
      <div className="mt-6 flex justify-center text-white/10 gap-4"><Club className="h-5 w-5" /><Spade className="h-5 w-5" /><Club className="h-5 w-5" /></div>
    </div>
  );
}
