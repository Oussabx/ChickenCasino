import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DAILY_REWARDS, DEFAULT_ITEMS, GameId, PROMO_CODES, itemById, levelFromXp, tierForLevel,
} from './lib/data';
import { eggById, eggPool, onSale, setPrice, vipTierOf } from './lib/shopLogic';
import { rand } from './lib/rng';
import { uid } from './lib/format';
import type { SavedCard } from './lib/payment';
import { Order, productById } from './lib/coinStore';

export interface Round {
  id: string;
  game: GameId;
  bet: number;
  multiplier: number;
  payout: number;
  at: number;
  detail?: string;
}

/** Coins taken to a live table: they come back (as the final stack) when you stand up. */
export interface Escrow { rid: string; game: 'poker' | 'blackjack'; table: string; tableName: string; buyIn: number; stack: number; at: number }

export type TxKind = 'bonus' | 'daily' | 'shop' | 'promo' | 'mission' | 'rakeback' | 'level' | 'exchange' | 'faucet' | 'purchase' | 'table';
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
  /** 'auto' picks lite effects on phones / low-power devices. */
  effects: 'auto' | 'full' | 'lite';
}

interface GameStat { rounds: number; wagered: number; profit: number; best: number }
interface Stats { wagered: number; won: number; rounds: number; biggestWin: number; biggestMult: number; perGame: Partial<Record<GameId, GameStat>> }

export interface Equipped {
  avatar: string; frame: string; ball: string; title: string;
  chicken: string; hat: string; table: string; chips: string; deck: string; fx: string; name: string;
}
export const DEFAULT_EQUIPPED: Equipped = {
  avatar: 'av-classic', frame: 'fr-none', ball: 'bl-gold', title: 'tt-none',
  chicken: 'ch-classic', hat: 'hat-none', table: 'tb-classic', chips: 'cp-classic', deck: 'dk-classic', fx: 'fx-classic', name: 'nm-plain',
};
/** Which equip slot each item kind goes in. */
const SLOT: Partial<Record<string, keyof Equipped>> = {
  avatar: 'avatar', frame: 'frame', ball: 'ball', title: 'title', chicken: 'chicken', hat: 'hat', table: 'table', chips: 'chips', deck: 'deck', fx: 'fx', name: 'name',
};
// chicken skins from before the collectibles update
const LEGACY: Record<string, string> = { 'sk-classic': 'ch-classic', 'sk-golden': 'ch-golden', 'sk-ninja': 'ch-ninja', 'sk-fire': 'ch-lava' };
/** Bring saved data up to date: new equip slots, starter items, renamed skins. */
export function normalizeGame<T extends { inventory?: string[]; equipped?: Partial<Equipped> & { skin?: string } }>(d: T): T {
  const inv = new Set([...(d.inventory ?? []).map((id) => LEGACY[id] ?? id), ...DEFAULT_ITEMS]);
  const old = d.equipped ?? {};
  const eq = { ...DEFAULT_EQUIPPED, ...old } as Equipped & { skin?: string };
  if (old.skin) eq.chicken = LEGACY[old.skin] ?? eq.chicken;
  delete eq.skin;
  return { ...d, inventory: [...inv], equipped: eq };
}

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
export type AuthView = 'login' | 'signup' | 'forgot';
/** One winning round, as shown by the shared win animation (WinFX). */
export interface WinEvent { id: number; game: GameId; bet: number; payout: number; mult: number; detail?: string; at: number }
/** The coin store dialog: which tab, and optionally a product to go straight to checkout. */
export interface StoreView { tab: 'coins' | 'eggs' | 'bundle'; product?: string }
interface UIState {
  auth: null | AuthView;
  win: WinEvent | null;
  store: StoreView | null;
  openStore: (v: StoreView | null) => void;
  openAuth: (m: AuthView | null) => void;
  pushWin: (w: Omit<WinEvent, 'id' | 'at'>) => void;
}
let winSeq = 0;
export const useUI = create<UIState>((set) => ({
  auth: null,
  win: null,
  store: null,
  openStore: (store) => set({ store }),
  openAuth: (auth) => set({ auth }),
  pushWin: (w) => set({ win: { ...w, id: ++winSeq, at: Date.now() } }),
}));

/* ---------- main persisted store ---------- */
interface State {
  user: { name: string; joinedAt: number; email?: string } | null;
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
  /** Saved payment cards (brand, last four, expiry, name — never the full number). */
  cards: SavedCard[];
  defaultCard: string | null;
  orders: Order[];
  /** Coins sitting at a live table right now. */
  escrow: Escrow | null;

  /** Replace all per-account game data (null = fresh account). */
  loadData: (d: GameData | null) => void;
  exportData: () => GameData;
  betError: (amount: number) => string | null;
  placeBet: (amount: number) => boolean;
  /** Give back (or, with a negative amount, re-commit) coins sitting on a table layout — not a round. */
  refund: (amount: number) => void;
  settle: (game: GameId, bet: number, multiplier: number, detail?: string, opts?: { noCredit?: boolean }) => number;
  /** Take `amount` from the balance to a live table seat. Returns an error, or null. */
  escrowOpen: (e: Omit<Escrow, 'stack' | 'at'>) => string | null;
  /** Remember the seat's current stack (what you get back if the page closes). */
  escrowSync: (rid: string, stack: number) => void;
  /** Stand up: the stack goes back to the balance. Returns the amount. */
  escrowClose: (rid?: string) => number;
  grant: (kind: TxKind, label: string, coins: number, eggs?: number) => void;
  buy: (id: string) => string | null;
  equip: (id: string) => void;
  claimVip: (id: string) => string | null;
  /** Hatch an egg: returns the item id won, or an error message. */
  openEgg: (eggId: string) => { item?: string; error?: string };
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
  addCard: (c: Omit<SavedCard, 'id' | 'addedAt'>, makeDefault?: boolean) => string;
  removeCard: (id: string) => void;
  setDefaultCard: (id: string) => void;
  /** Deliver a paid coin-store product (call after the charge succeeds). */
  deliver: (productId: string, cardLabel: string) => string | null;
}

const DEFAULT_SETTINGS: Settings = {
  sound: true, volume: 0.6, reduceMotion: false, turbo: false, hideBalance: false, confirmOver: 0,
  sessionReminder: 0, lossLimit: 0, showLiveFeed: true, bigWinCelebration: true, defaultBet: 10, effects: 'auto',
};

const GAME_DEFAULTS = {
  balance: 0,
  eggs: 0,
  xp: 0,
  rounds: [] as Round[],
  txs: [] as Tx[],
  inventory: [...DEFAULT_ITEMS],
  equipped: { ...DEFAULT_EQUIPPED } as Equipped,
  daily: { last: null as string | null, streak: 0 },
  missions: { date: today(), claimed: [] as string[] },
  promoUsed: [] as string[],
  favorites: [] as GameId[],
  rakebackBase: 0,
  breakUntil: 0,
  lastFaucet: 0,
  stats: { wagered: 0, won: 0, rounds: 0, biggestWin: 0, biggestMult: 0, perGame: {} } as Stats,
  tournaments: [] as string[],
  cards: [] as SavedCard[],
  defaultCard: null as string | null,
  orders: [] as Order[],
  escrow: null as Escrow | null,
};

/** Everything that belongs to one account (settings stay per-device). */
export type GameData = typeof GAME_DEFAULTS;
const GAME_KEYS = Object.keys(GAME_DEFAULTS) as (keyof GameData)[];

const initial = { user: null as State['user'], ...GAME_DEFAULTS };

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...structuredClone(initial),
      settings: DEFAULT_SETTINGS,

      loadData: (d) => set(normalizeGame({ ...structuredClone(GAME_DEFAULTS), missions: { date: today(), claimed: [] }, ...(d ?? {}) })),
      exportData: () => {
        const s = get();
        return Object.fromEntries(GAME_KEYS.map((k) => [k, s[k]])) as GameData;
      },

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

      refund: (amount) => set((s) => ({ balance: +(s.balance + amount).toFixed(2) })),

      escrowOpen: (e) => {
        const s = get();
        if (s.escrow) s.escrowClose();
        const err = get().betError(e.buyIn);
        if (err) return err;
        set((st) => ({
          balance: +(st.balance - e.buyIn).toFixed(2),
          escrow: { ...e, stack: e.buyIn, at: Date.now() },
          txs: [{ id: uid(), kind: 'table' as TxKind, label: `Bought in at ${e.tableName}`, coins: -e.buyIn, eggs: 0, at: Date.now() }, ...st.txs].slice(0, 300),
        }));
        return null;
      },
      escrowSync: (rid, stack) => {
        const e = get().escrow;
        if (e && e.rid === rid && e.stack !== stack) set({ escrow: { ...e, stack: +stack.toFixed(2) } });
      },
      escrowClose: (rid) => {
        const e = get().escrow;
        if (!e || (rid && e.rid !== rid)) return 0;
        const amt = Math.max(0, +e.stack.toFixed(2));
        set((st) => ({
          balance: +(st.balance + amt).toFixed(2),
          escrow: null,
          txs: [{ id: uid(), kind: 'table' as TxKind, label: `Cashed out of ${e.tableName}`, coins: amt, eggs: 0, at: Date.now() }, ...st.txs].slice(0, 300),
        }));
        return amt;
      },

      settle: (game, bet, multiplier, detail, opts) => {
        const payout = +(bet * multiplier).toFixed(2);
        const s = get();
        const prevLevel = levelFromXp(s.xp);
        const xp = s.xp + Math.max(1, Math.round(bet / 5));
        const pg = s.stats.perGame[game] ?? { rounds: 0, wagered: 0, profit: 0, best: 0 };
        const round: Round = { id: uid(), game, bet, multiplier, payout, at: Date.now(), detail };
        set({
          balance: opts?.noCredit ? s.balance : +(s.balance + payout).toFixed(2),
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
        // every winning round gets the same win animation, whatever the game
        if (payout > bet) useUI.getState().pushWin({ game, bet, payout, mult: multiplier, detail });
        return payout;
      },

      addCard: (c, makeDefault) => {
        const s = get();
        const dup = s.cards.find((x) => x.brand === c.brand && x.last4 === c.last4 && x.expMonth === c.expMonth && x.expYear === c.expYear);
        if (dup) { if (makeDefault) set({ defaultCard: dup.id }); return dup.id; }
        const id = uid();
        set({ cards: [...s.cards, { ...c, id, addedAt: Date.now() }], defaultCard: makeDefault || !s.defaultCard ? id : s.defaultCard });
        return id;
      },
      removeCard: (id) => set((s) => {
        const cards = s.cards.filter((c) => c.id !== id);
        return { cards, defaultCard: s.defaultCard === id ? cards[0]?.id ?? null : s.defaultCard };
      }),
      setDefaultCard: (id) => set({ defaultCard: id }),
      deliver: (productId, cardLabel) => {
        const p = productById(productId);
        const s = get();
        if (!p) return 'Unknown product';
        if (!s.user) return 'Sign in first';
        if (p.once && s.orders.some((o) => o.product === p.id)) return 'Already purchased';
        const items = (p.items ?? []).filter((i) => !s.inventory.includes(i));
        set({
          balance: +(s.balance + (p.coins ?? 0)).toFixed(2),
          eggs: s.eggs + (p.eggs ?? 0),
          inventory: [...s.inventory, ...items],
          orders: [{ id: uid(), product: p.id, name: p.name, usd: p.usd, card: cardLabel, at: Date.now() }, ...s.orders].slice(0, 200),
          txs: [{ id: uid(), kind: 'purchase' as TxKind, label: `${p.name} · $${p.usd.toFixed(2)}`, coins: p.coins ?? 0, eggs: p.eggs ?? 0, at: Date.now() }, ...s.txs].slice(0, 300),
        });
        return null;
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
        if (item.vip) return 'Unlocked on the Rooster VIP ladder';
        if (item.kind !== 'bundle' && item.kind !== 'set' && s.inventory.includes(id)) return 'Already owned';
        if (!onSale(item)) return 'This drop has ended';
        if (item.minLevel && levelFromXp(s.xp) < item.minLevel) return `Requires level ${item.minLevel}`;
        if (item.kind === 'set') {
          const sp = setPrice(item, s.inventory);
          if (sp.complete) return 'You already own everything in this bundle';
          if (s.balance < sp.price) return 'Not enough coins';
          get().grant('shop', item.name, -sp.price + (item.coins ?? 0), 0);
          set((st) => ({ inventory: [...st.inventory, ...sp.missing.map((i) => i.id)] }));
          return null;
        }
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
        const slot = item && SLOT[item.kind];
        if (!slot || !get().inventory.includes(id)) return;
        set((s) => ({ equipped: { ...s.equipped, [slot]: id } }));
      },

      claimVip: (id) => {
        const s = get();
        if (!s.user) { useUI.getState().openAuth('signup'); return 'Sign up first'; }
        const tier = vipTierOf(id);
        if (!tier) return 'Not a VIP reward';
        if (levelFromXp(s.xp) < tier.level) return `Reach level ${tier.level} for ${tier.name}`;
        if (s.inventory.includes(id)) return 'Already claimed';
        set((st) => ({ inventory: [...st.inventory, id] }));
        return null;
      },

      openEgg: (eggId) => {
        const s = get();
        const egg = eggById(eggId);
        if (!egg) return { error: 'Unknown egg' };
        if (!s.user) { useUI.getState().openAuth('signup'); return { error: 'Sign up first' }; }
        const { byRarity, odds, empty } = eggPool(egg, s.inventory);
        if (empty) return { error: 'You already own everything this egg can hatch' };
        if (s.balance < egg.price) return { error: 'Not enough coins' };
        // pick a rarity by the shown odds, then any item of it you don't own yet
        let r = rand(), rarity = Object.keys(odds)[0] as keyof typeof odds;
        for (const [k, p] of Object.entries(odds)) { if ((r -= p!) <= 0) { rarity = k as keyof typeof odds; break; } }
        const list = byRarity[rarity]!;
        const item = list[Math.floor(rand() * list.length)];
        get().grant('shop', `${egg.name}: ${item.name}`, -egg.price, 0);
        set((st) => ({ inventory: [...st.inventory, item.id] }));
        return { item: item.id };
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
      resetAll: () => set({ ...structuredClone(initial), settings: DEFAULT_SETTINGS }),
    }),
    {
      name: 'chicken-casino-v1',
      version: 1,
      merge: (persisted, current) => {
        const p = persisted as Partial<State>;
        return normalizeGame({ ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...(p?.settings ?? {}) } });
      },
    },
  ),
);

export const useLevel = () => {
  const xp = useStore((s) => s.xp);
  const level = levelFromXp(xp);
  return { xp, level, tier: tierForLevel(level) };
};

// dev builds only: lets tests fire the shared win animation directly
if (import.meta.env.DEV) (globalThis as { __ui?: typeof useUI }).__ui = useUI;
