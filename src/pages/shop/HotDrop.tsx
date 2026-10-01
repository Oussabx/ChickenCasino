import { useEffect, useState } from 'react';
import { Flame, Timer } from 'lucide-react';
import { ShopItem, itemById } from '../../lib/data';
import { DROP_POOL, currentDrop, dropEndsAt, dropIndex } from '../../lib/cosmetics';
import { ItemArt } from '../../components/CosmeticArt';
import { Price, RARITY_COLOR, fmtLeft, useItemState } from './common';

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  return now;
}

/** Today's limited item, a live countdown, and the week's drop schedule. */
export default function HotDrop({ onOpen }: { onOpen: (it: ShopItem) => void }) {
  const now = useNow();
  const it = itemById(currentDrop(now))!;
  const { owned } = useItemState(it);
  const left = dropEndsAt(now) - now;
  const [h, m, s] = fmtLeft(left).split(':');
  const col = RARITY_COLOR[it.rarity];
  return (
    <section className="own-layer relative isolate overflow-hidden rounded-3xl border border-blood/40 bg-gradient-to-br from-[#3a0b10] via-[#140608] to-black shadow-[0_30px_80px_-30px_rgba(230,57,70,.6)]">
      <div className="pointer-events-none absolute -left-20 top-1/2 h-[140%] w-[70%] -translate-y-1/2 opacity-60"
        style={{ background: `radial-gradient(circle, ${col}55, transparent 60%)` }} />
      <div className="pointer-events-none absolute inset-0 shop-embers" />
      <div className="relative grid items-center gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:p-8">
        <button type="button" onClick={() => onOpen(it)} className="group relative mx-auto grid place-items-center" aria-label={`Look at ${it.name}`}>
          <div className="rays pointer-events-none absolute h-[120%] w-[120%] opacity-50"
            style={{ background: `repeating-conic-gradient(from 0deg, ${col}66 0deg 7deg, transparent 7deg 20deg)`, animation: 'winfx-spin 30s linear infinite', maskImage: 'radial-gradient(circle, black 15%, transparent 60%)', WebkitMaskImage: 'radial-gradient(circle, black 15%, transparent 60%)' }} />
          <div className="cos-live relative transition duration-500 group-hover:scale-105"><ItemArt it={it} size={250} /></div>
        </button>
        <div className="text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-blood/60 bg-blood/20 px-3 py-1 font-display text-[11px] font-black uppercase tracking-[.25em] text-[#ff8a95]">
            <Flame size={13} className="animate-pulse" />Today’s Hot Drop
          </div>
          <h2 className="h-display mt-3 text-4xl leading-none text-gold-grad sm:text-5xl">{it.name}</h2>
          <div className="mt-2 font-display text-xs font-black uppercase tracking-[.3em]" style={{ color: col }}>Limited edition · {it.rarity}</div>
          <p className="mt-2 text-sm text-cream/70">{it.desc.replace(' Limited edition.', '')} Gone when the timer hits zero — the next drop replaces it.</p>
          <div className="mt-4 flex items-center justify-center gap-2 sm:justify-start" aria-label="Time left">
            <Timer size={16} className="text-blood" />
            {[h, m, s].map((v, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="min-w-[46px] rounded-xl border border-white/10 bg-black/60 px-2 py-1.5 text-center font-display text-2xl font-black tabular">{v}</span>
                {i < 2 && <span className="font-display text-xl font-black text-smoke">:</span>}
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
            <button className="btn-gold px-6 py-3.5 text-base" onClick={() => onOpen(it)}>
              {owned ? 'Owned — equip it' : <>Get it · <Price it={it} /></>}
            </button>
            <span className="text-xs text-smoke">Cosmetic only · never affects odds</span>
          </div>
        </div>
      </div>
      <DropSchedule now={now} onOpen={onOpen} />
    </section>
  );
}

/** The 7-day rotation: today lit, upcoming ones as silhouettes. */
function DropSchedule({ now, onOpen }: { now: number; onOpen: (it: ShopItem) => void }) {
  const today = dropIndex(now);
  const days = Array.from({ length: 7 }, (_, k) => ({ k, id: DROP_POOL[(today + k) % DROP_POOL.length] }));
  return (
    <div className="relative border-t border-white/[0.06] bg-black/40 px-4 py-3 sm:px-8">
      <div className="mb-2 font-display text-[10px] font-black uppercase tracking-[.25em] text-smoke">This week’s drops</div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {days.map(({ k, id }) => {
          const it = itemById(id)!;
          const label = k === 0 ? 'Now' : k === 1 ? 'Tomorrow' : new Date((today + k) * 864e5).toLocaleDateString(undefined, { weekday: 'short' });
          return (
            <button key={id} type="button" onClick={() => onOpen(it)}
              className={`flex shrink-0 flex-col items-center rounded-2xl border px-2 pb-1.5 pt-1 transition hover:-translate-y-0.5 ${k === 0 ? 'border-blood/60 bg-blood/15' : 'border-white/10 bg-white/[0.03]'}`}>
              <div className={k === 0 ? '' : 'opacity-60 brightness-0 invert-[.15]'}><ItemArt it={it} size={58} tryOn={false} /></div>
              <span className={`font-display text-[10px] font-black uppercase tracking-wider ${k === 0 ? 'text-blood' : 'text-smoke'}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
