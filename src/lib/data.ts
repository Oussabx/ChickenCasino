export type GameId = 'plinko' | 'crash' | 'chicken-cross' | 'egg-hunt' | 'cluck-dice' | 'golden-wheel';

export interface GameMeta {
  id: GameId;
  name: string;
  tagline: string;
  description: string;
  maxWin: string;
  accent: string; // tailwind gradient classes
  tags: string[];
  hot?: boolean;
  isNew?: boolean;
}

export const GAMES: GameMeta[] = [
  {
    id: 'chicken-cross',
    name: 'Chicken Cross',
    tagline: 'Why did the chicken cross the road?',
    description: 'Hop lane by lane across a busy highway. Every lane you survive pumps the multiplier — cash out before you become nuggets.',
    maxWin: '2,100×',
    accent: 'from-amber-500/30 via-blood/20 to-ink-800',
    tags: ['Original', 'Risk ladder'],
    hot: true,
  },
  {
    id: 'crash',
    name: 'Rocket Rooster',
    tagline: 'Ride the rooster to the moon',
    description: 'A multiplayer crash game. The rooster climbs, the multiplier climbs — hit cash out before he gets fried.',
    maxWin: '10,000×',
    accent: 'from-blood/40 via-orange-600/20 to-ink-800',
    tags: ['Multiplayer', 'Crash'],
    hot: true,
  },
  {
    id: 'plinko',
    name: 'Plinko Coop',
    tagline: 'Drop the egg. Pray.',
    description: 'Drop golden eggs through the peg coop. Choose rows and risk, then watch them bounce into multipliers up to 1000×.',
    maxWin: '1,000×',
    accent: 'from-gold/30 via-amber-700/20 to-ink-800',
    tags: ['Classic', 'Auto-drop'],
  },
  {
    id: 'egg-hunt',
    name: 'Egg Hunt',
    tagline: 'Find eggs. Dodge foxes.',
    description: 'A 5×5 henhouse hides golden eggs and sneaky foxes. Pick nests, stack multipliers and bail before the fox bites.',
    maxWin: '24,750×',
    accent: 'from-emerald-500/25 via-gold/10 to-ink-800',
    tags: ['Mines', 'Strategy'],
    isNew: true,
  },
  {
    id: 'cluck-dice',
    name: 'Cluck Dice',
    tagline: 'Set your odds, roll the egg',
    description: 'Slide your win chance anywhere from 2% to 98%. Roll over or under — lightning fast with auto-bet.',
    maxWin: '9,900×',
    accent: 'from-sky-500/25 via-blood/10 to-ink-800',
    tags: ['Dice', 'Fast'],
  },
  {
    id: 'golden-wheel',
    name: 'Golden Wheel',
    tagline: 'Spin the barnyard fortune',
    description: 'A neon wheel of fortune with three risk profiles. Low risk keeps you pecking, high risk hunts the 29.7× golden slice.',
    maxWin: '29.70×',
    accent: 'from-fuchsia-500/25 via-gold/10 to-ink-800',
    tags: ['Wheel', 'Chill'],
    isNew: true,
  },
];

export const gameById = (id: string) => GAMES.find((g) => g.id === id);

/* ---------------- Shop ---------------- */
export type ItemKind = 'avatar' | 'frame' | 'skin' | 'ball' | 'title' | 'bundle';

export interface ShopItem {
  id: string;
  kind: ItemKind;
  name: string;
  desc: string;
  price: number;
  currency: 'coins' | 'eggs';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  img?: string;
  color?: string;
  coins?: number; // for bundles
  minLevel?: number;
}

export const SHOP: ShopItem[] = [
  // bundles (eggs -> coins)
  { id: 'b-small', kind: 'bundle', name: 'Handful of Feed', desc: '5,000 coins', price: 5, currency: 'eggs', rarity: 'common', coins: 5000 },
  { id: 'b-med', kind: 'bundle', name: 'Sack of Grain', desc: '25,000 coins +10% bonus', price: 22, currency: 'eggs', rarity: 'rare', coins: 27500 },
  { id: 'b-large', kind: 'bundle', name: 'Barn Full of Gold', desc: '100,000 coins +25% bonus', price: 80, currency: 'eggs', rarity: 'epic', coins: 125000 },
  { id: 'b-mega', kind: 'bundle', name: 'Golden Coop Vault', desc: '500,000 coins +50% bonus', price: 350, currency: 'eggs', rarity: 'legendary', coins: 750000 },
  // avatars
  { id: 'av-classic', kind: 'avatar', name: 'The Classic', desc: 'Where it all started.', price: 0, currency: 'coins', rarity: 'common', img: 'head.webp' },
  { id: 'av-dealer', kind: 'avatar', name: 'Card Shark', desc: 'Never shows his hand.', price: 15000, currency: 'coins', rarity: 'rare', img: 'bonus-chicken.webp' },
  { id: 'av-boss', kind: 'avatar', name: 'The Boss', desc: 'Sunglasses indoors. Always.', price: 40000, currency: 'coins', rarity: 'epic', img: 'mood-face.webp' },
  { id: 'av-highroller', kind: 'avatar', name: 'High Roller', desc: 'Chips stacked sky-high.', price: 60, currency: 'eggs', rarity: 'epic', img: 'phone-chicken.webp' },
  { id: 'av-don', kind: 'avatar', name: 'Don Cluckleone', desc: 'An offer you can’t refuse.', price: 150, currency: 'eggs', rarity: 'legendary', img: 'hero.webp', minLevel: 5 },
  { id: 'av-crown', kind: 'avatar', name: 'Neon Crown', desc: 'Royalty of the roost.', price: 25000, currency: 'coins', rarity: 'rare', img: 'mood-crown.webp' },
  { id: 'av-ace', kind: 'avatar', name: 'Ace of Spades', desc: 'The card that pays.', price: 10000, currency: 'coins', rarity: 'common', img: 'mood-ace.webp' },
  // frames
  { id: 'fr-none', kind: 'frame', name: 'No Frame', desc: 'Clean and simple.', price: 0, currency: 'coins', rarity: 'common', color: 'ring-white/10' },
  { id: 'fr-gold', kind: 'frame', name: 'Gold Ring', desc: 'Shine on.', price: 20000, currency: 'coins', rarity: 'rare', color: 'ring-gold shadow-gold' },
  { id: 'fr-neon', kind: 'frame', name: 'Neon Red', desc: 'Straight off the Vegas strip.', price: 35000, currency: 'coins', rarity: 'epic', color: 'ring-blood shadow-red' },
  { id: 'fr-legend', kind: 'frame', name: 'Legend Aura', desc: 'Only the realest roosters.', price: 120, currency: 'eggs', rarity: 'legendary', color: 'ring-gold ring-offset-2 ring-offset-blood shadow-gold', minLevel: 8 },
  // chicken skins (Chicken Cross)
  { id: 'sk-classic', kind: 'skin', name: 'Classic Cluck', desc: 'Chicken Cross runner.', price: 0, currency: 'coins', rarity: 'common', color: '#F8F6EF' },
  { id: 'sk-golden', kind: 'skin', name: 'Golden Goose', desc: 'Literally made of money.', price: 50000, currency: 'coins', rarity: 'epic', color: '#F4C430' },
  { id: 'sk-ninja', kind: 'skin', name: 'Ninja Nugget', desc: 'Dodges cars silently.', price: 30000, currency: 'coins', rarity: 'rare', color: '#2A2A2A' },
  { id: 'sk-fire', kind: 'skin', name: 'Hot Wings', desc: 'Spicy on the road.', price: 90, currency: 'eggs', rarity: 'legendary', color: '#E63946' },
  // plinko balls
  { id: 'bl-gold', kind: 'ball', name: 'Golden Egg', desc: 'Default Plinko drop.', price: 0, currency: 'coins', rarity: 'common', color: '#F4C430' },
  { id: 'bl-red', kind: 'ball', name: 'Hot Chip', desc: 'A red poker chip drop.', price: 12000, currency: 'coins', rarity: 'rare', color: '#E63946' },
  { id: 'bl-cream', kind: 'ball', name: 'Farm Fresh', desc: 'Straight from the nest.', price: 8000, currency: 'coins', rarity: 'common', color: '#F8F6EF' },
  { id: 'bl-neon', kind: 'ball', name: 'Neon Pulse', desc: 'Glows as it falls.', price: 40, currency: 'eggs', rarity: 'epic', color: '#22D3EE' },
  // titles
  { id: 'tt-none', kind: 'title', name: 'Rookie', desc: 'Everybody starts somewhere.', price: 0, currency: 'coins', rarity: 'common' },
  { id: 'tt-hunter', kind: 'title', name: 'Egg Hunter', desc: 'Show it off in the lobby.', price: 15000, currency: 'coins', rarity: 'rare' },
  { id: 'tt-roller', kind: 'title', name: 'High Roller', desc: 'Big bets only.', price: 75000, currency: 'coins', rarity: 'epic' },
  { id: 'tt-king', kind: 'title', name: 'King of the Coop', desc: 'Bow down.', price: 200, currency: 'eggs', rarity: 'legendary', minLevel: 10 },
];

export const itemById = (id: string) => SHOP.find((i) => i.id === id);

export const RARITY_STYLE: Record<ShopItem['rarity'], string> = {
  common: 'text-smoke border-white/10',
  rare: 'text-sky-300 border-sky-400/30',
  epic: 'text-fuchsia-300 border-fuchsia-400/30',
  legendary: 'text-gold border-gold/40',
};

/* ---------------- VIP ---------------- */
export interface Tier { name: string; minLevel: number; color: string; rakeback: number; perks: string[] }
export const TIERS: Tier[] = [
  { name: 'Chick', minLevel: 1, color: '#A0A0A0', rakeback: 0.5, perks: ['Daily rewards', 'Weekly missions'] },
  { name: 'Hen', minLevel: 5, color: '#CD7F32', rakeback: 1, perks: ['1% rakeback', 'Bronze badge', 'Level-up eggs x2'] },
  { name: 'Rooster', minLevel: 10, color: '#E63946', rakeback: 2, perks: ['2% rakeback', 'Exclusive tournaments', 'Priority promos'] },
  { name: 'Golden Rooster', minLevel: 20, color: '#F4C430', rakeback: 3.5, perks: ['3.5% rakeback', 'Golden profile flair', 'Monthly egg drop'] },
  { name: 'Legend of the Coop', minLevel: 35, color: '#22D3EE', rakeback: 5, perks: ['5% rakeback', 'Personal host (a rooster)', 'All the above, but shinier'] },
];

export const xpForLevel = (lvl: number) => Math.round(100 * Math.pow(lvl - 1, 1.6) * 10);
export const levelFromXp = (xp: number) => {
  let l = 1;
  while (xpForLevel(l + 1) <= xp) l++;
  return l;
};
export const tierForLevel = (lvl: number) => [...TIERS].reverse().find((t) => lvl >= t.minLevel)!;

/* ---------------- Promo codes ---------------- */
export const PROMO_CODES: Record<string, { coins?: number; eggs?: number; label: string }> = {
  CLUCK: { coins: 2500, label: '2,500 coins' },
  GOLDENEGG: { eggs: 10, label: '10 golden eggs' },
  WINBIGGER: { coins: 10000, label: '10,000 coins' },
};

/* ---------------- Daily ---------------- */
export const DAILY_REWARDS = [
  { coins: 1000 }, { coins: 1500 }, { coins: 2000, eggs: 1 }, { coins: 3000 }, { coins: 4000, eggs: 2 }, { coins: 5000 }, { coins: 10000, eggs: 5 },
];

/* ---------------- Bots ---------------- */
export const BOT_NAMES = [
  'LuckyPlayer23', 'ChickenKing', 'SlotsQueen', 'EggBenedict', 'CluckNorris', 'HenSolo', 'Nuggetz', 'FeatherFury',
  'RoosterCogburn', 'YolkoOno', 'PeckPocket', 'BokBokBoss', 'WingDingo', 'CoopDeVille', 'DrumstickDan', 'OmeletteYou',
  'ScrambledLegs', 'PoultryGeist', 'EggsQuisite', 'Brood Pitt', 'Chick Jagger', 'SunnySideUp', 'HashBrownHero', 'GoldenYolk',
];
