import { useEffect, useState } from 'react';
import Modal from './Modal';
import { useStore, useUI } from '../store';
import { SHOP } from '../lib/data';
import { pick } from '../lib/rng';
import { Coin, Egg } from './Icons';

const NAMES = ['Cluckster', 'EggCellent', 'WingKing', 'FeatherBet', 'RoostRunner', 'NuggetNinja', 'PeckMaster'];
const FREE_AVATARS = SHOP.filter((i) => i.kind === 'avatar').slice(0, 4);

export default function AuthModal() {
  const { auth, openAuth } = useUI();
  const signup = useStore((s) => s.signup);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('av-classic');
  const [age, setAge] = useState(false);

  useEffect(() => {
    if (auth) setName(pick(NAMES) + Math.floor(Math.random() * 90 + 10));
  }, [auth]);

  const isSignup = auth === 'signup';
  const valid = name.trim().length >= 3 && (!isSignup || age);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    signup(name.trim(), isSignup ? avatar : undefined);
    openAuth(null);
  };

  return (
    <Modal open={!!auth} onClose={() => openAuth(null)} title={isSignup ? 'Join the coop' : 'Welcome back'}>
      <div className="relative -mx-5 -mt-2 mb-5 overflow-hidden">
        <img src="./img/hero.webp" alt="" className="h-36 w-full object-cover object-[50%_30%] opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-800 via-ink-800/40 to-transparent" />
        {isSignup && (
          <div className="absolute bottom-3 left-5 right-5">
            <div className="label text-gold">Welcome bonus</div>
            <div className="flex items-center gap-3 font-display text-xl font-black">
              <span className="flex items-center gap-1.5"><Coin className="h-5 w-5" />10,000</span>
              <span className="text-smoke text-sm">+</span>
              <span className="flex items-center gap-1.5"><Egg className="h-5 w-5" />10</span>
            </div>
          </div>
        )}
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="uname">Username</label>
          <input id="uname" className="input mt-1.5" value={name} onChange={(e) => setName(e.target.value)} maxLength={18} autoFocus />
        </div>
        {isSignup && (
          <>
            <div>
              <div className="label mb-2">Pick your chicken</div>
              <div className="grid grid-cols-4 gap-2">
                {FREE_AVATARS.map((a) => (
                  <button type="button" key={a.id} onClick={() => setAvatar(a.id)}
                    className={`rounded-2xl p-1 border transition ${avatar === a.id ? 'border-gold bg-gold/10' : 'border-white/10 hover:border-white/25'}`}>
                    <img src={`./img/${a.img}`} alt={a.name} className="aspect-square w-full rounded-xl object-cover" />
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-smoke">Starter pick is free — unlock more in the Shop.</p>
            </div>
            <label className="flex items-start gap-2.5 text-xs text-smoke cursor-pointer">
              <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} className="mt-0.5 accent-[#F4C430]" />
              I'm 18+ and understand Chicken Casino uses virtual coins only — no real money can be deposited or withdrawn.
            </label>
          </>
        )}
        <button className="btn-gold w-full py-3" disabled={!valid}>{isSignup ? 'Create account & claim bonus' : 'Log in'}</button>
        <p className="text-center text-xs text-smoke">
          {isSignup ? 'Already have an account? ' : 'New here? '}
          <button type="button" className="font-semibold text-gold hover:underline" onClick={() => openAuth(isSignup ? 'login' : 'signup')}>
            {isSignup ? 'Log in' : 'Sign up'}
          </button>
        </p>
      </form>
    </Modal>
  );
}
