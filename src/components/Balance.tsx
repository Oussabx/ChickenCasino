import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useStore } from '../store';
import { fmt } from '../lib/format';
import { Coin, Egg } from './Icons';
import { useEffect, useRef, useState } from 'react';
import { useCountUp } from '../lib/motion';

export default function Balance({ compact = false }: { compact?: boolean }) {
  const balance = useStore((s) => s.balance);
  const eggs = useStore((s) => s.eggs);
  const hide = useStore((s) => s.settings.hideBalance);
  const shown = useCountUp(balance, 700);
  const prev = useRef(balance);
  const [flash, setFlash] = useState<'' | 'up' | 'down'>('');
  useEffect(() => {
    if (balance !== prev.current) {
      setFlash(balance > prev.current ? 'up' : 'down');
      prev.current = balance;
      const t = setTimeout(() => setFlash(''), 500);
      return () => clearTimeout(t);
    }
  }, [balance]);
  return (
    <div className="flex items-center rounded-xl border border-white/10 bg-ink-900/80 pl-2.5 pr-1 py-1 gap-2">
      <Coin className="h-5 w-5 shrink-0" />
      <span className={`font-display font-bold tabular text-sm transition-all duration-300 ${flash === 'up' ? 'text-emerald-400 scale-110' : flash === 'down' ? 'text-blood' : ''} inline-block`}>
        {hide ? '••••••' : fmt(shown)}
      </span>
      {!compact && (
        <span className="hidden md:flex items-center gap-1 border-l border-white/10 pl-2 text-sm font-display font-bold">
          <Egg className="h-4 w-4" />{hide ? '••' : eggs}
        </span>
      )}
      <Link to="/wallet" className="ml-1 grid h-7 w-7 place-items-center rounded-lg bg-gold text-ink hover:bg-gold-300" aria-label="Wallet"><Plus size={16} strokeWidth={3} /></Link>
    </div>
  );
}
