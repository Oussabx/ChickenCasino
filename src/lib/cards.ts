import { rand } from './rng';

export type Suit = 'S' | 'H' | 'D' | 'C';
/** rank: 2..14 (11 J, 12 Q, 13 K, 14 A) */
export interface Card { r: number; s: Suit }

export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
export const SUIT_CHAR: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const isRed = (c: Card) => c.s === 'H' || c.s === 'D';
export const rankLabel = (r: number) => (r <= 10 ? String(r) : ['J', 'Q', 'K', 'A'][r - 11]);
export const cardLabel = (c: Card) => `${rankLabel(c.r)}${SUIT_CHAR[c.s]}`;

/** A shuffled shoe of `decks` decks (Fisher–Yates with the crypto RNG). */
export function makeShoe(decks = 1): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < decks; d++) for (const s of SUITS) for (let r = 2; r <= 14; r++) cards.push({ r, s });
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

/** Shoe that reshuffles itself when it runs low (cut card at ~25%). */
export class Shoe {
  private cards: Card[] = [];
  constructor(private decks: number) { this.cards = makeShoe(decks); }
  draw(): Card {
    if (this.cards.length < this.decks * 13) this.cards = makeShoe(this.decks);
    return this.cards.pop()!;
  }
  /** Draw from a fresh single deck (for games that reshuffle every hand). */
  static fresh(): Shoe { return new Shoe(1); }
}

/* ---------------- blackjack ---------------- */
export function bjValue(hand: Card[]) {
  let total = 0, aces = 0;
  for (const c of hand) {
    if (c.r === 14) { aces++; total += 11; } else total += Math.min(10, c.r);
  }
  while (total > 21 && aces) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}
export const isBlackjack = (hand: Card[]) => hand.length === 2 && bjValue(hand).total === 21;

/* ---------------- baccarat ---------------- */
export const bacPoint = (c: Card) => (c.r === 14 ? 1 : c.r >= 10 ? 0 : c.r);
export const bacTotal = (hand: Card[]) => hand.reduce((s, c) => s + bacPoint(c), 0) % 10;

/**
 * Deals a full baccarat coup with the standard tableau.
 * Returns the order cards were dealt so the table can animate them.
 */
export function dealBaccarat(draw: () => Card) {
  const player = [draw()], banker = [draw()];
  player.push(draw()); banker.push(draw());
  const order: { side: 'player' | 'banker'; card: Card }[] = [
    { side: 'player', card: player[0] }, { side: 'banker', card: banker[0] },
    { side: 'player', card: player[1] }, { side: 'banker', card: banker[1] },
  ];
  const p = bacTotal(player), b = bacTotal(banker);
  if (p < 8 && b < 8) {
    let p3: Card | null = null;
    if (p <= 5) { p3 = draw(); player.push(p3); order.push({ side: 'player', card: p3 }); }
    const bt = bacTotal(banker);
    let bankerDraws: boolean;
    if (!p3) bankerDraws = bt <= 5;
    else {
      const v = bacPoint(p3);
      bankerDraws = bt <= 2 || (bt === 3 && v !== 8) || (bt === 4 && v >= 2 && v <= 7) || (bt === 5 && v >= 4 && v <= 7) || (bt === 6 && (v === 6 || v === 7));
    }
    if (bankerDraws) { const c = draw(); banker.push(c); order.push({ side: 'banker', card: c }); }
  }
  const pt = bacTotal(player), btot = bacTotal(banker);
  const winner: 'player' | 'banker' | 'tie' = pt > btot ? 'player' : btot > pt ? 'banker' : 'tie';
  return { player, banker, order, pt, bt: btot, winner, natural: p >= 8 || b >= 8 };
}

/* ---------------- poker ---------------- */
export const HAND_NAMES = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush', 'Royal flush'];

/** Scores a 5-card hand. Higher score = better hand; score[0] is the category. */
export function eval5(cards: Card[]): number[] {
  const rs = cards.map((c) => c.r).sort((a, b) => b - a);
  const flush = cards.every((c) => c.s === cards[0].s);
  const uniq = [...new Set(rs)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (rs[0] - rs[4] === 4) straightHigh = rs[0];
    else if (rs[0] === 14 && rs[1] === 5) straightHigh = 5; // wheel A-2-3-4-5
  }
  const counts = new Map<number, number>();
  rs.forEach((r) => counts.set(r, (counts.get(r) ?? 0) + 1));
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const byGroup = groups.map((g) => g[0]);
  if (straightHigh && flush) return [straightHigh === 14 ? 9 : 8, straightHigh];
  if (groups[0][1] === 4) return [7, ...byGroup];
  if (groups[0][1] === 3 && groups[1][1] === 2) return [6, ...byGroup];
  if (flush) return [5, ...rs];
  if (straightHigh) return [4, straightHigh];
  if (groups[0][1] === 3) return [3, ...byGroup];
  if (groups[0][1] === 2 && groups[1][1] === 2) return [2, ...byGroup];
  if (groups[0][1] === 2) return [1, ...byGroup];
  return [0, ...rs];
}

export function cmpScore(a: number[], b: number[]) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** Best 5-card hand out of 5–7 cards. */
export function bestHand(cards: Card[]) {
  let best: number[] = [-1];
  let bestCards: Card[] = cards.slice(0, 5);
  const n = cards.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
    const hand = [cards[a], cards[b], cards[c], cards[d], cards[e]];
    const s = eval5(hand);
    if (cmpScore(s, best) > 0) { best = s; bestCards = hand; }
  }
  return { score: best, cards: bestCards, name: HAND_NAMES[best[0]] };
}
