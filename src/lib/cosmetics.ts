/**
 * Chicken Casino cosmetics: how every collectible looks. Shop items in
 * data.ts point at these by id; games and the shop art both read them.
 * Cosmetic only — nothing here changes odds or payouts.
 */

// ---------------- chickens ----------------
export type Outfit = 'none' | 'suit' | 'tux' | 'cowboy' | 'space' | 'robe' | 'armor' | 'cyber' | 'bones' | 'pirate' | 'zombie' | 'lava' | 'frost' | 'ninja' | 'disco';
export type Eyes = 'shades' | 'eye' | 'visor' | 'skull' | 'patch' | 'mask' | 'stars';
export interface ChickenStyle {
  body: [string, string];   // gradient light → dark
  belly: string;
  wing: string;
  comb: string;
  beak: string;
  legs: string;
  eyes: Eyes;
  outfit: Outfit;
  accent?: string;          // tie, trims, glow lines
  sparkle?: string;         // twinkling stars
  glow?: string;            // aura
  facets?: boolean;         // diamond cut
}
const base = { belly: '#ffffff', comb: '#E63946', beak: '#F6A623', legs: '#F6A623', eyes: 'shades' as Eyes, outfit: 'none' as Outfit };
export const CHICKENS: Record<string, ChickenStyle> = {
  'ch-classic': { ...base, body: ['#ffffff', '#e9e3d4'], wing: '#ebe4d2' },
  'ch-golden': { ...base, body: ['#fff1a8', '#d99a00'], belly: '#ffe680', wing: '#e3a700', comb: '#ff6b2c', sparkle: '#fff8d6', glow: 'rgba(244,196,48,.55)' },
  'ch-diamond': { ...base, body: ['#e9fbff', '#5fc9e8'], belly: '#d9f6ff', wing: '#8fdcf2', comb: '#6ee7ff', beak: '#bfefff', legs: '#9ad8ea', sparkle: '#ffffff', glow: 'rgba(110,231,255,.6)', facets: true },
  'ch-mafia': { ...base, body: ['#f2f0ea', '#cfc9bb'], wing: '#d7d1c2', outfit: 'suit', accent: '#b3192a' },
  'ch-cowboy': { ...base, body: ['#ffffff', '#e2d6bd'], wing: '#d8c8a6', outfit: 'cowboy', accent: '#c21a2a' },
  'ch-astronaut': { ...base, body: ['#ffffff', '#e5e7eb'], wing: '#e6e7ea', eyes: 'eye', outfit: 'space', accent: '#2563eb' },
  'ch-king': { ...base, body: ['#ffffff', '#efe6d0'], wing: '#ece2c8', outfit: 'robe', accent: '#8e1b24', sparkle: '#ffe27a' },
  'ch-tuxedo': { ...base, body: ['#ffffff', '#e8e2d2'], wing: '#e3dccb', outfit: 'tux', accent: '#0b0b0b' },
  'ch-samurai': { ...base, body: ['#ffffff', '#e6dccb'], wing: '#ddd2bd', eyes: 'eye', outfit: 'armor', accent: '#b3192a' },
  'ch-cyber': { ...base, body: ['#3a3f58', '#151827'], belly: '#2a2f45', wing: '#232740', comb: '#ff2bd6', beak: '#22d3ee', legs: '#22d3ee', eyes: 'visor', outfit: 'cyber', accent: '#22d3ee', glow: 'rgba(34,211,238,.55)' },
  'ch-skeleton': { ...base, body: ['#2a2a2e', '#0d0d10'], belly: '#1a1a1e', wing: '#1c1c20', comb: '#8b8b8b', beak: '#d9d4c4', legs: '#d9d4c4', eyes: 'skull', outfit: 'bones', accent: '#f1ede1' },
  // limited drops
  'ch-golden-mafia': { ...base, body: ['#fff1a8', '#d99a00'], belly: '#ffe680', wing: '#e3a700', outfit: 'suit', accent: '#0b0b0b', sparkle: '#fff8d6', glow: 'rgba(244,196,48,.5)' },
  'ch-disco': { ...base, body: ['#f5d0fe', '#a855f7'], belly: '#fae8ff', wing: '#c084fc', comb: '#f472b6', eyes: 'stars', outfit: 'disco', sparkle: '#ffffff', glow: 'rgba(244,114,182,.5)' },
  'ch-zombie': { ...base, body: ['#b7e4a0', '#5c8f4a'], belly: '#cdeab9', wing: '#6e9e58', comb: '#7a1b1b', beak: '#c9a23a', legs: '#8a9a5b', eyes: 'eye', outfit: 'zombie', accent: '#3a2a1a' },
  'ch-pirate': { ...base, body: ['#ffffff', '#e6dccb'], wing: '#dccfb8', eyes: 'patch', outfit: 'pirate', accent: '#b3192a' },
  'ch-lava': { ...base, body: ['#3b1d16', '#130705'], belly: '#2a120c', wing: '#22100b', comb: '#ff7a1a', beak: '#ffb347', legs: '#ff7a1a', eyes: 'visor', outfit: 'lava', accent: '#ff7a1a', glow: 'rgba(255,122,26,.55)' },
  'ch-frost': { ...base, body: ['#ffffff', '#b9e3f5'], belly: '#ecf9ff', wing: '#a8d8ef', comb: '#7dd3fc', beak: '#c7ecff', legs: '#9cc9e0', eyes: 'eye', outfit: 'frost', sparkle: '#ffffff', glow: 'rgba(125,211,252,.5)' },
  'ch-ninja': { ...base, body: ['#2b2b30', '#0e0e12'], belly: '#1d1d22', wing: '#18181c', comb: '#b3192a', eyes: 'mask', outfit: 'ninja', accent: '#e63946' },
  // VIP
  'ch-vip': { ...base, body: ['#ffffff', '#a7adbb'], belly: '#f4f6fa', wing: '#c2c7d2', comb: '#e5e7eb', beak: '#f4c430', legs: '#cfd3dc', outfit: 'tux', accent: '#F4C430', sparkle: '#ffffff', glow: 'rgba(226,232,240,.6)' },
};

export type HatKind = 'none' | 'tophat' | 'crown' | 'cowboy' | 'chef' | 'viking' | 'santa' | 'headphones' | 'sombrero' | 'gradcap' | 'chain';
export const HATS: Record<string, HatKind> = {
  'hat-none': 'none', 'hat-top': 'tophat', 'hat-crown': 'crown', 'hat-cowboy': 'cowboy', 'hat-chef': 'chef', 'hat-viking': 'viking',
  'hat-santa': 'santa', 'hat-headphones': 'headphones', 'hat-sombrero': 'sombrero', 'hat-grad': 'gradcap', 'hat-chain': 'chain',
};

// ---------------- tables ----------------
export interface TableTheme {
  felt: number;      // main felt colour
  edge: number;      // darker felt toward the rail
  rail: number;      // padded rail
  trim: number;      // brass/neon trim
  ink: string;       // printing on the felt
  pattern?: 'stars' | 'grid' | 'chicken' | 'sparkle' | 'damask';
  glow?: number;     // neon edge glow
}
export const TABLES: Record<string, TableTheme> = {
  'tb-classic': { felt: 0x0e5a3a, edge: 0x07311f, rail: 0x2a1209, trim: 0xc9a227, ink: '#F4C430' },
  'tb-red': { felt: 0x8e1b24, edge: 0x45090f, rail: 0x1d0b07, trim: 0xc9a227, ink: '#F4C430' },
  'tb-royal': { felt: 0x5b0f2a, edge: 0x2a0513, rail: 0x1a0d05, trim: 0xf4c430, ink: '#FFE27A', pattern: 'damask' },
  'tb-neon': { felt: 0x12082a, edge: 0x05020e, rail: 0x0a0a12, trim: 0xff2bd6, ink: '#22D3EE', glow: 0xff2bd6, pattern: 'grid' },
  'tb-farm': { felt: 0x4f7d2a, edge: 0x2c4a14, rail: 0x7a5424, trim: 0xb88a3e, ink: '#FFF1C2', pattern: 'chicken' },
  'tb-diamond': { felt: 0x1c5f7a, edge: 0x0a2a38, rail: 0xdfe8ef, trim: 0xbfefff, ink: '#E9FBFF', pattern: 'sparkle', glow: 0x6ee7ff },
  'tb-blackgold': { felt: 0x111111, edge: 0x000000, rail: 0x0b0b0b, trim: 0xf4c430, ink: '#F4C430', pattern: 'damask' },
  'tb-cyber': { felt: 0x1b1340, edge: 0x07051a, rail: 0x111827, trim: 0x22d3ee, ink: '#F0ABFC', glow: 0x22d3ee, pattern: 'grid' },
  'tb-vip': { felt: 0x2d3340, edge: 0x11141b, rail: 0xc9ced8, trim: 0xf4c430, ink: '#F4C430', pattern: 'stars' },
};

// ---------------- chips ----------------
/** Colours by denomination: 1, 5, 25, 100, 500, 1000. */
export interface ChipTheme { colors: [string, string, string, string, string, string]; stripe: string; text: string; glow?: boolean; rainbow?: boolean }
export const CHIP_DENOMS = [1, 5, 25, 100, 500, 1000] as const;
export const CHIPSETS: Record<string, ChipTheme> = {
  'cp-classic': { colors: ['#F8F6EF', '#E63946', '#10B981', '#F4C430', '#1e1e1e', '#7C3AED'], stripe: '#F8F6EF', text: '#0B0B0B' },
  'cp-gold': { colors: ['#fff1a8', '#ffd84d', '#f4c430', '#d99a00', '#a86b00', '#7a4f00'], stripe: '#fff8d6', text: '#3a2600' },
  'cp-diamond': { colors: ['#f0fbff', '#c7ecff', '#8fdcf2', '#5fc9e8', '#2b9cc2', '#1b6f8f'], stripe: '#ffffff', text: '#0b3140' },
  'cp-egg': { colors: ['#fffaf0', '#f6ead2', '#efdcb6', '#e6c98f', '#d9b36a', '#c99a4b'], stripe: '#ffffff', text: '#5a3a12' },
  'cp-neon': { colors: ['#f0abfc', '#ff2bd6', '#22d3ee', '#a3e635', '#facc15', '#a855f7'], stripe: '#0b0b0b', text: '#0b0b0b', glow: true },
  'cp-blackgold': { colors: ['#2a2a2a', '#1e1e1e', '#151515', '#0f0f0f', '#0a0a0a', '#000000'], stripe: '#F4C430', text: '#F4C430' },
  'cp-money': { colors: ['#d1fae5', '#86efac', '#4ade80', '#16a34a', '#15803d', '#14532d'], stripe: '#fefce8', text: '#052e16' },
  'cp-rainbow': { colors: ['#f87171', '#fb923c', '#facc15', '#4ade80', '#38bdf8', '#a78bfa'], stripe: '#ffffff', text: '#0b0b0b', rainbow: true },
  'cp-vip': { colors: ['#f4f6fa', '#d7dbe3', '#b8bfcc', '#99a1b0', '#6b7280', '#374151'], stripe: '#F4C430', text: '#111827' },
};

// ---------------- card decks ----------------
export interface DeckTheme {
  back: [string, string];   // radial gradient centre → edge
  frame: string;            // card border colour
  pattern: 'lattice' | 'stripes' | 'circuit' | 'damask' | 'chicken' | 'pinstripe' | 'emoji' | 'sunburst';
  accent: string;           // pattern colour
  emblem: 'head' | 'crown' | 'fedora' | 'egg' | 'bolt' | 'laugh' | 'coin';
  paper: string;            // face colour
  red: string;
  black: string;
}
export const DECKS: Record<string, DeckTheme> = {
  'dk-classic': { back: ['#B3202E', '#5E0E17'], frame: '#FBF8EF', pattern: 'lattice', accent: 'rgba(244,196,48,.32)', emblem: 'head', paper: '#FFFFFF', red: '#C8102E', black: '#16120F' },
  'dk-chicken': { back: ['#ffd84d', '#d99a00'], frame: '#FFF8E1', pattern: 'chicken', accent: 'rgba(122,79,0,.35)', emblem: 'egg', paper: '#FFFDF5', red: '#C8102E', black: '#3a2600' },
  'dk-mafia': { back: ['#2a2a2a', '#050505'], frame: '#E9E4D6', pattern: 'pinstripe', accent: 'rgba(255,255,255,.12)', emblem: 'fedora', paper: '#F3EFE4', red: '#8E1B24', black: '#111111' },
  'dk-royal': { back: ['#3b1a78', '#160833'], frame: '#F4C430', pattern: 'damask', accent: 'rgba(244,196,48,.35)', emblem: 'crown', paper: '#FFFBEF', red: '#9F1239', black: '#1E1B4B' },
  'dk-neon': { back: ['#1a0b33', '#05020e'], frame: '#22D3EE', pattern: 'circuit', accent: 'rgba(255,43,214,.55)', emblem: 'bolt', paper: '#0f0a1f', red: '#FF2BD6', black: '#22D3EE' },
  'dk-meme': { back: ['#22c55e', '#0f6b33'], frame: '#FFFFFF', pattern: 'emoji', accent: 'rgba(255,255,255,.22)', emblem: 'laugh', paper: '#FFFFFF', red: '#DC2626', black: '#111827' },
  'dk-gold': { back: ['#fff1a8', '#a86b00'], frame: '#F4C430', pattern: 'sunburst', accent: 'rgba(255,255,255,.35)', emblem: 'coin', paper: '#FFF9E6', red: '#B45309', black: '#3a2600' },
  'dk-vip': { back: ['#e5e7eb', '#6b7280'], frame: '#F4C430', pattern: 'damask', accent: 'rgba(244,196,48,.4)', emblem: 'crown', paper: '#FFFFFF', red: '#B91C1C', black: '#111827' },
};

// ---------------- win shows ----------------
export const WIN_FX: Record<string, { name: string; rays: string; title: string; mascotCrown?: boolean }> = {
  'fx-classic': { name: 'Classic Gold', rays: 'rgba(244,196,48,.3)', title: 'text-gold-grad' },
  'fx-royal': { name: 'Royal Rooster', rays: 'rgba(168,85,247,.38)', title: 'text-gold-grad', mascotCrown: true },
};

// ---------------- VIP ladder ----------------
export interface VipTier { name: string; level: number; rewards: string[]; color: string }
export const VIP_TIERS: VipTier[] = [
  { name: 'VIP I', level: 2, rewards: ['cp-vip'], color: '#CD7F32' },
  { name: 'VIP II', level: 4, rewards: ['fr-vip', 'nm-gold'], color: '#C0C0C0' },
  { name: 'VIP III', level: 6, rewards: ['tb-vip'], color: '#F4C430' },
  { name: 'VIP IV', level: 9, rewards: ['ch-vip', 'dk-vip'], color: '#22D3EE' },
  { name: 'ROOSTER ELITE', level: 12, rewards: ['fx-royal', 'tt-elite'], color: '#E63946' },
];

// ---------------- hot drop ----------------
/** Limited items, one on sale per UTC day. */
export const DROP_POOL = ['ch-golden-mafia', 'ch-disco', 'ch-zombie', 'ch-pirate', 'ch-lava', 'ch-frost', 'ch-ninja'];
const DAY = 864e5;
export const dropIndex = (t = Date.now()) => Math.floor(t / DAY);
export const currentDrop = (t = Date.now()) => DROP_POOL[dropIndex(t) % DROP_POOL.length];
export const nextDrop = (t = Date.now()) => DROP_POOL[(dropIndex(t) + 1) % DROP_POOL.length];
export const dropEndsAt = (t = Date.now()) => (dropIndex(t) + 1) * DAY;

// ---------------- eggs ----------------
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export interface EggDef { id: string; name: string; price: number; desc: string; weights: Partial<Record<Rarity, number>>; shell: [string, string]; spots: string }
export const EGGS: EggDef[] = [
  { id: 'egg-basic', name: 'Basic Egg', price: 2000, desc: 'Common and rare cosmetics.', weights: { common: 75, rare: 25 }, shell: ['#fffaf0', '#e8d9b8'], spots: '#d9c49a' },
  { id: 'egg-golden', name: 'Golden Egg', price: 10000, desc: 'Mostly rare, a shot at epic and legendary.', weights: { rare: 60, epic: 35, legendary: 5 }, shell: ['#fff1a8', '#d99a00'], spots: '#fff8d6' },
  { id: 'egg-diamond', name: 'Diamond Egg', price: 50000, desc: 'Epic or legendary, guaranteed.', weights: { epic: 70, legendary: 30 }, shell: ['#e9fbff', '#5fc9e8'], spots: '#ffffff' },
  { id: 'egg-royal', name: 'Royal Egg', price: 250000, desc: 'A legendary item, guaranteed.', weights: { legendary: 100 }, shell: ['#c084fc', '#5b21b6'], spots: '#F4C430' },
];
