# 🐔 Chicken Casino

**Play big. Win bigger.** A social-casino web app (desktop + mobile) built around the Chicken Casino brand — dark, red and gold, with a rooster in sunglasses.

> Virtual coins only. Nothing can be deposited or withdrawn. There is no backend: accounts and progress live in the browser's localStorage, so they don't sync between devices, and password resets use a recovery code instead of email.

## Games

Every game is a real-time 3D scene (Three.js, loaded only when you open the game):

| Game | Type | In 3D |
| --- | --- | --- |
| **Chicken Cross** | Original risk ladder | Voxel chicken hops across a highway; the crash lane is decided (and hashed) at round start like Crash; safe-lane cars brake behind barriers. |
| **Rocket Rooster** | Multiplayer crash | The rooster rides a rocket along a glowing flight path through space; flames, exhaust, explosion on crash. |
| **Plinko Coop** | Plinko | Metal pegs on a gold-framed board, glowing golden eggs, 3D prize buckets that bounce. |
| **Egg Hunt** | Mines | Barn floor with 25 straw nests; golden eggs rise out, foxes pop up. |
| **Cluck Dice** | Dice | A golden egg bounces along a red/green track to the rolled number on a casino table. |
| **Golden Wheel** | Wheel | Upright carnival wheel with extruded slices, chasing bulbs and a flicking pointer. |

### Casino tables

All dealt on a shared 3D felt table (cards fly from the shoe and flip; chip stacks mark your bets):

| Game | Rules |
| --- | --- |
| **Blackjack** | 6-deck shoe, dealer stands on soft 17, blackjack pays 3:2, double on any two cards, split once. |
| **Roulette** | European single zero, 3D wheel and ball; straight 35:1, dozens/columns 2:1, even-money bets 1:1. |
| **Baccarat** | 8 decks, standard third-card tableau, slow card squeeze, bead road. Player 1:1, Banker 0.95:1, Tie 8:1. |
| **Punto Banco** | Fast baccarat with Player Pair / Banker Pair side bets at 11:1. |
| **Texas Hold'em** | No-limit poker with 2–8 players (you + chicken bots) and a chicken croupier who deals but never plays. Button, small/big blinds, pre-flop/flop/turn/river betting (fold, check, call, bet, raise, all-in; min-raise rules), uncalled bets returned, side pots and split pots at showdown. |
| **5 Card Poker** | Five-card draw, Jacks or Better 9/6 pay table, hold suggestions. |
| **Craps** | Las Vegas rules on a 3D table with a rooster boxman and ON/OFF puck. Pass/Don't Pass (bar 12), Come/Don't Come, 3-4-5× free odds at true odds (lay odds to win 6×), Place 4–10 (9:5, 7:5, 7:6), Field (2 pays double, 12 triple), hardways and one-roll props. Place bets and hardways are off on the come-out; winning bets stay up. |

### Slots & keno

| Game | Rules |
| --- | --- |
| **Golden Coop Slots** | 5 reels × 3 rows with motion-blurred spinning reels, 20 fixed paylines paying left to right. Golden Rooster wild, Coop scatter: 3/4/5 pay 3×/15×/100× the total bet and award 10/15/20 free spins with every win tripled (retriggers). RTP 95.2%, calculated exactly from the reel strips. |
| **Coop Keno** | 80 numbers, 20 drawn, pick 1–10 spots. A hen lays the numbered eggs. Pay tables tuned to ≈95% for every spot count (exact hypergeometric odds); 10 of 10 pays 100,000×. |

Cards are drawn from shoes shuffled with `crypto.getRandomValues`; the originals are tuned to ≈99% RTP, the table games use their standard casino rules, and slots/keno use the return-to-player figures above.

Game card thumbnails are rendered from these same scenes: `npm run build`, `npx vite preview --port 4173`, then `node scripts/render-thumbs.mjs` (needs Playwright and Python/Pillow).

## The rest of the site

- **Lobby** – hero, live winners ticker, featured games, welcome bonus, tournament countdown, favourites.
- **Games** – search, filters (originals / favourites / hot / new), personal stats per game.
- **Promotions** – 7-day daily streak, daily missions, promo codes (`CLUCK`, `GOLDENEGG`, `WINBIGGER`), hourly “chicken feed” refill.
- **Tournaments** – three live tournaments with countdowns, podium and leaderboard where your real rounds count.
- **VIP club** – XP & levels, 5 tiers, rakeback you can claim.
- **Shop (The Coop Store)** – collectible, cosmetic-only items that show up in your games:
  - **Chickens** (Golden, Diamond, Mafia, Cowboy, Astronaut, King, Tuxedo, Samurai, Cyber, Skeleton…) and **hats** that mix and match – worn in Chicken Cross and Rocket Rooster.
  - **Table skins** (felt, rail and trim in Blackjack, Baccarat, Poker, Craps and Roulette), **chip skins** and **card decks** (looks only, never gameplay).
  - **🔥 Hot Drop** – a limited chicken that rotates daily at 00:00 UTC, with a countdown.
  - **Egg Shop** – Basic / Golden / Diamond / Royal eggs with odds shown up front; cosmetics only and never a duplicate.
  - **Bundles** – priced from what you don't own yet, plus bonus coins.
  - **Rooster VIP** – free rewards at levels 2 / 4 / 6 / 9 / 12 (VIP chips, frame, golden name, table, chicken, deck, royal win show, Rooster Elite title).
  - **My Locker** – equip by slot. Golden eggs still buy coin packs, avatars, frames and titles under *More*.
- **Wallet** – coin & egg balances, transaction log.
- **History** – every round, filters, profit chart, pagination, CSV export.
- **Profile** – level, stats per game, 10 achievements.
- **Settings** – sound/volume, turbo mode, reduced motion, hide balance, default bet, large-bet confirmation, session reminders, daily loss limit, take-a-break, reset data.
- **Accounts** – sign-up (username, optional email, password strength checks, avatar), log-in by username or email, show/hide password, Caps Lock warning, lockout after 5 failed tries, and forgot-password via a one-time recovery code (rotated on use). Passwords and codes are stored only as salted PBKDF2 hashes; each account keeps its own balance, items and history. Security settings let you change the password or make a new recovery code.
- Toasts, big-win celebration, level-up rewards, mobile bottom nav + drawer.

## Stack

React 18 · TypeScript · Vite · Tailwind CSS · Three.js · Zustand (persisted) · React Router (hash) · lucide-react · self-hosted fonts (Montserrat, Inter, Kaushan Script).

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/ (relative paths, deployable anywhere)
```

Brand imagery in `public/img/` is cropped from the Chicken Casino brand board.
