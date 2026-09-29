# 🐔 Chicken Casino

**Play big. Win bigger.** A social-casino web app (desktop + mobile) built around the Chicken Casino brand — dark, red and gold, with a rooster in sunglasses.

> Virtual coins only. Nothing can be deposited or withdrawn. There is no backend: accounts and progress live in the browser's localStorage, so they don't sync between devices, and password resets use a recovery code instead of email.

## Games

| Game | Type | What makes it different |
| --- | --- | --- |
| **Chicken Cross** | Original risk ladder | Hop across a live highway, lane by lane. 4 difficulties, keyboard controls, animated traffic, barriers and a very flat chicken. |
| **Rocket Rooster** | Multiplayer crash | Continuous rounds with countdown, live curve on canvas, simulated players cashing out, auto cash-out, queue-next-round, feather explosion. |
| **Plinko Coop** | Plinko | Canvas-rendered peg board, 8–16 rows, 3 risk levels, multi-ball + auto-drop, glowing pegs and bouncing buckets. |
| **Egg Hunt** | Mines | 5×5 henhouse, 1–24 foxes, 3D flip tiles, random pick, live odds. |
| **Cluck Dice** | Dice | Over/under slider (2–98%), editable multiplier / chance, animated roll counter, auto-roll. |
| **Golden Wheel** | Wheel | 30-slice neon wheel with 3 risk profiles and a single 29.7× golden slice. |

All games use `crypto.getRandomValues` and are tuned to ≈99% RTP.

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

React 18 · TypeScript · Vite · Tailwind CSS · Zustand (persisted) · React Router (hash) · lucide-react · self-hosted fonts (Montserrat, Inter, Kaushan Script).

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/ (relative paths, deployable anywhere)
```

Brand imagery in `public/img/` is cropped from the Chicken Casino brand board.
