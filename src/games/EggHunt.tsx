import { useState } from 'react';
import { Shuffle } from 'lucide-react';
import GameShell from '../components/GameShell';
import BetControls, { confirmBet } from '../components/BetControls';
import { useStore } from '../store';
import { shuffle } from '../lib/rng';
import { sfx } from '../lib/sound';
import { fmt, fmtMult } from '../lib/format';
import { Coin, Egg } from '../components/Icons';

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
  const [boom, setBoom] = useState<number | null>(null);
  const [stake, setStake] = useState(0);

  const picks = open.size;
  const cur = multFor(mines, picks);
  const next = multFor(mines, picks + 1);
  const playing = status === 'playing';

  const start = () => {
    if (!confirmBet(bet) || !useStore.getState().placeBet(bet)) return;
    sfx.bet();
    const b = shuffle(Array.from({ length: N }, (_, i) => i < mines));
    setBoard(b); setOpen(new Set()); setBoom(null); setStake(bet); setStatus('playing');
  };

  const reveal = (i: number) => {
    if (!playing || open.has(i)) return;
    const o = new Set(open); o.add(i);
    setOpen(o);
    if (board[i]) {
      setBoom(i); setStatus('lost'); sfx.crash();
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
    useStore.getState().settle('egg-hunt', stake, m, `${k} eggs · ${mines} foxes`);
  };

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
      <div className="absolute inset-0 flex items-center justify-center" style={{ containerType: 'size' }}>
        <div style={{ width: 'min(100cqw - 24px, 100cqh - 24px, 540px)' }} className={`grid grid-cols-5 gap-2 sm:gap-3 ${status === 'lost' ? 'animate-shake' : ''}`}>
          {Array.from({ length: N }).map((_, i) => {
            const isOpen = open.has(i) || status === 'lost' || status === 'won';
            const fox = board[i];
            const picked = open.has(i);
            return (
              <button
                key={i}
                onClick={() => reveal(i)}
                disabled={!playing || open.has(i)}
                className={`group relative aspect-square rounded-xl sm:rounded-2xl transition-all duration-300 [transform-style:preserve-3d] ${playing && !open.has(i) ? 'hover:-translate-y-1 cursor-pointer' : ''}`}
                aria-label={`Nest ${i + 1}`}
              >
                <div className={`absolute inset-0 rounded-[inherit] transition-transform duration-500 [backface-visibility:hidden] ${isOpen && status !== 'idle' ? '[transform:rotateY(180deg)]' : ''}
                  bg-gradient-to-b from-[#3a2c1a] to-[#241a0e] border border-[#5a4526]/60 shadow-[inset_0_-6px_0_rgba(0,0,0,.35)] ${playing ? 'group-hover:border-gold/50' : ''}`}>
                  <Nest />
                </div>
                <div className={`absolute inset-0 grid place-items-center rounded-[inherit] transition-transform duration-500 [backface-visibility:hidden] [transform:rotateY(180deg)] ${isOpen && status !== 'idle' ? '![transform:rotateY(0deg)]' : ''}
                  ${fox ? (boom === i ? 'bg-blood/40 border-2 border-blood shadow-red' : 'bg-blood/10 border border-blood/20') : picked ? 'bg-gold/15 border-2 border-gold/60 shadow-gold' : 'bg-white/[0.03] border border-white/5'}
                  ${!picked && boom !== i ? 'opacity-50' : ''}`}>
                  {fox ? <Fox className="w-3/5" /> : <Egg className={`w-1/2 h-1/2 ${picked ? 'animate-pop' : ''}`} />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
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

function Nest() {
  return (
    <svg viewBox="0 0 40 40" className="absolute inset-[18%] opacity-70">
      <ellipse cx="20" cy="26" rx="15" ry="7" fill="#6b4f2a" />
      {Array.from({ length: 9 }).map((_, i) => (
        <path key={i} d={`M${6 + i * 3.5} ${22 + (i % 2) * 3} q 6 ${-4 + (i % 3)} 12 2`} stroke="#a47c45" strokeWidth="1.3" fill="none" />
      ))}
      <ellipse cx="20" cy="23" rx="10" ry="3.5" fill="#2a1d0e" />
    </svg>
  );
}

export function Fox({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className}>
      <path d="M8 6l14 16h20L56 6l-4 26c0 14-9 24-20 24S12 46 12 32Z" fill="#F97316" />
      <path d="M12 32c6 2 12 8 20 22 8-14 14-20 20-22-2 14-10 24-20 24S14 46 12 32Z" fill="#F8F6EF" />
      <path d="M14 12l6 9-7 3Zm36 0-6 9 7 3Z" fill="#7c2d12" />
      <path d="M20 30l8 3-8 2Zm24 0-8 3 8 2Z" fill="#0B0B0B" />
      <ellipse cx="32" cy="46" rx="4" ry="3" fill="#0B0B0B" />
    </svg>
  );
}
