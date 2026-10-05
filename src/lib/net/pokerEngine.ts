import { Shoe } from '../cards';
import { Game, Seat, act, alive, inHand, legal, nextStreet, returnUncalled, roundOver, showdown, startHand } from '../holdem';
import { LiveTable } from './tables';
import { BaseState, Engine, PeerView } from './live';
import { encList } from './cardsCodec';

/* The host's Texas Hold'em table: real players only; a hand is dealt once two of them have chips. */

export interface PSeat {
  /** Seat session id, chosen by the player's page. */
  id: string;
  /** Owner's peer label. */
  p: string;
  n: string;
  av: string;
  fr?: string;
  ns?: string;
  k: number;
  b: number;
  tt: number;
  f?: 1;
  ai?: 1;
  /** Dealt into this hand. */
  in?: 1;
  l?: string;
  /** Sat down mid-hand: plays from the next one. */
  w?: 1;
  /** Standing up at the end of this hand. */
  lv?: 1;
}

export interface PState extends BaseState {
  t: string;
  h: number;
  ph: 'wait' | 'play' | 'show';
  /** Street: 0 pre-flop … 3 river, 4 showdown. */
  sr: number;
  bd: string;
  btn: number;
  ta: number;
  tq: number;
  cb: number;
  mr: number;
  s: (PSeat | null)[];
  win?: { s: number[]; a: number; hn: string }[];
  sh?: Record<string, string>;
  note?: string;
}

const STREETS = ['preflop', 'flop', 'turn', 'river', 'showdown'] as const;
export const TURN_MS = 20000;
const r2 = (v: number) => Math.round(v * 100) / 100;

interface Meta { id: string; p: string; n: string; av: string; fr?: string; ns?: string; w?: boolean; lv?: boolean; timeouts: number }

const emptySeat = (i: number): Seat => ({ id: i, name: '', avatar: '', human: false, stack: 0, hole: [], bet: 0, total: 0, folded: true, allIn: false, acted: false, sittingOut: true, style: { loose: 0.5, aggro: 0.5 } });

export class PokerEngine implements Engine<PState> {
  private g: Game;
  private meta: (Meta | null)[];
  private ph: PState['ph'] = 'wait';
  private seq = 1;
  private tq = 0;
  private until = 0;      // busy (animations) until
  private deadline = 0;   // action clock
  private win: PState['win'];
  private sh: Record<string, string> | undefined;
  private note: string | undefined;
  private out: { rid: string; k: number }[] = [];
  private busy = false;

  constructor(private table: LiveTable) {
    this.g = { seats: Array.from({ length: table.seats }, (_, i) => emptySeat(i)), button: 0, sb: table.lo, bb: table.hi, board: [], street: 'preflop', toAct: -1, currentBet: 0, minRaise: table.hi, shoe: Shoe.fresh(), handNo: 0 };
    this.meta = Array(table.seats).fill(null);
  }

  adopt(prev: PState | null) {
    if (!prev || prev.t !== this.table.id) return;
    this.seq = prev.seq + 1;
    this.g.handNo = prev.h;
    this.g.button = Math.max(0, prev.btn);
    this.out = prev.out ?? [];
    prev.s.forEach((x, i) => {
      if (!x || i >= this.table.seats) return;
      // a hand that was running is called off: everything put in goes back
      const stack = prev.ph === 'play' ? r2(x.k + x.tt) : x.k;
      this.g.seats[i] = { ...emptySeat(i), name: x.n, human: true, stack, sittingOut: stack <= 0, folded: false };
      this.meta[i] = { id: x.id, p: x.p, n: x.n, av: x.av, fr: x.fr, ns: x.ns, lv: !!x.lv, timeouts: 0 };
    });
    if (prev.ph === 'play') this.note = 'New dealer — the last hand was called off and every bet went back';
    this.ph = 'wait';
    this.until = Date.now() + 2500;
  }

  /* ---------- seats ---------- */

  private humans() { return this.meta.filter((m) => m && !m.lv).length; }
  private freeSeats() { return this.meta.map((m, i) => (m ? -1 : i)).filter((i) => i >= 0); }

  private remove(i: number) {
    const m = this.meta[i];
    if (!m) return;
    this.out = [{ rid: m.id, k: r2(this.g.seats[i].stack) }, ...this.out.filter((o) => o.rid !== m.id)].slice(0, 12);
    this.meta[i] = null;
    this.g.seats[i] = emptySeat(i);
  }

  private seat(i: number, m: Meta, stack: number, waiting: boolean) {
    this.meta[i] = { ...m, w: waiting };
    this.g.seats[i] = { ...emptySeat(i), name: m.n, human: true, stack: r2(stack), sittingOut: waiting, folded: waiting };
  }

  /** Seat requests, leavers and disconnects from the room. */
  private syncPeers(peers: PeerView[]) {
    let changed = false;
    const byPeer = new Map(peers.map((p) => [p.peer, p]));
    // players who left the room or stood up (they fold when their turn comes)
    this.meta.forEach((m, i) => {
      if (!m) return;
      if (!m.lv && byPeer.get(m.p)?.pres.sit?.rid !== m.id) { m.lv = true; changed = true; }
      if (m.lv && (this.ph === 'wait' || !this.g.seats[i].hole.length)) { this.remove(i); changed = true; }
    });
    // new seat requests
    for (const p of peers) {
      const sit = p.pres.sit;
      if (!sit || !p.pres.id) continue;
      if (this.meta.some((m) => m && (m.id === sit.rid || m.p === p.peer))) continue;
      if (this.out.some((o) => o.rid === sit.rid)) continue; // that seat session is over
      const buy = r2(+sit.buy);
      if (!(buy >= this.table.buyMin && buy <= this.table.buyMax)) continue;
      const free = this.freeSeats();
      if (!free.length) {
        continue;
      }
      const want = free.includes(sit.seat) ? sit.seat : free.sort((a, b) => Math.abs(a - sit.seat) - Math.abs(b - sit.seat))[0];
      const id = p.pres.id;
      this.seat(want, { id: sit.rid, p: p.peer, n: String(id.nm ?? 'Player').slice(0, 18), av: String(id.av ?? ''), fr: id.fr, ns: id.ns, timeouts: 0 }, buy, this.ph !== 'wait');
      changed = true;
    }
    return changed;
  }

  /* ---------- hand flow ---------- */

  private eligible() { return this.meta.filter((m, i) => m && !m.lv && this.g.seats[i].stack > 0).length; }

  private beginHand(now: number) {
    const g = this.g;
    g.shoe = Shoe.fresh();
    this.meta.forEach((m) => { if (m) m.w = false; });
    startHand(g);
    this.win = undefined; this.sh = undefined; this.note = undefined;
    this.ph = 'play';
    const dealt = g.seats.filter((s) => !s.sittingOut).length;
    this.until = now + 900 + dealt * 2 * 230;
    this.newTurn(this.until);
  }

  private newTurn(from: number) {
    this.tq++;
    this.deadline = from + TURN_MS;
  }

  private finishRound(now: number) {
    const g = this.g;
    returnUncalled(g);
    const contenders = alive(g);
    if (contenders.length <= 1 || g.street === 'river') { this.toShowdown(now); return; }
    const actors = g.seats.filter((s) => inHand(s) && !s.allIn).length;
    if (actors <= 1 && !this.sh) this.reveal();
    const dealt = nextStreet(g);
    this.until = now + 700 + dealt.length * 260 + (actors <= 1 ? 900 : 0);
    this.newTurn(this.until);
  }

  private reveal() {
    const sh: Record<string, string> = {};
    this.g.seats.forEach((s, i) => { if (inHand(s) && s.hole.length) sh[i] = encList(s.hole); });
    this.sh = sh;
  }

  private toShowdown(now: number) {
    const g = this.g;
    const contenders = alive(g);
    if (contenders.length > 1) this.reveal();
    const res = showdown(g);
    this.win = res.map((r) => ({ s: r.winners, a: r.amount, hn: contenders.length > 1 ? r.hand : '' }));
    this.ph = 'show';
    this.until = now + (contenders.length > 1 ? 5200 : 3200);
    g.toAct = -1;
  }

  private endHand(now: number) {
    const g = this.g;
    this.meta.forEach((m, i) => {
      if (!m) return;
      // leavers, busted players and anyone who timed out twice in a row stand up
      if (m.lv || g.seats[i].stack <= 0 || m.timeouts >= 2) this.remove(i);
    });
    for (const s of g.seats) { s.hole = []; s.bet = 0; s.total = 0; s.last = undefined; s.folded = false; s.allIn = false; }
    g.board = []; g.street = 'preflop'; g.toAct = -1; g.currentBet = 0;
    this.win = undefined; this.sh = undefined;
    this.ph = 'wait';
    this.until = now + 1800;
  }

  step(now: number, peers: PeerView[]): boolean {
    let changed = this.syncPeers(peers);
    const g = this.g;
    const busy = now < this.until;
    if (busy !== this.busy) { this.busy = busy; changed = true; }
    if (this.ph === 'wait') {
      // a hand needs at least two players with chips
      if (now >= this.until && this.eligible() >= 2) { this.beginHand(now); changed = true; }
      else {
        const note = this.eligible() < 2 ? (this.humans() ? 'Waiting for a second player to deal the cards…' : 'Take a seat — the game starts with 2 players') : undefined;
        if (note !== this.note && !(this.note && this.note.startsWith('New dealer') && now < this.until)) { this.note = note; changed = true; }
      }
    } else if (this.ph === 'show') {
      if (now >= this.until) { this.endHand(now); changed = true; }
    } else if (now >= this.until) {
      if (roundOver(g) || g.toAct < 0) { this.finishRound(now); return true; }
      const i = g.toAct;
      const m = this.meta[i];
      const seat = g.seats[i];
      if (!m || m.lv) { act(g, 'fold'); this.newTurn(now + 300); return true; }
      {
        const p = peers.find((x) => x.peer === m.p);
        const a = p?.pres.act;
        if (a && a.h === g.handNo && a.q === this.tq) {
          const L = legal(g, i);
          const t = a.t as Parameters<typeof act>[1];
          const ok = t === 'fold' || t === 'allin' || (t === 'check' && L.canCheck) || (t === 'call' && !L.canCheck) || ((t === 'bet' || t === 'raise') && L.canRaise);
          if (ok) { act(g, t, +(a.a ?? 0)); m.timeouts = 0; this.newTurn(now + 250); changed = true; }
        } else if (now >= this.deadline) {
          // out of time: check if free, otherwise fold
          act(g, legal(g, i).canCheck ? 'check' : 'fold');
          seat.last = seat.folded ? 'Timed out' : 'Check';
          m.timeouts++;
          this.newTurn(now + 250);
          changed = true;
        }
      }
    }
    if (changed) this.seq++;
    return changed;
  }

  state(): PState {
    const g = this.g;
    return {
      seq: this.seq, out: this.out, t: this.table.id, h: g.handNo, ph: this.ph,
      sr: STREETS.indexOf(g.street), bd: encList(g.board), btn: g.button, ta: this.ph === 'play' && Date.now() >= this.until ? g.toAct : -1, tq: this.tq,
      cb: g.currentBet, mr: g.minRaise,
      tl: this.ph === 'play' ? Math.max(0, this.deadline - Date.now()) : this.ph === 'wait' ? Math.max(0, this.until - Date.now()) : 0,
      s: this.meta.map((m, i) => {
        if (!m) return null;
        const s = g.seats[i];
        const x: PSeat = { id: m.id, p: m.p, n: m.n, av: m.av, k: r2(s.stack), b: r2(s.bet), tt: r2(s.total) };
        if (m.fr) x.fr = m.fr;
        if (m.ns) x.ns = m.ns;
        if (s.folded && s.hole.length) x.f = 1;
        if (s.allIn) x.ai = 1;
        if (s.hole.length) x.in = 1;
        if (s.last) x.l = s.last;
        if (m.w) x.w = 1;
        if (m.lv) x.lv = 1;
        return x;
      }),
      win: this.win, sh: this.sh, note: this.note,
    };
  }

  secrets() {
    const list: [number, string, string][] = [];
    // [seat, owner's peer, cards]: the LiveTable seals each for that peer's public key
    this.g.seats.forEach((s, i) => { const m = this.meta[i]; if (m && s.hole.length) list.push([i, m.p, encList(s.hole)]); });
    return { key: `${this.g.handNo}|${list.map((x) => x[0] + x[1]).join(',')}`, list };
  }
}
