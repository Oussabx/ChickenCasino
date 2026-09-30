import { CSSProperties } from 'react';
import { Chip, Coin, Egg, Heart, Spade } from './Icons';

/** A two-sided CSS 3D playing card. */
export function Card3D({ rank = 'A', suit = 'spade', className = '', style }: { rank?: string; suit?: 'spade' | 'heart'; className?: string; style?: CSSProperties }) {
  const red = suit === 'heart';
  const S = red ? Heart : Spade;
  return (
    <div className={`relative [transform-style:preserve-3d] ${className}`} style={style}>
      <div className="absolute inset-0 rounded-[10%] bg-cream shadow-[0_18px_40px_-10px_rgba(0,0,0,.8)] [backface-visibility:hidden] border border-black/10">
        <div className={`absolute left-[8%] top-[5%] font-display font-black leading-none ${red ? 'text-blood' : 'text-ink'}`} style={{ fontSize: '1.1em' }}>
          {rank}<S className="mt-0.5 h-[0.8em] w-[0.8em]" />
        </div>
        <S className={`absolute left-1/2 top-1/2 h-[45%] w-[45%] -translate-x-1/2 -translate-y-1/2 ${red ? 'text-blood' : 'text-ink'}`} />
        <div className={`absolute bottom-[5%] right-[8%] rotate-180 font-display font-black leading-none ${red ? 'text-blood' : 'text-ink'}`} style={{ fontSize: '1.1em' }}>
          {rank}<S className="mt-0.5 h-[0.8em] w-[0.8em]" />
        </div>
      </div>
      <div className="absolute inset-0 rounded-[10%] [backface-visibility:hidden] [transform:rotateY(180deg)] border-[3px] border-cream"
        style={{ background: 'repeating-linear-gradient(45deg,#E63946 0 6px,#8E1B24 6px 12px)' }}>
        <img src="./img/head.webp" alt="" className="absolute left-1/2 top-1/2 h-1/2 w-auto -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-cream" />
      </div>
    </div>
  );
}

/** A spinning coin with thickness (stacked discs). */
export function Coin3D({ size = 48, dur = 3.5, style }: { size?: number; dur?: number; style?: CSSProperties }) {
  return (
    <div style={{ width: size, height: size, ...style }} className="[perspective:600px]">
      <div className="spin-y relative h-full w-full" style={{ ['--dur' as string]: `${dur}s` }}>
        {[-3, -1.5, 0, 1.5, 3].map((z) => (
          <div key={z} className="absolute inset-0" style={{ transform: `translateZ(${z}px)` }}>
            <Coin className="h-full w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Chip3D({ size = 60, color = '#E63946', tilt = 60, style }: { size?: number; color?: string; tilt?: number; style?: CSSProperties }) {
  return (
    <div style={{ width: size, height: size, transform: `rotateX(${tilt}deg)`, transformStyle: 'preserve-3d', ...style }}>
      {[0, 2, 4, 6].map((z) => (
        <div key={z} className="absolute inset-0" style={{ transform: `translateZ(${-z}px)`, filter: z ? 'brightness(.55)' : undefined }}>
          <Chip color={color} className="h-full w-full" />
        </div>
      ))}
    </div>
  );
}

export function EggGlow({ size = 56, style }: { size?: number; style?: CSSProperties }) {
  return (
    <div className="relative" style={{ width: size, height: size * 1.1, ...style }}>
      <div className="absolute inset-[-40%] rounded-full bg-gold/40 blur-2xl" style={{ animation: 'glow-pulse 3s ease-in-out infinite' }} />
      <Egg className="relative h-full w-full drop-shadow-[0_10px_20px_rgba(0,0,0,.6)]" />
    </div>
  );
}
