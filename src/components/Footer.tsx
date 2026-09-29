import { Link } from 'react-router-dom';
import Logo from './Logo';
import { Club, Diamond, Heart, Spade } from './Icons';

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-white/[0.06] bg-ink-900/60">
      <div className="mx-auto max-w-7xl px-4 lg:px-6 py-12 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo size="lg" />
          <p className="mt-4 font-script text-3xl text-cream/90 -rotate-3 origin-left">Good Games. <span className="text-gold">Better Wins.</span></p>
          <div className="mt-5 flex gap-3 text-smoke">
            <Spade className="h-5 w-5" /><Heart className="h-5 w-5 text-blood" /><Diamond className="h-5 w-5 text-blood" /><Club className="h-5 w-5" />
          </div>
        </div>
        {[
          { h: 'Play', l: [['All games', '/games'], ['Chicken Cross', '/games/chicken-cross'], ['Rocket Rooster', '/games/crash'], ['Plinko Coop', '/games/plinko']] },
          { h: 'Rewards', l: [['Promotions', '/promotions'], ['Tournaments', '/tournaments'], ['VIP Club', '/vip'], ['Shop', '/shop']] },
          { h: 'Account', l: [['Profile', '/profile'], ['Wallet', '/wallet'], ['Bet history', '/history'], ['Settings & limits', '/settings']] },
        ].map((c) => (
          <div key={c.h}>
            <div className="label mb-3">{c.h}</div>
            <ul className="space-y-2 text-sm">
              {c.l.map(([t, to]) => <li key={to}><Link to={to} className="text-cream/70 hover:text-gold">{t}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/[0.06]">
        <div className="mx-auto max-w-7xl px-4 lg:px-6 py-5 flex flex-col sm:flex-row gap-3 justify-between text-xs text-smoke">
          <p><span className="rounded border border-blood/50 px-1.5 py-0.5 font-bold text-blood mr-2">18+</span>Social casino for entertainment. Virtual coins have no cash value and can't be withdrawn.</p>
          <p>© {new Date().getFullYear()} Chicken Casino. All clucks reserved.</p>
        </div>
      </div>
    </footer>
  );
}
