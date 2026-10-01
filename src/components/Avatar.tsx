import { itemById } from '../lib/data';
import { useStore } from '../store';

export default function Avatar({ size = 40, avatar, frame, className = '' }: { size?: number; avatar?: string; frame?: string; className?: string }) {
  const eq = useStore((s) => s.equipped);
  const a = itemById(avatar ?? eq.avatar);
  const f = itemById(frame ?? eq.frame);
  return (
    <div
      className={`relative shrink-0 rounded-full ring-2 ${f?.color ?? 'ring-white/10'} ${className}`}
      style={{ width: size, height: size }}
    >
      <img src={`./img/${a?.img ?? 'head.webp'}`} alt="" className="h-full w-full rounded-full object-cover" draggable={false} />
    </div>
  );
}

/** The player's name, in gold if they've equipped the Golden Name (Rooster VIP II). */
export function PlayerName({ name, className = '' }: { name: string; className?: string }) {
  const gold = useStore((s) => s.equipped.name === 'nm-gold');
  return <span className={`${gold ? 'text-gold-grad drop-shadow-[0_0_8px_rgba(244,196,48,.35)]' : ''} ${className}`}>{name}</span>;
}
