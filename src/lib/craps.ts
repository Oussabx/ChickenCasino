/**
 * Craps rules engine (pure, no UI).
 *
 * Come-out roll: 7/11 win the Pass Line, 2/3/12 ("craps") lose it; any other
 * total (4,5,6,8,9,10) becomes the point. Then the point must repeat before a
 * 7 for Pass to win. Don't Pass is the reverse, with 12 a push ("bar 12").
 *
 * Supported bets and payouts (standard Las Vegas):
 *   pass / dp ............ 1:1           (contract bets, come-out only)
 *   passOdds / dpOdds .... true odds     4/10 2:1 · 5/9 3:2 · 6/8 6:5 (lay = inverse)
 *   come / dc ............ 1:1           (like pass/don't pass, made while a point is on)
 *   come & dc odds ....... true odds     (come odds are off on the come-out roll)
 *   place4..place10 ...... 9:5, 7:5, 7:6 (off on the come-out roll)
 *   field ................ 1:1, 2 pays 2:1, 12 pays 3:1   (one roll)
 *   hard4/6/8/10 ......... 7:1 / 9:1     (lose on 7 or the easy way; off on come-out)
 *   any7 4:1 · anyCraps 7:1 · aces(2) 30:1 · aceDeuce(3) 15:1 · yo(11) 15:1 · boxcars(12) 30:1  (one roll)
 * Odds limits: 3-4-5× (pass/come odds), lay up to win 6× the flat bet.
 */

export const POINTS = [4, 5, 6, 8, 9, 10] as const;
export type PointNum = (typeof POINTS)[number];

export type BetKey =
  | 'pass' | 'passOdds' | 'dp' | 'dpOdds' | 'come' | 'dc' | 'field'
  | 'place4' | 'place5' | 'place6' | 'place8' | 'place9' | 'place10'
  | 'hard4' | 'hard6' | 'hard8' | 'hard10'
  | 'any7' | 'anyCraps' | 'aces' | 'aceDeuce' | 'yo' | 'boxcars';

/** A Come / Don't Come bet that has travelled to its number. */
export interface Travelled { n: PointNum; base: number; odds: number }

export interface CrapsState {
  point: PointNum | null;
  bets: Partial<Record<BetKey, number>>;
  come: Travelled[];
  dontCome: Travelled[];
}

export const newState = (): CrapsState => ({ point: null, bets: {}, come: [], dontCome: [] });

export type Outcome = 'win' | 'lose' | 'push';
/**
 * One resolved wager. `stake` is what was at risk, `win` the profit paid.
 * `stays` = a winning bet that remains up on the layout (place, hardways,
 * field, props, the flat Pass/Don't Pass) — only its profit is paid out.
 * Otherwise a win returns stake + profit, and a push returns the stake.
 */
export interface Resolved { key: string; label: string; stake: number; win: number; outcome: Outcome; stays: boolean }

export const isPoint = (n: number): n is PointNum => (POINTS as readonly number[]).includes(n);

/** True-odds profit for a Pass/Come odds bet. */
export const takeOddsPay = (n: PointNum, amt: number) => amt * ({ 4: 2, 10: 2, 5: 1.5, 9: 1.5, 6: 1.2, 8: 1.2 } as const)[n];
/** True-odds profit for a Don't Pass/Don't Come lay. */
export const layOddsPay = (n: PointNum, amt: number) => amt * ({ 4: 0.5, 10: 0.5, 5: 2 / 3, 9: 2 / 3, 6: 5 / 6, 8: 5 / 6 } as const)[n];
/** 3-4-5× odds. */
export const maxTakeOdds = (n: PointNum, flat: number) => flat * ({ 4: 3, 10: 3, 5: 4, 9: 4, 6: 5, 8: 5 } as const)[n];
/** Lay enough to win at most 6× the flat bet. */
export const maxLayOdds = (n: PointNum, flat: number) => Math.floor((flat * 6) / layOddsPay(n, 1) * 100) / 100;
/** Place bet profit. */
export const placePay = (n: PointNum, amt: number) => amt * ({ 4: 9 / 5, 10: 9 / 5, 5: 7 / 5, 9: 7 / 5, 6: 7 / 6, 8: 7 / 6 } as const)[n];

/** Profit multiplier ("x to 1") of the simple bets. */
export const PAYS_TO_1: Partial<Record<BetKey, number>> = {
  any7: 4, anyCraps: 7, aces: 30, aceDeuce: 15, yo: 15, boxcars: 30, hard4: 7, hard10: 7, hard6: 9, hard8: 9,
};

export const LABEL: Record<BetKey, string> = {
  pass: 'Pass Line', passOdds: 'Pass Odds', dp: 'Don’t Pass', dpOdds: 'Lay Odds', come: 'Come', dc: 'Don’t Come', field: 'Field',
  place4: 'Place 4', place5: 'Place 5', place6: 'Place 6', place8: 'Place 8', place9: 'Place 9', place10: 'Place 10',
  hard4: 'Hard 4', hard6: 'Hard 6', hard8: 'Hard 8', hard10: 'Hard 10',
  any7: 'Any Seven', anyCraps: 'Any Craps', aces: 'Chicken Eyes (2)', aceDeuce: 'Ace-Deuce (3)', yo: 'Yo-Leven (11)', boxcars: 'Boxcars (12)',
};

/** Can this bet be placed right now? Returns an error message, or null. */
export function canPlace(st: CrapsState, key: BetKey): string | null {
  const on = st.point !== null;
  switch (key) {
    case 'pass': case 'dp': return on ? 'Line bets are made on the come-out roll' : null;
    case 'come': case 'dc': return on ? null : 'Come bets open once a point is set — use the Pass Line now';
    case 'passOdds': return !on ? 'Odds open once a point is set' : !st.bets.pass ? 'Put a Pass Line bet down first' : null;
    case 'dpOdds': return !on ? 'Odds open once a point is set' : !st.bets.dp ? 'Put a Don’t Pass bet down first' : null;
    default: return null;
  }
}

/** Highest amount allowed on a bet (odds limits); Infinity when unlimited. */
export function maxFor(st: CrapsState, key: BetKey): number {
  if (key === 'passOdds' && st.point) return maxTakeOdds(st.point, st.bets.pass ?? 0);
  if (key === 'dpOdds' && st.point) return maxLayOdds(st.point, st.bets.dp ?? 0);
  return Infinity;
}

/** Can the player pick this bet back up? (Pass and come points are contract bets.) */
export function canRemove(st: CrapsState, key: BetKey) {
  if (key === 'pass' && st.point) return false;
  return true;
}

const placeKey = (n: PointNum) => `place${n}` as BetKey;
const hardKey = (n: PointNum) => `hard${n}` as BetKey;

/**
 * Resolve one roll. Returns the new state and every wager that won, lost or pushed.
 * Bets that win but stay up keep their stake on the layout.
 */
export function resolveRoll(prev: CrapsState, d1: number, d2: number): { state: CrapsState; resolved: Resolved[]; event: string } {
  const st: CrapsState = { point: prev.point, bets: { ...prev.bets }, come: prev.come.map((c) => ({ ...c })), dontCome: prev.dontCome.map((c) => ({ ...c })) };
  const sum = d1 + d2;
  const hard = d1 === d2;
  const comeOut = st.point === null;
  const out: Resolved[] = [];
  const add = (key: string, label: string, stake: number, outcome: Outcome, win = 0, stays = false) => { if (stake > 0) out.push({ key, label, stake, win, outcome, stays }); };
  const take = (k: BetKey) => { const v = st.bets[k] ?? 0; delete st.bets[k]; return v; };
  let event = '';

  // ---- one-roll bets ----
  const field = st.bets.field ?? 0;
  if (field) {
    if ([2, 3, 4, 9, 10, 11, 12].includes(sum)) add('field', LABEL.field, field, 'win', field * (sum === 2 ? 2 : sum === 12 ? 3 : 1), true);
    else add('field', LABEL.field, take('field'), 'lose');
  }
  const props: [BetKey, boolean][] = [['any7', sum === 7], ['anyCraps', sum === 2 || sum === 3 || sum === 12], ['aces', sum === 2], ['aceDeuce', sum === 3], ['yo', sum === 11], ['boxcars', sum === 12]];
  for (const [k, hit] of props) {
    const v = st.bets[k] ?? 0; if (!v) continue;
    if (hit) add(k, LABEL[k], v, 'win', v * PAYS_TO_1[k]!, true); else add(k, LABEL[k], take(k), 'lose');
  }

  // ---- hardways (off on the come-out roll) ----
  for (const n of [4, 6, 8, 10] as const) {
    const k = hardKey(n), v = st.bets[k] ?? 0;
    if (!v || comeOut) continue;
    if (sum === n && hard) add(k, LABEL[k], v, 'win', v * PAYS_TO_1[k]!, true);
    else if (sum === 7 || sum === n) add(k, LABEL[k], take(k), 'lose');
  }

  // ---- place bets (off on the come-out roll) ----
  for (const n of POINTS) {
    const k = placeKey(n), v = st.bets[k] ?? 0;
    if (!v || comeOut) continue;
    if (sum === n) add(k, LABEL[k], v, 'win', placePay(n, v), true);
    else if (sum === 7) add(k, LABEL[k], take(k), 'lose');
  }

  // ---- come points already on numbers ----
  st.come = st.come.filter((c) => {
    if (sum === c.n) {
      add(`come${c.n}`, `Come ${c.n}`, c.base, 'win', c.base);
      // odds are off on the come-out: returned unpaid
      if (c.odds) add(`come${c.n}odds`, `Come ${c.n} odds`, c.odds, comeOut ? 'push' : 'win', comeOut ? 0 : takeOddsPay(c.n, c.odds));
      return false;
    }
    if (sum === 7) {
      add(`come${c.n}`, `Come ${c.n}`, c.base, 'lose');
      if (c.odds) add(`come${c.n}odds`, `Come ${c.n} odds`, c.odds, comeOut ? 'push' : 'lose');
      return false;
    }
    return true;
  });
  st.dontCome = st.dontCome.filter((c) => {
    if (sum === 7) {
      add(`dc${c.n}`, `Don’t Come ${c.n}`, c.base, 'win', c.base);
      if (c.odds) add(`dc${c.n}odds`, `Don’t Come ${c.n} lay`, c.odds, 'win', layOddsPay(c.n, c.odds));
      return false;
    }
    if (sum === c.n) {
      add(`dc${c.n}`, `Don’t Come ${c.n}`, c.base, 'lose');
      if (c.odds) add(`dc${c.n}odds`, `Don’t Come ${c.n} lay`, c.odds, 'lose');
      return false;
    }
    return true;
  });

  // ---- new Come / Don't Come bets (their own "come-out") ----
  const come = st.bets.come ?? 0;
  if (come) {
    delete st.bets.come;
    if (sum === 7 || sum === 11) add('come', LABEL.come, come, 'win', come);
    else if (sum === 2 || sum === 3 || sum === 12) add('come', LABEL.come, come, 'lose');
    else if (isPoint(sum)) st.come.push({ n: sum, base: come, odds: 0 });
  }
  const dc = st.bets.dc ?? 0;
  if (dc) {
    delete st.bets.dc;
    if (sum === 2 || sum === 3) add('dc', LABEL.dc, dc, 'win', dc);
    else if (sum === 7 || sum === 11) add('dc', LABEL.dc, dc, 'lose');
    else if (sum === 12) add('dc', LABEL.dc, dc, 'push', 0, true);
    if (sum === 12) st.bets.dc = dc; // barred: stays in the box
    else if (isPoint(sum)) st.dontCome.push({ n: sum, base: dc, odds: 0 });
  }

  // ---- the line ----
  const pass = st.bets.pass ?? 0, dp = st.bets.dp ?? 0;
  if (comeOut) {
    if (sum === 7 || sum === 11) {
      event = sum === 7 ? 'Seven — front line winner!' : 'Yo-leven — front line winner!';
      if (pass) add('pass', LABEL.pass, pass, 'win', pass, true);
      if (dp) add('dp', LABEL.dp, take('dp'), 'lose');
    } else if (sum === 2 || sum === 3 || sum === 12) {
      event = sum === 2 ? 'Chicken eyes — craps!' : sum === 12 ? 'Boxcars — craps!' : 'Ace-deuce — craps!';
      if (pass) add('pass', LABEL.pass, take('pass'), 'lose');
      if (dp) {
        if (sum === 12) add('dp', LABEL.dp, dp, 'push', 0, true);
        else add('dp', LABEL.dp, dp, 'win', dp, true);
      }
    } else if (isPoint(sum)) {
      st.point = sum;
      event = `Point is ${sum}`;
    }
  } else {
    const p = st.point!;
    if (sum === p) {
      event = `${p} — the point is made!`;
      if (pass) add('pass', LABEL.pass, pass, 'win', pass, true);
      const po = take('passOdds'); if (po) add('passOdds', LABEL.passOdds, po, 'win', takeOddsPay(p, po));
      if (dp) add('dp', LABEL.dp, take('dp'), 'lose');
      const lo = take('dpOdds'); if (lo) add('dpOdds', LABEL.dpOdds, lo, 'lose');
      st.point = null;
    } else if (sum === 7) {
      event = 'Seven out — line away';
      if (pass) add('pass', LABEL.pass, take('pass'), 'lose');
      const po = take('passOdds'); if (po) add('passOdds', LABEL.passOdds, po, 'lose');
      if (dp) add('dp', LABEL.dp, dp, 'win', dp, true);
      const lo = take('dpOdds'); if (lo) add('dpOdds', LABEL.dpOdds, lo, 'win', layOddsPay(p, lo));
      st.point = null;
    }
  }
  if (!event) event = hard && isPoint(sum) ? `Hard ${sum}` : `${sum}${hard ? ' the hard way' : ''}`;
  return { state: st, resolved: out, event };
}

/** Money flow of a resolution: what goes back to the balance, and what stays on the layout. */
export function settleTotals(resolved: Resolved[]) {
  // stake/returned: decided wagers; stayed: winning stakes that remain on the layout;
  // refunded: pushes that come back to the player (e.g. come odds that were off)
  let stake = 0, returned = 0, stayed = 0, refunded = 0;
  for (const r of resolved) {
    if (r.outcome === 'push') { if (!r.stays) refunded += r.stake; continue; }
    stake += r.stake;
    if (r.outcome === 'win') { returned += r.stake + r.win; if (r.stays) stayed += r.stake; }
  }
  return { stake, returned, stayed, refunded };
}

/** Sum of everything currently on the layout. */
export function onTable(st: CrapsState) {
  return Object.values(st.bets).reduce((a, b) => a + (b ?? 0), 0) + st.come.reduce((a, c) => a + c.base + c.odds, 0) + st.dontCome.reduce((a, c) => a + c.base + c.odds, 0);
}
