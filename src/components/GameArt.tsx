import { useId } from 'react';
import { GameId } from '../lib/data';
import { ChickenSprite, Egg } from './Icons';

/** Illustrated thumbnails for each game — pure SVG/CSS so they stay crisp at any size. */
export default function GameArt({ id, className = '' }: { id: GameId; className?: string }) {
  const uid = 'a' + useId().replace(/:/g, '');
  return <div className={`overflow-hidden ${/\babsolute\b/.test(className) ? '' : 'relative'} ${className}`}>{id === 'crash' ? crashArt(uid) : ART[id]}</div>;
}

const bg = (a: string, b: string) => ({ background: `radial-gradient(120% 90% at 50% 0%, ${a}, ${b})` });

const ART: Record<GameId, JSX.Element | null> = {
  plinko: (
    <div className="absolute inset-0" style={bg('#3a2a05', '#0b0b0b')}>
      <svg viewBox="0 0 200 150" className="absolute inset-0 h-full w-full">
        {Array.from({ length: 7 }).flatMap((_, r) =>
          Array.from({ length: r + 3 }).map((_, i) => (
            <circle key={`${r}-${i}`} cx={100 + (i - (r + 2) / 2) * 18} cy={22 + r * 14} r="2.6" fill="#F8F6EF" opacity={0.55 + r * 0.05} />
          )),
        )}
        {Array.from({ length: 9 }).map((_, i) => (
          <g key={i}>
            <rect x={100 + (i - 4) * 18 - 8} y="122" width="16" height="12" rx="3" fill={i === 0 || i === 8 ? '#E63946' : i === 4 ? '#F4C430' : '#c96a19'} />
          </g>
        ))}
        <circle cx="91" cy="40" r="6" fill="#F4C430" style={{ filter: 'drop-shadow(0 0 6px #F4C430)' }} />
        <path d="M100 8 C 95 20, 92 30, 91 40" stroke="#F4C430" strokeDasharray="2 3" fill="none" opacity=".6" />
      </svg>
    </div>
  ),
  crash: null,
  'chicken-cross': (
    <div className="absolute inset-0 bg-[#1a1a1a]">
      <div className="absolute inset-y-0 left-0 w-[16%] bg-[#2b2b2b] border-r-4 border-dashed border-white/10" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="absolute inset-y-0 border-r-2 border-dashed border-gold/40" style={{ left: `${16 + (i + 1) * 21}%` }} />
      ))}
      {[{ l: 37, t: 8, c: '#E63946' }, { l: 58, t: 58, c: '#F4C430' }, { l: 79, t: 22, c: '#F8F6EF' }].map((c, i) => (
        <div key={i} className="absolute w-[12%] h-[28%] rounded-lg" style={{ left: `${c.l - 16}%`, top: `${c.t}%`, background: c.c, boxShadow: '0 6px 14px rgba(0,0,0,.6)' }}>
          <div className="absolute inset-x-1 top-[18%] h-[22%] rounded bg-ink/70" />
        </div>
      ))}
      <div className="absolute left-[22%] bottom-[30%] w-[22%]"><ChickenSprite className="w-full" /></div>
      <div className="absolute left-[44%] bottom-[16%] rounded-full bg-gold px-2 py-0.5 font-display text-[10px] font-black text-ink">1.72×</div>
    </div>
  ),
  'egg-hunt': (
    <div className="absolute inset-0" style={bg('#10321f', '#0b0b0b')}>
      <div className="absolute inset-[12%] grid grid-cols-4 gap-[5%]">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className={`rounded-lg ${[2, 5, 9].includes(i) ? 'bg-emerald-500/20 border border-emerald-400/40' : i === 7 ? 'bg-blood/40 border border-blood' : 'bg-white/5 border border-white/10'} grid place-items-center`}>
            {[2, 5, 9].includes(i) && <Egg className="w-1/2 h-1/2" />}
            {i === 7 && <span className="text-[min(3vw,18px)]">🦊</span>}
          </div>
        ))}
      </div>
    </div>
  ),
  'cluck-dice': (
    <div className="absolute inset-0" style={bg('#0c2436', '#0b0b0b')}>
      <div className="absolute inset-x-[10%] top-[26%] text-center font-display font-black text-[min(9vw,44px)] text-cream">67.42</div>
      <div className="absolute inset-x-[10%] bottom-[24%] h-2.5 rounded-full overflow-hidden flex">
        <div className="bg-blood w-[48%]" /><div className="bg-emerald-400 flex-1" />
      </div>
      <div className="absolute bottom-[26%] left-[65%] -translate-x-1/2 -translate-y-3"><Egg className="h-7 w-7 drop-shadow" /></div>
    </div>
  ),
  'golden-wheel': (
    <div className="absolute inset-0" style={bg('#33102f', '#0b0b0b')}>
      <svg viewBox="0 0 200 150" className="absolute inset-0 h-full w-full">
        <g transform="translate(100 82)">
          {Array.from({ length: 16 }).map((_, i) => {
            const a0 = (i / 16) * Math.PI * 2, a1 = ((i + 1) / 16) * Math.PI * 2, r = 58;
            const c = ['#E63946', '#F4C430', '#2a2a2a', '#F8F6EF'][i % 4];
            return <path key={i} d={`M0 0 L${Math.cos(a0) * r} ${Math.sin(a0) * r} A${r} ${r} 0 0 1 ${Math.cos(a1) * r} ${Math.sin(a1) * r}Z`} fill={c} stroke="#0b0b0b" strokeWidth="1.5" />;
          })}
          <circle r="60" fill="none" stroke="#F4C430" strokeWidth="3" />
          <circle r="16" fill="#0b0b0b" stroke="#F4C430" strokeWidth="2" />
        </g>
        <path d="M100 14 l-7 -10 h14Z" fill="#F4C430" />
      </svg>
    </div>
  ),
};

const crashArt = (gid: string) => (
    <div className="absolute inset-0" style={bg('#4a0d12', '#0b0b0b')}>
      <svg viewBox="0 0 200 150" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id={gid} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#E63946" stopOpacity="0" /><stop offset="1" stopColor="#E63946" stopOpacity=".6" /></linearGradient>
        </defs>
        {Array.from({ length: 20 }).map((_, i) => <circle key={i} cx={(i * 37) % 200} cy={(i * 53) % 110} r={i % 3 ? 0.8 : 1.4} fill="#fff" opacity=".5" />)}
        <path d="M10 140 Q 110 135 160 45 L160 150 L10 150Z" fill={`url(#${gid})`} />
        <path d="M10 140 Q 110 135 160 45" stroke="#F4C430" strokeWidth="3" fill="none" strokeLinecap="round" />
        <text x="20" y="40" fill="#F8F6EF" fontFamily="Montserrat" fontWeight="900" fontSize="26">4.20×</text>
      </svg>
      <div className="absolute right-[12%] top-[14%] w-[26%] rotate-[-30deg]">
        <ChickenSprite className="w-full drop-shadow-[0_0_12px_rgba(244,196,48,.6)]" />
        <div className="absolute -left-3 top-1/2 h-3 w-6 rounded-full bg-gradient-to-l from-gold to-blood blur-[2px]" />
      </div>
    </div>
  );
