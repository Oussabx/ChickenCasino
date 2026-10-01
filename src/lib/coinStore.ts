/** The coin store: real-money packs of coins, golden eggs, and skin + coin bundles. */

export type ProductKind = 'coins' | 'eggs' | 'bundle';
export interface Product {
  id: string;
  kind: ProductKind;
  name: string;
  usd: number;
  coins?: number;
  eggs?: number;
  /** Shop item ids included (bundles). */
  items?: string[];
  /** % extra over the base rate, shown as a badge. */
  bonus?: number;
  tag?: 'popular' | 'best' | 'limited';
  /** Bundles can be bought once per account. */
  once?: boolean;
  blurb?: string;
}

export const PRODUCTS: Product[] = [
  // coins — base rate 100,000 coins per $0.99
  { id: 'cp-1', kind: 'coins', name: 'Handful of Feed', usd: 0.99, coins: 100_000 },
  { id: 'cp-2', kind: 'coins', name: 'Bag of Grain', usd: 4.99, coins: 600_000, bonus: 20 },
  { id: 'cp-3', kind: 'coins', name: 'Barn Stack', usd: 9.99, coins: 1_500_000, bonus: 50, tag: 'popular' },
  { id: 'cp-4', kind: 'coins', name: 'Golden Silo', usd: 19.99, coins: 4_000_000, bonus: 100 },
  { id: 'cp-5', kind: 'coins', name: 'Coop Vault', usd: 49.99, coins: 12_000_000, bonus: 140, tag: 'best' },
  { id: 'cp-6', kind: 'coins', name: 'Rooster Reserve', usd: 99.99, coins: 30_000_000, bonus: 200 },
  // golden eggs — base rate 50 eggs per $0.99
  { id: 'ep-1', kind: 'eggs', name: 'Nest of Eggs', usd: 0.99, eggs: 50 },
  { id: 'ep-2', kind: 'eggs', name: 'Egg Carton', usd: 4.99, eggs: 300, bonus: 20 },
  { id: 'ep-3', kind: 'eggs', name: 'Egg Crate', usd: 9.99, eggs: 700, bonus: 40, tag: 'popular' },
  { id: 'ep-4', kind: 'eggs', name: 'Golden Basket', usd: 19.99, eggs: 1_600, bonus: 60 },
  { id: 'ep-5', kind: 'eggs', name: 'Hen House', usd: 49.99, eggs: 4_500, bonus: 80, tag: 'best' },
  // skin + coin bundles (once per account)
  { id: 'sb-starter', kind: 'bundle', name: 'Golden Starter', usd: 2.99, coins: 250_000, items: ['ch-golden', 'cp-gold'], once: true, tag: 'limited', blurb: 'Golden Chicken + Gold Chicken Chips + 250K coins. One per account.' },
  { id: 'sb-highroller', kind: 'bundle', name: 'High Roller Pack', usd: 14.99, coins: 2_000_000, eggs: 100, items: ['ch-mafia', 'hat-top', 'tb-blackgold'], once: true, blurb: 'Mafia Chicken, Top Hat, Black & Gold table + 2M coins + 100 eggs.' },
  { id: 'sb-phoenix', kind: 'bundle', name: 'Phoenix Pack', usd: 29.99, coins: 5_000_000, items: ['ch-phoenix', 'fx-inferno'], once: true, tag: 'popular', blurb: 'Mythic Phoenix Rooster + Inferno win show + 5M coins.' },
  { id: 'sb-legend', kind: 'bundle', name: '24K Legend Pack', usd: 79.99, coins: 20_000_000, eggs: 1_000, items: ['ch-24k', 'hat-diamondcrown', 'tb-billionaire'], once: true, tag: 'best', blurb: '24K Solid Gold Rooster, Diamond Crown, Billionaire Table + 20M coins + 1,000 eggs.' },
];

export const productById = (id: string) => PRODUCTS.find((p) => p.id === id);

export interface Order { id: string; product: string; name: string; usd: number; card: string; at: number }
