import { CSSProperties, ReactNode, useMemo } from 'react';
import { Check, Crown, Flame, Lock, Sparkles, Star } from 'lucide-react';
import { ShopItem } from '../../lib/data';
import { fmt } from '../../lib/format';
import { Coin, Egg } from '../../components/Icons';
import { useStore } from '../../store';
import { setPrice, vipTierOf } from '../../lib/shopLogic';

export const RARITY_COLOR: Record<ShopItem['rarity'], string> = { common: '#A3A3A3', rare: '#38BDF8', epic: '#C084FC', legendary: '#F4C430', mythic: '#FF4D6D' };

/** Where a cosmetic shows up, for the item sheet. */
export const SHOWS: Partial<Record<ShopItem['kind'], string>> = {
  chicken: 'Your runner in Chicken Cross and Rocket Rooster, your Locker and profile.',
  hat: 'Worn by your chicken in Chicken Cross, Rocket Rooster and your Locker.',
  table: 'The felt and rail in Blackjack, Baccarat, Punto Banco, Texas Hold’em, 5 Card Poker and Craps.',
  chips: 'Every chip you bet with — Blackjack, Roulette, Baccarat, Craps, Poker and more.',
  deck: 'Card backs and faces in Blackjack, Baccarat, Punto Banco, Texas Hold’em and 5 Card Poker.',
  fx: 'The big-win show in every game.',
  name: 'Your name in the header and on your profile.',
  avatar: 'Your profile picture and poker seat.',
  frame: 'The ring around your avatar.',
  title: 'Shown under your name on your profile.',
  ball: 'The egg you drop in Plinko Coop.',
};

export function useItemState(it: ShopItem) {
  const owned = useStore((s) => s.inventory.includes(it.id));
  const equipped = useStore((s) => Object.values(s.equipped).includes(it.id));
  const inv = useStore((s) => s.inventory);
  const sp = useMemo(() => (it.kind === 'set' ? setPrice(it, inv) : null), [it, inv]);
  const price = sp ? sp.price : it.price;
  return { owned: it.kind === 'set' ? !!sp?.complete : owned, equipped, price, sp, vipTier: it.vip ? vipTierOf(it.id) : null };
}

export function Price({ it, price, className = '' }: { it: ShopItem; price?: number; className?: string }) {
  const p = price ?? it.price;
  return (
    <span className={`inline-flex items-center gap-1 font-display font-black tabular ${className}`}>
      {it.currency === 'eggs' ? <Egg className="h-4 w-4" /> : <Coin className="h-4 w-4" />}{p === 0 ? 'Free' : fmt(p, 0)}
    </span>
  );
}

export function Badge({ tone, children }: { tone: 'new' | 'hot' | 'limited' | 'vip' | 'owned' | 'equipped'; children: ReactNode }) {
  const map = {
    new: 'bg-sky-400 text-ink', hot: 'bg-blood text-white', limited: 'bg-gradient-to-r from-[#ff7a1a] to-blood text-white',
    vip: 'bg-gradient-to-r from-[#fff1a8] to-gold text-ink', owned: 'bg-emerald-500 text-ink', equipped: 'bg-gold text-ink',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-display text-[10px] font-black uppercase tracking-wider shadow ${map[tone]}`}>{children}</span>;
}

export function ItemBadges({ it, owned, equipped }: { it: ShopItem; owned: boolean; equipped: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      {equipped ? <Badge tone="equipped"><Check size={9} />Equipped</Badge> : owned ? <Badge tone="owned"><Check size={9} />Owned</Badge> : null}
      {it.limited && <Badge tone="limited"><Flame size={9} />Limited</Badge>}
      {it.vip && <Badge tone="vip"><Crown size={9} />VIP</Badge>}
      {it.best && !owned && <Badge tone="hot"><Star size={9} />Best seller</Badge>}
      {it.fresh && !owned && <Badge tone="new"><Sparkles size={9} />New</Badge>}
    </div>
  );
}

export const LockTag = ({ text }: { text: string }) => <span className="inline-flex items-center gap-1 text-xs font-bold text-smoke"><Lock size={12} />{text}</span>;

/** Coins and stars bursting out — played on unlocks. */
export function UnlockBurst({ color = '#F4C430', n = 26 }: { color?: string; n?: number }) {
  const parts = useMemo(() => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4, r = 90 + Math.random() * 90;
    return { i, x: Math.cos(a) * r, y: Math.sin(a) * r - 30, s: 8 + Math.random() * 10, star: i % 3 === 0, d: Math.random() * 0.1 };
  }), [n]);
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-0 w-0">
      {parts.map((p) => (
        <span key={p.i} className="absolute" style={{ '--x': `${p.x}px`, '--y': `${p.y}px`, animation: `winfx-burst 1.1s ${p.d}s cubic-bezier(.15,.7,.3,1) both` } as CSSProperties}>
          {p.star
            ? <svg width={p.s * 1.4} height={p.s * 1.4} viewBox="0 0 20 20"><path d="M10 0 L12.5 7.5 L20 10 L12.5 12.5 L10 20 L7.5 12.5 L0 10 L7.5 7.5Z" fill={color} /></svg>
            : <span className="winfx-coin" style={{ width: p.s, height: p.s }}><span className="winfx-coin-face" /></span>}
        </span>
      ))}
    </div>
  );
}

/** Live hh:mm:ss countdown. */
export function fmtLeft(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
