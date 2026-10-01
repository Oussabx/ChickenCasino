import { useState } from 'react';
import { Check, ShoppingBag } from 'lucide-react';
import { ChickenArt, ItemArt, TableArt } from '../../components/CosmeticArt';
import { ItemKind, SHOP, ShopItem, itemById } from '../../lib/data';
import { sfx } from '../../lib/sound';
import { Equipped, useStore } from '../../store';
import Avatar from '../../components/Avatar';
import { RARITY_COLOR } from './common';

const SLOTS: { slot: keyof Equipped; kind: ItemKind; label: string }[] = [
  { slot: 'chicken', kind: 'chicken', label: 'Chicken' },
  { slot: 'hat', kind: 'hat', label: 'Hat' },
  { slot: 'table', kind: 'table', label: 'Table' },
  { slot: 'chips', kind: 'chips', label: 'Chips' },
  { slot: 'deck', kind: 'deck', label: 'Cards' },
  { slot: 'fx', kind: 'fx', label: 'Win show' },
  { slot: 'name', kind: 'name', label: 'Name' },
  { slot: 'avatar', kind: 'avatar', label: 'Avatar' },
  { slot: 'frame', kind: 'frame', label: 'Frame' },
  { slot: 'title', kind: 'title', label: 'Title' },
  { slot: 'ball', kind: 'ball', label: 'Plinko egg' },
];

/** My Locker: your Chicken Casino identity — everything you own, by slot, one tap to wear. */
export default function Locker({ onShop }: { onShop: (kind: ItemKind) => void }) {
  const eq = useStore((s) => s.equipped);
  const inv = useStore((s) => s.inventory);
  const user = useStore((s) => s.user);
  const [slot, setSlot] = useState<(typeof SLOTS)[number]>(SLOTS[0]);
  const [pulse, setPulse] = useState(0);
  const owned = SHOP.filter((i) => i.kind === slot.kind && inv.includes(i.id));
  const total = SHOP.filter((i) => i.kind === slot.kind && !i.limited).length + SHOP.filter((i) => i.kind === slot.kind && i.limited && inv.includes(i.id)).length;
  const collected = SHOP.filter((i) => ['chicken', 'hat', 'table', 'chips', 'deck'].includes(i.kind) && inv.includes(i.id)).length;
  const collectible = SHOP.filter((i) => ['chicken', 'hat', 'table', 'chips', 'deck'].includes(i.kind)).length;
  const golden = eq.name === 'nm-gold';

  const wear = (it: ShopItem) => {
    if (eq[slot.slot] === it.id) return;
    useStore.getState().equip(it.id); sfx.click(); setPulse((p) => p + 1);
  };

  return (
    <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      {/* stage */}
      <div className="relative min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_50%_35%,#3a0b10,#0d0d11_70%)] p-5">
        <div className="rays pointer-events-none absolute left-1/2 top-[30%] h-[160%] w-[160%] -translate-x-1/2 -translate-y-1/2 opacity-30"
          style={{ background: 'repeating-conic-gradient(from 0deg, rgba(244,196,48,.4) 0deg 6deg, transparent 6deg 20deg)', animation: 'winfx-spin 50s linear infinite', maskImage: 'radial-gradient(circle, black 10%, transparent 45%)', WebkitMaskImage: 'radial-gradient(circle, black 10%, transparent 45%)' }} />
        <div className="relative flex items-center gap-3">
          <Avatar size={46} />
          <div className="min-w-0">
            <div className={`truncate font-display text-xl font-black ${golden ? 'text-gold-grad' : ''}`}>{user?.name ?? 'Guest'}</div>
            <div className="text-xs text-smoke">{itemById(eq.title)?.name} · {collected}/{collectible} collectibles</div>
          </div>
        </div>
        <div key={`c${pulse}`} className="cos-live relative mx-auto mt-2 grid place-items-center shop-equip-pop">
          <div className="pointer-events-none absolute bottom-3 h-6 w-40 rounded-[50%] bg-black/60 blur-md" />
          <div className="w-[190px] sm:w-[230px] [&>svg]:h-auto [&>svg]:w-full"><ChickenArt skin={eq.chicken} hat={eq.hat} size={230} /></div>
        </div>
        <div className="relative mt-2 flex justify-center [&>svg]:h-auto [&>svg]:max-w-full"><TableArt table={eq.table} chips={eq.chips} deck={eq.deck} size={250} /></div>
        <div className="relative mt-3 grid grid-cols-2 gap-1.5 text-[11px] sm:grid-cols-3">
          {SLOTS.slice(0, 6).map((s) => (
            <button key={s.slot} type="button" onClick={() => setSlot(s)} className={`flex items-center justify-between gap-1 rounded-lg px-2 py-1.5 text-left transition ${slot.slot === s.slot ? 'bg-gold/15 ring-1 ring-gold/50' : 'bg-white/[0.04] hover:bg-white/[0.08]'}`}>
              <span className="text-smoke">{s.label}</span><b className="truncate text-cream">{itemById(eq[s.slot])?.name}</b>
            </button>
          ))}
        </div>
      </div>

      {/* wardrobe */}
      <div className="min-w-0">
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {SLOTS.map((s) => (
            <button key={s.slot} type="button" onClick={() => { setSlot(s); sfx.click(); }}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${slot.slot === s.slot ? 'border-gold bg-gold text-ink' : 'border-white/10 text-cream/80 hover:border-white/30'}`}>{s.label}</button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-smoke">
          <span>{owned.length} of {total} {slot.label.toLowerCase()} items</span>
          <button type="button" className="flex items-center gap-1 font-bold text-gold hover:underline" onClick={() => onShop(slot.kind)}><ShoppingBag size={13} />Get more</button>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {owned.map((it) => {
            const on = eq[slot.slot] === it.id;
            return (
              <button key={it.id} type="button" onClick={() => wear(it)}
                className={`group relative flex flex-col items-center overflow-hidden rounded-2xl border p-2 transition hover:-translate-y-0.5 ${on ? 'border-gold bg-gold/10 shadow-gold' : 'border-white/10 bg-ink-800 hover:border-white/25'}`}>
                <div className="grid aspect-square w-full place-items-center" style={{ background: `radial-gradient(circle, ${RARITY_COLOR[it.rarity]}26, transparent 65%)` }}>
                  <ItemArt it={it} size={86} tryOn={slot.kind !== 'chicken' && slot.kind !== 'hat'} />
                </div>
                <div className="mt-1 w-full truncate text-center text-[11px] font-bold">{it.name}</div>
                {on && <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-gold text-ink shop-check"><Check size={12} /></span>}
              </button>
            );
          })}
          <button type="button" onClick={() => onShop(slot.kind)} className="grid min-h-[120px] place-items-center rounded-2xl border border-dashed border-white/15 text-xs font-bold text-smoke transition hover:border-gold/50 hover:text-gold">
            <span className="flex flex-col items-center gap-1"><ShoppingBag size={18} />Shop {slot.label.toLowerCase()}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
