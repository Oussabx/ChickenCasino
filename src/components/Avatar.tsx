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

/** CSS class for each name style (shop "name" items). */
export const NAME_CLASS: Record<string, string> = {
  'nm-gold': 'text-gold-grad drop-shadow-[0_0_8px_rgba(244,196,48,.35)]',
  'nm-fire': 'name-fire',
  'nm-rainbow': 'name-rainbow',
  'nm-ice': 'name-ice',
};

/** The player's name in their equipped name style (gold, fire, rainbow, ice…). */
export function PlayerName({ name, className = '' }: { name: string; className?: string }) {
  const style = useStore((s) => NAME_CLASS[s.equipped.name] ?? '');
  return <span className={`${style} ${className}`}>{name}</span>;
}
