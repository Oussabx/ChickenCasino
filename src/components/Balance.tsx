import { Plus } from 'lucide-react';
import { useStore, useUI } from '../store';
import { fmt, fmtCompact } from '../lib/format';
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
        {hide ? '••••••' : <><span className="max-[419px]:hidden">{fmt(shown)}</span><span className="min-[420px]:hidden">{shown >= 1e5 ? fmtCompact(shown) : fmt(shown, 0)}</span></>}
      </span>
      {!compact && (
        <span className="hidden md:flex items-center gap-1 border-l border-white/10 pl-2 text-sm font-display font-bold">
          <Egg className="h-4 w-4" />{hide ? '••' : eggs}
        </span>
      )}
      <button type="button" onClick={() => useUI.getState().openStore({ tab: 'coins' })} className="ml-1 grid h-7 w-7 place-items-center rounded-lg bg-gold text-ink transition hover:bg-gold-300 active:scale-95" aria-label="Buy coins"><Plus size={16} strokeWidth={3} /></button>
    </div>
  );
}
