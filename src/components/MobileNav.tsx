import { NavLink } from 'react-router-dom';
import { Home, Gamepad2, Gift, ShoppingBag, User } from 'lucide-react';

const ITEMS = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/games', icon: Gamepad2, label: 'Games' },
  { to: '/promotions', icon: Gift, label: 'Rewards' },
  { to: '/shop', icon: ShoppingBag, label: 'Shop' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export default function MobileNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 glass-bar border-t border-white/[0.07] pb-safe">
      <div className="grid grid-cols-5">
        {ITEMS.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.to === '/'}
            className={({ isActive }) => `relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition ${isActive ? 'text-gold' : 'text-smoke'}`}>
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-b bg-gold shadow-gold" />}
                <i.icon size={21} strokeWidth={isActive ? 2.4 : 2} className={isActive ? "animate-pop" : ""} />
                {i.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
