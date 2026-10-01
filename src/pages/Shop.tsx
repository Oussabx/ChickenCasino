import { ReactNode, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Crown, Egg as EggIcon, Flame, Gem, Layers, Package, Shirt, Sparkles, Star } from 'lucide-react';
import { useStore } from '../store';
import { ItemKind, SHOP, ShopItem } from '../lib/data';
import { fmt } from '../lib/format';
import { Coin, Egg } from '../components/Icons';
import { EggArt } from '../components/CosmeticArt';
import { EGGS } from '../lib/cosmetics';
import { useCountUp } from '../components/TableUI';
import { LazyMount } from '../lib/motion';
import ItemCard from './shop/ItemCard';
import ItemSheet from './shop/ItemSheet';
import HotDrop from './shop/HotDrop';
import EggShop from './shop/EggShop';
import VipTrack from './shop/VipTrack';
import Locker from './shop/Locker';

type Tab = 'featured' | 'chicken' | 'hat' | 'table' | 'chips' | 'deck' | 'set' | 'eggs' | 'vip' | 'locker' | 'more';
const TABS: { k: Tab; label: string; icon?: ReactNode }[] = [
  { k: 'featured', label: 'Featured', icon: <Flame size={14} /> },
  { k: 'chicken', label: 'Chickens' },
  { k: 'hat', label: 'Hats' },
  { k: 'table', label: 'Tables' },
  { k: 'chips', label: 'Chips' },
  { k: 'deck', label: 'Cards' },
  { k: 'set', label: 'Bundles', icon: <Package size={14} /> },
  { k: 'eggs', label: 'Egg Shop', icon: <EggIcon size={14} /> },
  { k: 'vip', label: 'VIP', icon: <Crown size={14} /> },
  { k: 'locker', label: 'My Locker', icon: <Shirt size={14} /> },
  { k: 'more', label: 'More' },
];
const ORDER: Record<ShopItem['rarity'], number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.k === params.get('tab'))?.k ?? 'featured') as Tab;
  const setTab = (k: Tab) => { setParams(k === 'featured' ? {} : { tab: k }, { replace: true }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const [open, setOpen] = useState<ShopItem | null>(null);
  const toShop = (k: ItemKind) => setTab(k === 'fx' || k === 'name' ? 'vip' : (['chicken', 'hat', 'table', 'chips', 'deck'].includes(k) ? k : 'more') as Tab);

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 pt-6 lg:px-6">
      <Header onLocker={() => setTab('locker')} />
      {/* sticky category bar */}
      <nav className="sticky top-16 z-30 -mx-4 glass-bar border-b border-white/[0.06] px-4 lg:-mx-6 lg:px-6" aria-label="Shop sections">
        <div className="no-scrollbar -mx-2 flex gap-1.5 overflow-x-auto px-2 py-2.5">
          {TABS.map((t) => (
            <button key={t.k} type="button" onClick={() => setTab(t.k)} aria-current={tab === t.k}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-bold transition ${tab === t.k ? 'border-gold bg-gold text-ink shadow-[0_2px_12px_-3px_rgba(244,196,48,.7)]' : 'border-white/10 text-cream/80 hover:border-white/30 hover:text-cream'} ${t.k === 'locker' ? 'sm:ml-auto' : ''}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </nav>

      <div key={tab} className="shop-tab-in space-y-8 pb-6">
        {tab === 'featured' && <Featured onOpen={setOpen} go={setTab} />}
        {(['chicken', 'hat', 'table', 'chips', 'deck'] as Tab[]).includes(tab) && <Category kind={tab as ItemKind} onOpen={setOpen} />}
        {tab === 'set' && <Grid items={SHOP.filter((i) => i.kind === 'set')} onOpen={setOpen} wide />}
        {tab === 'eggs' && <EggShop onOpen={setOpen} />}
        {tab === 'vip' && <VipTrack onOpen={setOpen} />}
        {tab === 'locker' && <Locker onShop={toShop} />}
        {tab === 'more' && <More onOpen={setOpen} />}
      </div>

      <ItemSheet it={open} onClose={() => setOpen(null)} onOpenItem={setOpen} />
    </div>
  );
}

function Header({ onLocker }: { onLocker: () => void }) {
  const balance = useStore((s) => s.balance);
  const eggs = useStore((s) => s.eggs);
  const shown = useCountUp(balance, 600);
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-ink-900 p-5 sm:p-7 grain">
      <img src="./img/strip-chips.webp" alt="" className="absolute inset-y-0 right-0 h-full w-2/3 object-cover opacity-40 [mask-image:linear-gradient(to_right,transparent,black_60%)]" />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="label text-gold">The Coop Store</div>
          <h1 className="h-display mt-1 text-4xl sm:text-5xl">Dress your <span className="text-gold-grad">chicken</span></h1>
          <p className="mt-1 max-w-lg text-sm text-cream/70">Chickens, hats, tables, chips and card decks — collect them, mix and match, and they show up in your games.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-2xl border border-white/10 bg-ink/70 px-4 py-2 backdrop-blur"><div className="label !text-[10px]">Coins</div><div className="flex items-center gap-1.5 font-display font-black tabular"><Coin className="h-4 w-4" />{fmt(shown || balance)}</div></div>
          <div className="rounded-2xl border border-gold/30 bg-ink/70 px-4 py-2 backdrop-blur"><div className="label !text-[10px]">Golden eggs</div><div className="flex items-center gap-1.5 font-display font-black tabular"><Egg className="h-4 w-4" />{eggs}</div></div>
          <button type="button" onClick={onLocker} className="btn-gold px-4 py-2.5"><Shirt size={16} />My Locker</button>
        </div>
      </div>
    </div>
  );
}

function Featured({ onOpen, go }: { onOpen: (it: ShopItem) => void; go: (t: Tab) => void }) {
  const inv = useStore((s) => s.inventory);
  const sellable = (i: ShopItem) => !i.limited && !i.vip && i.price > 0;
  const best = SHOP.filter((i) => i.best);
  const fresh = SHOP.filter((i) => i.fresh);
  const legendary = SHOP.filter((i) => i.rarity === 'legendary' && sellable(i) && ['chicken', 'hat', 'table', 'chips', 'deck'].includes(i.kind));
  const almost = SHOP.filter((i) => sellable(i) && !inv.includes(i.id) && ['chicken', 'hat', 'table', 'chips', 'deck'].includes(i.kind)).sort((a, b) => a.price - b.price).slice(0, 8);
  return (
    <>
      <HotDrop onOpen={onOpen} />
      <Shelf title="Best sellers" icon={<Star size={18} className="text-gold" />} items={best} onOpen={onOpen} />
      <Shelf title="New arrivals" icon={<Sparkles size={18} className="text-sky-300" />} items={fresh} onOpen={onOpen} />
      <section className="own-layer cv-auto">
        <ShelfHead title="Bundles" icon={<Package size={18} className="text-gold" />} more={() => go('set')} />
        <LazyMount minHeight={600}><Grid items={SHOP.filter((i) => i.kind === 'set')} onOpen={onOpen} wide /></LazyMount>
      </section>
      <section className="own-layer cv-auto grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <LazyMount minHeight={260}><EggTeaser go={() => go('eggs')} /></LazyMount>
        <LazyMount minHeight={260}><VipTrack onOpen={onOpen} compact /></LazyMount>
      </section>
      <Shelf title="Legendary" icon={<Gem size={18} className="text-gold" />} items={legendary} onOpen={onOpen} />
      {almost.length > 0 && <Shelf title="Start your collection" icon={<Layers size={18} className="text-emerald-400" />} items={almost} onOpen={onOpen} />}
    </>
  );
}

function ShelfHead({ title, icon, more }: { title: string; icon: ReactNode; more?: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 font-display text-xl font-extrabold sm:text-2xl">{icon}{title}</h2>
      {more && <button type="button" onClick={more} className="flex items-center gap-1 py-2 text-xs font-bold text-gold hover:underline">See all <ArrowRight size={13} /></button>}
    </div>
  );
}

/** Horizontal, snap-scrolling shelf with arrow buttons on desktop. */
function Shelf({ title, icon, items, onOpen }: { title: string; icon: ReactNode; items: ShopItem[]; onOpen: (it: ShopItem) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (d: number) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  return (
    <section className="own-layer cv-auto relative">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-xl font-extrabold sm:text-2xl">{icon}{title}</h2>
        <div className="hidden gap-1.5 sm:flex">
          <button type="button" aria-label="Scroll left" onClick={() => scroll(-1)} className="grid h-8 w-8 place-items-center rounded-full border border-white/10 hover:border-gold/50"><ChevronLeft size={16} /></button>
          <button type="button" aria-label="Scroll right" onClick={() => scroll(1)} className="grid h-8 w-8 place-items-center rounded-full border border-white/10 hover:border-gold/50"><ChevronRight size={16} /></button>
        </div>
      </div>
      <LazyMount minHeight={230}>
        <div ref={ref} className="no-scrollbar isolate -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 lg:-mx-1 lg:px-1">
          {items.map((it, i) => (
            <div key={it.id} className="shop-rise w-[46%] shrink-0 snap-start sm:w-[30%] md:w-[23%] lg:w-[18.5%]" style={{ animationDelay: `${i * 50}ms` }}>
              <ItemCard it={it} onOpen={onOpen} compact />
            </div>
          ))}
        </div>
      </LazyMount>
    </section>
  );
}

function Grid({ items, onOpen, wide }: { items: ShopItem[]; onOpen: (it: ShopItem) => void; wide?: boolean }) {
  return (
    <div className={`grid gap-3 sm:gap-4 ${wide ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'}`}>
      {items.map((it, i) => <div key={it.id} className="shop-rise" style={{ animationDelay: `${(i % 10) * 45}ms` }}><ItemCard it={it} onOpen={onOpen} /></div>)}
    </div>
  );
}

const FILTERS = ['All', 'Not owned', 'Owned'] as const;
function Category({ kind, onOpen }: { kind: ItemKind; onOpen: (it: ShopItem) => void }) {
  const inv = useStore((s) => s.inventory);
  const [f, setF] = useState<(typeof FILTERS)[number]>('All');
  const items = useMemo(() => SHOP.filter((i) => i.kind === kind && (!i.limited || inv.includes(i.id)))
    .filter((i) => (f === 'Owned' ? inv.includes(i.id) : f === 'Not owned' ? !inv.includes(i.id) : true))
    .sort((a, b) => Number(!!a.vip) - Number(!!b.vip) || ORDER[a.rarity] - ORDER[b.rarity] || a.price - b.price), [kind, inv, f]);
  const have = SHOP.filter((i) => i.kind === kind && inv.includes(i.id)).length;
  const all = SHOP.filter((i) => i.kind === kind && (!i.limited || inv.includes(i.id))).length;
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-2 w-40 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-gold-600 to-gold-300 transition-all duration-700" style={{ width: `${(have / all) * 100}%` }} /></div>
          <span className="text-xs font-bold text-smoke">{have}/{all} collected</span>
        </div>
        <div className="seg">{FILTERS.map((x) => <button key={x} type="button" data-active={f === x} onClick={() => setF(x)} className="!px-3">{x}</button>)}</div>
      </div>
      {items.length ? <Grid items={items} onOpen={onOpen} /> : <div className="py-16 text-center text-smoke">Nothing here yet.</div>}
    </section>
  );
}

function EggTeaser({ go }: { go: () => void }) {
  return (
    <button type="button" onClick={go} className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#1e1a0e] to-black p-5 text-left">
      <div className="flex items-center gap-2 font-display text-[11px] font-black uppercase tracking-[.3em] text-gold/80"><EggIcon size={14} />Egg Shop</div>
      <h3 className="h-display mt-1 text-3xl text-gold-grad">Hatch a surprise</h3>
      <p className="mt-1 text-sm text-cream/70">Cosmetics only, never a duplicate, odds shown up front.</p>
      <div className="mt-4 flex items-end justify-between">
        {EGGS.map((e, i) => <div key={e.id} className="shop-egg-idle transition group-hover:-translate-y-1" style={{ animationDelay: `${i * 0.3}s` }}><EggArt egg={e.id} size={56 + i * 8} /></div>)}
      </div>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-gold">Open the Egg Shop <ArrowRight size={14} className="transition group-hover:translate-x-1" /></span>
    </button>
  );
}

function More({ onOpen }: { onOpen: (it: ShopItem) => void }) {
  const groups: [ItemKind, string, string?][] = [
    ['bundle', 'Coin packs', 'Trade golden eggs — earned from level-ups, streaks, missions and promo codes — for coins.'],
    ['avatar', 'Avatars'], ['frame', 'Avatar frames'], ['title', 'Titles'], ['ball', 'Plinko eggs'],
  ];
  return (
    <>
      {groups.map(([k, title, sub]) => (
        <section key={k}>
          <h2 className="mb-1 font-display text-xl font-extrabold">{title}</h2>
          {sub && <p className="mb-3 text-sm text-smoke">{sub}</p>}
          <Grid items={SHOP.filter((i) => i.kind === k)} onOpen={k === 'bundle' ? (it) => onOpen(it) : onOpen} />
        </section>
      ))}
    </>
  );
}

