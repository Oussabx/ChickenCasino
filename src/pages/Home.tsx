import { Link } from 'react-router-dom';
import { ArrowRight, Zap, ShieldCheck, Smartphone, Trophy, ChevronRight } from 'lucide-react';
import { GAMES, gameById } from '../lib/data';
import GameCard from '../components/GameCard';
import HeroScene from '../components/HeroScene';
import { Reveal, Tilt } from '../lib/motion';
import { Coin3D } from '../components/Floaters';
import { useStore, useUI } from '../store';
import { useCountdown, useLiveFeed } from '../lib/useLiveFeed';
import { fmt, pad2 } from '../lib/format';
import { Coin, Diamond, Heart, Spade } from '../components/Icons';

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
      <HeroScene>
        <div className="px-6 py-10 sm:px-10 sm:py-16 lg:py-20 max-w-xl min-h-[520px] sm:min-h-0">
          <span className="chip bg-blood/15 text-blood border border-blood/30 mb-5"><span className="h-1.5 w-1.5 rounded-full bg-blood animate-pulse" />{fmt(1284 + (Date.now() / 60000) % 400, 0)} players online</span>
          <h1 className="h-display text-5xl sm:text-6xl lg:text-7xl">
            <span className="word-in inline-block" style={{ animationDelay: '60ms' }}>Play</span>{' '}
            <span className="word-in inline-block" style={{ animationDelay: '160ms' }}>big.</span><br />
            <span className="word-in inline-block text-gold-grad" style={{ animationDelay: '300ms' }}>Win</span>{' '}
            <span className="word-in inline-block text-gold-grad" style={{ animationDelay: '420ms' }}>bigger.</span>
          </h1>
          <p className="mt-5 text-lg text-cream/80 max-w-sm word-in" style={{ animationDelay: '600ms' }}>Your favorite casino games, with a little more chicken.</p>
          <div className="mt-8 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap word-in" style={{ animationDelay: '720ms' }}>
            {user ? (
              <Link to="/games/chicken-cross" className="btn-gold px-5 py-3.5 text-base whitespace-nowrap">Play Chicken Cross <ArrowRight size={18} /></Link>
            ) : (
              <button onClick={() => openAuth('signup')} className="btn-gold px-6 py-3.5 text-base">Join Now <ArrowRight size={18} /></button>
            )}
            <Link to="/games" className="btn px-5 py-3.5 text-base whitespace-nowrap text-cream bg-black/55 backdrop-blur-md border border-white/25 shadow-[0_8px_24px_-8px_rgba(0,0,0,.8)] hover:bg-black/70 hover:border-gold/60 hover:text-gold">Browse games</Link>
          </div>
          <div className="mt-10 flex gap-6 sm:gap-10">
            {[{ i: Zap, t: 'Instant Payouts' }, { i: ShieldCheck, t: 'Crypto-grade RNG' }, { i: Smartphone, t: 'Play Anywhere' }].map((f, k) => (
              <div key={f.t} className="text-center sm:text-left word-in" style={{ animationDelay: `${860 + k * 110}ms` }}>
                <f.i className="text-gold mx-auto sm:mx-0" size={24} />
                <div className="mt-2 text-xs sm:text-sm font-medium text-cream/80">{f.t}</div>
              </div>
            ))}
          </div>
        </div>
      </HeroScene>

      {/* ticker */}
      <Reveal className="mt-4"><div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-800/60">
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
      </div></Reveal>

      {/* FEATURED + TOURNAMENT */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        <Reveal as="section" className="card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl sm:text-2xl font-extrabold">Featured Games</h2>
            <Link to="/games" className="shrink-0 whitespace-nowrap py-2 text-xs font-semibold text-gold hover:underline flex items-center gap-1">View all <ChevronRight size={14} /></Link>
          </div>
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {GAMES.filter((g) => g.category === 'original').map((g, i) => <Reveal key={g.id} variant="zoom" delay={i * 70}><GameCard g={g} /></Reveal>)}
          </div>

          {/* welcome bonus */}
          <Tilt max={6} scale={1.01} className="mt-6 overflow-hidden rounded-2xl border border-blood/30 bg-gradient-to-r from-ink-900 via-blood-900 to-blood-700">
            <img src="./img/bonus-chicken.webp" alt="" className="hidden sm:block absolute left-0 bottom-0 h-full w-auto object-cover opacity-90 [mask-image:linear-gradient(to_right,black_60%,transparent)] [transform:translateZ(30px)]" />
            <Coin3D size={34} dur={3} style={{ position: 'absolute', right: '8%', top: '18%' }} />
            <Coin3D size={22} dur={4.2} style={{ position: 'absolute', right: '18%', bottom: '14%', opacity: 0.8 }} />
            <div className="relative sm:ml-auto sm:w-[55%] px-5 sm:pl-0 py-6">
              <div className="font-display text-sm font-extrabold tracking-wider">WELCOME BONUS</div>
              <div className="h-display text-3xl sm:text-4xl text-gold-grad mt-1">10,000 coins</div>
              <div className="text-sm text-cream/80">+10 golden eggs on sign-up</div>
              {user ? (
                <Link to="/promotions" className="btn-gold mt-4 px-4 py-2 text-sm">See promotions <ArrowRight size={14} /></Link>
              ) : (
                <button onClick={() => openAuth('signup')} className="btn-gold mt-4 px-4 py-2 text-sm">Claim Now <ArrowRight size={14} /></button>
              )}
            </div>
          </Tilt>
        </Reveal>

        <div className="flex flex-col gap-6">
          <Reveal as="section" variant="right" delay={120} className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold">Popular Tournaments</h2>
              <Link to="/tournaments" className="shrink-0 whitespace-nowrap py-2 text-xs font-semibold text-gold hover:underline">View all</Link>
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
          </Reveal>

          <Reveal as="section" variant="right" delay={240} className="card p-5 flex-1">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold">Latest Winners</h2>
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />LIVE</span>
            </div>
            <ul className="mt-3 divide-y divide-white/[0.05]">
              {feed.slice(0, 6).map((f) => (
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
          </Reveal>
        </div>
      </div>

      <Reveal as="section" className="mt-8 card p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold">Casino Tables</h2>
            <p className="text-xs text-smoke">Blackjack, roulette, craps, baccarat and poker — dealt in 3D.</p>
          </div>
          <Link to="/games" className="shrink-0 whitespace-nowrap py-2 text-xs font-semibold text-gold hover:underline flex items-center gap-1">View all <ChevronRight size={14} /></Link>
        </div>
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {GAMES.filter((g) => g.category === 'table').map((g, i) => <Reveal key={g.id} variant="zoom" delay={i * 60}><GameCard g={g} /></Reveal>)}
        </div>
      </Reveal>

      <Reveal as="section" className="mt-8 card p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold">Slots &amp; Keno</h2>
            <p className="text-xs text-smoke">Spin the Golden Coop or pick your nests and let the hen lay.</p>
          </div>
          <Link to="/games" className="shrink-0 whitespace-nowrap py-2 text-xs font-semibold text-gold hover:underline flex items-center gap-1">View all <ChevronRight size={14} /></Link>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4">
          {GAMES.filter((g) => g.category === 'slots').map((g, i) => <Reveal key={g.id} variant="zoom" delay={i * 60}><GameCard g={g} size="lg" /></Reveal>)}
        </div>
      </Reveal>

      {favorites.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-extrabold mb-4">Your favourites</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {favorites.map((id) => <GameCard key={id} g={gameById(id)!} />)}
          </div>
        </section>
      )}


      {/* why */}
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          { icon: <Spade className="h-6 w-6" />, t: 'Originals you won’t find elsewhere', d: 'Chicken Cross, Egg Hunt and Rocket Rooster are built from scratch for the coop.' },
          { icon: <Heart className="h-6 w-6 text-blood" />, t: 'Rewards that actually reward', d: 'Daily streaks, missions, rakeback and a shop full of flex — all earned by playing.' },
          { icon: <Diamond className="h-6 w-6 text-blood" />, t: 'Play responsibly', d: 'Loss limits, session reminders and take-a-break controls live in Settings.' },
        ].map((c, i) => (
          <Reveal key={c.t} delay={i * 110}><Tilt className="card p-5 h-full">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/5 [transform:translateZ(24px)]">{c.icon}</div>
            <div className="mt-4 font-display font-bold">{c.t}</div>
            <p className="mt-1 text-sm text-smoke">{c.d}</p>
          </Tilt></Reveal>
        ))}
      </section>
    </div>
  );
}
