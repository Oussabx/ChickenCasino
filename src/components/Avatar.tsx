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
