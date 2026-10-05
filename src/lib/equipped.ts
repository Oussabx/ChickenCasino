import { useStore } from '../store';
import { CHIPSETS, DECKS, TABLES } from './cosmetics';

/**
 * The cosmetics a player has equipped, read at the moment a scene or card is
 * drawn. Purely visual — nothing here touches game logic.
 */
export const eqTableId = () => useStore.getState().equipped.table ?? 'tb-classic';
export const eqTable = () => TABLES[eqTableId()] ?? TABLES['tb-classic'];
export const eqDeckId = () => (DECKS[useStore.getState().equipped.deck] ? useStore.getState().equipped.deck : 'dk-classic');
export const eqDeck = () => DECKS[eqDeckId()];
export const eqChips = () => CHIPSETS[useStore.getState().equipped.chips] ?? CHIPSETS['cp-classic'];

const DENOM_INDEX: Record<number, number> = { 1: 0, 5: 1, 25: 2, 100: 3, 500: 4, 1000: 5 };
/** High-roller chips (above 1,000) look the same in every chip set. */
const HIGH: Record<number, [string, string, string]> = {
  5000: ['#0EA5E9', '#E0F2FE', '#04293A'],
  10000: ['#F97316', '#FFEDD5', '#2A1203'],
  50000: ['#EC4899', '#FCE7F3', '#2A0516'],
  100000: ['#111827', '#F4C430', '#F4C430'],
  500000: ['#84CC16', '#ECFCCB', '#1A2E05'],
  1000000: ['#FDE047', '#7C2D12', '#3A1A00'],
};
/** Colour of a chip of `value` in the equipped set (`n` varies rainbow chips). */
export function chipColor(value: number, n = 0) {
  const hi = HIGH[value];
  if (hi) return { color: parseInt(hi[0].slice(1), 16), css: hi[0], stripe: parseInt(hi[1].slice(1), 16), stripeCss: hi[1], text: hi[2], glow: value >= 100000 };
  const t = eqChips();
  const i = DENOM_INDEX[value] ?? 3;
  const color = t.rainbow ? t.colors[(i + n) % 6] : t.colors[i];
  return { color: parseInt(color.slice(1), 16), css: color, stripe: parseInt(t.stripe.slice(1), 16), stripeCss: t.stripe, text: t.text, glow: !!t.glow };
}
