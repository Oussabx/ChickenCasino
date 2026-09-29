import { useEffect, useState } from 'react';
import { BOT_NAMES, GAMES, GameId } from './data';
import { pick, rand } from './rng';
import { uid } from './format';

export interface FeedItem { id: string; name: string; game: GameId; bet: number; mult: number; at: number }

const fakeWin = (): FeedItem => {
  const bet = pick([5, 10, 20, 25, 50, 100, 250, 500, 1000]);
  const mult = +(1.1 + Math.pow(rand(), 4) * 60).toFixed(2);
  return { id: uid(), name: pick(BOT_NAMES), game: pick(GAMES).id, bet, mult, at: Date.now() };
};

export function useLiveFeed(size = 8, every = 2400) {
  const [items, setItems] = useState<FeedItem[]>(() => Array.from({ length: size }, fakeWin));
  useEffect(() => {
    const id = setInterval(() => setItems((l) => [fakeWin(), ...l].slice(0, size)), every + rand() * 1500);
    return () => clearInterval(id);
  }, [size, every]);
  return items;
}

export function useCountdown(target: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const d = Math.max(0, target - now);
  return { days: Math.floor(d / 864e5), hours: Math.floor(d / 36e5) % 24, mins: Math.floor(d / 6e4) % 60, secs: Math.floor(d / 1e3) % 60 };
}
