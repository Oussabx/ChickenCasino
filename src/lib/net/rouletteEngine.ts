import { rand } from '../rng';
import { LiveTable } from './tables';
import { BaseState, Engine, PeerView } from './live';

/*
 * The host's roulette table: one wheel, one clock, everyone bets together.
 * Players place chips on their own pages (coins leave their wallet as they
 * place them); the host only runs the rounds and spins the wheel. Each page pays
 * itself from the winning number, so there's nothing to hold for anyone.
 */

export interface RState extends BaseState {
  t: string;
  r: number;
  ph: 'bet' | 'spin' | 'result';
  /** Winning number once the wheel is spun (-1 before). */
  n: number;
  /** Recent numbers, newest first. */
  hist: number[];
  /** Kept empty: roulette has no seats (players are the room's bettors). */
  s: never[];
}

export const RL_BET_MS = 20000;
export const RL_SPIN_MS = 7000;
export const RL_RESULT_MS = 5500;
export const RL_MAX_PLAYERS = 25;

export class RouletteEngine implements Engine<RState> {
  private r = 1;
  private ph: RState['ph'] = 'bet';
  private n = -1;
  private hist: number[] = [];
  private until = Date.now() + RL_BET_MS;
  private seq = 1;

  constructor(private table: LiveTable) {}

  adopt(prev: RState | null) {
    if (!prev || prev.t !== this.table.id) return;
    // carry on exactly where the last host was: the winning number is already public
    this.seq = prev.seq + 1;
    this.r = prev.r; this.ph = prev.ph; this.n = prev.n; this.hist = prev.hist ?? [];
    this.until = Date.now() + (this.ph === 'bet' ? Math.max(5000, prev.tl ?? RL_BET_MS) : this.ph === 'spin' ? RL_SPIN_MS : 2500);
  }

  step(now: number, peers: PeerView[]): boolean {
    if (now < this.until) return false;
    if (this.ph === 'bet') {
      const betting = peers.some((p) => p.pres.rb?.r === this.r && Object.keys(p.pres.rb.b ?? {}).length);
      if (!betting) { this.until = now + RL_BET_MS; this.seq++; return true; } // nobody bet: keep the table open
      this.n = Math.floor(rand() * 37);
      this.ph = 'spin';
      this.until = now + RL_SPIN_MS;
    } else if (this.ph === 'spin') {
      this.ph = 'result';
      this.hist = [this.n, ...this.hist].slice(0, 40);
      this.until = now + RL_RESULT_MS;
    } else {
      this.r++;
      this.ph = 'bet';
      this.n = -1;
      this.until = now + RL_BET_MS;
    }
    this.seq++;
    return true;
  }

  state(): RState {
    return { seq: this.seq, out: [], t: this.table.id, r: this.r, ph: this.ph, n: this.n, hist: this.hist, tl: Math.max(0, this.until - Date.now()), s: [] };
  }

  secrets() { return { key: '', list: [] as [number, string, string][] }; }
}
