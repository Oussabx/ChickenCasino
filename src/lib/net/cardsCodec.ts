import { Card, Suit } from '../cards';

const R = '23456789TJQKA';
/** "As", "Td", "7h" — two characters per card. */
export const enc = (c: Card) => R[c.r - 2] + c.s.toLowerCase();
export const dec = (s: string): Card => ({ r: R.indexOf(s[0]) + 2, s: s[1].toUpperCase() as Suit });
export const encList = (cs: Card[]) => cs.map(enc).join('');
export const decList = (s: string | null | undefined): Card[] => {
  if (!s) return [];
  const out: Card[] = [];
  for (let i = 0; i + 1 < s.length; i += 2) out.push(dec(s.slice(i, i + 2)));
  return out;
};
