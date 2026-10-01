import { useEffect, useState } from 'react';
import { Check, Crown, Shirt, ShoppingBag } from 'lucide-react';
import Modal from '../../components/Modal';
import { ChickenArt, ItemArt, TableArt } from '../../components/CosmeticArt';
import { ShopItem, itemById } from '../../lib/data';
import { onSale } from '../../lib/shopLogic';
import { dropEndsAt } from '../../lib/cosmetics';
import { fmt } from '../../lib/format';
import { sfx } from '../../lib/sound';
import { toast, useLevel, useStore } from '../../store';
import { Coin } from '../../components/Icons';
import { ItemBadges, Price, RARITY_COLOR, SHOWS, UnlockBurst, fmtLeft, useItemState } from './common';

/**
 * The big look at one item: spotlight stage, try-on with what you're
 * wearing, where it shows up in game, and a two-tap buy that ends in an
 * unlock burst and an "Equip now" button.
 */
export default function ItemSheet({ it, onClose, onOpenItem }: { it: ShopItem | null; onClose: () => void; onOpenItem?: (it: ShopItem) => void }) {
  return (
    <Modal open={!!it} onClose={onClose} title={it ? <span className="flex items-center gap-2"><ShoppingBag size={18} className="text-gold" />{it.name}</span> : ''} wide>
      {it && <Sheet key={it.id} it={it} onClose={onClose} onOpenItem={onOpenItem} />}
    </Modal>
  );
}

function Sheet({ it, onClose, onOpenItem }: { it: ShopItem; onClose: () => void; onOpenItem?: (it: ShopItem) => void }) {
  const { owned, equipped, price, sp, vipTier } = useItemState(it);
  const balance = useStore((s) => s.balance);
  const eggs = useStore((s) => s.eggs);
  const eq = useStore((s) => s.equipped);
  const { level } = useLevel();
  const [arming, setArming] = useState(false);
  const [justBought, setJustBought] = useState(false);
  const [shake, setShake] = useState(false);
  const [now, setNow] = useState(Date.now());
  const col = RARITY_COLOR[it.rarity];
  const have = it.currency === 'eggs' ? eggs : balance;
  const short = Math.max(0, price - have);
  const sale = onSale(it, now);
  useEffect(() => { if (!it.limited) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [it.limited]);
  useEffect(() => { if (!arming) return; const t = setTimeout(() => setArming(false), 3500); return () => clearTimeout(t); }, [arming]);

  const buy = () => {
    if (short > 0) { setShake(true); sfx.lose(); setTimeout(() => setShake(false), 500); return; }
    if (!arming) { setArming(true); sfx.click(); return; }
    const err = useStore.getState().buy(it.id);
    setArming(false);
    if (err) { toast({ title: err, tone: 'red' }); return; }
    sfx.cashout(); setTimeout(() => sfx.win(), 180);
    setJustBought(true);
  };
  const claim = () => {
    const err = useStore.getState().claimVip(it.id);
    if (err) { toast({ title: err, tone: 'red' }); return; }
    sfx.win(); setJustBought(true);
  };
  const equip = (id = it.id) => { useStore.getState().equip(id); sfx.click(); toast({ title: `${itemById(id)?.name} equipped`, tone: 'gold' }); };
  const equipSet = () => { (it.contains ?? []).forEach((id) => useStore.getState().equip(id)); sfx.click(); toast({ title: `${it.name} equipped`, tone: 'gold' }); onClose(); };

  const canTry = it.kind === 'chicken' || it.kind === 'hat' || it.kind === 'table' || it.kind === 'chips' || it.kind === 'deck';

  return (
    <div className="grid gap-5 md:grid-cols-[1.1fr_1fr]">
      {/* stage */}
      <div className="relative grid min-h-[260px] place-items-center overflow-hidden rounded-3xl border border-white/10"
        style={{ background: `radial-gradient(circle at 50% 70%, ${col}40, transparent 60%), linear-gradient(180deg,#1d1d25,#0e0e12)` }}>
        <div className="rays pointer-events-none absolute left-1/2 top-1/2 h-[200%] w-[200%] -translate-x-1/2 -translate-y-1/2 opacity-30"
          style={{ background: `repeating-conic-gradient(from 0deg, ${col}55 0deg 6deg, transparent 6deg 20deg)`, animation: 'winfx-spin 40s linear infinite', maskImage: 'radial-gradient(circle, black 10%, transparent 50%)', WebkitMaskImage: 'radial-gradient(circle, black 10%, transparent 50%)' }} />
        <div className="pointer-events-none absolute bottom-6 left-1/2 h-6 w-2/3 -translate-x-1/2 rounded-[50%] bg-black/50 blur-md" />
        <div className={`cos-live relative ${justBought ? 'shop-unlock-pop' : 'shop-stage-in'}`}>
          {it.kind === 'chips' || it.kind === 'deck' ? (
            <div className="flex flex-col items-center gap-2">
              <ItemArt it={it} size={190} />
              <div className="opacity-90"><TableArt table={eq.table} chips={it.kind === 'chips' ? it.id : eq.chips} deck={it.kind === 'deck' ? it.id : eq.deck} size={180} /></div>
            </div>
          ) : <ItemArt it={it} size={it.kind === 'table' || it.kind === 'set' ? 220 : 230} />}
        </div>
        {justBought && <UnlockBurst color={col} />}
        {justBought && <div className="shop-stamp absolute top-4 rounded-xl border-2 px-3 py-1 font-display text-lg font-black tracking-widest" style={{ borderColor: col, color: col, background: 'rgba(0,0,0,.65)' }}>UNLOCKED!</div>}
        {canTry && !justBought && <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-cream/80"><Shirt size={11} />Shown with what you’re wearing</div>}
      </div>

      {/* details */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="font-display text-[11px] font-black uppercase tracking-[.25em]" style={{ color: col }}>{it.rarity}</span>
          <ItemBadges it={it} owned={owned} equipped={equipped} />
        </div>
        <h3 className="mt-1 font-display text-2xl font-black leading-tight">{it.name}</h3>
        <p className="mt-1 text-sm text-cream/75">{it.desc}</p>
        {SHOWS[it.kind] && <p className="mt-3 rounded-xl bg-white/[0.04] p-3 text-xs text-smoke"><b className="text-cream">Where it shows · </b>{SHOWS[it.kind]}</p>}

        {sp && (
          <div className="mt-3 space-y-1.5">
            <div className="label">What’s inside</div>
            {sp.items.map((x) => {
              const mine = useStore.getState().inventory.includes(x.id);
              return (
                <button key={x.id} type="button" onClick={() => onOpenItem?.(x)} className="flex w-full items-center gap-3 rounded-xl bg-white/[0.04] px-2 py-1.5 text-left transition hover:bg-white/[0.08]">
                  <span className="grid h-10 w-10 place-items-center overflow-hidden"><ItemArt it={x} size={42} /></span>
                  <span className="flex-1 truncate text-sm font-semibold">{x.name}</span>
                  {mine ? <span className="flex items-center gap-1 text-xs font-bold text-emerald-400"><Check size={12} />Owned</span> : <span className="text-xs text-smoke tabular">{fmt(x.price, 0)}</span>}
                </button>
              );
            })}
            {it.coins ? <div className="flex items-center gap-3 rounded-xl bg-gold/10 px-2 py-1.5 text-sm font-bold text-gold"><Coin className="h-8 w-8" />+{fmt(it.coins, 0)} coins</div> : null}
            {sp.missing.length < sp.items.length && !sp.complete && <p className="text-[11px] text-smoke">Price lowered for the items you already own.</p>}
          </div>
        )}

        {it.limited && (
          <div className={`mt-3 flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${sale ? 'border-blood/50 bg-blood/10' : 'border-white/10 bg-white/[0.04]'}`}>
            <span className="font-bold">{sale ? '🔥 Hot Drop ends in' : 'This drop has ended'}</span>
            {sale && <span className="font-display font-black tabular text-blood">{fmtLeft(dropEndsAt(now) - now)}</span>}
          </div>
        )}

        <div className="mt-auto pt-5">
          {justBought && it.kind === 'bundle' ? (
            <button className="btn-gold w-full py-3" onClick={onClose}>+{fmt(it.coins ?? 0, 0)} coins added · Keep shopping</button>
          ) : justBought ? (
            <div className="grid grid-cols-2 gap-2">
              {it.kind === 'set'
                ? <button className="btn-gold py-3" onClick={equipSet}><Shirt size={16} />Equip all</button>
                : <button className="btn-gold py-3" onClick={() => { equip(); onClose(); }}><Shirt size={16} />Equip now</button>}
              <button className="btn-ghost py-3" onClick={onClose}>Keep shopping</button>
            </div>
          ) : owned ? (
            it.kind === 'set'
              ? <button className="btn-gold w-full py-3" onClick={equipSet}><Shirt size={16} />Equip the whole set</button>
              : <button className={`w-full py-3 ${equipped ? 'btn-dark' : 'btn-gold'}`} disabled={equipped} onClick={() => equip()}>{equipped ? <><Check size={16} />Equipped</> : <><Shirt size={16} />Equip</>}</button>
          ) : it.vip ? (
            level >= (vipTier?.level ?? 99)
              ? <button className="btn-gold w-full py-3" onClick={claim}><Crown size={16} />Claim free · {vipTier?.name}</button>
              : <div className="rounded-xl bg-white/[0.04] p-3 text-center text-sm"><Crown size={16} className="mx-auto mb-1 text-gold" />Reach <b>level {vipTier?.level}</b> ({vipTier?.name}) to claim this free. You’re level {level}.</div>
          ) : !sale ? (
            <button className="btn-dark w-full py-3" disabled>Drop ended — check back next week</button>
          ) : (
            <div className={shake ? 'animate-shake' : ''}>
              <button className={`w-full py-3 text-base ${short > 0 ? 'btn-dark' : arming ? 'btn-red' : 'btn-gold'} ${arming ? 'shop-arm' : ''}`} onClick={buy}>
                {short > 0 ? <>Need {fmt(short, 0)} more {it.currency === 'eggs' ? 'golden eggs' : 'coins'}</> : arming ? <>Tap again to confirm · <Price it={it} price={price} /></> : <>Buy · <Price it={it} price={price} /></>}
              </button>
              <div className="mt-2 text-center text-[11px] text-smoke">You have <Price it={it} price={have} className="text-cream" /></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Quick chicken+hat composite, used by the locker stage. */
export const Wearing = ({ size = 200 }: { size?: number }) => {
  const eq = useStore((s) => s.equipped);
  return <ChickenArt skin={eq.chicken} hat={eq.hat} size={size} />;
};
