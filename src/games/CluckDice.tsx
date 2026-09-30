import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import GameShell, { GameAction } from '../components/GameShell';
import BetControls, { MiniBet, Seg, confirmBet } from '../components/BetControls';
import { useStore } from '../store';
import { rand } from '../lib/rng';
import { sfx } from '../lib/sound';
import { fmt, fmtMult } from '../lib/format';
import { DiceScene } from './three/dice3d';

export default function CluckDice() {
  const [bet, setBet] = useState(useStore.getState().settings.defaultBet);
  const [target, setTarget] = useState(50.5);
  const [over, setOver] = useState(true);
  const [shown, setShown] = useState(0);
  const [won, setWon] = useState<boolean | null>(null);
  const [rolling, setRolling] = useState(false);
  const [recent, setRecent] = useState<{ v: number; w: boolean; id: number }[]>([]);
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const [autoCount, setAutoCount] = useState(10);
  const [autoLeft, setAutoLeft] = useState(0);
  const seq = useRef(0);

  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<DiceScene | null>(null);
  useEffect(() => {
    const sc = new DiceScene(hostRef.current!);
    sceneRef.current = sc;
    return () => { sc.dispose(); sceneRef.current = null; };
  }, []);
  useEffect(() => { sceneRef.current?.setTarget(target, over); }, [target, over]);

  const chance = over ? 100 - target : target;
  const mult = Math.floor((99 / chance) * 10000) / 10000;

  const doRoll = useCallback(() => {
    if (rolling) return false;
    if (!useStore.getState().placeBet(bet)) return false;
    sfx.bet();
    const r = Math.floor(rand() * 10001) / 100;
    const w = over ? r > target : r < target;
    setRolling(true); setWon(null);
    const turbo = useStore.getState().settings.turbo;
    const dur = turbo ? 280 : 950;
    sceneRef.current?.roll(r, w, dur);
    const t0 = performance.now();
    const from = shown;
    const anim = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(from + (r - from) * e);
      if (k < 1) requestAnimationFrame(anim);
      else {
        setShown(r); setWon(w); setRolling(false);
        useStore.getState().settle('cluck-dice', bet, w ? mult : 0, `Roll ${r.toFixed(2)} ${over ? '>' : '<'} ${target}`);
        w ? sfx.win() : sfx.lose();
        setRecent((l) => [{ v: r, w, id: ++seq.current }, ...l].slice(0, 10));
      }
    };
    requestAnimationFrame(anim);
    return true;
  }, [bet, over, target, mult, rolling, shown]);

  useEffect(() => {
    if (autoLeft <= 0 || rolling) return;
    const t = setTimeout(() => { if (doRoll()) setAutoLeft((n) => n - 1); else setAutoLeft(0); }, useStore.getState().settings.turbo ? 80 : 350);
    return () => clearTimeout(t);
  }, [autoLeft, rolling, doRoll]);

  const setChance = (c: number) => {
    const cc = Math.min(98, Math.max(2, c));
    setTarget(+(over ? 100 - cc : cc).toFixed(2));
  };

  const controls = (
    <>
      <Seg options={['manual', 'auto'] as const} value={mode} onChange={setMode} disabled={autoLeft > 0} render={(v) => (v === 'manual' ? 'Manual' : 'Auto')} />
      <BetControls value={bet} onChange={setBet} disabled={autoLeft > 0} />
        <div className="space-y-3">
          <div className="relative rounded-2xl bg-ink-900 p-4 border border-white/5">
            <div className="relative h-10">
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 rounded-full overflow-hidden flex">
                <div className={over ? 'bg-blood' : 'bg-emerald-500'} style={{ width: `${target}%` }} />
                <div className={`flex-1 ${over ? 'bg-emerald-500' : 'bg-blood'}`} />
              </div>
              <input type="range" min={2} max={98} step={0.5} value={target} disabled={rolling || autoLeft > 0}
                onChange={(e) => { setTarget(+e.target.value); sfx.tick(); }} className="range absolute inset-0 h-10" aria-label="Target" />

            </div>
            <div className="mt-1 flex justify-between text-[10px] font-bold text-smoke tabular"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Multiplier" value={mult.toFixed(4)} suffix="×" onChange={(v) => setChance(99 / Math.max(1.0102, v))} disabled={rolling} />
            <div>
              <div className="label mb-1">{over ? 'Roll over' : 'Roll under'}</div>
              <button onClick={() => { setOver((o) => !o); setTarget((t) => +(100 - t).toFixed(2)); sfx.click(); }} disabled={rolling}
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-ink-900 px-3 py-2.5 font-display font-bold tabular hover:border-gold/50">
                {target.toFixed(2)} <ArrowLeftRight size={14} className="text-gold" />
              </button>
            </div>
            <Field label="Win chance" value={chance.toFixed(2)} suffix="%" onChange={setChance} disabled={rolling} />
          </div>
        </div>

      <div className="rounded-xl bg-ink-900 p-3 flex justify-between items-center">
        <span className="label">Profit on win</span>
        <span className="font-display font-black text-emerald-400 tabular">+{fmt(bet * mult - bet)}</span>
      </div>
      {mode === 'auto' && (
        <div>
          <div className="label mb-1.5">Number of rolls</div>
          <Seg options={[10, 25, 50, 100] as const} value={autoCount as 10} onChange={setAutoCount} disabled={autoLeft > 0} />
        </div>
      )}
      <GameAction extra={<MiniBet value={bet} onChange={setBet} disabled={autoLeft > 0} />}>
        {mode === 'manual' ? (
          <button className="btn-gold w-full py-4 text-base" disabled={rolling} onClick={() => confirmBet(bet) && doRoll()}>Roll the egg</button>
        ) : autoLeft > 0 ? (
          <button className="btn-red w-full py-4 text-base" onClick={() => setAutoLeft(0)}>Stop ({autoLeft} left)</button>
        ) : (
          <button className="btn-gold w-full py-4 text-base" onClick={() => confirmBet(bet) && setAutoLeft(autoCount)}>Start auto-roll</button>
        )}
      </GameAction>
    </>
  );


  return (
    <GameShell id="cluck-dice" controls={controls} rules={[
      'Drag the slider to set your target number between 2 and 98.',
      'Choose Roll Over or Roll Under — the multiplier updates to match your win chance.',
      'A random number between 0.00 and 100.00 is rolled.',
      'Land on the green side of the target to win bet × multiplier.',
    ]}>
      <div ref={hostRef} className="absolute inset-0" aria-hidden />
      <div className="absolute inset-0 flex flex-col p-4 sm:p-8">
        <div className="flex gap-1.5 justify-end min-h-[28px]">
          {recent.map((r) => (
            <span key={r.id} className={`chip animate-pop tabular ${r.w ? 'bg-emerald-500/15 text-emerald-300' : 'bg-ink-600 text-smoke'}`}>{r.v.toFixed(2)}</span>
          ))}
        </div>
        <div className="pointer-events-none text-center">
          <div className={`h-display text-5xl sm:text-7xl tabular transition-colors drop-shadow-[0_4px_20px_rgba(0,0,0,.8)] ${won === null ? 'text-cream' : won ? 'text-emerald-400' : 'text-blood neon-red'}`}>
            {shown.toFixed(2)}
          </div>
          <div className="mt-1 h-6 font-display font-bold tracking-widest text-sm">
            {won === true && <span className="text-emerald-400 animate-pop inline-block">WINNER · {fmtMult(mult)}</span>}
            {won === false && <span className="text-smoke animate-pop inline-block">SO CLOSE. CLUCK AGAIN?</span>}
          </div>
        </div>
        <div className="flex-1" />

      </div>
    </GameShell>
  );
}

function Field({ label, value, suffix, onChange, disabled }: { label: string; value: string; suffix: string; onChange: (v: number) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div>
      <div className="label mb-1">{label}</div>
      <div className="flex items-center rounded-xl border border-white/10 bg-ink-900 px-3 focus-within:border-gold/60">
        <input value={draft ?? value} disabled={disabled} inputMode="decimal"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { if (draft !== null) { const v = parseFloat(draft); if (Number.isFinite(v)) onChange(v); setDraft(null); } }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="w-full min-w-0 bg-transparent py-2.5 font-display font-bold outline-none tabular" aria-label={label} />
        <span className="text-smoke text-sm">{suffix}</span>
      </div>
    </div>
  );
}
