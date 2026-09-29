import { useEffect, useMemo, useRef, useState } from 'react';
import GameShell from '../components/GameShell';
import BetControls, { Seg, confirmBet } from '../components/BetControls';
import { useStore } from '../store';
import { rand } from '../lib/rng';
import { sfx } from '../lib/sound';
import { itemById } from '../lib/data';
import { fmt, fmtMult } from '../lib/format';
import { ChickenSprite, Coin, Egg } from '../components/Icons';

type Diff = 'easy' | 'medium' | 'hard' | 'hardcore';
const DIFF: Record<Diff, { lanes: number; death: number; label: string }> = {
  easy: { lanes: 24, death: 1 / 25, label: 'Easy' },
  medium: { lanes: 22, death: 3 / 25, label: 'Medium' },
  hard: { lanes: 20, death: 5 / 25, label: 'Hard' },
  hardcore: { lanes: 15, death: 10 / 25, label: 'Daredevil' },
};
const multFor = (d: Diff, step: number) => (step === 0 ? 1 : Math.floor((0.99 / Math.pow(1 - DIFF[d].death, step)) * 100) / 100);

const CAR_COLORS = ['#E63946', '#F4C430', '#F8F6EF', '#3B82F6', '#10B981', '#8B5CF6', '#F97316'];

type Status = 'idle' | 'playing' | 'dead' | 'cashed';

export default function ChickenCross() {
  const [bet, setBet] = useState(useStore.getState().settings.defaultBet);
  const [diff, setDiff] = useState<Diff>('medium');
  const [status, setStatus] = useState<Status>('idle');
  const [step, setStep] = useState(0);
  const [hop, setHop] = useState(false);
  const [killer, setKiller] = useState(false);
  const [stake, setStake] = useState(0);
  const lanesRef = useRef<HTMLDivElement>(null);
  const [laneW, setLaneW] = useState(96);
  const skin = useStore((s) => itemById(s.equipped.skin)?.color ?? '#F8F6EF');
  const lock = useRef(false);

  const { lanes } = DIFF[diff];
  const mults = useMemo(() => Array.from({ length: lanes }, (_, i) => multFor(diff, i + 1)), [diff, lanes]);
  const cur = multFor(diff, step);
  const next = step < lanes ? mults[step] : cur;

  useEffect(() => {
    const el = lanesRef.current!;
    const ro = new ResizeObserver(() => setLaneW(el.clientWidth < 520 ? 78 : 104));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // random decorative traffic per lane (re-rolled each game)
  const traffic = useMemo(
    () => Array.from({ length: lanes }, () => ({ dur: 1.4 + rand() * 2.2, delay: -rand() * 4, color: CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)], truck: rand() < 0.2 })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lanes, status === 'idle'],
  );

  const start = () => {
    if (!confirmBet(bet) || !useStore.getState().placeBet(bet)) return;
    sfx.bet(); sfx.cluck();
    setStake(bet); setStep(0); setStatus('playing'); setKiller(false);
  };

  const go = () => {
    if (status !== 'playing' || lock.current) return;
    lock.current = true;
    const turbo = useStore.getState().settings.turbo;
    const nextStep = step + 1;
    setHop(true); sfx.step();
    setStep(nextStep);
    const dies = rand() < DIFF[diff].death;
    setTimeout(() => {
      setHop(false);
      if (dies) {
        setKiller(true);
        setTimeout(() => {
          sfx.crash();
          setStatus('dead');
          useStore.getState().settle('chicken-cross', stake, 0, `Hit on lane ${nextStep} · ${DIFF[diff].label}`);
          lock.current = false;
        }, turbo ? 150 : 320);
      } else {
        sfx.reveal();
        lock.current = false;
        if (nextStep >= lanes) finish(nextStep);
      }
    }, turbo ? 140 : 280);
  };

  const finish = (s = step) => {
    if (s === 0) return;
    const m = multFor(diff, s);
    setStatus('cashed');
    useStore.getState().settle('chicken-cross', stake, m, `Crossed ${s} lane${s > 1 ? 's' : ''} · ${DIFF[diff].label}`);
    sfx.cashout();
  };

  // keyboard: space/→ = go, enter = cash out
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (['INPUT', 'BUTTON'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); status === 'playing' ? go() : start(); }
      if (e.key === 'Enter' && status === 'playing' && step > 0) finish();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  // camera: keep chicken ~30% from left
  const W = lanesRef.current?.clientWidth ?? 800;
  const chickenX = laneW * 0.5 + step * laneW + (step > 0 ? laneW * 0.5 : 0);
  const offset = Math.max(0, Math.min(chickenX - W * 0.32, laneW * (lanes + 2.2) - W));

  const controls = (
    <>
      <BetControls value={bet} onChange={setBet} disabled={status === 'playing'} />
      <div>
        <div className="label mb-1.5">Difficulty</div>
        <Seg options={['easy', 'medium', 'hard', 'hardcore'] as const} value={diff} onChange={setDiff} disabled={status === 'playing'} render={(v) => DIFF[v].label} />
        <p className="mt-1.5 text-[11px] text-smoke">{DIFF[diff].lanes} lanes · {Math.round(DIFF[diff].death * 100)}% chance of a car per lane · top {fmtMult(mults[lanes - 1])}</p>
      </div>
      {status === 'playing' ? (
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-gold py-4 text-base" onClick={go}>Go → <span className="text-xs opacity-70">{fmtMult(next)}</span></button>
          <button className="btn-red py-4 text-base" disabled={step === 0} onClick={() => finish()}>Cash out</button>
        </div>
      ) : (
        <button className="btn-gold w-full py-4 text-base" onClick={start}>{status === 'idle' ? 'Start crossing' : 'Play again'}</button>
      )}
      <div className="rounded-xl bg-ink-900 p-3 grid grid-cols-2 gap-2 text-center">
        <div><div className="label">Current</div><div className="font-display text-lg font-black text-gold tabular">{fmtMult(cur)}</div></div>
        <div><div className="label">Payout</div><div className="font-display text-lg font-black tabular flex items-center justify-center gap-1"><Coin className="h-4 w-4" />{fmt(status === 'idle' ? 0 : stake * cur)}</div></div>
      </div>
      <p className="text-[11px] text-smoke hidden lg:block">Keyboard: <kbd className="rounded bg-ink-600 px-1">Space</kbd> go · <kbd className="rounded bg-ink-600 px-1">Enter</kbd> cash out</p>
    </>
  );

  return (
    <GameShell id="chicken-cross" controls={controls} rules={[
      'Choose a difficulty — harder roads have more traffic but grow the multiplier faster.',
      'Press Go to hop into the next lane. Each lane you survive raises your multiplier.',
      'Cash out any time to bank bet × multiplier.',
      'Get hit by a car and the round is lost. Reach the far sidewalk to auto-collect the top prize.',
    ]}>
      <div ref={lanesRef} className="absolute inset-0 overflow-hidden bg-[#161616]">
        <div className="absolute inset-y-0 left-0 flex transition-transform duration-500 ease-out" style={{ transform: `translateX(${-offset}px)` }}>
          {/* start sidewalk */}
          <Sidewalk w={laneW} />
          {mults.map((m, i) => {
            const passed = i < step - (status === 'dead' ? 1 : 0) || (status === 'cashed' && i < step);
            const isCur = i === step - 1;
            const deathLane = status !== 'idle' && killer && isCur;
            const t = traffic[i];
            return (
              <div key={i} className="relative h-full shrink-0 border-r-2 border-dashed border-white/15" style={{ width: laneW }}>
                <div className="absolute inset-0 bg-gradient-to-b from-[#1d1d1d] via-[#191919] to-[#1d1d1d]" />
                {/* traffic */}
                {!passed && !isCur && (
                  <div className="absolute left-1/2 -translate-x-1/2 -top-40" style={{ animation: `drive ${t.dur}s linear ${t.delay}s infinite` }}>
                    <Car color={t.color} truck={t.truck} w={laneW * 0.56} />
                  </div>
                )}
                {deathLane && (
                  <div className="absolute left-1/2 -translate-x-1/2 z-20" style={{ top: -160, animation: 'slam .4s ease-in forwards' }}>
                    <Car color="#E63946" w={laneW * 0.6} />
                  </div>
                )}
                {/* barrier on passed lanes */}
                {(passed || (isCur && !killer)) && status !== 'idle' && (
                  <div className="absolute inset-x-2 top-[18%] h-3 rounded-sm animate-pop" style={{ background: 'repeating-linear-gradient(45deg,#F4C430 0 8px,#0B0B0B 8px 16px)', boxShadow: '0 4px 10px rgba(0,0,0,.6)' }} />
                )}
                {/* multiplier manhole */}
                <div className={`absolute left-1/2 top-[62%] -translate-x-1/2 -translate-y-1/2 grid place-items-center rounded-full border-4 font-display font-black tabular transition-all duration-300
                    ${passed ? 'border-gold/70 bg-gold text-ink scale-90 opacity-70' : isCur && status !== 'idle' ? 'border-gold bg-gold/20 text-gold scale-110 shadow-gold' : 'border-white/10 bg-ink-600 text-cream/80'}`}
                  style={{ width: laneW * 0.7, height: laneW * 0.7, fontSize: laneW < 90 ? 11 : 13 }}>
                  {fmtMult(m)}
                </div>
              </div>
            );
          })}
          {/* finish */}
          <div className="relative h-full shrink-0 bg-[#2a2a2a] border-l-4 border-gold/40" style={{ width: laneW * 1.2 }}>
            <div className="absolute inset-0 opacity-20" style={{ background: 'repeating-linear-gradient(0deg,#fff 0 1px,transparent 1px 28px)' }} />
            <div className="absolute left-1/2 top-[62%] -translate-x-1/2 -translate-y-1/2 text-center">
              <Egg className="h-14 w-14 mx-auto animate-floaty drop-shadow-[0_0_20px_rgba(244,196,48,.6)]" />
              <div className="mt-1 font-display text-[10px] font-black tracking-widest text-gold">GOLDEN EGG</div>
            </div>
          </div>
        </div>

        {/* chicken */}
        <div className="absolute z-10 transition-all ease-out" style={{
          left: chickenX - offset - laneW * 0.36, top: '62%', width: laneW * 0.72, transform: `translateY(-70%) ${hop ? 'translateY(-26px) scale(1.08)' : ''}`,
          transitionDuration: hop ? '160ms' : '300ms',
        }}>
          <ChickenSprite body={skin} dead={status === 'dead'} className={`w-full ${status === 'dead' ? 'rotate-90 opacity-80' : ''} ${status === 'idle' ? 'animate-floaty' : ''}`} />
          {status === 'dead' && <Feathers />}
        </div>

        {/* overlays */}
        {status === 'dead' && (
          <Overlay tone="red" title="SPLAT!" sub={`The chicken got flattened on lane ${step}. Lost ${fmt(stake)}.`} />
        )}
        {status === 'cashed' && (
          <Overlay tone="gold" title={fmtMult(cur)} sub={`Safe! You banked ${fmt(stake * cur)} coins.`} />
        )}
        {status === 'idle' && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center pointer-events-none">
            <div className="rounded-full bg-black/60 px-4 py-2 text-xs font-semibold backdrop-blur">Why did the chicken cross the road? <span className="text-gold">To get paid.</span></div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes drive { from { transform: translate(-50%, 0) } to { transform: translate(-50%, calc(100vh + 400px)) } }
        @keyframes slam { from { top: -160px } to { top: calc(62% - ${laneW * 0.9}px) } }
      `}</style>
    </GameShell>
  );
}

function Sidewalk({ w }: { w: number }) {
  return (
    <div className="relative h-full shrink-0 bg-[#2a2a2a] border-r-4 border-[#3a3a3a]" style={{ width: w }}>
      <div className="absolute inset-0 opacity-20" style={{ background: 'repeating-linear-gradient(0deg,#fff 0 1px,transparent 1px 28px)' }} />
      <div className="absolute bottom-3 inset-x-0 text-center font-display text-[9px] font-black tracking-widest text-smoke">START</div>
    </div>
  );
}

function Car({ color, w, truck }: { color: string; w: number; truck?: boolean }) {
  const h = w * (truck ? 2.4 : 1.8);
  return (
    <svg viewBox={`0 0 40 ${truck ? 96 : 72}`} width={w} height={h} className="drop-shadow-[0_10px_12px_rgba(0,0,0,.7)]">
      <rect x="2" y="2" width="36" height={truck ? 92 : 68} rx="9" fill={color} />
      {truck ? <rect x="6" y="30" width="28" height="58" rx="3" fill="#0003" /> : <rect x="6" y="36" width="28" height="18" rx="4" fill="#0B0B0B" opacity=".55" />}
      <rect x="6" y={truck ? 64 - 52 : 50 - 36} width="28" height="14" rx="4" fill="#0B0B0B" opacity=".7" />
      {/* headlights (driving down) */}
      <rect x="6" y={truck ? 90 : 66} width="8" height="4" rx="2" fill="#FFE08A" />
      <rect x="26" y={truck ? 90 : 66} width="8" height="4" rx="2" fill="#FFE08A" />
      <rect x="6" y="2" width="8" height="3" rx="1.5" fill="#E63946" />
      <rect x="26" y="2" width="8" height="3" rx="1.5" fill="#E63946" />
    </svg>
  );
}

function Feathers() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {Array.from({ length: 14 }).map((_, i) => (
        <span key={i} className="absolute left-1/2 top-1/2 h-1.5 w-4 rounded-full"
          style={{ background: i % 3 ? '#F8F6EF' : '#E63946', animation: `feather${i % 4} 1s ease-out forwards`, ['--dx' as any]: `${(Math.random() - 0.5) * 160}px`, ['--dy' as any]: `${-Math.random() * 120}px`, ['--r' as any]: `${Math.random() * 540}deg` }} />
      ))}
      <style>{[0, 1, 2, 3].map((k) => `@keyframes feather${k}{to{transform:translate(var(--dx),var(--dy)) rotate(var(--r));opacity:0}}`).join('')}</style>
    </div>
  );
}

function Overlay({ tone, title, sub }: { tone: 'red' | 'gold'; title: string; sub: string }) {
  return (
    <div className="absolute inset-x-0 top-6 z-30 flex justify-center pointer-events-none">
      <div className={`animate-pop rounded-2xl border px-6 py-4 text-center backdrop-blur-md ${tone === 'red' ? 'border-blood/50 bg-blood/15' : 'border-gold/50 bg-gold/10'}`}>
        <div className={`h-display text-4xl sm:text-5xl ${tone === 'red' ? 'text-blood neon-red' : 'text-gold-grad'}`}>{title}</div>
        <div className="mt-1 text-sm text-cream/80">{sub}</div>
      </div>
    </div>
  );
}
