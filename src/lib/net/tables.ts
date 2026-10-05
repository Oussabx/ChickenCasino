import { TABLES, TableTheme } from '../cosmetics';

/** One live table. Buy-ins are 10–100 big blinds (poker) or minimum bets (blackjack). */
export interface LiveTable {
  id: string;
  game: 'poker' | 'blackjack' | 'roulette';
  name: string;
  tagline: string;
  themeId: string;
  theme: TableTheme;
  /** Poker: small/big blind. Blackjack: min/max bet. */
  lo: number;
  hi: number;
  buyMin: number;
  buyMax: number;
  seats: number;
  tier: number;
}

const POKER: [string, string, string][] = [
  ['Coop Corner', 'tb-farm', 'Where every legend starts'],
  ['Green Feather Club', 'tb-classic', 'The classic felt'],
  ['Red Rooster Room', 'tb-red', 'Hot seats, hotter pots'],
  ['Neon Nest', 'tb-neon', 'Late-night action'],
  ['Royal Roost', 'tb-royal', 'Velvet and crowns'],
  ['Cyber Coop', 'tb-cyber', 'Chips at light speed'],
  ['Diamond Hen House', 'tb-diamond', 'Ice-cold bluffs'],
  ['Inferno Lounge', 'tb-inferno', 'Only the brave'],
  ['Galaxy Grand', 'tb-galaxy', 'Stakes out of this world'],
  ['Billionaire’s Perch', 'tb-billionaire', 'The highest roost in the house'],
];
const BLACKJACK: [string, string, string][] = [
  ['Pecking Order', 'tb-farm', 'Friendly first hands'],
  ['Scramble Saloon', 'tb-classic', 'Classic six-deck shoe'],
  ['Hot Wings Hall', 'tb-red', 'Turn up the heat'],
  ['Neon Nugget', 'tb-neon', 'Glow-in-the-dark 21'],
  ['Crown & Comb', 'tb-royal', 'A royal shoe'],
  ['Circuit Clucker', 'tb-cyber', 'Hit me, robot'],
  ['Ice Diamond 21', 'tb-diamond', 'Cool heads only'],
  ['Phoenix Pit', 'tb-inferno', 'Rise from the ashes'],
  ['Starlight Shoe', 'tb-galaxy', 'Cosmic doubles'],
  ['The Golden Egg', 'tb-blackgold', 'Black and gold, high limits'],
];
/** Big blind (poker) / minimum bet (blackjack) for each of the ten tiers. */
const STAKE = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];

export const POKER_TABLES: LiveTable[] = POKER.map(([name, themeId, tagline], i) => ({
  id: `p${i + 1}`, game: 'poker', name, tagline, themeId, theme: TABLES[themeId],
  lo: STAKE[i] / 2, hi: STAKE[i], buyMin: STAKE[i] * 10, buyMax: STAKE[i] * 100, seats: 8, tier: i,
}));
export const BJ_TABLES: LiveTable[] = BLACKJACK.map(([name, themeId, tagline], i) => ({
  id: `b${i + 1}`, game: 'blackjack', name, tagline, themeId, theme: TABLES[themeId],
  lo: STAKE[i], hi: STAKE[i] * 10, buyMin: STAKE[i] * 10, buyMax: STAKE[i] * 100, seats: 5, tier: i,
}));

const ROULETTE: [string, string, string][] = [
  ['Lucky Zero', 'tb-classic', 'Where the ball always finds a home'],
  ['Red Comb Room', 'tb-red', 'Red or black? Ask the rooster'],
  ['Barnyard Wheel', 'tb-farm', 'Spins straight from the farm'],
  ['Velvet Roost', 'tb-royal', 'A royal wheel'],
  ['Neon Spin', 'tb-neon', 'Electric nights'],
  ['Cyber Wheel', 'tb-cyber', 'Numbers at light speed'],
  ['Diamond Drop', 'tb-diamond', 'Ice-cold landings'],
  ['Inferno Wheel', 'tb-inferno', 'Hot numbers only'],
  ['Galaxy Spin', 'tb-galaxy', 'Out of this world'],
  ['Billionaire Wheel', 'tb-billionaire', 'Where millions ride on one spin'],
];
/** Roulette: every table has the same chips (100 → 1M) and no buy-in; up to 25 players bet together. */
export const ROULETTE_TABLES: LiveTable[] = ROULETTE.map(([name, themeId, tagline], i) => ({
  id: `r${i + 1}`, game: 'roulette', name, tagline, themeId, theme: TABLES[themeId],
  lo: 100, hi: 1_000_000, buyMin: 0, buyMax: 0, seats: 25, tier: i,
}));

export const liveTable = (id: string) => [...POKER_TABLES, ...BJ_TABLES, ...ROULETTE_TABLES].find((t) => t.id === id);
/** Room name for a table (platform grammar: lowercase, digits, . _ -). */
export const roomName = (t: LiveTable) => `cc-${t.game}-${t.id}`;
/** Hex colour for CSS from a theme number. */
export const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
