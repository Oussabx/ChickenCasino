import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Menu, History, Settings, User, Wallet, LogOut, ShoppingBag, Crown, Trophy, Gift, Gamepad2, X, Home } from 'lucide-react';
import Logo from './Logo';
import Balance from './Balance';
import Avatar, { PlayerName } from './Avatar';
import { toast, useLevel, useStore, useUI } from '../store';
import { logout as doLogout } from '../lib/auth';
import { xpForLevel } from '../lib/data';

const NAV = [
  { to: '/games', label: 'Games' },
  { to: '/promotions', label: 'Promotions' },
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/vip', label: 'VIP' },
  { to: '/shop', label: 'Shop' },
];

export default function Header() {
  const user = useStore((s) => s.user);
  const logout = () => { doLogout(); toast({ title: 'Logged out. See you soon 🐔', tone: 'neutral' }); };
  const openAuth = useUI((s) => s.openAuth);
  const { level, tier, xp } = useLevel();
  const [menu, setMenu] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMenu(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pct = Math.min(100, ((xp - xpForLevel(level)) / (xpForLevel(level + 1) - xpForLevel(level))) * 100);

  return (
    <header className="glass-bar sticky top-0 z-50 border-b border-white/[0.06]">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 sm:gap-4 px-3 sm:px-4 lg:px-6">
        <Logo />
        <nav className="ml-6 hidden lg:flex items-center gap-1">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to}
              className={({ isActive }) => `relative rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'text-gold' : 'text-cream/80 hover:text-cream'}`}>
              {({ isActive }) => (<>{n.label}{isActive && <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded bg-gold" />}</>)}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Balance />
              <div className="relative hidden sm:block" ref={ref}>
                <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-white/5" aria-label="Account menu">
                  <Avatar size={34} />
                  <div className="hidden xl:block text-left leading-tight">
                    <div className="text-sm font-semibold max-w-[110px] truncate"><PlayerName name={user.name} /></div>
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: tier.color }}>{tier.name} · Lv {level}</div>
                  </div>
                </button>
                {menu && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-white/10 bg-ink-800 p-2 shadow-2xl animate-slideUp">
                    <div className="px-3 py-2">
                      <div className="flex justify-between text-xs"><span className="font-semibold">Level {level}</span><span className="text-smoke">{Math.round(pct)}%</span></div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-ink-500 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-gold-600 to-gold" style={{ width: `${pct}%` }} /></div>
                    </div>
                    {[
                      { to: '/profile', icon: User, label: 'Profile' },
                      { to: '/wallet', icon: Wallet, label: 'Wallet' },
                      { to: '/history', icon: History, label: 'Bet history' },
                      { to: '/vip', icon: Crown, label: 'VIP club' },
                      { to: '/settings', icon: Settings, label: 'Settings' },
                    ].map((i) => (
                      <Link key={i.to} to={i.to} onClick={() => setMenu(false)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-white/5">
                        <i.icon size={16} className="text-smoke" />{i.label}
                      </Link>
                    ))}
                    <button onClick={() => { logout(); setMenu(false); nav('/'); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-blood hover:bg-blood/10">
                      <LogOut size={16} />Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <button className="btn-ghost whitespace-nowrap px-3 py-2 text-xs sm:text-sm hidden min-[380px]:inline-flex" onClick={() => openAuth('login')}>Log In</button>
              <button className="btn-gold whitespace-nowrap px-3 py-2 text-xs sm:text-sm" onClick={() => openAuth('signup')}>Sign Up</button>
            </>
          )}
          <button className="lg:hidden rounded-xl p-2 hover:bg-white/5" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu size={22} /></button>
        </div>
      </div>

      {drawer && createPortal(
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDrawer(false)} />
          <aside className="absolute right-0 top-0 h-full w-[85%] max-w-sm bg-ink-800 border-l border-white/10 p-5 overflow-y-auto animate-[slideUp_.25s_ease-out]">
            <div className="flex items-center justify-between">
              <Logo size="sm" />
              <button onClick={() => setDrawer(false)} className="rounded-xl p-2 hover:bg-white/5" aria-label="Close menu"><X size={20} /></button>
            </div>
            {user && (
              <Link to="/profile" onClick={() => setDrawer(false)} className="mt-6 flex items-center gap-3 rounded-2xl bg-ink-700 p-3">
                <Avatar size={48} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate"><PlayerName name={user.name} /></div>
                  <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: tier.color }}>{tier.name} · Lv {level}</div>
                  <div className="mt-1.5 h-1 rounded-full bg-ink-500 overflow-hidden"><div className="h-full bg-gold" style={{ width: `${pct}%` }} /></div>
                </div>
              </Link>
            )}
            <nav className="mt-5 space-y-1">
              {[
                { to: '/', icon: Home, label: 'Home' },
                { to: '/games', icon: Gamepad2, label: 'Games' },
                { to: '/promotions', icon: Gift, label: 'Promotions' },
                { to: '/tournaments', icon: Trophy, label: 'Tournaments' },
                { to: '/vip', icon: Crown, label: 'VIP Club' },
                { to: '/shop', icon: ShoppingBag, label: 'Shop' },
                { to: '/wallet', icon: Wallet, label: 'Wallet' },
                { to: '/history', icon: History, label: 'History' },
                { to: '/settings', icon: Settings, label: 'Settings' },
              ].map((i) => (
                <NavLink key={i.to} to={i.to} end onClick={() => setDrawer(false)}
                  className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${isActive ? 'bg-gold/10 text-gold' : 'hover:bg-white/5'}`}>
                  <i.icon size={18} />{i.label}
                </NavLink>
              ))}
            </nav>
            {user ? (
              <button onClick={() => { logout(); setDrawer(false); nav('/'); }} className="mt-4 btn-ghost w-full py-3 text-blood border-blood/30"><LogOut size={16} />Log out</button>
            ) : (
              <div className="mt-6 grid grid-cols-2 gap-2">
                <button className="btn-ghost py-3" onClick={() => { setDrawer(false); openAuth('login'); }}>Log In</button>
                <button className="btn-gold py-3" onClick={() => { setDrawer(false); openAuth('signup'); }}>Sign Up</button>
              </div>
            )}
          </aside>
        </div>,
        document.body,
      )}
    </header>
  );
}
