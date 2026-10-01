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
/** Colour of a chip of `value` in the equipped set (`n` varies rainbow chips). */
export function chipColor(value: number, n = 0) {
  const t = eqChips();
  const i = DENOM_INDEX[value] ?? 3;
  const color = t.rainbow ? t.colors[(i + n) % 6] : t.colors[i];
  return { color: parseInt(color.slice(1), 16), css: color, stripe: parseInt(t.stripe.slice(1), 16), stripeCss: t.stripe, text: t.text, glow: !!t.glow };
}
