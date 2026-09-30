import { Link } from 'react-router-dom';
import { Star, Flame, Sparkles, Play } from 'lucide-react';
import { GameMeta } from '../lib/data';
import GameArt from './GameArt';
import { useStore } from '../store';
import { Tilt } from '../lib/motion';
import { enterLandscape, isPhoneDevice } from '../lib/phone';

export default function GameCard({ g, size = 'md' }: { g: GameMeta; size?: 'md' | 'lg' }) {
  const fav = useStore((s) => s.favorites.includes(g.id));
  const toggle = useStore((s) => s.toggleFav);
  return (
    <Tilt max={14} scale={1.04} className="rounded-2xl">
      <Link to={`/games/${g.id}`} onClick={() => { if (isPhoneDevice()) enterLandscape(); }} className="group relative block rounded-2xl card overflow-hidden transition-[border-color,box-shadow] duration-300 hover:border-gold/40 hover:shadow-gold [transform-style:preserve-3d]">
        <GameArt id={g.id} wide={size === 'lg'} className={`${size === 'lg' ? 'aspect-[4/3]' : 'aspect-square'} w-full transition duration-700 group-hover:scale-[1.08]`} />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />
        <div className="absolute left-2.5 top-2.5 flex gap-1.5 [transform:translateZ(30px)]">
          {g.hot && <span className="chip bg-blood text-white"><Flame size={11} />HOT</span>}
          {g.isNew && <span className="chip bg-gold text-ink"><Sparkles size={11} />NEW</span>}
        </div>
        <button
          onClick={(e) => { e.preventDefault(); toggle(g.id); }}
          className={`absolute right-2.5 top-2.5 grid h-8 w-8 place-items-center rounded-full backdrop-blur transition [transform:translateZ(30px)] ${fav ? 'bg-gold text-ink' : 'bg-black/40 text-cream/80 opacity-100 lg:opacity-0 group-hover:opacity-100'}`}
          aria-label={fav ? 'Remove favourite' : 'Add favourite'}
        >
          <Star size={15} fill={fav ? 'currentColor' : 'none'} />
        </button>
        {/* play badge pops forward on hover */}
        <div className="pointer-events-none absolute left-1/2 top-[42%] grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 scale-50 place-items-center rounded-full bg-gold text-ink opacity-0 shadow-gold transition duration-300 group-hover:scale-100 group-hover:opacity-100">
          <Play size={20} fill="currentColor" className="ml-0.5" />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-3 [transform:translateZ(40px)]">
          <div className="font-display font-extrabold leading-tight transition-transform duration-300 group-hover:-translate-y-0.5">{g.name}</div>
          <div className="mt-0.5 flex items-center justify-between text-[11px] text-smoke">
            <span className="truncate">{g.tagline}</span>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition shine" />
      </Link>
    </Tilt>
  );
}
