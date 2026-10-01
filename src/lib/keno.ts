/**
 * Coop Keno — classic 80-ball keno.
 *
 * Pick 1–10 "spots" from 1–80. Twenty eggs (balls) are drawn without
 * replacement; every drawn number you picked is a "catch". The pay table pays
 * by how many spots you played and how many you caught (amounts are "for 1",
 * i.e. the total returned per coin bet, stake included).
 */
import { rand } from './rng';

export const KENO_NUMBERS = 80;
export const KENO_DRAWN = 20;
export const KENO_MAX_SPOTS = 10;

/** PAYS[spots][catches] = total return per 1 coin. */
export const PAYS: Record<number, number[]> = {
  1: [0, 3.8],
  2: [0, 1, 9.5],
  3: [0, 0, 3, 39],
  4: [0, 0, 2, 5, 100],
  5: [0, 0, 1, 3, 14, 400],
  6: [0, 0, 0, 3, 5, 70, 1600],
  7: [0, 0, 0, 1, 4, 18, 340, 7000],
  8: [0, 0, 0, 0, 2, 12, 98, 1400, 25000],
  9: [0, 0, 0, 0, 1, 6, 38, 380, 5000, 50000],
  // 10 spots: catching none of your ten also pays your bet back
  10: [1, 0, 0, 0, 0, 3, 24, 140, 1400, 8000, 100000],
};

const lnFact: number[] = [0];
for (let i = 1; i <= KENO_NUMBERS; i++) lnFact[i] = lnFact[i - 1] + Math.log(i);
const lnC = (n: number, k: number) => (k < 0 || k > n ? -Infinity : lnFact[n] - lnFact[k] - lnFact[n - k]);

/** Probability of catching exactly `c` of `spots` picks (hypergeometric). */
export function catchProb(spots: number, c: number) {
  return Math.exp(lnC(spots, c) + lnC(KENO_NUMBERS - spots, KENO_DRAWN - c) - lnC(KENO_NUMBERS, KENO_DRAWN));
}

/** Expected return (RTP) of a pay table row. */
export function rtp(spots: number) {
  return PAYS[spots].reduce((a, pay, c) => a + pay * catchProb(spots, c), 0);
}

/** Draw 20 distinct numbers from 1–80, in draw order. */
export function drawBalls(): number[] {
  const pool = Array.from({ length: KENO_NUMBERS }, (_, i) => i + 1);
  for (let i = 0; i < KENO_DRAWN; i++) {
    const j = i + Math.floor(rand() * (KENO_NUMBERS - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, KENO_DRAWN);
}

/** Random distinct picks for Quick Pick. */
export function quickPick(n: number): number[] {
  return drawBalls().slice(0, Math.min(n, KENO_MAX_SPOTS)).sort((a, b) => a - b);
}

export function payFor(spots: number, catches: number) {
  return PAYS[spots]?.[catches] ?? 0;
}
