import { HashRouter, Route, Routes } from 'react-router-dom';
import { lazy } from 'react';
import Layout from './components/Layout';
import Home from './pages/Home';
import Games from './pages/Games';
import Promotions from './pages/Promotions';
import Tournaments from './pages/Tournaments';
import VIP from './pages/VIP';
import Shop from './pages/Shop';
import Wallet from './pages/Wallet';
import History from './pages/History';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

const Plinko = lazy(() => import('./games/Plinko'));
const Crash = lazy(() => import('./games/Crash'));
const ChickenCross = lazy(() => import('./games/ChickenCross'));
const EggHunt = lazy(() => import('./games/EggHunt'));
const CluckDice = lazy(() => import('./games/CluckDice'));
const GoldenWheel = lazy(() => import('./games/GoldenWheel'));

export default function App() {
  return (
    <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="games" element={<Games />} />
            <Route path="games/plinko" element={<Plinko />} />
            <Route path="games/crash" element={<Crash />} />
            <Route path="games/chicken-cross" element={<ChickenCross />} />
            <Route path="games/egg-hunt" element={<EggHunt />} />
            <Route path="games/cluck-dice" element={<CluckDice />} />
            <Route path="games/golden-wheel" element={<GoldenWheel />} />
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
