import { HashRouter, Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from './components/Layout';
import Home from './pages/Home';
import Games from './pages/Games';

// Pages other than the lobby load on demand, then get fetched quietly once
// the browser is idle so moving between them still feels instant.
const PAGES = {
  Promotions: () => import('./pages/Promotions'),
  Tournaments: () => import('./pages/Tournaments'),
  VIP: () => import('./pages/VIP'),
  Shop: () => import('./pages/Shop'),
  Wallet: () => import('./pages/Wallet'),
  History: () => import('./pages/History'),
  Profile: () => import('./pages/Profile'),
  Settings: () => import('./pages/Settings'),
  NotFound: () => import('./pages/NotFound'),
};
const Promotions = lazy(PAGES.Promotions);
const Tournaments = lazy(PAGES.Tournaments);
const VIP = lazy(PAGES.VIP);
const Shop = lazy(PAGES.Shop);
const Wallet = lazy(PAGES.Wallet);
const History = lazy(PAGES.History);
const Profile = lazy(PAGES.Profile);
const Settings = lazy(PAGES.Settings);
const NotFound = lazy(PAGES.NotFound);

if (typeof window !== 'undefined') {
  const idle = (cb: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(cb, { timeout: 4000 }) : setTimeout(cb, 2500));
  // skip on data-saver / 2G so we never spend someone's data on pages they may not open
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  const thrifty = !!conn?.saveData || /2g/.test(conn?.effectiveType ?? '');
  if (!thrifty) window.addEventListener('load', () => idle(() => Object.values(PAGES).forEach((load) => load().catch(() => {}))), { once: true });
}

const Plinko = lazy(() => import('./games/Plinko'));
const Crash = lazy(() => import('./games/Crash'));
const ChickenCross = lazy(() => import('./games/ChickenCross'));
const EggHunt = lazy(() => import('./games/EggHunt'));
const CluckDice = lazy(() => import('./games/CluckDice'));
const GoldenWheel = lazy(() => import('./games/GoldenWheel'));
const Showcase = lazy(() => import('./pages/Showcase'));
const Blackjack = lazy(() => import('./games/Blackjack'));
const Roulette = lazy(() => import('./games/Roulette'));
const Baccarat = lazy(() => import('./games/Baccarat'));
const Poker = lazy(() => import('./games/Poker'));
const VideoPoker = lazy(() => import('./games/VideoPoker'));
const Slots = lazy(() => import('./games/Slots'));
const Craps = lazy(() => import('./games/Craps'));
const Keno = lazy(() => import('./games/Keno'));
const LiveLobby = lazy(() => import('./pages/live/LiveLobby'));
const PokerLive = lazy(() => import('./games/live/PokerLive'));
const BlackjackLive = lazy(() => import('./games/live/BlackjackLive'));

export default function App() {
  return (
    <HashRouter>
        <Routes>
        <Route path="showcase/:id" element={<Suspense fallback={null}><Showcase /></Suspense>} />
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="games" element={<Games />} />
            <Route path="games/plinko" element={<Plinko />} />
            <Route path="games/crash" element={<Crash />} />
            <Route path="games/chicken-cross" element={<ChickenCross />} />
            <Route path="games/egg-hunt" element={<EggHunt />} />
            <Route path="games/cluck-dice" element={<CluckDice />} />
            <Route path="games/golden-wheel" element={<GoldenWheel />} />
            <Route path="games/blackjack" element={<LiveLobby key="bj" game="blackjack" />} />
            <Route path="games/blackjack/practice" element={<Blackjack />} />
            <Route path="games/blackjack/:tableId" element={<BlackjackLive />} />
            <Route path="games/roulette" element={<Roulette />} />
            <Route path="games/baccarat" element={<Baccarat key="classic" variant="classic" />} />
            <Route path="games/punto-banco" element={<Baccarat key="punto" variant="punto" />} />
            <Route path="games/poker" element={<LiveLobby key="poker" game="poker" />} />
            <Route path="games/poker/practice" element={<Poker />} />
            <Route path="games/poker/:tableId" element={<PokerLive />} />
            <Route path="games/video-poker" element={<VideoPoker />} />
            <Route path="games/slots" element={<Slots />} />
            <Route path="games/craps" element={<Craps />} />
            <Route path="games/keno" element={<Keno />} />
            <Route path="promotions" element={<Promotions />} />
            <Route path="tournaments" element={<Tournaments />} />
            <Route path="vip" element={<VIP />} />
            <Route path="shop" element={<Shop />} />
            <Route path="wallet" element={<Wallet />} />
            <Route path="history" element={<History />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
    </HashRouter>
  );
}
