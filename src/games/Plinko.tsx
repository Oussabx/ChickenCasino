import { useCallback, useEffect, useRef, useState } from 'react';
import { Infinity as InfinityIcon } from 'lucide-react';
import GameShell, { GameAction } from '../components/GameShell';
import BetControls, { MiniBet, Seg, confirmBet } from '../components/BetControls';
import { toast, useStore } from '../store';
import { rand } from '../lib/rng';
import { sfx } from '../lib/sound';
import { itemById } from '../lib/data';
import { fmt, fmtMult } from '../lib/format';
import { PlinkoScene } from './three/plinko3d';

/**
 * Difficulty sets the board size (rows) and the payout table together.
 * Every level returns ~99% over time, but the chance of getting at least your
 * bet back drops at each step while the edge prizes grow.
 */
const LEVELS = {
  easy: { label: 'Easy', rows: 8, win: 72.7, table: [2, 1.6, 1.3, 1.1, 0.4, 1.1, 1.3, 1.6, 2] },
  normal: { label: 'Normal', rows: 10, win: 34.4, table: [14, 4.9, 2.7, 1.5, 0.5, 0.3, 0.5, 1.5, 2.7, 4.9, 14] },
  hard: { label: 'Hard', rows: 12, win: 14.6, table: [44, 16, 7.4, 3.3, 0.5, 0.3, 0.2, 0.3, 0.5, 3.3, 7.4, 16, 44] },
  expert: { label: 'Expert', rows: 14, win: 5.7, table: [130, 55, 22, 8.7, 0.5, 0.3, 0.2, 0.2, 0.2, 0.3, 0.5, 8.7, 22, 55, 130] },
  insane: { label: 'Insane', rows: 16, win: 2.1, table: [730, 220, 72, 24, 0.5, 0.3, 0.2, 0.2, 0, 0.2, 0.2, 0.3, 0.5, 24, 72, 220, 730] },
} as const;
type Level = keyof typeof LEVELS;
const LEVEL_COLORS: Record<Level, string> = { easy: '#34d399', normal: '#F4C430', hard: '#FB923C', expert: '#E63946', insane: '#A855F7' };

const SPEEDS = { normal: 450, fast: 240, turbo: 110 } as const;
type Speed = keyof typeof SPEEDS;
const COUNTS = [10, 25, 50, 100, Infinity] as const;

const bucketColor = (i: number, n: number) => {
  const d = Math.abs(i - (n - 1) / 2) / ((n - 1) / 2); // 0 center → 1 edge
  const hue = 48 - d * 48; // gold → red
  return `hsl(${hue} ${85 + d * 5}% ${52 - d * 4}%)`;
};

export default function Plinko() {
  const [bet, setBet] = useState(useStore.getState().settings.defaultBet);
  const [level, setLevel] = useState<Level>('normal');
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const [autoCount, setAutoCount] = useState<number>(25);
  const [speed, setSpeed] = useState<Speed>('fast');
  const [stopProfit, setStopProfit] = useState(0);
  const [stopLoss, setStopLoss] = useState(0);
  const [autoLeft, setAutoLeft] = useState(0);
  const [autoTick, setAutoTick] = useState(0); // drives the loop (autoLeft stays Infinity in unlimited mode)
  const [session, setSession] = useState({ drops: 0, profit: 0 });
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<{ id: number; m: number; i: number; n: number }[]>([]);

  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PlinkoScene | null>(null);
  const ballSkin = useStore((s) => itemById(s.equipped.ball)?.color ?? '#F4C430');
  const turbo = useStore((s) => s.settings.turbo);
  const seq = useRef(0);
  const auto = useRef({ running: false, profit: 0, stopProfit: 0, stopLoss: 0 });
  const { rows, table } = LEVELS[level];

  useEffect(() => {
    const sc = new PlinkoScene(hostRef.current!);
    sceneRef.current = sc;
    return () => { sc.dispose(); sceneRef.current = null; };
  }, []);
  useEffect(() => { sceneRef.current?.setBoard(rows, [...table]); }, [rows, table]);
  useEffect(() => { sceneRef.current?.setBallColor(ballSkin); }, [ballSkin]);
  useEffect(() => { sceneRef.current?.setTurbo(turbo); }, [turbo]);
  useEffect(() => { sceneRef.current?.setAuto(autoLeft > 0); }, [autoLeft]);

  const stopAuto = (why?: string) => {
    auto.current.running = false;
    setAutoLeft(0);
    if (why) toast({ title: why, tone: 'neutral' });
  };

  const drop = useCallback(() => {
    if (!(bet > 0) || !sceneRef.current) return false;
    if (!useStore.getState().placeBet(bet)) return false;
    sfx.bet();
    const path = Array.from({ length: rows }, () => (rand() < 0.5 ? 0 : 1));
    const bucket = path.reduce<number>((a, b) => a + b, 0);
    const mult = table[bucket];
    const id = ++seq.current;
    const stake = bet, n = rows, lvl = LEVELS[level].label;
    const fromAuto = auto.current.running;
    setActive((a) => a + 1);
    sceneRef.current.drop(id, path, {
      onPeg: (r) => sfx.tick(r),
      onLand: () => {
        useStore.getState().settle('plinko', stake, mult, `${lvl} · ${n} rows`);
        mult >= 1 ? (mult >= 3 ? sfx.win() : sfx.reveal()) : sfx.lose();
        setRecent((l) => [{ id, m: mult, i: bucket, n: n + 1 }, ...l].slice(0, 8));
        setActive((a) => a - 1);
        if (fromAuto) {
          const a = auto.current;
          a.profit += stake * mult - stake;
          setSession((s) => ({ drops: s.drops + 1, profit: s.profit + stake * mult - stake }));
          if (a.running && a.stopProfit > 0 && a.profit >= a.stopProfit) stopAuto(`Auto stopped: profit target hit (+${fmt(a.profit)})`);
          else if (a.running && a.stopLoss > 0 && -a.profit >= a.stopLoss) stopAuto(`Auto stopped: loss limit hit (${fmt(a.profit)})`);
        }
      },
    });
    return true;
  }, [bet, rows, table, level]);

  // auto-drop loop
  useEffect(() => {
    if (autoLeft <= 0 || !auto.current.running) return;
    const t = setTimeout(() => {
      if (!auto.current.running) return;
      if (drop()) { setAutoLeft((n) => n - 1); setAutoTick((k) => k + 1); }
      else stopAuto();
    }, turbo ? Math.min(SPEEDS[speed], 120) : SPEEDS[speed]);
    return () => clearTimeout(t);
  }, [autoLeft, autoTick, drop, turbo, speed]);

  const startAuto = () => {
    if (!confirmBet(bet)) return;
    auto.current = { running: true, profit: 0, stopProfit, stopLoss };
    setSession({ drops: 0, profit: 0 });
    setAutoLeft(autoCount);
  };

  const running = autoLeft > 0;
  const busy = active > 0 || running;

  const actionBtn =
    mode === 'manual' ? (
      <button className="btn-gold w-full py-3.5 text-base" onClick={() => confirmBet(bet) && drop()}>Drop egg</button>
    ) : running ? (
      <button className="btn-red w-full py-3.5 text-base" onClick={() => stopAuto()}>
        Stop auto · {Number.isFinite(autoLeft) ? `${autoLeft} left` : '∞'}
      </button>
    ) : (
      <button className="btn-gold w-full py-3.5 text-base" onClick={startAuto}>Start auto-drop</button>
    );

  const controls = (
    <>
      <Seg options={['manual', 'auto'] as const} value={mode} onChange={setMode} disabled={running} render={(v) => (v === 'manual' ? 'Manual' : 'Auto-dropper')} />
      <BetControls value={bet} onChange={setBet} disabled={running} />
      <div>
        <div className="label mb-1.5">Difficulty</div>
        <div className="grid grid-cols-5 gap-1 rounded-xl border border-white/5 bg-ink-900 p-1">
          {(Object.keys(LEVELS) as Level[]).map((k) => (
            <button key={k} type="button" disabled={busy} onClick={() => { sfx.click(); setLevel(k); }} aria-pressed={level === k}
              className={`rounded-lg px-1 py-1.5 text-[11px] font-bold transition disabled:opacity-50 ${level === k ? 'text-ink' : 'text-smoke hover:text-cream'}`}
              style={level === k ? { background: LEVEL_COLORS[k] } : undefined}>
              {LEVELS[k].label}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
          <Stat label="Board" value={`${rows} rows`} />
          <Stat label="Win chance" value={`${LEVELS[level].win}%`} />
          <Stat label="Top prize" value={fmtMult(table[0])} gold />
        </div>
      </div>

      {mode === 'auto' && (
        <div className="space-y-3 rounded-xl border border-gold/20 bg-gold/[0.04] p-3">
          <div>
            <div className="label mb-1.5">Drops</div>
            <div className="seg">
              {COUNTS.map((c) => (
                <button key={String(c)} type="button" data-active={autoCount === c} disabled={running} onClick={() => setAutoCount(c)} aria-label={Number.isFinite(c) ? `${c} drops` : 'Unlimited drops'}>
                  {Number.isFinite(c) ? c : <InfinityIcon size={14} className="mx-auto" />}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="label mb-1.5">Speed</div>
            <Seg options={['normal', 'fast', 'turbo'] as const} value={speed} onChange={setSpeed} render={(v) => v[0].toUpperCase() + v.slice(1)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Limit label="Stop at profit" value={stopProfit} onChange={setStopProfit} disabled={running} />
            <Limit label="Stop at loss" value={stopLoss} onChange={setStopLoss} disabled={running} />
          </div>
          {(running || session.drops > 0) && (
            <div className="flex items-center justify-between rounded-lg bg-ink-900 px-3 py-2 text-xs">
              <span className="text-smoke">{session.drops} dropped{running && <span className="ml-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}</span>
              <span className={`font-display font-black tabular ${session.profit >= 0 ? 'text-emerald-400' : 'text-blood'}`}>{session.profit >= 0 ? '+' : ''}{fmt(session.profit)}</span>
            </div>
          )}
        </div>
      )}

      <GameAction extra={<MiniBet value={bet} onChange={setBet} disabled={running} />}>{actionBtn}</GameAction>
      <p className="text-[11px] text-smoke hidden lg:block">
        {mode === 'manual' ? 'Tip: tap fast — several eggs can bounce at once.' : 'The hen lays eggs on her own until the count runs out or a limit is hit.'}
      </p>
    </>
  );

  return (
    <GameShell id="plinko" controls={controls} rules={[
      'Set your bet and pick a difficulty from Easy to Insane.',
      'Harder levels use a bigger board with more rows, fewer winning slots and much bigger edge prizes. Every level returns about 99% over time.',
      'The hen lays a golden egg; at each peg it bounces left or right with equal odds, and the slot it lands in decides your multiplier.',
      'Switch to Auto-dropper to let the hen keep laying: choose how many drops, the speed, and optional profit/loss limits.',
    ]}>
      <div ref={hostRef} className="absolute inset-0" aria-label="Plinko board" />
      <div className="pointer-events-none absolute left-2 top-2 sm:left-3 sm:top-3 rounded-xl bg-black/55 px-3 py-1.5 backdrop-blur">
        <div className="label !text-[10px]" style={{ color: LEVEL_COLORS[level] }}>{LEVELS[level].label}</div>
        <div className="font-display text-sm font-black tabular">{LEVELS[level].win}% <span className="font-semibold text-smoke">to win</span></div>
      </div>
      <div className="absolute right-2 top-2 sm:right-3 sm:top-3 flex flex-col gap-1.5">
        {recent.map((r) => (
          <div key={r.id} className="animate-pop rounded-lg px-2 py-1 text-center font-display text-[11px] font-black text-ink min-w-[48px]" style={{ background: bucketColor(r.i, r.n) }}>
            {fmtMult(r.m)}
          </div>
        ))}
      </div>
    </GameShell>
  );
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="rounded-lg bg-ink-900 px-1 py-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-smoke">{label}</div>
      <div className={`font-display text-xs font-black tabular ${gold ? 'text-gold' : ''}`}>{value}</div>
    </div>
  );
}

function Limit({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-smoke">{label}</span>
      <input type="number" min={0} value={value || ''} placeholder="Off" disabled={disabled}
        onChange={(e) => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
        className="input mt-1 !py-2 text-sm tabular" />
    </label>
  );
}
