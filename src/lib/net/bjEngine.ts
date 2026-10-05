import { Card, Shoe, bjValue, isBlackjack } from '../cards';
import { LiveTable } from './tables';
import { BaseState, Engine, PeerView } from './live';
import { dec, enc, encList } from './cardsCodec';

/* The host's multiplayer blackjack table: everyone plays their own hand against the chicken dealer. */

export interface BHand {
  /** Cards ("As7d…"). */
  c: string;
  bt: number;
  d?: 1;
  x?: 1;
  /** Result once settled, and what came back. */
  r?: 'win' | 'lose' | 'push' | 'bj';
  pay?: number;
}
export interface BSeat {
  id: string;
  p: string;
  n: string;
  av: string;
  fr?: string;
  ns?: string;
  k: number;
  /** Chips added from the wallet so far (echo of the seat request's `tu`). */
  tu?: number;
  /** Bet placed for the coming round. */
  bet: number;
  /** Ready to deal. */
  rd?: 1;
  hs: BHand[];
  ah: number;
  w?: 1;
  lv?: 1;
}
export interface BState extends BaseState {
  t: string;
  r: number;
  ph: 'wait' | 'bet' | 'deal' | 'play' | 'dealer' | 'settle';
  /** Dealer's cards; "??" is the face-down hole card. */
  d: string;
  ta: number;
  tq: number;
  s: (BSeat | null)[];
  note?: string;
}

export const BJ_BET_MS = 15000;
export const BJ_TURN_MS = 15000;
const r2 = (v: number) => Math.round(v * 100) / 100;
const ten = (c: Card) => (c.r === 14 ? 11 : Math.min(10, c.r));

interface Hand { cards: Card[]; bt: number; doubled: boolean; done: boolean; split: boolean; r?: BHand['r']; pay?: number }
interface Seat { id: string; p: string; n: string; av: string; fr?: string; ns?: string; k: number; bet: number; rd: boolean; hands: Hand[]; ah: number; w: boolean; lv: boolean; timeouts: number; tu: number }

export class BlackjackEngine implements Engine<BState> {
  private seats: (Seat | null)[];
  private shoe = new Shoe(6);
  private ph: BState['ph'] = 'wait';
  private round = 0;
  private dealer: Card[] = [];
  private holeUp = false;
  private ta = -1;
  private tq = 0;
  private until = 0;
  private deadline = 0;
  private seq = 1;
  private out: { rid: string; k: number }[] = [];
  private note: string | undefined;

  constructor(private table: LiveTable) {
    this.seats = Array(table.seats).fill(null);
  }

  adopt(prev: BState | null) {
    if (!prev || prev.t !== this.table.id) return;
    this.seq = prev.seq + 1;
    this.round = prev.r;
    this.out = prev.out ?? [];
    const midRound = prev.ph === 'deal' || prev.ph === 'play' || prev.ph === 'dealer';
    prev.s.forEach((x, i) => {
      if (!x || i >= this.table.seats) return;
      const back = midRound ? x.hs.reduce((a, h) => a + h.bt, 0) : 0;
      this.seats[i] = { id: x.id, p: x.p, n: x.n, av: x.av, fr: x.fr, ns: x.ns, k: r2(x.k + back), bet: 0, rd: false, hands: [], ah: 0, w: false, lv: !!x.lv, timeouts: 0, tu: x.tu ?? 0 };
    });
    if (midRound) this.note = 'New dealer — the last round was called off and every bet went back';
    this.ph = 'wait';
    this.until = Date.now() + 2000;
  }

  private remove(i: number) {
    const s = this.seats[i];
    if (!s) return;
    this.out = [{ rid: s.id, k: r2(s.k) }, ...this.out.filter((o) => o.rid !== s.id)].slice(0, 12);
    this.seats[i] = null;
  }

  private inRound(s: Seat) { return s.hands.length > 0; }

  private syncPeers(peers: PeerView[], now: number) {
    let changed = false;
    const byPeer = new Map(peers.map((p) => [p.peer, p]));
    this.seats.forEach((s, i) => {
      if (!s) return;
      const sit = byPeer.get(s.p)?.pres.sit;
      if (!s.lv && sit?.rid !== s.id) { s.lv = true; changed = true; }
      // chips added from the wallet (e.g. to cover a split or double); never past the table maximum
      const tu = r2(+(sit?.tu ?? 0) || 0);
      if (!s.lv && sit?.rid === s.id && tu > s.tu && s.k + (tu - s.tu) <= this.table.buyMax) { s.k = r2(s.k + tu - s.tu); s.tu = tu; changed = true; }
      if (s.lv && !this.inRound(s)) { this.remove(i); changed = true; }
    });
    for (const p of peers) {
      const sit = p.pres.sit;
      if (!sit || !p.pres.id) continue;
      if (this.seats.some((s) => s && (s.id === sit.rid || s.p === p.peer))) continue;
      if (this.out.some((o) => o.rid === sit.rid)) continue;
      const buy = r2(+sit.buy);
      if (!(buy >= this.table.buyMin && buy <= this.table.buyMax)) continue;
      const free = this.seats.map((s, i) => (s ? -1 : i)).filter((i) => i >= 0);
      if (!free.length) continue;
      const at = free.includes(sit.seat) ? sit.seat : free.sort((a, b) => Math.abs(a - sit.seat) - Math.abs(b - sit.seat))[0];
      const id = p.pres.id;
      const waiting = this.ph !== 'wait' && this.ph !== 'bet' && this.ph !== 'settle';
      this.seats[at] = { id: sit.rid, p: p.peer, n: String(id.nm ?? 'Player').slice(0, 18), av: String(id.av ?? ''), fr: id.fr, ns: id.ns, k: buy, bet: 0, rd: false, hands: [], ah: 0, w: waiting, lv: false, timeouts: 0, tu: 0 };
      changed = true;
    }
    // bets and "deal me in" while betting is open
    if (this.ph === 'bet') {
      this.seats.forEach((s) => {
        if (!s || s.lv) return;
        const b = byPeer.get(s.p)?.pres.bet;
        const want = b && b.r === this.round ? r2(+b.a) : 0;
        const bet = want >= this.table.lo && want <= Math.min(this.table.hi, s.k) ? want : 0;
        const a = byPeer.get(s.p)?.pres.act;
        const rd = !!(bet && a && a.h === this.round && a.t === 'deal');
        if (bet !== s.bet || rd !== s.rd) { s.bet = bet; s.rd = rd; changed = true; }
      });
    }
    void now;
    return changed;
  }

  private active() { return this.seats.filter((s): s is Seat => !!s && !s.lv); }

  private openBetting(now: number) {
    this.round++;
    this.ph = 'bet';
    this.dealer = []; this.holeUp = false; this.ta = -1;
    this.seats.forEach((s) => { if (s) { s.hands = []; s.ah = 0; s.bet = 0; s.rd = false; s.w = false; } });
    this.until = now + BJ_BET_MS;
  }

  private draw(): Card {
    // dev builds only: tests can stack the next cards ("8s8d…")
    const q = import.meta.env.DEV ? (globalThis as { __bjCards?: string[] }).__bjCards : undefined;
    if (q?.length) return dec(q.shift()!);
    return this.shoe.draw();
  }

  private deal(now: number) {
    const players = this.seats.map((s, i) => [s, i] as const).filter(([s]) => s && s.bet > 0 && !s.lv) as [Seat, number][];
    if (!players.length) { this.until = now + BJ_BET_MS; return; }
    for (const [s] of players) { s.k = r2(s.k - s.bet); s.hands = [{ cards: [], bt: s.bet, doubled: false, done: false, split: false }]; s.ah = 0; }
    for (let r = 0; r < 2; r++) {
      for (const [s] of players) s.hands[0].cards.push(this.draw());
      this.dealer.push(this.draw());
    }
    this.ph = 'deal';
    this.until = now + 700 + (players.length * 2 + 2) * 380;
  }

  /** After the deal: dealer peeks on an ace or ten; naturals stand. */
  private afterDeal(now: number) {
    const up = this.dealer[0];
    const dealerBJ = (up.r === 14 || ten(up) === 10) && isBlackjack(this.dealer);
    for (const s of this.seats) if (s?.hands.length && isBlackjack(s.hands[0].cards)) s.hands[0].done = true;
    if (dealerBJ) { this.holeUp = true; this.settle(now); return; }
    this.ph = 'play';
    this.ta = -1;
    this.nextTurn(now);
  }

  private nextTurn(now: number) {
    for (let i = 0; i < this.seats.length; i++) {
      const s = this.seats[i];
      if (!s?.hands.length) continue;
      const h = s.hands.findIndex((x) => !x.done);
      if (h >= 0) { this.ta = i; s.ah = h; this.tq++; this.deadline = now + BJ_TURN_MS; return; }
    }
    this.ta = -1;
    this.ph = 'dealer';
    this.holeUp = true;
    this.until = now + 900;
  }

  private act(s: Seat, t: string, now: number) {
    const h = s.hands[s.ah];
    if (!h || h.done) return false;
    const v = () => bjValue(h.cards).total;
    if (t === 'hit') {
      h.cards.push(this.draw());
      if (v() >= 21) h.done = true;
    } else if (t === 'stand') {
      h.done = true;
    } else if (t === 'double') {
      if (h.cards.length !== 2 || s.k < h.bt) return false;
      s.k = r2(s.k - h.bt); h.bt = r2(h.bt * 2); h.doubled = true;
      h.cards.push(this.draw()); h.done = true;
    } else if (t === 'split') {
      const [a, b] = h.cards;
      if (h.cards.length !== 2 || s.hands.length > 1 || ten(a) !== ten(b) || s.k < h.bt) return false;
      s.k = r2(s.k - h.bt);
      const aces = a.r === 14;
      const h2: Hand = { cards: [b, this.draw()], bt: h.bt, doubled: false, done: aces, split: true };
      h.cards = [a, this.draw()]; h.split = true; h.done = aces;
      s.hands.push(h2);
      if (!aces && v() === 21) h.done = true;
      if (!aces && bjValue(h2.cards).total === 21) h2.done = true;
    } else return false;
    // this hand finished: on to the next (split hand or player)
    if (h.done) { const nx = s.hands.findIndex((x) => !x.done); if (nx >= 0) { s.ah = nx; this.tq++; this.deadline = now + BJ_TURN_MS; return true; } this.nextTurn(now); return true; }
    this.tq++;
    this.deadline = now + BJ_TURN_MS;
    return true;
  }

  private dealerStep(now: number) {
    const live = this.seats.some((s) => s?.hands.some((h) => bjValue(h.cards).total <= 21 && !(isBlackjack(h.cards) && !h.split)));
    const v = bjValue(this.dealer);
    if (live && (v.total < 17)) { this.dealer.push(this.draw()); this.until = now + 750; return; }
    this.settle(now);
  }

  private settle(now: number) {
    const dv = bjValue(this.dealer).total;
    const dBJ = isBlackjack(this.dealer);
    for (const s of this.seats) {
      if (!s?.hands.length) continue;
      for (const h of s.hands) {
        const pv = bjValue(h.cards).total;
        const natural = isBlackjack(h.cards) && !h.split;
        let r: Hand['r'];
        if (natural && !dBJ) r = 'bj';
        else if (natural && dBJ) r = 'push';
        else if (dBJ) r = 'lose';
        else if (pv > 21) r = 'lose';
        else if (dv > 21 || pv > dv) r = 'win';
        else if (pv === dv) r = 'push';
        else r = 'lose';
        const pay = r === 'bj' ? h.bt * 2.5 : r === 'win' ? h.bt * 2 : r === 'push' ? h.bt : 0;
        h.r = r; h.pay = r2(pay); h.done = true;
        s.k = r2(s.k + pay);
      }
    }
    this.ph = 'settle';
    this.ta = -1;
    this.until = now + 4200;
  }

  step(now: number, peers: PeerView[]): boolean {
    let changed = this.syncPeers(peers, now);
    const players = this.active();
    if (this.ph === 'wait') {
      if (players.length && now >= this.until) { this.openBetting(now); changed = true; }
      const note = players.length ? undefined : 'Take a seat to start the game';
      if (note !== this.note && !(this.note?.startsWith('New dealer') && now < this.until)) { this.note = note; changed = true; }
    } else if (this.ph === 'bet') {
      if (!players.length) { this.ph = 'wait'; changed = true; }
      else {
        const betting = players.filter((s) => s.k >= this.table.lo);
        const allReady = betting.length > 0 && betting.every((s) => s.bet > 0 && s.rd);
        if (allReady || now >= this.until) {
          if (players.some((s) => s.bet > 0)) this.deal(now);
          else this.until = now + BJ_BET_MS;
          changed = true;
        }
      }
    } else if (now < this.until) {
      // dealing / dealer drawing animations
    } else if (this.ph === 'deal') {
      this.afterDeal(now); changed = true;
    } else if (this.ph === 'play') {
      const s = this.ta >= 0 ? this.seats[this.ta] : null;
      if (!s) { this.nextTurn(now); changed = true; }
      else if (s.lv) { this.act(s, 'stand', now); changed = true; }
      else {
        const a = peers.find((p) => p.peer === s.p)?.pres.act;
        if (a && a.h === this.round && a.q === this.tq && this.act(s, a.t, now)) { s.timeouts = 0; changed = true; }
        else if (now >= this.deadline) { s.timeouts++; this.act(s, 'stand', now); changed = true; }
      }
    } else if (this.ph === 'dealer') {
      this.dealerStep(now); changed = true;
    } else if (this.ph === 'settle') {
      this.seats.forEach((s, i) => { if (s && (s.lv || s.k < this.table.lo || s.timeouts >= 3)) this.remove(i); });
      if (this.active().length) this.openBetting(now); else { this.ph = 'wait'; this.dealer = []; }
      changed = true;
    }
    if (changed) this.seq++;
    return changed;
  }

  state(): BState {
    const now = Date.now();
    return {
      seq: this.seq, out: this.out, t: this.table.id, r: this.round, ph: this.ph,
      d: this.dealer.length ? (this.holeUp ? encList(this.dealer) : enc(this.dealer[0]) + (this.dealer.length > 1 ? '??' : '')) : '',
      ta: this.ph === 'play' ? this.ta : -1, tq: this.tq,
      tl: this.ph === 'bet' ? Math.max(0, this.until - now) : this.ph === 'play' ? Math.max(0, this.deadline - now) : 0,
      s: this.seats.map((s) => {
        if (!s) return null;
        const x: BSeat = { id: s.id, p: s.p, n: s.n, av: s.av, k: r2(s.k), bet: s.bet, hs: s.hands.map((h) => {
          const o: BHand = { c: encList(h.cards), bt: h.bt };
          if (h.doubled) o.d = 1;
          if (h.done) o.x = 1;
          if (h.r) { o.r = h.r; o.pay = h.pay; }
          return o;
        }), ah: s.ah };
        if (s.fr) x.fr = s.fr;
        if (s.ns) x.ns = s.ns;
        if (s.tu) x.tu = s.tu;
        if (s.rd) x.rd = 1;
        if (s.w) x.w = 1;
        if (s.lv) x.lv = 1;
        return x;
      }),
      note: this.note,
    };
  }

  /** Nothing secret per player: the hole card stays with the host until it's turned over. */
  secrets() { return { key: '', list: [] as [number, string, string][] }; }
}
