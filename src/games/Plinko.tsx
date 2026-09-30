import { useCallback, useEffect, useRef, useState } from 'react';
import GameShell from '../components/GameShell';
import BetControls, { Seg, confirmBet } from '../components/BetControls';
import { useStore } from '../store';
import { rand } from '../lib/rng';
import { sfx } from '../lib/sound';
import { itemById } from '../lib/data';
import { fmtMult } from '../lib/format';
import { PlinkoScene } from './three/plinko3d';

type Risk = 'low' | 'medium' | 'high';
const ROWS = [8, 10, 12, 14, 16] as const;
type Rows = (typeof ROWS)[number];

const TABLE: Record<Rows, Record<Risk, number[]>> = {
  8: { low: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6], medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13], high: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29] },
  10: { low: [8.9, 3, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 3, 8.9], medium: [22, 5, 2, 1.4, 0.6, 0.4, 0.6, 1.4, 2, 5, 22], high: [76, 10, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 10, 76] },
  12: { low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10], medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33], high: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170] },
  14: { low: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 1.4, 1.9, 4, 7.1], medium: [58, 15, 7, 4, 1.9, 1, 0.5, 0.2, 0.5, 1, 1.9, 4, 7, 15, 58], high: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5, 18, 56, 420] },
  16: { low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16], medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110], high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000] },
};

const bucketColor = (i: number, n: number) => {
  const d = Math.abs(i - (n - 1) / 2) / ((n - 1) / 2); // 0 center → 1 edge
  const hue = 48 - d * 48; // gold → red
  return `hsl(${hue} ${85 + d * 5}% ${52 - d * 4}%)`;
};

export default function Plinko() {
  const [bet, setBet] = useState(useStore.getState().settings.defaultBet);
  const [risk, setRisk] = useState<Risk>('medium');
  const [rows, setRows] = useState<Rows>(12);
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const [autoCount, setAutoCount] = useState(10);
  const [autoLeft, setAutoLeft] = useState(0);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<{ id: number; m: number; i: number; n: number }[]>([]);

  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PlinkoScene | null>(null);
  const ballSkin = useStore((s) => itemById(s.equipped.ball)?.color ?? '#F4C430');
  const turbo = useStore((s) => s.settings.turbo);
  const seq = useRef(0);

  useEffect(() => {
    const sc = new PlinkoScene(hostRef.current!);
    sceneRef.current = sc;
    return () => { sc.dispose(); sceneRef.current = null; };
  }, []);
  useEffect(() => { sceneRef.current?.setBoard(rows, TABLE[rows][risk]); }, [rows, risk]);
  useEffect(() => { sceneRef.current?.setBallColor(ballSkin); }, [ballSkin]);
  useEffect(() => { sceneRef.current?.setTurbo(turbo); }, [turbo]);

  const drop = useCallback(() => {
    if (!(bet > 0) || !sceneRef.current) return false;
    if (!useStore.getState().placeBet(bet)) return false;
    sfx.bet();
    const path = Array.from({ length: rows }, () => (rand() < 0.5 ? 0 : 1));
    const bucket = path.reduce<number>((a, b) => a + b, 0);
    const mult = TABLE[rows][risk][bucket];
    const id = ++seq.current;
    const stake = bet, n = rows, riskNow = risk;
    setActive((a) => a + 1);
    sceneRef.current.drop(id, path, {
      onPeg: (r) => sfx.tick(r),
      onLand: () => {
        useStore.getState().settle('plinko', stake, mult, `${n} rows · ${riskNow}`);
        mult >= 1 ? (mult >= 3 ? sfx.win() : sfx.reveal()) : sfx.lose();
        setRecent((l) => [{ id, m: mult, i: bucket, n: n + 1 }, ...l].slice(0, 8));
        setActive((a) => a - 1);
      },
    });
    return true;
  }, [bet, rows, risk]);

  // auto-drop loop
  useEffect(() => {
    if (autoLeft <= 0) return;
    const t = setTimeout(() => {
      if (drop()) setAutoLeft((n) => n - 1);
      else setAutoLeft(0);
    }, turbo ? 120 : 260);
    return () => clearTimeout(t);
  }, [autoLeft, drop, turbo]);

  const busy = active > 0 || autoLeft > 0;

  const controls = (
    <>
      <Seg options={['manual', 'auto'] as const} value={mode} onChange={setMode} disabled={autoLeft > 0} render={(v) => (v === 'manual' ? 'Manual' : 'Auto')} />
      <BetControls value={bet} onChange={setBet} disabled={autoLeft > 0} />
      <div>
        <div className="label mb-1.5">Risk</div>
        <Seg options={['low', 'medium', 'high'] as const} value={risk} onChange={setRisk} disabled={busy} render={(v) => v[0].toUpperCase() + v.slice(1)} />
      </div>
      <div>
        <div className="label mb-1.5">Rows</div>
        <Seg options={ROWS} value={rows} onChange={setRows} disabled={busy} />
      </div>
      {mode === 'auto' && (
        <div>
          <div className="label mb-1.5">Number of drops</div>
          <Seg options={[10, 25, 50, 100] as const} value={autoCount as 10} onChange={setAutoCount} disabled={autoLeft > 0} />
        </div>
      )}
      {mode === 'manual' ? (
        <button className="btn-gold w-full py-3.5 text-base" onClick={() => confirmBet(bet) && drop()}>Drop egg</button>
      ) : autoLeft > 0 ? (
        <button className="btn-red w-full py-3.5 text-base" onClick={() => setAutoLeft(0)}>Stop auto ({autoLeft})</button>
      ) : (
        <button className="btn-gold w-full py-3.5 text-base" onClick={() => confirmBet(bet) && setAutoLeft(autoCount)}>Start auto-drop</button>
      )}
      <p className="text-[11px] text-smoke">Tip: spam the button — multiple eggs can bounce at once.</p>
    </>
  );

  return (
    <GameShell id="plinko" controls={controls} rules={[
      'Set your bet, pick a risk level and the number of peg rows.',
      'Drop a golden egg — at each peg it bounces left or right with equal odds.',
      'The slot it lands in decides your multiplier. Edges pay the most but are rarest.',
      'Higher risk = bigger edges, smaller middle. More rows = more extreme edges.',
    ]}>
      <div ref={hostRef} className="absolute inset-0" aria-label="Plinko board" />
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
