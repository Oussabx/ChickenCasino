import { Link } from 'react-router-dom';
import { Star, Flame, Sparkles } from 'lucide-react';
import { GameMeta } from '../lib/data';
import GameArt from './GameArt';
import { useStore } from '../store';

export default function GameCard({ g, size = 'md' }: { g: GameMeta; size?: 'md' | 'lg' }) {
  const fav = useStore((s) => s.favorites.includes(g.id));
  const toggle = useStore((s) => s.toggleFav);
  return (
    <Link to={`/games/${g.id}`} className="group relative block rounded-2xl card card-hover overflow-hidden">
      <GameArt id={g.id} className={`${size === 'lg' ? 'aspect-[4/3]' : 'aspect-square'} w-full transition duration-500 group-hover:scale-[1.04]`} />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />
      <div className="absolute left-2.5 top-2.5 flex gap-1.5">
        {g.hot && <span className="chip bg-blood text-white"><Flame size={11} />HOT</span>}
        {g.isNew && <span className="chip bg-gold text-ink"><Sparkles size={11} />NEW</span>}
      </div>
      <button
        onClick={(e) => { e.preventDefault(); toggle(g.id); }}
        className={`absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full backdrop-blur transition ${fav ? 'bg-gold text-ink' : 'bg-black/40 text-cream/80 opacity-100 lg:opacity-0 group-hover:opacity-100'}`}
        aria-label={fav ? 'Remove favourite' : 'Add favourite'}
      >
        <Star size={15} fill={fav ? 'currentColor' : 'none'} />
      </button>
      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="font-display font-extrabold leading-tight">{g.name}</div>
        <div className="mt-0.5 flex items-center justify-between text-[11px] text-smoke">
          <span className="truncate">{g.tagline}</span>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition shine" />
    </Link>
  );
}
