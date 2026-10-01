/**
 * Golden Coop — a 5-reel, 3-row, 20-payline video slot.
 *
 * How it works (like a real video slot):
 *  - Each reel is a fixed strip of symbols; a spin picks a random stop on every
 *    reel, and the window shows the stop plus the symbols above and below it.
 *  - 20 fixed paylines. A line pays for 3, 4 or 5 matching symbols in a row
 *    starting from the leftmost reel. Only the highest win per line is paid.
 *    Line pays are multiples of the line bet (total bet ÷ 20).
 *  - WILD (the Golden Rooster) substitutes for every symbol except the COOP
 *    scatter, and pays on its own as the top symbol.
 *  - COOP is a scatter: it pays anywhere in the window (× total bet), and 3+
 *    coops trigger free spins where every win is tripled. Free spins can retrigger.
 */
import { rand } from './rng';

export type Sym = 'corn' | 'feather' | 'egg' | 'horseshoe' | 'chick' | 'bell' | 'seven' | 'golden' | 'wild' | 'coop';

export const SYMBOLS: Sym[] = ['corn', 'feather', 'egg', 'horseshoe', 'chick', 'bell', 'seven', 'golden', 'wild', 'coop'];

export const SYMBOL_NAME: Record<Sym, string> = {
  corn: 'Corn Cob', feather: 'Feather', egg: 'Fresh Egg', horseshoe: 'Lucky Horseshoe', chick: 'Chick',
  bell: 'Barn Bell', seven: 'Lucky 7', golden: 'Golden Egg', wild: 'Golden Rooster (Wild)', coop: 'Coop (Scatter)',
};

/** Line pays for 3/4/5 of a kind, × line bet. */
export const LINE_PAYS: Partial<Record<Sym, [number, number, number]>> = {
  corn: [6, 20, 65],
  feather: [6, 20, 65],
  egg: [10, 30, 100],
  horseshoe: [10, 30, 100],
  chick: [20, 65, 200],
  bell: [25, 100, 300],
  seven: [40, 150, 600],
  golden: [60, 300, 1250],
  wild: [125, 600, 3000],
};
/** Scatter pays for 3/4/5 coops anywhere, × total bet, and the free spins they award. */
export const SCATTER_PAYS: Record<number, number> = { 3: 3, 4: 15, 5: 100 };
export const FREE_SPINS: Record<number, number> = { 3: 10, 4: 15, 5: 20 };
export const FREE_SPIN_MULT = 3;

export const LINES = 20;
export const ROWS = 3;
export const REELS = 5;

/** Row index (0 = top) on each reel, for each of the 20 paylines. */
export const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [1, 0, 1, 2, 1],
  [1, 2, 1, 0, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2], [1, 1, 0, 1, 1], [1, 1, 2, 1, 1],
  [0, 1, 1, 1, 0], [2, 1, 1, 1, 2], [0, 0, 2, 0, 0], [2, 2, 0, 2, 2], [0, 2, 0, 2, 0],
];
export const LINE_COLORS = [
  '#F4C430', '#E63946', '#22D3EE', '#A3E635', '#F472B6', '#FB923C', '#818CF8', '#34D399', '#FACC15', '#F87171',
  '#38BDF8', '#C084FC', '#4ADE80', '#FDBA74', '#93C5FD', '#FDE047', '#FCA5A5', '#5EEAD4', '#D8B4FE', '#BEF264',
];

/** How many of each symbol sit on each reel strip. */
const COUNTS: Record<Sym, [number, number, number, number, number]> = {
  corn: [7, 7, 7, 7, 7],
  feather: [7, 7, 7, 7, 7],
  egg: [6, 6, 6, 6, 6],
  horseshoe: [6, 6, 6, 6, 6],
  chick: [4, 4, 4, 4, 4],
  bell: [3, 3, 3, 3, 3],
  seven: [2, 2, 2, 2, 2],
  golden: [2, 2, 2, 2, 2],
  wild: [1, 2, 2, 2, 1],
  coop: [1, 2, 1, 2, 1],
};

/** Deterministic reel strips: symbols spread out so the same one rarely sits twice in a row. */
export const STRIPS: Sym[][] = Array.from({ length: REELS }, (_, r) => {
  const bag: Sym[] = [];
  for (const s of SYMBOLS) for (let i = 0; i < COUNTS[s][r]; i++) bag.push(s);
  let seed = 1234 + r * 977;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
  // break up neighbours (including scatters stacking)
  for (let pass = 0; pass < 6; pass++)
    for (let i = 0; i < bag.length; i++) {
      const a = bag[i], b = bag[(i + 1) % bag.length];
      if (a === b) { const j = (i + 3 + Math.floor(rnd() * (bag.length - 4))) % bag.length; [bag[(i + 1) % bag.length], bag[j]] = [bag[j], bag[(i + 1) % bag.length]]; }
    }
  return bag;
});

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Visible window for reel stops: grid[reel][row], row 0 = top. */
export function windowFor(stops: number[]): Sym[][] {
  return stops.map((s, r) => { const L = STRIPS[r].length; return [STRIPS[r][mod(s + 1, L)], STRIPS[r][mod(s, L)], STRIPS[r][mod(s - 1, L)]]; });
}

export interface LineWin { line: number; sym: Sym; count: number; pay: number; cells: [number, number][] }
export interface SpinResult {
  stops: number[];
  grid: Sym[][];
  lines: LineWin[];
  scatters: [number, number][];
  scatterPay: number; // × total bet
  freeSpins: number;
  /** Total win as a multiple of the TOTAL bet (before any free-spin multiplier). */
  mult: number;
}

/** Best win on one payline (left to right, wild substitutes). */
function evalLine(grid: Sym[][], li: number): LineWin | null {
  const rows = PAYLINES[li];
  const syms = rows.map((row, r) => grid[r][row]);
  if (syms[0] === 'coop') return null;
  // run of wilds from the left (pays as wild)
  let wildRun = 0;
  while (wildRun < REELS && syms[wildRun] === 'wild') wildRun++;
  // run using the first non-wild symbol
  const base = syms.find((s) => s !== 'wild');
  let run = 0;
  if (base && base !== 'coop') while (run < REELS && (syms[run] === base || syms[run] === 'wild')) run++;
  const wildPay = wildRun >= 3 ? LINE_PAYS.wild![wildRun - 3] : 0;
  const basePay = base && base !== 'coop' && run >= 3 ? LINE_PAYS[base]![run - 3] : 0;
  if (!wildPay && !basePay) return null;
  const [sym, count, pay] = wildPay >= basePay ? ['wild' as Sym, wildRun, wildPay] : [base as Sym, run, basePay];
  return { line: li, sym, count, pay, cells: rows.slice(0, count).map((row, r) => [r, row] as [number, number]) };
}

export function evaluate(stops: number[]): SpinResult {
  const grid = windowFor(stops);
  const lines: LineWin[] = [];
  for (let i = 0; i < LINES; i++) { const w = evalLine(grid, i); if (w) lines.push(w); }
  const scatters: [number, number][] = [];
  grid.forEach((col, r) => col.forEach((s, row) => { if (s === 'coop') scatters.push([r, row]); }));
  const n = scatters.length;
  const scatterPay = SCATTER_PAYS[Math.min(5, n)] ?? 0;
  const freeSpins = FREE_SPINS[Math.min(5, n)] ?? 0;
  const linePay = lines.reduce((a, l) => a + l.pay, 0) / LINES;
  return { stops, grid, lines, scatters, scatterPay, freeSpins, mult: linePay + scatterPay };
}

export function spin(): SpinResult {
  // dev builds only: tests can queue exact reel stops
  const q = import.meta.env.DEV ? (globalThis as { __slotStops?: number[][] }).__slotStops : undefined;
  if (q?.length) return evaluate(q.shift()!);
  return evaluate(STRIPS.map((s) => Math.floor(rand() * s.length)));
}
