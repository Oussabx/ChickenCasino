import { useEffect, useRef, useState } from 'react';
import { EggHuntScene } from './three/egghunt3d';
import { Shuffle } from 'lucide-react';
import GameShell from '../components/GameShell';
import BetControls, { confirmBet } from '../components/BetControls';
import { useStore } from '../store';
import { shuffle } from '../lib/rng';
import { sfx } from '../lib/sound';
import { fmt, fmtMult } from '../lib/format';
import { Coin } from '../components/Icons';

const N = 25;
const multFor = (mines: number, k: number) => {
  let m = 0.99;
  for (let i = 0; i < k; i++) m *= (N - i) / (N - mines - i);
  return k === 0 ? 1 : Math.floor(m * 100) / 100;
};

type Status = 'idle' | 'playing' | 'lost' | 'won';

export default function EggHunt() {
  const [bet, setBet] = useState(useStore.getState().settings.defaultBet);
  const [mines, setMines] = useState(3);
  const [status, setStatus] = useState<Status>('idle');
  const [board, setBoard] = useState<boolean[]>([]); // true = fox
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [stake, setStake] = useState(0);

  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<EggHuntScene | null>(null);
  const turbo = useStore((s) => s.settings.turbo);
  useEffect(() => {
    const sc = new EggHuntScene(hostRef.current!);
    sceneRef.current = sc;
    return () => { sc.dispose(); sceneRef.current = null; };
  }, []);
  useEffect(() => { sceneRef.current?.setTurbo(turbo); }, [turbo]);

  const picks = open.size;
  const cur = multFor(mines, picks);
  const next = multFor(mines, picks + 1);
  const playing = status === 'playing';

  const start = () => {
    if (!confirmBet(bet) || !useStore.getState().placeBet(bet)) return;
    sfx.bet();
    const b = shuffle(Array.from({ length: N }, (_, i) => i < mines));
    setBoard(b); setOpen(new Set()); setStake(bet); setStatus('playing');
    sceneRef.current?.reset();
    sceneRef.current?.setPlayable(true);
  };

  // reveal everything that's left once the round is over
  const revealRest = (b: boolean[], picked: Set<number>) => {
    b.forEach((fox, i) => { if (!picked.has(i)) sceneRef.current?.reveal(i, fox ? 'fox' : 'egg', true); });
    sceneRef.current?.setPlayable(false);
  };

  const reveal = (i: number) => {
    if (!playing || open.has(i)) return;
    const o = new Set(open); o.add(i);
    setOpen(o);
    sceneRef.current?.reveal(i, board[i] ? 'fox' : 'egg');
    if (board[i]) {
      setStatus('lost'); sfx.crash();
      setTimeout(() => revealRest(board, o), 450);
      useStore.getState().settle('egg-hunt', stake, 0, `Fox after ${open.size} eggs · ${mines} foxes`);
      return;
    }
    sfx.reveal();
    if (o.size === N - mines) cashOut(o.size);
  };

  const cashOut = (k = picks) => {
    if (!playing || k === 0) return;
    const m = multFor(mines, k);
    setStatus('won'); sfx.cashout();
    revealRest(board, open.size ? open : new Set());
    useStore.getState().settle('egg-hunt', stake, m, `${k} eggs · ${mines} foxes`);
  };

  useEffect(() => { sceneRef.current?.setOnPick((i) => reveal(i)); });

  const randomPick = () => {
    const closed = Array.from({ length: N }, (_, i) => i).filter((i) => !open.has(i));
    if (closed.length) reveal(closed[Math.floor(Math.random() * closed.length)]);
  };

  const controls = (
    <>
      <BetControls value={bet} onChange={setBet} disabled={playing} />
      <div>
        <div className="flex justify-between"><span className="label">Foxes in the henhouse</span><span className="font-display font-black text-blood">{mines}</span></div>
        <div className="relative mt-3">
          <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-emerald-500 via-gold to-blood opacity-70" />
          <input type="range" min={1} max={24} value={mines} disabled={playing} onChange={(e) => setMines(+e.target.value)} className="range relative" aria-label="Number of foxes" />
        </div>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {[1, 3, 5, 10, 20].map((v) => (
            <button key={v} disabled={playing} onClick={() => setMines(v)} className={`rounded-lg py-1 text-xs font-bold ${mines === v ? 'bg-blood/20 text-blood' : 'bg-ink-700 text-smoke hover:text-cream'}`}>{v}</button>
          ))}
        </div>
      </div>
      {playing ? (
        <>
          <button className="btn-gold w-full py-4 text-base" disabled={picks === 0} onClick={() => cashOut()}>
            Cash out <span className="tabular">{fmt(stake * cur)}</span>
          </button>
          <button className="btn-dark w-full py-2.5 text-sm" onClick={randomPick}><Shuffle size={14} />Pick random nest</button>
        </>
      ) : (
        <button className="btn-gold w-full py-4 text-base" onClick={start}>{status === 'idle' ? 'Start hunt' : 'Hunt again'}</button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Current" value={fmtMult(cur)} tone="gold" />
        <Stat label="Next egg" value={picks < N - mines ? fmtMult(next) : '—'} />
        <Stat label="Eggs left" value={String(N - mines - (status === 'idle' ? 0 : [...open].filter((i) => !board[i]).length))} />
        <Stat label="Win chance" value={`${(((N - mines - picks) / (N - picks)) * 100).toFixed(1)}%`} />
      </div>
    </>
  );

  return (
    <GameShell id="egg-hunt" controls={controls} rules={[
      'Choose how many foxes hide in the 25 nests (more foxes = bigger multipliers).',
      'Start the hunt and tap nests to reveal them.',
      'Every golden egg raises your multiplier. Cash out whenever you like.',
      'Find a fox and the round is lost. Clear every egg for the maximum payout.',
    ]}>
      <div ref={hostRef} className="absolute inset-0" aria-hidden />
      {/* accessible controls for keyboard & screen readers */}
      <div className="sr-only">
        {Array.from({ length: N }).map((_, i) => (
          <button key={i} onClick={() => reveal(i)} disabled={!playing || open.has(i)} aria-label={`Nest ${i + 1}`}>Nest {i + 1}</button>
        ))}
      </div>
      {status === 'idle' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
          <div className="animate-floaty rounded-full bg-black/60 px-4 py-2 text-xs font-semibold backdrop-blur">Pick your fox count and start the hunt 🥚</div>
        </div>
      )}
      {status === 'lost' && (
        <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
          <div className="animate-pop rounded-2xl border border-blood/60 bg-blood/20 px-6 py-3 text-center backdrop-blur">
            <div className="h-display text-4xl text-blood neon-red">FOX!</div>
            <div className="text-sm text-cream/85">It ate your eggs. Lost {fmt(stake)}.</div>
          </div>
        </div>
      )}
      {status === 'won' && (
        <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
          <div className="animate-pop rounded-2xl border border-gold/50 bg-ink/80 px-6 py-3 text-center backdrop-blur">
            <div className="h-display text-4xl text-gold-grad">{fmtMult(cur)}</div>
            <div className="flex items-center justify-center gap-1 text-sm font-bold"><Coin className="h-4 w-4" />+{fmt(stake * cur - stake)}</div>
          </div>
        </div>
      )}
    </GameShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'gold' }) {
  return (
    <div className="rounded-xl bg-ink-900 p-2.5">
      <div className="label !text-[10px]">{label}</div>
      <div className={`font-display font-black tabular ${tone === 'gold' ? 'text-gold' : ''}`}>{value}</div>
    </div>
  );
}
