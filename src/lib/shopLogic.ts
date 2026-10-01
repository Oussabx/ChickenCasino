import { SHOP, ShopItem, coinValue, itemById } from './data';
import { EGGS, EggDef, Rarity, VIP_TIERS, currentDrop } from './cosmetics';

/** Bundles: 25% off whatever you don't own yet, plus half the bonus coins' value. */
export function setPrice(set: ShopItem, owned: string[]) {
  const items = (set.contains ?? []).map((id) => itemById(id)!).filter(Boolean);
  const missing = items.filter((i) => !owned.includes(i.id));
  const worth = items.reduce((a, i) => a + coinValue(i), 0) + (set.coins ?? 0);
  const price = Math.round((missing.reduce((a, i) => a + coinValue(i), 0) * 0.75 + (set.coins ?? 0) * 0.5) / 100) * 100;
  return { price, worth, missing, items, complete: missing.length === 0 };
}

/** The VIP tier an item is unlocked at (if it's a VIP reward). */
export const vipTierOf = (id: string) => VIP_TIERS.find((t) => t.rewards.includes(id)) ?? null;

/** Whether a limited item can be bought right now. */
export const onSale = (it: ShopItem, t = Date.now()) => !it.limited || currentDrop(t) === it.id;

/** Items an egg can hatch: sellable cosmetics you don't own yet. */
export function eggPool(egg: EggDef, owned: string[]) {
  const pool = SHOP.filter((i) => ['chicken', 'hat', 'table', 'chips', 'deck'].includes(i.kind) && i.price > 0 && !i.limited && !i.vip && !owned.includes(i.id));
  const byRarity: Partial<Record<Rarity, ShopItem[]>> = {};
  for (const r of Object.keys(egg.weights) as Rarity[]) byRarity[r] = pool.filter((i) => i.rarity === r);
  // odds renormalised over rarities that still have something new for you
  const live = (Object.keys(egg.weights) as Rarity[]).filter((r) => byRarity[r]!.length);
  const total = live.reduce((a, r) => a + egg.weights[r]!, 0);
  const odds = Object.fromEntries(live.map((r) => [r, egg.weights[r]! / total])) as Partial<Record<Rarity, number>>;
  return { byRarity, odds, empty: live.length === 0 };
}

export const eggById = (id: string) => EGGS.find((e) => e.id === id);
