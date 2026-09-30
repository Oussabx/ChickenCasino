import { Card, HAND_NAMES, SUITS, Shoe, bestHand, cmpScore } from './cards';

/**
 * No-limit Texas Hold'em engine.
 *
 * - Button, small blind, big blind; heads-up the button posts the small blind
 *   and acts first pre-flop, last after the flop.
 * - Four betting rounds: pre-flop (starts left of the big blind), flop, turn and
 *   river (start left of the button). A card is burned before each street.
 * - A raise must be at least the previous bet/raise; all-in for less is allowed.
 * - Uncalled bets are returned; side pots are built from each player's total
 *   contribution; ties split the pot, odd chips go to the first winner left of
 *   the button.
 */

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin';

export interface Seat {
  id: number;
  name: string;
  avatar: string;
  human: boolean;
  stack: number;
  hole: Card[];
  bet: number; // chips in front of the player this street
  total: number; // chips put in this hand
  folded: boolean;
  allIn: boolean;
  acted: boolean;
  sittingOut: boolean;
  /** 0 = tight/passive … 1 = loose/aggressive */
  style: { loose: number; aggro: number };
  last?: string;
}

export interface Game {
  seats: Seat[];
  button: number;
  sb: number;
  bb: number;
  board: Card[];
  street: Street;
  toAct: number;
  currentBet: number;
  minRaise: number;
  shoe: Shoe;
  handNo: number;
}

export interface PotResult { amount: number; winners: number[]; hand: string; eligible: number[] }

const round2 = (v: number) => Math.round(v * 100) / 100;

export const inHand = (s: Seat) => !s.sittingOut && !s.folded;
const canAct = (s: Seat) => inHand(s) && !s.allIn;

export function nextSeat(g: Game, from: number, pred: (s: Seat) => boolean = canAct) {
  const n = g.seats.length;
  for (let k = 1; k <= n; k++) { const i = (from + k) % n; if (pred(g.seats[i])) return i; }
  return -1;
}

export const pot = (g: Game) => round2(g.seats.reduce((a, s) => a + s.total, 0));

/** Start a new hand: move the button, post blinds, deal two cards each. Returns the blind posts. */
export function startHand(g: Game) {
  g.handNo++;
  g.board = [];
  g.street = 'preflop';
  for (const s of g.seats) {
    s.hole = []; s.bet = 0; s.total = 0; s.folded = false; s.allIn = false; s.acted = false; s.last = undefined;
    s.sittingOut = s.stack <= 0;
  }
  const live = g.seats.filter((s) => !s.sittingOut).length;
  if (live < 2) throw new Error('Not enough players');
  g.button = nextSeat(g, g.button, (s) => !s.sittingOut);
  const headsUp = live === 2;
  const sbSeat = headsUp ? g.button : nextSeat(g, g.button, (s) => !s.sittingOut);
  const bbSeat = nextSeat(g, sbSeat, (s) => !s.sittingOut);
  const posts: { seat: number; amount: number; label: string }[] = [];
  const post = (i: number, amt: number, label: string) => {
    const s = g.seats[i];
    const a = Math.min(s.stack, amt);
    s.stack = round2(s.stack - a); s.bet = round2(s.bet + a); s.total = round2(s.total + a);
    if (s.stack <= 0) s.allIn = true;
    s.last = label;
    posts.push({ seat: i, amount: a, label });
  };
  post(sbSeat, g.sb, 'SB');
  post(bbSeat, g.bb, 'BB');
  g.currentBet = g.bb;
  g.minRaise = g.bb;
  // deal: one card at a time starting left of the button
  for (let r = 0; r < 2; r++) {
    let i = g.button;
    for (let k = 0; k < live; k++) { i = nextSeat(g, i, (s) => !s.sittingOut); g.seats[i].hole.push(g.shoe.draw()); }
  }
  g.toAct = nextSeat(g, bbSeat);
  if (g.toAct < 0) g.toAct = bbSeat;
  return { posts, sbSeat, bbSeat };
}

export function legal(g: Game, i: number) {
  const s = g.seats[i];
  const toCall = round2(Math.min(s.stack, Math.max(0, g.currentBet - s.bet)));
  const maxTo = round2(s.bet + s.stack);
  const minTo = round2(Math.min(maxTo, g.currentBet + g.minRaise));
  const canRaise = maxTo > g.currentBet && s.stack > toCall;
  return { toCall, canCheck: toCall === 0, minTo, maxTo, canRaise, isBet: g.currentBet === 0 };
}

/** Apply an action for the player to act. `to` = total bet for this street when betting/raising. Returns chips moved. */
export function act(g: Game, type: ActionType, to = 0): number {
  const i = g.toAct;
  const s = g.seats[i];
  const L = legal(g, i);
  let moved = 0;
  const putTo = (target: number) => {
    const add = round2(Math.min(s.stack, target - s.bet));
    s.stack = round2(s.stack - add); s.bet = round2(s.bet + add); s.total = round2(s.total + add);
    if (s.stack <= 0.0001) { s.stack = 0; s.allIn = true; }
    moved = add;
  };
  if (type === 'fold') { s.folded = true; s.last = 'Fold'; }
  else if (type === 'check' || (type === 'call' && L.toCall === 0)) { s.last = 'Check'; }
  else if (type === 'call') { putTo(s.bet + L.toCall); s.last = s.allIn ? 'All-in' : `Call`; }
  else {
    const target = type === 'allin' ? L.maxTo : Math.max(L.minTo, Math.min(L.maxTo, to));
    const raiseBy = target - g.currentBet;
    const wasBet = g.currentBet === 0;
    putTo(target);
    if (target > g.currentBet) {
      if (raiseBy >= g.minRaise) g.minRaise = round2(raiseBy);
      g.currentBet = round2(target);
      // everyone else has to respond again
      for (const o of g.seats) if (o !== s && canAct(o)) o.acted = false;
    }
    s.last = s.allIn ? 'All-in' : wasBet ? 'Bet' : 'Raise';
  }
  s.acted = true;
  g.toAct = nextSeat(g, i);
  return moved;
}

export const alive = (g: Game) => g.seats.filter(inHand);

/** Betting round over? (everyone matched or folded/all-in) */
export function roundOver(g: Game) {
  if (alive(g).length <= 1) return true;
  const actors = g.seats.filter(canAct);
  if (actors.length === 0) return true;
  // only one player can still act and everyone else is all-in: nothing left to bet against
  if (actors.length === 1 && actors[0].bet >= g.currentBet) return true;
  return actors.every((s) => s.acted && s.bet === g.currentBet);
}

/** Return any part of the top bet nobody called. Returns [seat, amount] or null. */
export function returnUncalled(g: Game): [number, number] | null {
  const bets = g.seats.map((s, i) => [i, s.bet] as const).sort((a, b) => b[1] - a[1]);
  if (bets.length < 2 || bets[0][1] <= bets[1][1]) return null;
  const [i, top] = bets[0];
  const extra = round2(top - bets[1][1]);
  const s = g.seats[i];
  s.bet = round2(s.bet - extra); s.total = round2(s.total - extra); s.stack = round2(s.stack + extra);
  if (s.stack > 0) s.allIn = false;
  return [i, extra];
}

/** Move to the next street (burn + deal). Returns the new board cards. */
export function nextStreet(g: Game): Card[] {
  for (const s of g.seats) { s.bet = 0; s.acted = false; if (inHand(s) && !s.allIn) s.last = undefined; }
  g.currentBet = 0;
  g.minRaise = g.bb;
  const order: Street[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];
  g.street = order[order.indexOf(g.street) + 1];
  let dealt: Card[] = [];
  if (g.street !== 'showdown') {
    g.shoe.draw(); // burn
    dealt = g.street === 'flop' ? [g.shoe.draw(), g.shoe.draw(), g.shoe.draw()] : [g.shoe.draw()];
    g.board.push(...dealt);
  }
  g.toAct = nextSeat(g, g.button);
  return dealt;
}

/** Build side pots and award them. Mutates stacks. */
export function showdown(g: Game): PotResult[] {
  const live = alive(g);
  const results: PotResult[] = [];
  if (live.length === 1) {
    const amount = pot(g);
    const w = g.seats.indexOf(live[0]);
    live[0].stack = round2(live[0].stack + amount);
    results.push({ amount, winners: [w], hand: '', eligible: [w] });
  } else {
    const scores = new Map<number, { score: number[]; name: string }>();
    g.seats.forEach((s, i) => { if (inHand(s)) { const b = bestHand([...s.hole, ...g.board]); scores.set(i, { score: b.score, name: b.name }); } });
    const levels = [...new Set(g.seats.filter((s) => s.total > 0).map((s) => s.total))].sort((a, b) => a - b);
    let prev = 0;
    for (const lvl of levels) {
      const amount = round2(g.seats.reduce((a, s) => a + Math.max(0, Math.min(s.total, lvl) - Math.min(s.total, prev)), 0));
      const eligible = g.seats.map((_, i) => i).filter((i) => inHand(g.seats[i]) && g.seats[i].total >= lvl);
      prev = lvl;
      if (amount <= 0 || !eligible.length) continue;
      let best: number[] = [-1]; let winners: number[] = [];
      for (const i of eligible) {
        const c = cmpScore(scores.get(i)!.score, best);
        if (c > 0) { best = scores.get(i)!.score; winners = [i]; } else if (c === 0) winners.push(i);
      }
      // merge with the previous pot if it has the same eligible players (not really a side pot)
      const lastR = results[results.length - 1];
      if (lastR && lastR.eligible.join() === eligible.join()) { lastR.amount = round2(lastR.amount + amount); continue; }
      results.push({ amount, winners, hand: HAND_NAMES[best[0]], eligible });
    }
    for (const r of results) {
      const share = Math.floor((r.amount / r.winners.length) * 100) / 100;
      let rest = round2(r.amount - share * r.winners.length);
      // odd chips go to the first winner left of the button
      const ordered = [...r.winners].sort((a, b) => ((a - g.button + g.seats.length) % g.seats.length) - ((b - g.button + g.seats.length) % g.seats.length));
      for (const w of ordered) { g.seats[w].stack = round2(g.seats[w].stack + share + rest); rest = 0; }
    }
  }
  g.street = 'showdown';
  return results;
}

/* ---------------- bots ---------------- */

const DECK: Card[] = SUITS.flatMap((s) => Array.from({ length: 13 }, (_, i) => ({ r: i + 2, s })));

/** Monte-Carlo win probability against `opponents` random hands. */
export function equity(hole: Card[], board: Card[], opponents: number, sims = 160) {
  const used = new Set([...hole, ...board].map((c) => `${c.r}${c.s}`));
  const rest = DECK.filter((c) => !used.has(`${c.r}${c.s}`));
  let score = 0;
  for (let k = 0; k < sims; k++) {
    // partial shuffle for the cards we need
    const need = 5 - board.length + opponents * 2;
    const pool = rest.slice();
    for (let i = 0; i < need; i++) { const j = i + Math.floor(Math.random() * (pool.length - i)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const b = [...board, ...pool.slice(0, 5 - board.length)];
    const mine = bestHand([...hole, ...b]).score;
    let beaten = false, ties = 0;
    for (let o = 0; o < opponents; o++) {
      const off = 5 - board.length + o * 2;
      const c = cmpScore(bestHand([pool[off], pool[off + 1], ...b]).score, mine);
      if (c > 0) { beaten = true; break; }
      if (c === 0) ties++;
    }
    if (!beaten) score += ties ? 1 / (ties + 1) : 1;
  }
  return score / sims;
}

/** Pick an action for a bot seat. */
export function botDecision(g: Game, i: number): { type: ActionType; to?: number } {
  const s = g.seats[i];
  const L = legal(g, i);
  const opp = Math.max(1, alive(g).length - 1);
  const eq = equity(s.hole, g.board, Math.min(opp, 4), g.board.length ? 150 : 110);
  const potNow = pot(g);
  const oddsNeeded = L.toCall / Math.max(0.01, potNow + L.toCall);
  // how good the hand feels relative to a fair share
  const fair = 1 / (opp + 1);
  const strength = eq / fair; // > 1 = better than average
  const r = Math.random();
  const loose = s.style.loose, aggro = s.style.aggro;
  const sizeTo = (frac: number) => {
    const target = g.currentBet + Math.max(g.minRaise, (potNow + L.toCall) * frac);
    return Math.round(Math.min(L.maxTo, Math.max(L.minTo, target)) / g.sb) * g.sb;
  };
  if (L.canCheck) {
    if (L.canRaise && (strength > 1.55 - aggro * 0.3 || (r < 0.08 + aggro * 0.12 && g.street !== 'preflop'))) {
      return { type: 'bet', to: sizeTo(0.45 + Math.random() * 0.4) };
    }
    return { type: 'check' };
  }
  // facing a bet: weak hands fold (looser players defend more)
  const threshold = g.street === 'preflop' ? 1.02 - loose * 0.3 : 0.95 - loose * 0.25;
  const bluffCatch = r < 0.03 + loose * 0.05;
  if ((strength < threshold || eq + loose * 0.05 < oddsNeeded) && !bluffCatch) return { type: 'fold' };
  if (L.canRaise && strength > 1.9 - aggro * 0.4 && r < 0.5 + aggro * 0.4) {
    const to = sizeTo(0.6 + Math.random() * 0.5);
    if (to >= L.maxTo * 0.85 || (eq > 0.8 && r < 0.2)) return { type: 'allin' };
    return { type: 'raise', to };
  }
  // big bets relative to stack need a real hand
  if (L.toCall > s.stack * 0.5 && strength < 1.2 && eq < 0.5) return { type: 'fold' };
  return { type: 'call' };
}

export const BOT_ROSTER: { name: string; avatar: string; loose: number; aggro: number }[] = [
  { name: 'Clucky', avatar: '🐔', loose: 0.5, aggro: 0.5 },
  { name: 'Henrietta', avatar: '🐓', loose: 0.3, aggro: 0.7 },
  { name: 'Nugget', avatar: '🐣', loose: 0.8, aggro: 0.3 },
  { name: 'Eggbert', avatar: '🥚', loose: 0.2, aggro: 0.2 },
  { name: 'Drumstick', avatar: '🍗', loose: 0.7, aggro: 0.8 },
  { name: 'Feathers', avatar: '🪶', loose: 0.4, aggro: 0.4 },
  { name: 'Colonel', avatar: '🎩', loose: 0.25, aggro: 0.6 },
  { name: 'Peep', avatar: '🐤', loose: 0.6, aggro: 0.55 },
  { name: 'Rooster Ray', avatar: '🌅', loose: 0.45, aggro: 0.9 },
  { name: 'Omelette', avatar: '🍳', loose: 0.9, aggro: 0.6 },
];
