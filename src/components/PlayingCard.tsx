import { Card, Suit } from '../lib/cards';

/**
 * A crisp HTML playing card. Suits are SVG paths (not text glyphs), so they
 * never turn into emoji or render as black boxes on phones.
 */
const SUIT_PATH: Record<Suit, string> = {
  H: 'M50 90 C32 74 4 56 4 32 C4 14 18 4 32 4 C41 4 48 10 50 18 C52 10 59 4 68 4 C82 4 96 14 96 32 C96 56 68 74 50 90Z',
  D: 'M50 2 Q66 30 90 50 Q66 70 50 98 Q34 70 10 50 Q34 30 50 2Z',
  S: 'M50 2 C36 22 4 40 4 62 C4 78 18 86 30 86 C39 86 45 81 47 76 C45 88 38 94 30 98 L70 98 C62 94 55 88 53 76 C55 81 61 86 70 86 C82 86 96 78 96 62 C96 40 64 22 50 2Z',
  C: 'M50 4 A20 20 0 1 1 49.9 4Z M22 38 A20 20 0 1 1 21.9 38Z M78 38 A20 20 0 1 1 77.9 38Z M46 50 Q46 86 30 98 L70 98 Q54 86 54 50Z',
};

export function SuitIcon({ s, size, className = '' }: { s: Suit; size: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={`block shrink-0 ${className}`} aria-hidden="true">
      <path d={SUIT_PATH[s]} fill="currentColor" />
    </svg>
  );
}

const RANK = (r: number) => (r <= 10 ? String(r) : 'JQKA'[r - 11]);
const NAME: Record<Suit, string> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };

/** `w` = card width in px (height follows the 5:7 card ratio). */
export default function PlayingCard({ c, w = 56, highlight, dim, faceDown, className = '' }: { c?: Card | null; w?: number; highlight?: boolean; dim?: boolean; faceDown?: boolean; className?: string }) {
  const h = Math.round(w * 1.4);
  if (!c || faceDown) {
    return (
      <span className={`relative inline-block shrink-0 overflow-hidden rounded-[10%] border-2 border-cream bg-[#8E1B24] shadow-lg ${className}`} style={{ width: w, height: h }} aria-label="Face-down card">
        <span className="absolute inset-[8%] rounded-[8%] border border-gold/70" style={{ background: 'repeating-linear-gradient(45deg, rgba(244,196,48,.25) 0 2px, transparent 2px 7px), repeating-linear-gradient(-45deg, rgba(244,196,48,.25) 0 2px, transparent 2px 7px)' }} />
        <img src="./img/head.webp" alt="" className="absolute left-1/2 top-1/2 w-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cream" />
      </span>
    );
  }
  const red = c.s === 'H' || c.s === 'D';
  const rank = RANK(c.r);
  const court = c.r >= 11 && c.r <= 13;
  const fs = w * (rank === '10' ? 0.3 : 0.34);
  return (
    <span
      aria-label={`${rank} of ${NAME[c.s]}`}
      className={`card-in relative inline-block shrink-0 select-none rounded-[10%] bg-gradient-to-b from-white to-[#f3efe4] font-display font-black leading-none shadow-[0_6px_14px_-4px_rgba(0,0,0,.7)] ring-1 ring-black/10 transition-transform duration-300 ${red ? 'text-[#C8102E]' : 'text-[#16120f]'} ${highlight ? '-translate-y-[10%] shadow-[0_0_0_3px_#F4C430,0_10px_24px_-6px_rgba(244,196,48,.8)]' : ''} ${dim ? 'brightness-[.62] saturate-[.7]' : ''} ${className}`}
      style={{ width: w, height: h }}
    >
      {/* corner index */}
      <span className="absolute flex flex-col items-center" style={{ left: w * 0.07, top: w * 0.06 }}>
        <span style={{ fontSize: fs, letterSpacing: rank === '10' ? '-0.06em' : 0 }}>{rank}</span>
        <SuitIcon s={c.s} size={w * 0.2} className="mt-[2px]" />
      </span>
      <span className="absolute flex rotate-180 flex-col items-center" style={{ right: w * 0.07, bottom: w * 0.06 }}>
        <span style={{ fontSize: fs * 0.8, letterSpacing: rank === '10' ? '-0.06em' : 0 }}>{rank}</span>
      </span>
      {/* centre: big suit, or framed court letter */}
      {court ? (
        <span className="absolute inset-x-[24%] inset-y-[22%] grid place-items-center rounded-[12%] border-2" style={{ borderColor: 'currentColor', background: 'linear-gradient(180deg, rgba(244,196,48,.18), rgba(244,196,48,.05))' }}>
          <span className="flex flex-col items-center">
            <span style={{ fontSize: w * 0.34 }}>{rank}</span>
            <SuitIcon s={c.s} size={w * 0.2} className="mt-[3%]" />
          </span>
        </span>
      ) : (
        <SuitIcon s={c.s} size={w * 0.5} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[38%]" />
      )}
    </span>
  );
}
