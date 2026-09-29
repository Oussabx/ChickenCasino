import { useEffect, useMemo } from 'react';
import { useUI } from '../store';
import { fmt, fmtMult } from '../lib/format';
import { Coin } from './Icons';
import { sfx } from '../lib/sound';

export default function Celebration() {
  const { celebrate, setCelebrate } = useUI();
  useEffect(() => {
    if (!celebrate) return;
    sfx.bigWin();
    const t = setTimeout(() => setCelebrate(null), 2800);
    return () => clearTimeout(t);
  }, [celebrate, setCelebrate]);
  const coins = useMemo(
    () => Array.from({ length: 36 }, (_, i) => ({ i, x: Math.random() * 100, d: Math.random() * 0.8, s: 0.6 + Math.random() * 0.9, r: Math.random() * 720 - 360, dur: 1.6 + Math.random() * 1.2 })),
    [celebrate],
  );
  if (!celebrate) return null;
  const tier = celebrate.mult >= 100 ? 'LEGENDARY WIN' : celebrate.mult >= 25 ? 'MEGA WIN' : 'BIG WIN';
  return (
    <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center overflow-hidden" onClick={() => setCelebrate(null)}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(244,196,48,.25),rgba(0,0,0,.7)_60%)] animate-[slideUp_.3s_ease-out]" />
      {coins.map((c) => (
        <div key={c.i} className="absolute -top-10" style={{ left: `${c.x}%`, animation: `coinfall ${c.dur}s ${c.d}s ease-in forwards`, ['--r' as any]: `${c.r}deg` }}>
          <Coin style={{ width: 28 * c.s, height: 28 * c.s }} />
        </div>
      ))}
      <div className="relative text-center animate-pop">
        <div className="font-display text-sm font-extrabold tracking-[.4em] text-blood neon-red">{tier}</div>
        <div className="h-display text-6xl sm:text-8xl text-gold-grad drop-shadow-[0_6px_30px_rgba(244,196,48,.5)]">{fmtMult(celebrate.mult)}</div>
        <div className="mt-2 flex items-center justify-center gap-2 font-display text-2xl font-black"><Coin className="h-7 w-7" />{fmt(celebrate.amount)}</div>
      </div>
      <style>{`@keyframes coinfall{to{transform:translateY(110vh) rotate(var(--r));}}`}</style>
    </div>
  );
}
