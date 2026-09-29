import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DAILY_REWARDS, GameId, PROMO_CODES, itemById, levelFromXp, tierForLevel,
} from './lib/data';
import { uid } from './lib/format';

export interface Round {
  id: string;
  game: GameId;
  bet: number;
  multiplier: number;
  payout: number;
  at: number;
  detail?: string;
}

export type TxKind = 'bonus' | 'daily' | 'shop' | 'promo' | 'mission' | 'rakeback' | 'level' | 'exchange' | 'faucet';
export interface Tx { id: string; kind: TxKind; label: string; coins: number; eggs: number; at: number }

export interface Settings {
  sound: boolean;
  volume: number;
  reduceMotion: boolean;
  turbo: boolean;
  hideBalance: boolean;
  confirmOver: number;
  sessionReminder: number;
  lossLimit: number;
  showLiveFeed: boolean;
  bigWinCelebration: boolean;
  defaultBet: number;
}

interface GameStat { rounds: number; wagered: number; profit: number; best: number }
interface Stats { wagered: number; won: number; rounds: number; biggestWin: number; biggestMult: number; perGame: Partial<Record<GameId, GameStat>> }

export interface Equipped { avatar: string; frame: string; skin: string; ball: string; title: string }

export const today = () => new Date().toISOString().slice(0, 10);

export const MISSIONS = [
  { id: 'play10', label: 'Play 10 rounds', goal: 10, reward: { eggs: 2 } },
  { id: 'variety3', label: 'Play 3 different games', goal: 3, reward: { eggs: 3 } },
  { id: 'win5x', label: 'Land a 5× or higher win', goal: 1, reward: { eggs: 5 } },
  { id: 'wager5k', label: 'Wager 5,000 coins', goal: 5000, reward: { coins: 3000 } },
] as const;

export function missionProgress(id: string, rounds: Round[]) {
  const d = today();
  const r = rounds.filter((x) => new Date(x.at).toISOString().slice(0, 10) === d);
  switch (id) {
    case 'play10': return r.length;
    case 'variety3': return new Set(r.map((x) => x.game)).size;
    case 'win5x': return r.some((x) => x.multiplier >= 5) ? 1 : 0;
    case 'wager5k': return r.reduce((s, x) => s + x.bet, 0);
    default: return 0;
  }
}

export function todaysNet(rounds: Round[]) {
  const d = today();
  return rounds
    .filter((x) => new Date(x.at).toISOString().slice(0, 10) === d)
    .reduce((s, x) => s + x.payout - x.bet, 0);
}

/* ---------- toasts (ephemeral) ---------- */
export interface Toast { id: string; title: string; desc?: string; tone?: 'gold' | 'red' | 'neutral' | 'green' }
interface ToastState { toasts: Toast[]; push: (t: Omit<Toast, 'id'>) => void; dismiss: (id: string) => void }
export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = uid();
    set({ toasts: [...get().toasts.slice(-3), { ...t, id }] });
    setTimeout(() => get().dismiss(id), 3800);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
}));
export const toast = (t: Omit<Toast, 'id'>) => useToasts.getState().push(t);

/* ---------- UI (ephemeral) ---------- */
interface UIState {
  auth: null | 'login' | 'signup';
  celebrate: null | { amount: number; mult: number };
  openAuth: (m: 'login' | 'signup' | null) => void;
  setCelebrate: (c: UIState['celebrate']) => void;
}
export const useUI = create<UIState>((set) => ({
  auth: null,
  celebrate: null,
  openAuth: (auth) => set({ auth }),
  setCelebrate: (celebrate) => set({ celebrate }),
}));

/* ---------- main persisted store ---------- */
interface State {
  user: { name: string; joinedAt: number } | null;
  balance: number;
  eggs: number;
  xp: number;
  rounds: Round[];
  txs: Tx[];
  inventory: string[];
  equipped: Equipped;
  settings: Settings;
  daily: { last: string | null; streak: number };
  missions: { date: string; claimed: string[] };
  promoUsed: string[];
  favorites: GameId[];
  rakebackBase: number;
  breakUntil: number;
  lastFaucet: number;
  stats: Stats;
  tournaments: string[];

  signup: (name: string, avatar?: string) => void;
  login: (name: string) => void;
  logout: () => void;
  betError: (amount: number) => string | null;
  placeBet: (amount: number) => boolean;
  settle: (game: GameId, bet: number, multiplier: number, detail?: string) => number;
  grant: (kind: TxKind, label: string, coins: number, eggs?: number) => void;
  buy: (id: string) => string | null;
  equip: (id: string) => void;
  claimDaily: () => boolean;
  claimMission: (id: string) => boolean;
  redeem: (code: string) => string;
  claimRakeback: () => number;
  faucet: () => boolean;
  updateSettings: (s: Partial<Settings>) => void;
  toggleFav: (id: GameId) => void;
  joinTournament: (id: string) => void;
  takeBreak: (hours: number) => void;
  resetAll: () => void;
}

const DEFAULT_SETTINGS: Settings = {
  sound: true, volume: 0.6, reduceMotion: false, turbo: false, hideBalance: false, confirmOver: 0,
  sessionReminder: 0, lossLimit: 0, showLiveFeed: true, bigWinCelebration: true, defaultBet: 10,
};

const initial = {
  user: null,
  balance: 0,
  eggs: 0,
  xp: 0,
  rounds: [] as Round[],
  txs: [] as Tx[],
  inventory: ['av-classic', 'fr-none', 'sk-classic', 'bl-gold', 'tt-none'],
  equipped: { avatar: 'av-classic', frame: 'fr-none', skin: 'sk-classic', ball: 'bl-gold', title: 'tt-none' },
  settings: DEFAULT_SETTINGS,
  daily: { last: null, streak: 0 },
  missions: { date: today(), claimed: [] as string[] },
  promoUsed: [] as string[],
  favorites: [] as GameId[],
  rakebackBase: 0,
  breakUntil: 0,
  lastFaucet: 0,
  stats: { wagered: 0, won: 0, rounds: 0, biggestWin: 0, biggestMult: 0, perGame: {} } as Stats,
  tournaments: [] as string[],
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...initial,

      signup: (name, avatar) => {
        const s = get();
        const first = !s.txs.some((t) => t.kind === 'bonus');
        set({ user: { name, joinedAt: Date.now() } });
        if (avatar) get().equip(avatar);
        if (first) {
          get().grant('bonus', 'Welcome bonus', 10000, 10);
          toast({ title: 'Welcome to the coop! 🐔', desc: '10,000 coins + 10 golden eggs added', tone: 'gold' });
        } else {
          toast({ title: `Welcome back, ${name}!`, tone: 'gold' });
        }
      },
      login: (name) => get().signup(name),
      logout: () => set({ user: null }),

      betError: (amount) => {
        const s = get();
        if (!s.user) return 'signup';
        if (!(amount > 0)) return 'Enter a bet amount';
        if (amount > s.balance + 1e-9) return 'Insufficient balance';
        if (s.breakUntil > Date.now()) return 'You are on a break — betting is paused';
        if (s.settings.lossLimit > 0 && -todaysNet(s.rounds) >= s.settings.lossLimit)
          return 'Daily loss limit reached';
        return null;
      },

      placeBet: (amount) => {
        const err = get().betError(amount);
        if (err === 'signup') {
          useUI.getState().openAuth('signup');
          return false;
        }
        if (err) {
          toast({ title: err, tone: 'red' });
          return false;
        }
        set((s) => ({ balance: +(s.balance - amount).toFixed(2) }));
        return true;
      },

      settle: (game, bet, multiplier, detail) => {
        const payout = +(bet * multiplier).toFixed(2);
        const s = get();
        const prevLevel = levelFromXp(s.xp);
        const xp = s.xp + Math.max(1, Math.round(bet / 5));
        const pg = s.stats.perGame[game] ?? { rounds: 0, wagered: 0, profit: 0, best: 0 };
        const round: Round = { id: uid(), game, bet, multiplier, payout, at: Date.now(), detail };
        set({
          balance: +(s.balance + payout).toFixed(2),
          xp,
          rounds: [round, ...s.rounds].slice(0, 500),
          stats: {
            wagered: s.stats.wagered + bet,
            won: s.stats.won + payout,
            rounds: s.stats.rounds + 1,
            biggestWin: Math.max(s.stats.biggestWin, payout - bet),
            biggestMult: Math.max(s.stats.biggestMult, multiplier),
            perGame: {
              ...s.stats.perGame,
              [game]: { rounds: pg.rounds + 1, wagered: pg.wagered + bet, profit: pg.profit + payout - bet, best: Math.max(pg.best, multiplier) },
            },
          },
        });
        const lvl = levelFromXp(xp);
        if (lvl > prevLevel) {
          const eggs = lvl * (tierForLevel(lvl).minLevel >= 5 ? 2 : 1);
          get().grant('level', `Reached level ${lvl}`, 0, eggs);
          toast({ title: `Level up! You're now level ${lvl}`, desc: `+${eggs} golden eggs 🥚`, tone: 'gold' });
        }
        if (multiplier >= 10 && payout >= 100 && s.settings.bigWinCelebration) {
          useUI.getState().setCelebrate({ amount: payout, mult: multiplier });
        }
        return payout;
      },

      grant: (kind, label, coins, eggs = 0) =>
        set((s) => ({
          balance: +(s.balance + coins).toFixed(2),
          eggs: s.eggs + eggs,
          txs: [{ id: uid(), kind, label, coins, eggs, at: Date.now() }, ...s.txs].slice(0, 300),
        })),

      buy: (id) => {
        const item = itemById(id);
        const s = get();
        if (!item) return 'Unknown item';
        if (!s.user) { useUI.getState().openAuth('signup'); return 'Sign up first'; }
        if (item.kind !== 'bundle' && s.inventory.includes(id)) return 'Already owned';
        if (item.minLevel && levelFromXp(s.xp) < item.minLevel) return `Requires level ${item.minLevel}`;
        const have = item.currency === 'coins' ? s.balance : s.eggs;
        if (have < item.price) return `Not enough ${item.currency === 'coins' ? 'coins' : 'golden eggs'}`;
        const coins = (item.currency === 'coins' ? -item.price : 0) + (item.coins ?? 0);
        const eggs = item.currency === 'eggs' ? -item.price : 0;
        get().grant(item.kind === 'bundle' ? 'exchange' : 'shop', item.name, coins, eggs);
        if (item.kind !== 'bundle') set((st) => ({ inventory: [...st.inventory, id] }));
        return null;
      },

      equip: (id) => {
        const item = itemById(id);
        if (!item || item.kind === 'bundle') return;
        const map = { avatar: 'avatar', frame: 'frame', skin: 'skin', ball: 'ball', title: 'title' } as const;
        set((s) => ({ equipped: { ...s.equipped, [map[item.kind as keyof typeof map]]: id } }));
      },

      claimDaily: () => {
        const s = get();
        const d = today();
        if (s.daily.last === d) return false;
        const yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
        const streak = s.daily.last === yest ? (s.daily.streak % 7) + 1 : 1;
        const r = DAILY_REWARDS[streak - 1];
        set({ daily: { last: d, streak } });
        get().grant('daily', `Daily reward — day ${streak}`, r.coins, r.eggs ?? 0);
        return true;
      },

      claimMission: (id) => {
        const s = get();
        const m = MISSIONS.find((x) => x.id === id);
        const missions = s.missions.date === today() ? s.missions : { date: today(), claimed: [] };
        if (!m || missions.claimed.includes(id) || missionProgress(id, s.rounds) < m.goal) return false;
        set({ missions: { ...missions, claimed: [...missions.claimed, id] } });
        const rw = m.reward as { coins?: number; eggs?: number };
        get().grant('mission', `Mission: ${m.label}`, rw.coins ?? 0, rw.eggs ?? 0);
        return true;
      },

      redeem: (raw) => {
        const code = raw.trim().toUpperCase();
        const p = PROMO_CODES[code];
        if (!get().user) { useUI.getState().openAuth('signup'); return 'Sign up to redeem codes'; }
        if (!p) return 'Invalid code';
        if (get().promoUsed.includes(code)) return 'Code already redeemed';
        set((s) => ({ promoUsed: [...s.promoUsed, code] }));
        get().grant('promo', `Promo code ${code}`, p.coins ?? 0, p.eggs ?? 0);
        return `Redeemed! +${p.label}`;
      },

      claimRakeback: () => {
        const s = get();
        const tier = tierForLevel(levelFromXp(s.xp));
        const amt = +(((s.stats.wagered - s.rakebackBase) * tier.rakeback) / 100).toFixed(2);
        if (amt < 0.01) return 0;
        set({ rakebackBase: s.stats.wagered });
        get().grant('rakeback', `${tier.name} rakeback`, amt);
        return amt;
      },

      faucet: () => {
        const s = get();
        if (s.balance >= 100 || Date.now() - s.lastFaucet < 36e5) return false;
        set({ lastFaucet: Date.now() });
        get().grant('faucet', 'Chicken feed refill', 1000);
        return true;
      },

      updateSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
      toggleFav: (id) =>
        set((s) => ({ favorites: s.favorites.includes(id) ? s.favorites.filter((x) => x !== id) : [...s.favorites, id] })),
      joinTournament: (id) => set((s) => ({ tournaments: s.tournaments.includes(id) ? s.tournaments : [...s.tournaments, id] })),
      takeBreak: (hours) => set({ breakUntil: Date.now() + hours * 36e5 }),
      resetAll: () => set({ ...initial, settings: DEFAULT_SETTINGS }),
    }),
    {
      name: 'chicken-casino-v1',
      version: 1,
      merge: (persisted, current) => {
        const p = persisted as Partial<State>;
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...(p?.settings ?? {}) } };
      },
    },
  ),
);

export const useLevel = () => {
  const xp = useStore((s) => s.xp);
  const level = levelFromXp(xp);
  return { xp, level, tier: tierForLevel(level) };
};
