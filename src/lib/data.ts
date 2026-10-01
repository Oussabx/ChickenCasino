export type GameId = 'plinko' | 'crash' | 'chicken-cross' | 'egg-hunt' | 'cluck-dice' | 'golden-wheel'
  | 'blackjack' | 'roulette' | 'baccarat' | 'punto-banco' | 'poker' | 'video-poker'
  | 'craps' | 'slots' | 'keno';

export interface GameMeta {
  id: GameId;
  name: string;
  tagline: string;
  description: string;
  maxWin: string;
  accent: string; // tailwind gradient classes
  tags: string[];
  /** 'original' = Chicken Casino originals; 'table' = classic casino table games; 'slots' = slots & keno */
  category?: 'original' | 'table' | 'slots';
  /** Theoretical return to player, shown in the rules. */
  rtp?: string;
  hot?: boolean;
  isNew?: boolean;
}

export const GAMES: GameMeta[] = [
  {
    id: 'chicken-cross',
    category: 'original',
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
    category: 'original',
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
    category: 'original',
    name: 'Plinko Coop',
    tagline: 'Drop the egg. Pray.',
    description: 'Drop golden eggs through the peg coop. Choose rows and risk, then watch them bounce into multipliers up to 1000×.',
    maxWin: '1,000×',
    accent: 'from-gold/30 via-amber-700/20 to-ink-800',
    tags: ['Classic', 'Auto-drop'],
  },
  {
    id: 'egg-hunt',
    category: 'original',
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
    category: 'original',
    name: 'Cluck Dice',
    tagline: 'Set your odds, roll the egg',
    description: 'Slide your win chance anywhere from 2% to 98%. Roll over or under — lightning fast with auto-bet.',
    maxWin: '9,900×',
    accent: 'from-sky-500/25 via-blood/10 to-ink-800',
    tags: ['Dice', 'Fast'],
  },
  {
    id: 'golden-wheel',
    category: 'original',
    name: 'Golden Wheel',
    tagline: 'Spin the barnyard fortune',
    description: 'A neon wheel of fortune with three risk profiles. Low risk keeps you pecking, high risk hunts the 29.7× golden slice.',
    maxWin: '29.70×',
    accent: 'from-fuchsia-500/25 via-gold/10 to-ink-800',
    tags: ['Wheel', 'Chill'],
    isNew: true,
  },
  {
    id: 'blackjack',
    name: 'Blackjack',
    tagline: 'Beat the dealer to 21',
    description: 'Six-deck blackjack on a 3D felt table. Hit, stand, double down or split pairs — blackjack pays 3 to 2 and the dealer stands on all 17s.',
    maxWin: '2.5×',
    accent: '',
    tags: ['Cards', 'Strategy'],
    category: 'table',
    hot: true,
  },
  {
    id: 'roulette',
    name: 'Roulette',
    tagline: 'Red, black or all in on 17',
    description: 'European single-zero roulette with a spinning 3D wheel. Bet on numbers, colours, odd/even, dozens or columns — a straight-up hit pays 35 to 1.',
    maxWin: '36×',
    accent: '',
    tags: ['Wheel', 'Classic'],
    category: 'table',
    isNew: true,
  },
  {
    id: 'baccarat',
    name: 'Baccarat',
    tagline: 'Player, Banker or Tie',
    description: 'Classic eight-deck baccarat with a slow card squeeze and a results road. Back the Player (1:1), the Banker (0.95:1) or a Tie (8:1).',
    maxWin: '9×',
    accent: '',
    tags: ['Cards', 'Classic'],
    category: 'table',
  },
  {
    id: 'punto-banco',
    name: 'Punto Banco',
    tagline: 'Speed baccarat with pair bets',
    description: 'The fast casino version of baccarat: quick deals, no squeeze, plus Player Pair and Banker Pair side bets paying 11 to 1.',
    maxWin: '12×',
    accent: '',
    tags: ['Cards', 'Fast'],
    category: 'table',
  },
  {
    id: 'poker',
    name: 'Texas Hold’em',
    tagline: 'No-limit poker, up to 8 players',
    description: 'Sit down with up to seven chicken bots while the croupier chicken deals. Blinds, pre-flop, flop, turn and river betting — check, call, bet, raise or go all-in, and take the pot at showdown.',
    maxWin: 'No limit',
    accent: '',
    tags: ['Poker', 'Strategy'],
    category: 'table',
    isNew: true,
  },
  {
    id: 'video-poker',
    name: '5 Card Poker',
    tagline: 'Draw poker — Jacks or Better',
    description: 'Five-card draw poker: hold the cards you like, draw the rest once. Pair of jacks or better pays, a royal flush pays 800×.',
    maxWin: '800×',
    accent: '',
    tags: ['Poker', 'Draw'],
    category: 'table',
  },
  {
    id: 'craps',
    name: 'Craps',
    tagline: 'Roll the bones in the coop',
    description: 'Las Vegas craps on a 3D table, with a rooster stickman calling the dice. Bet the Pass Line or Don’t Pass, take free odds at true payouts, press Come and Place bets, or go for the hardways and one-roll props.',
    maxWin: '31×',
    accent: '',
    tags: ['Dice', 'Classic'],
    category: 'table',
    rtp: '98.6% on the Pass Line · 100% on odds',
    isNew: true,
  },
  {
    id: 'slots',
    name: 'Golden Coop Slots',
    tagline: '5 reels, 20 lines, one golden rooster',
    description: 'A five-reel video slot with real spinning drums. The Golden Rooster is wild, three Coops trigger free spins with every win tripled, and five wild roosters pay 3,000× the line bet.',
    maxWin: '9,000×',
    accent: '',
    tags: ['Slots', 'Free spins'],
    category: 'slots',
    rtp: '95.2%',
    hot: true,
  },
  {
    id: 'keno',
    name: 'Coop Keno',
    tagline: 'Pick your nests, watch the eggs drop',
    description: 'Classic 80-number keno. Pick 1 to 10 nests, then the hen lays 20 numbered eggs. The more you catch, the more you win — ten out of ten pays 100,000×.',
    maxWin: '100,000×',
    accent: '',
    tags: ['Keno', 'Lottery'],
    category: 'slots',
    rtp: '≈ 95%',
    isNew: true,
  },
];

export const gameById = (id: string) => GAMES.find((g) => g.id === id);

/* ---------------- Shop ---------------- */
/**
 * 'bundle' = coin packs (golden eggs -> coins); 'set' = item bundles.
 * chicken/hat/table/chips/deck are the main collectibles (see lib/cosmetics.ts for their looks).
 */
export type ItemKind = 'avatar' | 'frame' | 'ball' | 'title' | 'bundle' | 'chicken' | 'hat' | 'table' | 'chips' | 'deck' | 'set' | 'fx' | 'name';

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
  coins?: number; // coin packs, and the coins inside an item bundle
  minLevel?: number;
  /** shop shelves */
  best?: boolean;
  fresh?: boolean;
  /** only sold while it's the Hot Drop */
  limited?: boolean;
  /** unlocked free on the Rooster VIP ladder, never sold */
  vip?: boolean;
  /** item bundles: what's inside */
  contains?: string[];
}

const C = (id: string, kind: ItemKind, name: string, desc: string, price: number, rarity: ShopItem['rarity'], extra: Partial<ShopItem> = {}): ShopItem =>
  ({ id, kind, name, desc, price, currency: 'coins', rarity, ...extra });

export const SHOP: ShopItem[] = [
  // ---- chickens (main collectibles) ----
  C('ch-classic', 'chicken', 'Classic Cluck', 'The original. Shades on, always.', 0, 'common'),
  C('ch-golden', 'chicken', 'Golden Chicken', 'Literally made of money. Glows a little.', 20000, 'rare', { best: true }),
  C('ch-cowboy', 'chicken', 'Cowboy Chicken', 'Vest, bandana, zero fear of the house.', 15000, 'rare'),
  C('ch-tuxedo', 'chicken', 'Chicken in a Tuxedo', 'Dressed for the high-roller table.', 22000, 'rare'),
  C('ch-skeleton', 'chicken', 'Skeleton Chicken', 'Bone dry. Still lucky.', 28000, 'rare'),
  C('ch-mafia', 'chicken', 'Mafia Chicken', 'Pinstripes and a red tie. An offer you can’t refuse.', 40000, 'epic', { best: true }),
  C('ch-astronaut', 'chicken', 'Astronaut Chicken', 'One small hop for a chicken.', 45000, 'epic'),
  C('ch-samurai', 'chicken', 'Samurai Chicken', 'Red lacquer armour, steady nerves.', 55000, 'epic', { fresh: true }),
  C('ch-cyber', 'chicken', 'Cyber Chicken', 'Neon circuits and a glowing visor.', 75, 'epic', { currency: 'eggs', fresh: true }),
  C('ch-king', 'chicken', 'King Chicken', 'Royal robe with ermine trim. Bow.', 90000, 'legendary'),
  C('ch-diamond', 'chicken', 'Diamond Chicken', 'Cut from a single diamond. Sparkles in the dark.', 150, 'legendary', { currency: 'eggs' }),
  // limited (Hot Drop rotation)
  C('ch-golden-mafia', 'chicken', 'Golden Mafia Chicken', 'Gold feathers, black suit. Limited edition.', 24500, 'legendary', { limited: true }),
  C('ch-disco', 'chicken', 'Disco Rooster', 'Mirror-ball feathers and star shades. Limited edition.', 30000, 'epic', { limited: true }),
  C('ch-zombie', 'chicken', 'Zombie Chicken', 'Stitched together, still hungry. Limited edition.', 26000, 'epic', { limited: true }),
  C('ch-pirate', 'chicken', 'Pirate Chicken', 'Eyepatch, bandana, stolen chips. Limited edition.', 22000, 'epic', { limited: true }),
  C('ch-lava', 'chicken', 'Lava Rooster', 'Glowing cracks of molten luck. Limited edition.', 35000, 'legendary', { limited: true }),
  C('ch-frost', 'chicken', 'Frost Chicken', 'Ice-cold under pressure. Limited edition.', 28000, 'epic', { limited: true }),
  C('ch-ninja', 'chicken', 'Ninja Rooster', 'Silent hops. Red headband. Limited edition.', 25000, 'epic', { limited: true }),
  C('ch-vip', 'chicken', 'Platinum Rooster', 'Rooster VIP IV reward.', 0, 'legendary', { vip: true }),

  // ---- hats ----
  C('hat-none', 'hat', 'No Hat', 'Let the comb breathe.', 0, 'common'),
  C('hat-chef', 'hat', 'Chef Hat', 'Cooking up wins, not nuggets.', 4000, 'common'),
  C('hat-santa', 'hat', 'Santa Hat', 'Ho ho hold ’em.', 5000, 'common'),
  C('hat-cowboy', 'hat', 'Cowboy Hat', 'Yeehaw at the high-limit table.', 6000, 'common'),
  C('hat-grad', 'hat', 'Graduation Cap', 'Masters in card counting (not really).', 6500, 'common'),
  C('hat-sombrero', 'hat', 'Sombrero', 'Shade for the hot streaks.', 7000, 'common'),
  C('hat-top', 'hat', 'Top Hat', 'Classic casino class.', 8000, 'rare'),
  C('hat-headphones', 'hat', 'Headphones', 'In the zone. Do not disturb.', 9000, 'rare', { fresh: true }),
  C('hat-viking', 'hat', 'Viking Helmet', 'Raid the jackpot.', 12000, 'rare'),
  C('hat-chain', 'hat', 'Gold Chain', 'Heavy. Shiny. Necessary.', 18000, 'epic'),
  C('hat-crown', 'hat', 'Crown', 'King of the coop.', 30000, 'legendary', { best: true }),

  // ---- tables ----
  C('tb-classic', 'table', 'Classic Green', 'The felt you know.', 0, 'common'),
  C('tb-red', 'table', 'Classic Red', 'Old-school casino red.', 10000, 'common'),
  C('tb-farm', 'table', 'Chicken Farm', 'Hay-bale rail and chicken-print felt.', 15000, 'rare'),
  C('tb-neon', 'table', 'Neon', 'Pink neon trim on midnight felt.', 25000, 'epic'),
  C('tb-royal', 'table', 'Royal Gold', 'Burgundy damask felt, gold everything.', 30000, 'epic', { best: true }),
  C('tb-blackgold', 'table', 'Black & Gold', 'All black, gold pinstripe.', 35000, 'epic'),
  C('tb-cyber', 'table', 'Cyberpunk', 'Purple grid felt, cyan glow.', 40000, 'epic', { fresh: true }),
  C('tb-diamond', 'table', 'Diamond', 'Ice-blue felt with a platinum rail.', 60000, 'legendary'),
  C('tb-vip', 'table', 'VIP Platinum Table', 'Rooster VIP III reward.', 0, 'legendary', { vip: true }),

  // ---- chips ----
  C('cp-classic', 'chips', 'Classic Chips', 'Standard casino colours.', 0, 'common'),
  C('cp-egg', 'chips', 'Egg Chips', 'Farm-fresh eggshell chips.', 8000, 'common'),
  C('cp-money', 'chips', 'Money Chips', 'Greenback greens.', 12000, 'rare'),
  C('cp-gold', 'chips', 'Gold Chicken Chips', 'Solid gold, every denomination.', 15000, 'rare', { best: true }),
  C('cp-rainbow', 'chips', 'Rainbow Chips', 'Every colour, every bet.', 18000, 'rare', { fresh: true }),
  C('cp-neon', 'chips', 'Neon Chips', 'They glow on the felt.', 20000, 'epic'),
  C('cp-blackgold', 'chips', 'Black & Gold Chips', 'Black chips, gold inlay.', 22000, 'epic'),
  C('cp-diamond', 'chips', 'Diamond Chips', 'Ice-blue and flawless.', 40000, 'legendary'),
  C('cp-vip', 'chips', 'VIP Chips', 'Rooster VIP I reward.', 0, 'epic', { vip: true }),

  // ---- card decks ----
  C('dk-classic', 'deck', 'Classic Deck', 'Red back, gold lattice.', 0, 'common'),
  C('dk-chicken', 'deck', 'Chicken Deck', 'Golden backs covered in chickens.', 10000, 'rare'),
  C('dk-meme', 'deck', 'Meme Deck', 'Laughing all the way to the bank.', 12000, 'rare', { fresh: true }),
  C('dk-mafia', 'deck', 'Mafia Deck', 'Pinstripe backs, fedora emblem.', 16000, 'epic'),
  C('dk-neon', 'deck', 'Neon Deck', 'Dark cards with neon suits.', 18000, 'epic', { best: true }),
  C('dk-royal', 'deck', 'Royal Deck', 'Purple and gold, fit for a king.', 25000, 'epic'),
  C('dk-gold', 'deck', 'Gold Deck', 'Gold backs, gold-tinted faces.', 30000, 'legendary'),
  C('dk-vip', 'deck', 'VIP Platinum Deck', 'Rooster VIP IV reward.', 0, 'legendary', { vip: true }),

  // ---- item bundles (price is worked out from what you don't own yet) ----
  C('set-rooster', 'set', 'Rooster Bundle', 'Go full gold.', 0, 'legendary', { contains: ['ch-golden', 'cp-gold', 'dk-gold', 'tb-royal'], coins: 50000 }),
  C('set-mafia', 'set', 'Mafia Bundle', 'Chicken, hat, table and chips — family business.', 0, 'epic', { contains: ['ch-mafia', 'hat-top', 'tb-blackgold', 'cp-blackgold'] }),
  C('set-royal', 'set', 'Royal Bundle', 'Long live the king.', 0, 'legendary', { contains: ['ch-king', 'hat-crown', 'tb-royal', 'dk-royal'] }),
  C('set-cyber', 'set', 'Cyber Bundle', 'Plug in.', 0, 'epic', { contains: ['ch-cyber', 'cp-neon', 'tb-cyber', 'dk-neon'] }),

  // ---- coin packs (eggs -> coins) ----
  { id: 'b-small', kind: 'bundle', name: 'Handful of Feed', desc: '5,000 coins', price: 5, currency: 'eggs', rarity: 'common', coins: 5000 },
  { id: 'b-med', kind: 'bundle', name: 'Sack of Grain', desc: '25,000 coins +10% bonus', price: 22, currency: 'eggs', rarity: 'rare', coins: 27500 },
  { id: 'b-large', kind: 'bundle', name: 'Barn Full of Gold', desc: '100,000 coins +25% bonus', price: 80, currency: 'eggs', rarity: 'epic', coins: 125000 },
  { id: 'b-mega', kind: 'bundle', name: 'Golden Coop Vault', desc: '500,000 coins +50% bonus', price: 350, currency: 'eggs', rarity: 'legendary', coins: 750000 },
  // ---- profile ----
  { id: 'av-classic', kind: 'avatar', name: 'The Classic', desc: 'Where it all started.', price: 0, currency: 'coins', rarity: 'common', img: 'head.webp' },
  { id: 'av-dealer', kind: 'avatar', name: 'Card Shark', desc: 'Never shows his hand.', price: 15000, currency: 'coins', rarity: 'rare', img: 'bonus-chicken.webp' },
  { id: 'av-boss', kind: 'avatar', name: 'The Boss', desc: 'Sunglasses indoors. Always.', price: 40000, currency: 'coins', rarity: 'epic', img: 'mood-face.webp' },
  { id: 'av-highroller', kind: 'avatar', name: 'High Roller', desc: 'Chips stacked sky-high.', price: 60, currency: 'eggs', rarity: 'epic', img: 'phone-chicken.webp' },
  { id: 'av-don', kind: 'avatar', name: 'Don Cluckleone', desc: 'An offer you can’t refuse.', price: 150, currency: 'eggs', rarity: 'legendary', img: 'hero.webp', minLevel: 5 },
  { id: 'av-crown', kind: 'avatar', name: 'Neon Crown', desc: 'Royalty of the roost.', price: 25000, currency: 'coins', rarity: 'rare', img: 'mood-crown.webp' },
  { id: 'av-ace', kind: 'avatar', name: 'Ace of Spades', desc: 'The card that pays.', price: 10000, currency: 'coins', rarity: 'common', img: 'mood-ace.webp' },
  { id: 'fr-none', kind: 'frame', name: 'No Frame', desc: 'Clean and simple.', price: 0, currency: 'coins', rarity: 'common', color: 'ring-white/10' },
  { id: 'fr-gold', kind: 'frame', name: 'Gold Ring', desc: 'Shine on.', price: 20000, currency: 'coins', rarity: 'rare', color: 'ring-gold shadow-gold' },
  { id: 'fr-neon', kind: 'frame', name: 'Neon Red', desc: 'Straight off the Vegas strip.', price: 35000, currency: 'coins', rarity: 'epic', color: 'ring-blood shadow-red' },
  { id: 'fr-legend', kind: 'frame', name: 'Legend Aura', desc: 'Only the realest roosters.', price: 120, currency: 'eggs', rarity: 'legendary', color: 'ring-gold ring-offset-2 ring-offset-blood shadow-gold', minLevel: 8 },
  { id: 'fr-vip', kind: 'frame', name: 'VIP Platinum Frame', desc: 'Rooster VIP II reward.', price: 0, currency: 'coins', rarity: 'epic', color: 'ring-slate-200 ring-offset-2 ring-offset-gold shadow-[0_0_18px_rgba(226,232,240,.6)]', vip: true },
  { id: 'bl-gold', kind: 'ball', name: 'Golden Egg', desc: 'Default Plinko drop.', price: 0, currency: 'coins', rarity: 'common', color: '#F4C430' },
  { id: 'bl-red', kind: 'ball', name: 'Hot Chip', desc: 'A red poker chip drop.', price: 12000, currency: 'coins', rarity: 'rare', color: '#E63946' },
  { id: 'bl-cream', kind: 'ball', name: 'Farm Fresh', desc: 'Straight from the nest.', price: 8000, currency: 'coins', rarity: 'common', color: '#F8F6EF' },
  { id: 'bl-neon', kind: 'ball', name: 'Neon Pulse', desc: 'Glows as it falls.', price: 40, currency: 'eggs', rarity: 'epic', color: '#22D3EE' },
  { id: 'tt-none', kind: 'title', name: 'Rookie', desc: 'Everybody starts somewhere.', price: 0, currency: 'coins', rarity: 'common' },
  { id: 'tt-hunter', kind: 'title', name: 'Egg Hunter', desc: 'Show it off in the lobby.', price: 15000, currency: 'coins', rarity: 'rare' },
  { id: 'tt-roller', kind: 'title', name: 'High Roller', desc: 'Big bets only.', price: 75000, currency: 'coins', rarity: 'epic' },
  { id: 'tt-king', kind: 'title', name: 'King of the Coop', desc: 'Bow down.', price: 200, currency: 'eggs', rarity: 'legendary', minLevel: 10 },
  { id: 'tt-elite', kind: 'title', name: 'Rooster Elite', desc: 'Rooster Elite reward.', price: 0, currency: 'coins', rarity: 'legendary', vip: true },
  // ---- VIP perks ----
  { id: 'fx-classic', kind: 'fx', name: 'Classic Gold Win', desc: 'The standard win show.', price: 0, currency: 'coins', rarity: 'common' },
  { id: 'fx-royal', kind: 'fx', name: 'Royal Rooster Win', desc: 'Purple-and-gold win show with a crowned rooster. Rooster Elite reward.', price: 0, currency: 'coins', rarity: 'legendary', vip: true },
  { id: 'nm-plain', kind: 'name', name: 'Standard Name', desc: 'Your name, plain and simple.', price: 0, currency: 'coins', rarity: 'common' },
  { id: 'nm-gold', kind: 'name', name: 'Golden Name', desc: 'Your name in gold across the site. Rooster VIP II reward.', price: 0, currency: 'coins', rarity: 'epic', vip: true },
];

/** Free starter cosmetics everyone owns. */
export const DEFAULT_ITEMS = ['av-classic', 'fr-none', 'bl-gold', 'tt-none', 'ch-classic', 'hat-none', 'tb-classic', 'cp-classic', 'dk-classic', 'fx-classic', 'nm-plain'];

/** Item prices in coins (golden eggs valued at 1,000 coins) — used to price bundles. */
export const coinValue = (it: ShopItem) => (it.currency === 'eggs' ? it.price * 1000 : it.price);

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
