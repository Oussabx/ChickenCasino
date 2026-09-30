import { ReactNode, useRef } from 'react';
import { layer, useMotionOK, useParallax } from '../lib/motion';

export default function PageHeader({ kicker, title, sub, img, right }: { kicker: string; title: ReactNode; sub?: string; img?: string; right?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const ok = useMotionOK();
  useParallax(ref, ok);
  return (
    <div ref={ref} className="relative overflow-hidden rounded-3xl border border-white/5 bg-ink-900 p-6 sm:p-10 grain">
      {img && (
        <div className="absolute inset-y-[-15%] right-[-6%] w-[76%]" style={ok ? layer(22, -60) : undefined}>
          <img src={`./img/${img}`} alt="" className="h-full w-full object-cover opacity-50 [mask-image:linear-gradient(to_right,transparent,black_50%)]" />
        </div>
      )}
      <div className="absolute inset-[-10%] bg-[radial-gradient(60%_80%_at_90%_10%,rgba(230,57,70,.2),transparent)]" style={ok ? layer(-12) : undefined} />
      <div className="relative flex flex-col md:flex-row md:items-end gap-4 justify-between" style={ok ? layer(-6, 12) : undefined}>
        <div>
          <div className="label text-gold word-in">{kicker}</div>
          <h1 className="h-display text-4xl sm:text-5xl mt-1 word-in" style={{ animationDelay: '90ms' }}>{title}</h1>
          {sub && <p className="mt-2 text-cream/70 max-w-lg word-in" style={{ animationDelay: '200ms' }}>{sub}</p>}
        </div>
        {right && <div className="word-in" style={{ animationDelay: '280ms' }}>{right}</div>}
      </div>
    </div>
  );
}
