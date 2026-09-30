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
| **Casino Hold'em** | Ante, flop, then call (2× ante) or fold; dealer qualifies with 4s or better; ante pays up to 100:1. |
| **5 Card Poker** | Five-card draw, Jacks or Better 9/6 pay table, hold suggestions. |

Cards are drawn from shoes shuffled with `crypto.getRandomValues`; the originals are tuned to ≈99% RTP and the table games use their standard casino rules.

Game card thumbnails are rendered from these same scenes: `npm run build`, `npx vite preview --port 4173`, then `node scripts/render-thumbs.mjs` (needs Playwright and Python/Pillow).

## The rest of the site

- **Lobby** – hero, live winners ticker, featured games, welcome bonus, tournament countdown, favourites.
- **Games** – search, filters (originals / favourites / hot / new), personal stats per game.
- **Promotions** – 7-day daily streak, daily missions, promo codes (`CLUCK`, `GOLDENEGG`, `WINBIGGER`), hourly “chicken feed” refill.
- **Tournaments** – three live tournaments with countdowns, podium and leaderboard where your real rounds count.
- **VIP club** – XP & levels, 5 tiers, rakeback you can claim.
- **Shop** – trade golden eggs for coin bundles; buy/equip avatars, profile frames, Chicken Cross skins, Plinko egg skins and titles (they show up in-game).
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
