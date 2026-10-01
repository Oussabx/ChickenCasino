import { ShopItem } from '../../lib/data';
import { ItemArt } from '../../components/CosmeticArt';
import { onSale } from '../../lib/shopLogic';
import { fmt } from '../../lib/format';
import { ItemBadges, LockTag, Price, RARITY_COLOR, useItemState } from './common';

/** One collectible on a shelf: rarity-lit stage, idle-animated art, price or state. Tap opens the item sheet. */
export default function ItemCard({ it, onOpen, compact }: { it: ShopItem; onOpen: (it: ShopItem) => void; compact?: boolean }) {
  const { owned, equipped, price, sp, vipTier } = useItemState(it);
  const col = RARITY_COLOR[it.rarity];
  const legendary = it.rarity === 'legendary';
  const gone = it.limited && !onSale(it) && !owned;
  return (
    <button type="button" onClick={() => onOpen(it)}
      className={`shop-card group relative flex h-full w-full flex-col overflow-hidden rounded-2xl text-left transition duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${legendary ? 'shop-legendary' : ''}`}
      style={{ '--rc': col } as React.CSSProperties}>
      <div className="relative grid place-items-center overflow-hidden" style={{ aspectRatio: compact ? '1 / .92' : '1 / 1', background: `radial-gradient(circle at 50% 60%, ${col}33, transparent 62%), linear-gradient(180deg,#1b1b22,#121216)` }}>
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent" />
        <span className="shop-shine" />
        <div className={`relative transition duration-500 group-hover:scale-110 ${gone ? 'opacity-40 grayscale' : ''}`}>
          <ItemArt it={it} size={compact ? 108 : 132} />
        </div>
        <div className="absolute left-2 top-2"><ItemBadges it={it} owned={owned} equipped={equipped} /></div>
        <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 font-display text-[9px] font-black uppercase tracking-wider" style={{ color: col }}>{it.rarity}</span>
      </div>
      <div className="flex flex-1 flex-col gap-1 border-t border-white/[0.06] bg-ink-800 p-3">
        <div className="truncate font-display text-sm font-bold leading-tight">{it.name}</div>
        <div className="mt-auto flex items-center justify-between gap-2">
          {owned ? (
            <span className="text-xs font-bold text-emerald-400">{equipped ? 'Wearing it' : 'In your locker'}</span>
          ) : it.vip ? (
            <LockTag text={vipTier ? `${vipTier.name} · Lv ${vipTier.level}` : 'VIP'} />
          ) : gone ? (
            <LockTag text="Drop ended" />
          ) : (
            <>
              <Price it={it} price={price} className="text-gold" />
              {sp && sp.worth > price && <span className="text-[11px] text-smoke line-through tabular">{fmt(sp.worth, 0)}</span>}
            </>
          )}
        </div>
      </div>
    </button>
  );
}
