import { useEffect, useMemo, useRef, useState } from 'react';
import GameShell from '../components/GameShell';
import BetControls, { Seg, confirmBet } from '../components/BetControls';
import { useStore } from '../store';
import { rand } from '../lib/rng';
import { sfx } from '../lib/sound';
import { itemById } from '../lib/data';
import { fmt, fmtMult } from '../lib/format';
import { Coin } from '../components/Icons';
import { ShieldCheck } from 'lucide-react';
import { CrossScene } from './cross3d';

type Diff = 'easy' | 'medium' | 'hard' | 'hardcore';
const DIFF: Record<Diff, { lanes: number; death: number; label: string }> = {
  easy: { lanes: 24, death: 1 / 25, label: 'Easy' },
  medium: { lanes: 22, death: 3 / 25, label: 'Medium' },
  hard: { lanes: 20, death: 5 / 25, label: 'Hard' },
  hardcore: { lanes: 15, death: 10 / 25, label: 'Daredevil' },
};
const multFor = (d: Diff, step: number) => (step === 0 ? 1 : Math.floor((0.99 / Math.pow(1 - DIFF[d].death, step)) * 100) / 100);

type Status = 'idle' | 'playing' | 'dead' | 'cashed';

/**
 * Like Crash, the losing lane is decided before the round starts. Each lane has
 * the difficulty's crash chance, so the odds (and RTP) match rolling per hop.
 * null = the road is clear all the way to the golden egg.
 */
function rollCrashLane(death: number, lanes: number): number | null {
  for (let i = 1; i <= lanes; i++) if (rand() < death) return i;
  return null;
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

interface Round { crashLane: number | null; salt: string; hash: string; lanes: number }

export default function ChickenCross() {
  const [bet, setBet] = useState(useStore.getState().settings.defaultBet);
  const [diff, setDiff] = useState<Diff>('medium');
  const [status, setStatus] = useState<Status>('idle');
  const [step, setStep] = useState(0);
  const [stake, setStake] = useState(0);
  const [busy, setBusy] = useState(false);
  const [bump, setBump] = useState(0);
  const [round, setRound] = useState<Round | null>(null);
  const [history, setHistory] = useState<{ lane: number | null; lanes: number; id: number }[]>([]);
  const [showFair, setShowFair] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CrossScene | null>(null);
  const skin = useStore((s) => itemById(s.equipped.skin)?.color ?? '#F8F6EF');
  const turbo = useStore((s) => s.settings.turbo);

  const { lanes } = DIFF[diff];
  const mults = useMemo(() => Array.from({ length: lanes }, (_, i) => multFor(diff, i + 1)), [diff, lanes]);
  const cur = multFor(diff, step);
  const next = step < lanes ? mults[step] : cur;

  // mount the 3D scene once
  useEffect(() => {
    const sc = new CrossScene(hostRef.current!);
    sceneRef.current = sc;
    return () => { sc.dispose(); sceneRef.current = null; };
  }, []);
  useEffect(() => { sceneRef.current?.build(mults); }, [mults]);
  useEffect(() => { sceneRef.current?.setSkin(skin); }, [skin]);
  useEffect(() => { sceneRef.current?.setTurbo(turbo); }, [turbo]);

  // latest-state refs for the canvas click + keyboard handlers
  const api = useRef({ go: () => {}, start: () => {}, cash: () => {} });

  const start = async () => {
    if (busy || !confirmBet(bet) || !useStore.getState().placeBet(bet)) return;
    setBusy(true);
    const crashLane = rollCrashLane(DIFF[diff].death, lanes);
    const salt = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
    const hash = await sha256(`${crashLane ?? 0}:${salt}`);
    setRound({ crashLane, salt, hash, lanes });
    sfx.bet(); sfx.cluck();
    sceneRef.current?.reset();
    setStake(bet); setStep(0); setStatus('playing'); setBusy(false);
  };

  const endRound = () => {
    if (!round) return;
    setHistory((h) => [{ lane: round.crashLane, lanes: round.lanes, id: Date.now() }, ...h].slice(0, 12));
  };

  const go = async () => {
    if (status !== 'playing' || busy) return;
    setBusy(true);
    const nextStep = step + 1;
    const dies = nextStep === round?.crashLane;
    sfx.step();
    await sceneRef.current?.hop(nextStep, !dies);
    setStep(nextStep);
    if (dies) {
      sfx.crash();
      setStatus('dead');
      endRound();
      useStore.getState().settle('chicken-cross', stake, 0, `Hit on lane ${nextStep} · ${DIFF[diff].label}`);
      setBusy(false);
      return;
    }
    sfx.reveal();
    setBump((b) => b + 1);
    if (nextStep >= lanes) {
      await sceneRef.current?.finish();
      cashOut(nextStep);
    }
    setBusy(false);
  };

  const cashOut = (s = step) => {
    if (s === 0) return;
    const m = multFor(diff, s);
    setStatus('cashed');
    endRound();
    if (s < lanes) sceneRef.current?.celebrate();
    useStore.getState().settle('chicken-cross', stake, m, `Crossed ${s} lane${s > 1 ? 's' : ''} · ${DIFF[diff].label}`);
    sfx.cashout();
  };

  api.current = {
    go: () => (status === 'playing' ? go() : !busy && start()),
    start,
    cash: () => status === 'playing' && step > 0 && !busy && cashOut(),
  };

  // tap / click the road to hop
  useEffect(() => {
    sceneRef.current?.onClickNext(() => api.current.go());
  }, []);

  // keyboard: space/→ = go, enter = cash out
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); api.current.go(); }
      if (e.key === 'Enter') api.current.cash();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const controls = (
    <>
      <BetControls value={bet} onChange={setBet} disabled={status === 'playing'} />
      <div>
        <div className="label mb-1.5">Difficulty</div>
        <Seg options={['easy', 'medium', 'hard', 'hardcore'] as const} value={diff} onChange={setDiff} disabled={status === 'playing'} render={(v) => DIFF[v].label} />
        <p className="mt-1.5 text-[11px] text-smoke">{DIFF[diff].lanes} lanes · {Math.round(DIFF[diff].death * 100)}% crash chance per lane · top {fmtMult(mults[lanes - 1])}</p>
      </div>
      {status === 'playing' ? (
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-gold py-4 text-base" disabled={busy} onClick={go}>
            <span className="flex flex-col leading-tight"><span>Go</span><span className="text-[11px] opacity-70 tabular">{fmtMult(next)}</span></span>
          </button>
          <button className="btn-red py-4 text-base" disabled={step === 0 || busy} onClick={() => cashOut()}>
            <span className="flex flex-col leading-tight"><span>Cash out</span><span className="text-[11px] opacity-80 tabular">{fmt(stake * cur)}</span></span>
          </button>
        </div>
      ) : (
        <button className="btn-gold w-full py-4 text-base" disabled={busy} onClick={start}>{status === 'idle' ? 'Start crossing' : 'Play again'}</button>
      )}
      <div className="rounded-xl bg-ink-900 p-3 grid grid-cols-2 gap-2 text-center">
        <div><div className="label">Current</div><div className="font-display text-lg font-black text-gold tabular">{fmtMult(cur)}</div></div>
        <div><div className="label">Payout</div><div className="font-display text-lg font-black tabular flex items-center justify-center gap-1"><Coin className="h-4 w-4" />{fmt(status === 'idle' ? 0 : stake * cur)}</div></div>
      </div>
      <FairPanel round={round} revealed={status === 'dead' || status === 'cashed'} open={showFair} onToggle={() => setShowFair((o) => !o)} />
      <p className="text-[11px] text-smoke hidden lg:block">Tip: tap the road to hop · <kbd className="rounded bg-ink-600 px-1">Space</kbd> go · <kbd className="rounded bg-ink-600 px-1">Enter</kbd> cash out</p>
    </>
  );

  const pct = (step / lanes) * 100;

  return (
    <GameShell id="chicken-cross" controls={controls} rules={[
      'Choose a difficulty — harder roads have more traffic but grow the multiplier faster.',
      'Like Crash, the lane where a car will hit is decided (and hashed) the moment the round starts — it can’t change mid-round.',
      'Press Go (or tap the road) to hop into the next lane. In every safe lane the car brakes behind the barrier; each lane you survive raises your multiplier.',
      'Cash out any time to bank bet × multiplier.',
      'Get hit by a car and the round is lost. Reach the golden egg on the far side to auto-collect the top prize.',
    ]}>
      <div ref={hostRef} className="absolute inset-0 cursor-pointer" aria-label="Chicken Cross road — tap to hop" />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-xl bg-black/55 backdrop-blur px-3 py-2">
            <div className="label !text-[10px]">Lane</div>
            <div className="font-display font-black tabular">{step}<span className="text-smoke">/{lanes}</span></div>
          </div>
          <div key={bump} className={`rounded-2xl bg-black/55 backdrop-blur px-4 py-2 text-center ${bump ? 'animate-pop' : ''}`}>
            <div className="label !text-[10px]">Multiplier</div>
            <div className={`h-display text-3xl sm:text-4xl tabular ${status === 'dead' ? 'text-blood' : 'text-gold'}`}>{fmtMult(cur)}</div>
          </div>
          <div className="rounded-xl bg-black/55 backdrop-blur px-3 py-2 text-right">
            <div className="label !text-[10px]">Next</div>
            <div className="font-display font-black tabular text-cream">{status === 'playing' && step < lanes ? fmtMult(next) : '—'}</div>
          </div>
        </div>
        <div className="mx-auto mt-3 h-1.5 max-w-md overflow-hidden rounded-full bg-black/50">
          <div className="h-full rounded-full bg-gradient-to-r from-gold-600 to-gold transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        {history.length > 0 && (
          <div className="mt-2 flex justify-center gap-1.5 overflow-hidden">
            {history.map((h, i) => (
              <span key={h.id} title={h.lane ? `Car was on lane ${h.lane} of ${h.lanes}` : 'Road was clear'}
                className={`chip shrink-0 tabular backdrop-blur ${h.lane === null ? 'bg-gold text-ink' : h.lane <= 2 ? 'bg-blood/30 text-blood' : 'bg-black/55 text-cream'} ${i === 0 ? 'animate-pop' : ''} ${i > 5 ? 'hidden sm:inline-flex' : ''}`}>
                {h.lane === null ? 'CLEAR' : `L${h.lane}`}
              </span>
            ))}
          </div>
        )}
      </div>

      {status === 'idle' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
          <div className="animate-floaty rounded-full bg-black/60 px-4 py-2 text-xs font-semibold backdrop-blur">
            Why did the chicken cross the road? <span className="text-gold">To get paid.</span>
          </div>
        </div>
      )}
      {status === 'playing' && step === 0 && !busy && (
        <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
          <div className="animate-pulse rounded-full bg-gold px-4 py-2 text-xs font-black text-ink shadow-gold">TAP THE ROAD OR PRESS GO</div>
        </div>
      )}
      {status === 'dead' && <ResultCard tone="red" title="SPLAT!" sub={`Flattened on lane ${step}. Lost ${fmt(stake)}.`} />}
      {status === 'cashed' && (
        <ResultCard tone="gold" title={fmtMult(cur)}
          sub={`Safe! +${fmt(stake * cur - stake)} coins · ${round?.crashLane ? `the car was waiting on lane ${round.crashLane}` : 'the road was clear all the way'}`} />
      )}
    </GameShell>
  );
}

function FairPanel({ round, revealed, open, onToggle }: { round: Round | null; revealed: boolean; open: boolean; onToggle: () => void }) {
  const [verified, setVerified] = useState<boolean | null>(null);
  useEffect(() => setVerified(null), [round, revealed]);
  if (!round) return null;
  const verify = async () => setVerified((await sha256(`${round.crashLane ?? 0}:${round.salt}`)) === round.hash);
  return (
    <div className="rounded-xl border border-white/5 bg-ink-900 p-3 text-xs">
      <button onClick={onToggle} className="flex w-full items-center justify-between font-semibold">
        <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-emerald-400" />Round locked in</span>
        <span className="text-smoke">{open ? 'Hide' : 'Details'}</span>
      </button>
      <p className="mt-1.5 text-smoke">
        {revealed
          ? round.crashLane ? <>The car was on <b className="text-cream">lane {round.crashLane}</b>.</> : <>The road was <b className="text-gold">clear</b> this round.</>
          : 'The crash lane was decided before your first hop and is hidden until the round ends.'}
      </p>
      {open && (
        <div className="mt-2 space-y-1.5 break-all font-mono text-[10px] text-smoke">
          <div><span className="text-cream/70">Hash</span> {round.hash}</div>
          {revealed ? (
            <>
              <div><span className="text-cream/70">Result</span> {round.crashLane ?? 0}:{round.salt}</div>
              <button onClick={verify} className="btn-dark mt-1 px-2.5 py-1 font-sans text-[11px]">
                {verified === null ? 'Verify hash' : verified ? '✓ Hash matches' : '✗ Mismatch'}
              </button>
            </>
          ) : <div>Revealed after the round: <span className="text-cream/70">SHA-256(lane:salt)</span></div>}
        </div>
      )}
    </div>
  );
}

function ResultCard({ tone, title, sub }: { tone: 'red' | 'gold'; title: string; sub: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center px-4">
      <div className={`animate-pop rounded-2xl border px-6 py-3 text-center backdrop-blur-md ${tone === 'red' ? 'border-blood/60 bg-blood/20' : 'border-gold/60 bg-black/60'}`}>
        <div className={`h-display text-4xl sm:text-5xl ${tone === 'red' ? 'text-blood neon-red' : 'text-gold-grad'}`}>{title}</div>
        <div className="mt-1 text-sm text-cream/85">{sub}</div>
      </div>
    </div>
  );
}
