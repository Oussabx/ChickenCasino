import { useEffect, useRef, useState } from 'react';
import GameShell, { GameAction } from '../components/GameShell';
import BetControls, { MiniBet, confirmBet } from '../components/BetControls';
import { useStore } from '../store';
import { rand, pick, randInt } from '../lib/rng';
import { sfx } from '../lib/sound';
import { BOT_NAMES } from '../lib/data';
import { fmt, fmtMult } from '../lib/format';
import { Coin } from '../components/Icons';
import { Users } from 'lucide-react';
import { itemById } from '../lib/data';
import { CrashScene } from './three/crash3d';

type Phase = 'waiting' | 'running' | 'crashed';
const WAIT_MS = 6000;
const GROWTH = 0.00007; // multiplier = e^(GROWTH * ms)

const genCrash = () => {
  const u = rand();
  if (u < 0.01) return 1; // instant bust
  return Math.max(1, Math.floor((0.99 / (1 - u)) * 100) / 100);
};
const multAt = (ms: number) => Math.exp(GROWTH * ms);

interface Player { name: string; bet: number; target: number; cashed: number | null; you?: boolean }

export default function Crash() {
  const [bet, setBet] = useState(useStore.getState().settings.defaultBet);
  const [auto, setAuto] = useState(2);
  const [autoOn, setAutoOn] = useState(false);
  const [phase, setPhase] = useState<Phase>('waiting');
  const [mult, setMult] = useState(1);
  const [countdown, setCountdown] = useState(WAIT_MS);
  const [history, setHistory] = useState<number[]>(() => Array.from({ length: 12 }, genCrash));
  const [players, setPlayers] = useState<Player[]>([]);
  const [my, setMy] = useState<{ bet: number; cashed: number | null } | null>(null);
  const [queued, setQueued] = useState<number | null>(null);

  const wrap = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CrashScene | null>(null);
  const skin = useStore((s2) => itemById(s2.equipped.skin)?.color ?? '#F8F6EF');
  const turbo = useStore((s2) => s2.settings.turbo);
  const st = useRef({ phase: 'waiting' as Phase, start: performance.now(), crash: genCrash(), crashAt: 0, mult: 1 });
  const myRef = useRef(my); myRef.current = my;
  const autoRef = useRef({ autoOn, auto }); autoRef.current = { autoOn, auto };
  const queuedRef = useRef(queued); queuedRef.current = queued;

  useEffect(() => { sceneRef.current?.setSkin(skin); }, [skin]);
  useEffect(() => { sceneRef.current?.setTurbo(turbo); }, [turbo]);

  const spawnBots = () =>
    Array.from({ length: randInt(6, 12) }, () => ({
      name: pick(BOT_NAMES), bet: pick([5, 10, 25, 50, 100, 250, 500, 1000]),
      target: +(1.1 + Math.pow(rand(), 2) * 6).toFixed(2), cashed: null,
    }));

  const joinRound = (amount: number) => {
    if (!useStore.getState().placeBet(amount)) return false;
    sfx.bet();
    setMy({ bet: amount, cashed: null });
    setPlayers((p) => [{ name: useStore.getState().user?.name ?? 'You', bet: amount, target: 0, cashed: null, you: true }, ...p.filter((x) => !x.you)]);
    return true;
  };

  const cashOut = (at?: number) => {
    const m = myRef.current;
    if (!m || m.cashed || st.current.phase !== 'running') return;
    const x = +(at ?? st.current.mult).toFixed(2);
    setMy({ ...m, cashed: x });
    setPlayers((p) => p.map((pl) => (pl.you ? { ...pl, cashed: x } : pl)));
    useStore.getState().settle('crash', m.bet, x, `Cashed at ${x}×`);
    sfx.cashout();
  };

  // game loop
  useEffect(() => {
    const scene = new CrashScene(wrap.current!);
    scene.setSkin(useStore.getState().equipped.skin ? (itemById(useStore.getState().equipped.skin)?.color ?? '#F8F6EF') : '#F8F6EF');
    sceneRef.current = scene;
    let raf = 0, lastTick = 0;
    setPlayers(spawnBots());

    const loop = (now: number) => {
      const s = st.current;
      const el = now - s.start;
      if (s.phase === 'waiting') {
        const left = WAIT_MS - el;
        setCountdown(left);
        if (left <= 0) {
          s.phase = 'running'; s.start = now; s.mult = 1;
          setPhase('running');
          scene.setState('running', 1);
          if (s.crash <= 1) { /* instant bust handled below */ }
        }
      } else if (s.phase === 'running') {
        s.mult = multAt(el);
        scene.setState('running', Math.min(s.mult, s.crash));
        const m = myRef.current;
        if (m && !m.cashed && autoRef.current.autoOn && autoRef.current.auto > 1 && s.mult >= autoRef.current.auto && autoRef.current.auto <= s.crash) {
          cashOut(autoRef.current.auto);
        }
        if (s.mult >= s.crash) {
          s.mult = s.crash; s.phase = 'crashed'; s.crashAt = now; s.start = now;
          setPhase('crashed'); setMult(s.crash);
          setHistory((h) => [s.crash, ...h].slice(0, 20));
          sfx.crash();
          const m2 = myRef.current;
          if (m2 && !m2.cashed) useStore.getState().settle('crash', m2.bet, 0, `Fried at ${s.crash}×`);
          scene.explode();
        } else {
          if (now - lastTick > 90) { setMult(s.mult); lastTick = now; }
          setPlayers((p) => (p.some((pl) => !pl.you && !pl.cashed && pl.target <= s.mult) ? p.map((pl) => (!pl.you && !pl.cashed && pl.target <= s.mult ? { ...pl, cashed: pl.target } : pl)) : p));
        }
      } else if (s.phase === 'crashed' && el > 3200) {
        s.phase = 'waiting'; s.start = now; s.crash = genCrash(); s.mult = 1;
        scene.resetRound();
        setPhase('waiting'); setMult(1); setMy(null);
        setPlayers(spawnBots());
        // queued bet from previous round
        const q = queuedRef.current;
        if (q) { setQueued(null); setTimeout(() => joinRound(q), 50); }
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); scene.dispose(); sceneRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inRound = !!my && !my.cashed && phase === 'running';
  const canBetNow = phase === 'waiting' && !my;

  let action;
  if (inRound) {
    action = (
      <button className="btn-gold w-full py-4 text-base animate-pulse" onClick={() => cashOut()}>
        Cash out <span className="tabular">{fmt(my!.bet * mult)}</span>
      </button>
    );
  } else if (canBetNow) {
    action = <button className="btn-gold w-full py-4 text-base" onClick={() => confirmBet(bet) && joinRound(bet)}>Place bet</button>;
  } else if (my && phase === 'waiting') {
    action = <button className="btn-dark w-full py-4 text-base" disabled>Bet placed — waiting…</button>;
  } else if (queued) {
    action = <button className="btn-red w-full py-4 text-base" onClick={() => setQueued(null)}>Cancel next-round bet</button>;
  } else {
    action = <button className="btn-ghost w-full py-4 text-base" onClick={() => setQueued(bet)}>Bet next round</button>;
  }

  const controls = (
    <>
      <BetControls value={bet} onChange={setBet} disabled={!!my && phase !== 'crashed'} />
      <div>
        <div className="flex items-center justify-between">
          <span className="label">Auto cash out</span>
          <button onClick={() => setAutoOn((a) => !a)} className={`relative h-6 w-11 rounded-full transition ${autoOn ? 'bg-gold' : 'bg-ink-500'}`} aria-label="Toggle auto cash out" aria-pressed={autoOn}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-ink transition-all ${autoOn ? 'left-[22px]' : 'left-0.5 bg-cream'}`} />
          </button>
        </div>
        <div className={`mt-1.5 flex items-center rounded-xl border border-white/10 bg-ink-900 px-3 ${autoOn ? '' : 'opacity-50'}`}>
          <input type="number" step="0.1" min="1.01" value={auto} onChange={(e) => setAuto(Math.max(1.01, parseFloat(e.target.value) || 1.01))}
            className="w-full bg-transparent py-2.5 font-display font-bold outline-none tabular" disabled={!autoOn} aria-label="Auto cash out multiplier" />
          <span className="text-smoke font-bold">×</span>
        </div>
      </div>
      <GameAction extra={<MiniBet value={bet} onChange={setBet} disabled={!!my && phase !== 'crashed'} />}>{action}</GameAction>
      {my && (
        <div className={`rounded-xl p-3 text-sm ${my.cashed ? 'bg-emerald-500/10 text-emerald-300' : phase === 'crashed' ? 'bg-blood/10 text-blood' : 'bg-ink-700'}`}>
          {my.cashed ? `Cashed out at ${fmtMult(my.cashed)} · +${fmt(my.bet * my.cashed - my.bet)}` : phase === 'crashed' ? `Fried! Lost ${fmt(my.bet)}` : `In play: ${fmt(my.bet)}`}
        </div>
      )}
      <div>
        <div className="flex items-center justify-between label mb-2"><span className="flex items-center gap-1.5"><Users size={12} />{players.length} players</span><span>{fmt(players.reduce((a, p) => a + p.bet, 0), 0)}</span></div>
        <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
          {players.map((p, i) => (
            <div key={i} className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs ${p.you ? 'bg-gold/10 border border-gold/30' : 'bg-ink-700/60'}`}>
              <span className={`truncate max-w-[110px] ${p.you ? 'font-bold text-gold' : ''}`}>{p.name}</span>
              <span className="flex items-center gap-1 tabular"><Coin className="h-3 w-3" />{p.bet}</span>
              <span className={`w-14 text-right font-bold tabular ${p.cashed ? 'text-emerald-400' : phase === 'crashed' ? 'text-blood' : 'text-smoke'}`}>
                {p.cashed ? fmtMult(p.cashed) : phase === 'crashed' ? '💥' : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <GameShell id="crash" controls={controls} rules={[
      'Place a bet during the countdown (or queue one for the next round).',
      'The rooster takes off and the multiplier climbs from 1.00×.',
      'Cash out at any time to lock in bet × current multiplier.',
      'If the rooster gets fried before you cash out, the bet is lost. Set auto cash out to play it safe.',
    ]}>
      <div className="absolute inset-x-0 top-0 z-10 flex gap-1.5 overflow-x-auto no-scrollbar p-3">
        {history.map((h, i) => (
          <span key={i} className={`chip shrink-0 tabular ${h >= 10 ? 'bg-gold text-ink' : h >= 2 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-blood/15 text-blood'} ${i === 0 ? 'animate-pop' : ''}`}>{fmtMult(h)}</span>
        ))}
      </div>
      <div ref={wrap} className="absolute inset-0" aria-label="Rocket Rooster flight" />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {phase === 'waiting' ? (
          <div className="text-center">
            <div className="label">Next flight in</div>
            <div className="h-display text-5xl sm:text-6xl text-cream tabular">{(countdown / 1000).toFixed(1)}s</div>
            <div className="mx-auto mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-ink-500"><div className="h-full bg-gold" style={{ width: `${(countdown / WAIT_MS) * 100}%` }} /></div>
          </div>
        ) : (
          <div className={`text-center ${phase === 'crashed' ? 'animate-shake' : ''}`}>
            <div className={`h-display text-6xl sm:text-8xl tabular ${phase === 'crashed' ? 'text-blood neon-red' : 'text-cream'}`}>{fmt(mult)}×</div>
            {phase === 'crashed' && <div className="mt-2 font-display font-black tracking-[.3em] text-blood">FRIED!</div>}
          </div>
        )}
      </div>
    </GameShell>
  );
}
