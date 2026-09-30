import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { GAMES } from '../lib/data';
import GameCard from '../components/GameCard';
import { useStore } from '../store';
import { Reveal } from '../lib/motion';

const FILTERS = ['All', 'Originals', 'Favourites', 'Hot', 'New'] as const;

export default function Games() {
  const [q, setQ] = useState('');
  const [f, setF] = useState<(typeof FILTERS)[number]>('All');
  const favs = useStore((s) => s.favorites);
  const stats = useStore((s) => s.stats.perGame);
  const list = useMemo(() => GAMES.filter((g) => {
    if (q && !`${g.name} ${g.tagline} ${g.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (f === 'Favourites') return favs.includes(g.id);
    if (f === 'Hot') return g.hot;
    if (f === 'New') return g.isNew;
    if (f === 'Originals') return ['chicken-cross', 'egg-hunt', 'crash'].includes(g.id);
    return true;
  }), [q, f, favs]);

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 pt-6">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-ink-900 p-6 sm:p-10">
        <img src="./img/mood-bar.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-transparent" />
        <div className="relative">
          <div className="label text-gold">The Coop</div>
          <h1 className="h-display text-4xl sm:text-5xl mt-1">All games</h1>
          <p className="mt-2 text-cream/70 max-w-md">Six hand-crafted games. Zero boring slot machines.</p>
        </div>
      </div>
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <div className="relative sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-smoke" />
          <input className="input pl-9" placeholder="Search games" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {FILTERS.map((x) => (
            <button key={x} onClick={() => setF(x)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold border transition ${f === x ? 'bg-gold text-ink border-gold' : 'border-white/10 text-cream/80 hover:border-white/30'}`}>{x}</button>
          ))}
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
        {list.map((g, i) => (
          <Reveal key={g.id} variant="zoom" delay={(i % 3) * 90}>
            <GameCard g={g} size="lg" />
            <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1">
              {g.tags.map((t) => <span key={t} className="chip bg-white/5 text-smoke">{t}</span>)}
              <span className="ml-auto text-[11px] text-smoke">Max <b className="text-gold">{g.maxWin}</b></span>
            </div>
            {stats[g.id] && <div className="px-1 mt-1 text-[11px] text-smoke">You've played {stats[g.id]!.rounds} rounds · best {stats[g.id]!.best.toFixed(2)}×</div>}
          </Reveal>
        ))}
        {!list.length && <div className="col-span-full py-16 text-center text-smoke">No games match — try another filter. 🐣</div>}
      </div>
    </div>
  );
}
