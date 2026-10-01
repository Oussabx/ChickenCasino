import { Check, Coins, Gift, Sparkles } from 'lucide-react';
import { PRODUCTS, Product, ProductKind } from '../../lib/coinStore';
import { itemById } from '../../lib/data';
import { fmt } from '../../lib/format';
import { usd } from '../../lib/payment';
import { useStore } from '../../store';
import { ItemArt } from '../CosmeticArt';
import { Coin, Egg } from '../Icons';

const TABS: { k: ProductKind; label: string; icon: JSX.Element }[] = [
  { k: 'coins', label: 'Coins', icon: <Coins size={15} /> },
  { k: 'eggs', label: 'Golden eggs', icon: <Egg className="h-4 w-4" /> },
  { k: 'bundle', label: 'Skin bundles', icon: <Gift size={15} /> },
];

/** A pile of coins / eggs that grows with the pack size. */
export function ProductArt({ p, size = 120 }: { p: Product; size?: number }) {
  if (p.kind === 'bundle') {
    const hero = itemById(p.items![0]);
    return (
      <div className="relative grid place-items-center" style={{ width: size * 1.2, height: size }}>
        {hero && <div className="cos-live"><ItemArt it={hero} size={size * 0.95} tryOn={false} /></div>}
        <div className="absolute bottom-0 right-1 flex -space-x-2">{[0, 1, 2].map((i) => <Coin key={i} style={{ width: size * 0.26, height: size * 0.26 }} />)}</div>
      </div>
    );
  }
  const tier = PRODUCTS.filter((x) => x.kind === p.kind).indexOf(p); // 0..5
  const n = [1, 3, 5, 7, 10, 14][tier] ?? 3;
  const Icon = p.kind === 'eggs' ? Egg : Coin;
  // simple pyramid pile, scaled so the widest row always fits the art box
  const w0 = Math.min(5, Math.ceil(Math.sqrt(n * 2)));
  const s = size * (p.kind === 'eggs' ? 0.34 : 0.3) * Math.min(1, 3.6 / (1 + (w0 - 1) * 0.72));
  const rows: number[] = [];
  let left = n, w = w0;
  while (left > 0) { const r = Math.min(w, left); rows.push(r); left -= r; w = Math.max(1, w - 1); }
  return (
    <div className="relative grid place-items-center" style={{ width: size * 1.2, height: size }}>
      <div className="absolute inset-x-4 bottom-1 h-5 rounded-[50%] bg-black/50 blur-md" />
      <div className="relative flex flex-col-reverse items-center">
        {rows.map((r, i) => (
          <div key={i} className="flex" style={{ marginTop: i ? -s * 0.45 : 0 }}>
            {Array.from({ length: r }, (_, k) => <Icon key={k} style={{ width: s, height: s, marginLeft: k ? -s * 0.28 : 0, filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.5))' }} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductCard({ p, onBuy }: { p: Product; onBuy: (p: Product) => void }) {
  const bought = useStore((s) => !!p.once && s.orders.some((o) => o.product === p.id));
  const tag = p.tag === 'popular' ? { t: 'Most popular', c: 'bg-blood text-white' } : p.tag === 'best' ? { t: 'Best value', c: 'bg-gold text-ink' } : p.tag === 'limited' ? { t: 'One-time offer', c: 'bg-sky-400 text-ink' } : null;
  return (
    <button type="button" disabled={bought} onClick={() => onBuy(p)}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border text-left transition duration-300 enabled:hover:-translate-y-1 disabled:opacity-60 ${p.tag === 'best' ? 'border-gold/60 shadow-gold' : p.tag === 'popular' ? 'border-blood/50' : 'border-white/10'} bg-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold`}>
      {tag && <span className={`absolute left-2 top-2 z-10 rounded-full px-2 py-0.5 font-display text-[10px] font-black uppercase tracking-wider ${tag.c}`}>{tag.t}</span>}
      <div className="relative grid place-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_65%,rgba(244,196,48,.18),transparent_65%)] px-2 pb-1 pt-7">
        {p.bonus ? <span className="absolute bottom-1.5 right-1.5 z-10 rounded-full bg-emerald-500 px-2 py-0.5 font-display text-[10px] font-black text-ink">+{p.bonus}% bonus</span> : null}
        <div className="transition duration-500 group-enabled:group-hover:scale-105"><ProductArt p={p} size={p.kind === 'bundle' ? 110 : 96} /></div>
      </div>
      <div className="flex flex-1 flex-col gap-1 border-t border-white/[0.06] p-3">
        <div className="font-display text-sm font-bold leading-tight">{p.name}</div>
        <div className="space-y-0.5 text-xs">
          {p.coins ? <div className="flex items-center gap-1 font-display text-base font-black text-gold tabular"><Coin className="h-4 w-4" />{fmt(p.coins, 0)}</div> : null}
          {p.eggs ? <div className={`flex items-center gap-1 font-display font-black tabular ${p.kind === 'eggs' ? 'text-base text-gold' : 'text-cream'}`}><Egg className="h-4 w-4" />{fmt(p.eggs, 0)}{p.kind === 'eggs' ? '' : ' eggs'}</div> : null}
          {p.items?.length ? <div className="flex items-center gap-1 font-bold text-fuchsia-300"><Sparkles size={12} />{p.items.map((i) => itemById(i)?.name).join(', ')}</div> : null}
        </div>
        <div className={`mt-auto pt-2`}>
          <span className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2 font-display text-sm font-black transition ${bought ? 'bg-white/5 text-emerald-400' : 'bg-gold text-ink group-hover:bg-gold-300'}`}>
            {bought ? <><Check size={14} />Purchased</> : usd(p.usd)}
          </span>
        </div>
      </div>
    </button>
  );
}

/** Coin, egg and bundle packs. `onBuy` starts checkout. */
export default function CoinStore({ tab, setTab, onBuy, compact }: { tab: ProductKind; setTab: (k: ProductKind) => void; onBuy: (p: Product) => void; compact?: boolean }) {
  const items = PRODUCTS.filter((p) => p.kind === tab);
  return (
    <div>
      <div className="seg w-full sm:w-auto" role="tablist">
        {TABS.map((t) => (
          <button key={t.k} type="button" role="tab" aria-selected={tab === t.k} data-active={tab === t.k} onClick={() => setTab(t.k)} className="flex flex-1 items-center justify-center gap-1.5 !px-3 sm:flex-none">{t.icon}<span className="whitespace-nowrap">{t.label}</span></button>
        ))}
      </div>
      <div className={`mt-4 grid gap-3 ${tab === 'bundle' ? 'grid-cols-1 min-[420px]:grid-cols-2' : 'grid-cols-2'} ${compact ? 'sm:grid-cols-3' : tab === 'bundle' ? 'lg:grid-cols-4' : 'sm:grid-cols-3 lg:grid-cols-6'}`}>
        {items.map((p) => <ProductCard key={p.id} p={p} onBuy={onBuy} />)}
      </div>
    </div>
  );
}
