import { useMemo, useRef, useState } from 'react';
import GameShell from '../components/GameShell';
import BetControls, { Seg, confirmBet } from '../components/BetControls';
import { useStore } from '../store';
import { rand } from '../lib/rng';
import { sfx } from '../lib/sound';
import { fmt, fmtMult } from '../lib/format';

type Risk = 'low' | 'medium' | 'high';
const SEGMENTS = 30;

const DIST: Record<Risk, [number, number][]> = {
  low: [[0, 8], [1.2, 12], [1.5, 9], [1.8, 1]],
  medium: [[0, 14], [1.5, 7], [1.6, 2], [2, 5], [3, 2]],
  high: [[0, 29], [29.7, 1]],
};
const COLOR: Record<string, string> = {
  '0': '#1f1f1f', '1.2': '#F8F6EF', '1.5': '#F4C430', '1.6': '#FB923C', '1.8': '#E63946', '2': '#E63946', '3': '#A855F7', '29.7': '#F4C430',
};

/** Deterministically interleave multipliers so the wheel looks balanced. */
function build(risk: Risk) {
  const list: number[] = [];
  DIST[risk].forEach(([m, c]) => { for (let i = 0; i < c; i++) list.push(m); });
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const zeros = list.filter((x) => x === 0), rest = list.filter((x) => x !== 0).sort(() => r() - 0.5);
  const out: number[] = [];
  const step = SEGMENTS / Math.max(1, rest.length);
  let acc = 0;
  for (let i = 0; i < SEGMENTS; i++) {
    if (rest.length && i >= Math.round(acc)) { out.push(rest.shift()!); acc += step; } else out.push(zeros.shift() ?? rest.shift()!);
  }
  return out;
}

export default function GoldenWheel() {
  const [bet, setBet] = useState(useStore.getState().settings.defaultBet);
  const [risk, setRisk] = useState<Risk>('medium');
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [hit, setHit] = useState<number | null>(null);
  const [recent, setRecent] = useState<{ m: number; id: number }[]>([]);
  const seq = useRef(0);
  const segs = useMemo(() => build(risk), [risk]);
  const turbo = useStore((s) => s.settings.turbo);
  const dur = turbo ? 1400 : 4200;

  const spin = () => {
    if (spinning || !confirmBet(bet) || !useStore.getState().placeBet(bet)) return;
    sfx.bet();
    const idx = Math.floor(rand() * SEGMENTS);
    const segA = 360 / SEGMENTS;
    const a = (idx + 0.5) * segA + (rand() - 0.5) * segA * 0.7;
    const base = rot - (((rot % 360) + 360) % 360);
    const target = base + 360 * (turbo ? 3 : 6) + (360 - a);
    setSpinning(true); setHit(null); setRot(target);
    // ticking
    let ticks = 0;
    const tickIv = setInterval(() => { sfx.tick(ticks++ % 5); }, turbo ? 60 : 110);
    setTimeout(() => {
      clearInterval(tickIv);
      const m = segs[idx];
      setHit(idx); setSpinning(false);
      setRecent((l) => [{ m, id: ++seq.current }, ...l].slice(0, 8));
      useStore.getState().settle('golden-wheel', bet, m, `${risk} risk`);
      m > 1 ? sfx.win() : m > 0 ? sfx.reveal() : sfx.lose();
    }, dur);
  };

  const counts = DIST[risk];
  const R = 150;

  const controls = (
    <>
      <BetControls value={bet} onChange={setBet} disabled={spinning} />
      <div>
        <div className="label mb-1.5">Risk</div>
        <Seg options={['low', 'medium', 'high'] as const} value={risk} onChange={(v) => { setRisk(v); setHit(null); }} disabled={spinning} render={(v) => v[0].toUpperCase() + v.slice(1)} />
      </div>
      <button className="btn-gold w-full py-4 text-base" disabled={spinning} onClick={spin}>{spinning ? 'Spinning…' : 'Spin the wheel'}</button>
      <div>
        <div className="label mb-2">Payout table</div>
        <div className="space-y-1.5">
          {counts.map(([m, c]) => (
            <div key={m} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ${hit !== null && segs[hit] === m ? 'bg-white/10 ring-1 ring-gold/50' : 'bg-ink-700/60'}`}>
              <span className="h-3 w-3 rounded-full border border-white/20" style={{ background: COLOR[String(m)] }} />
              <span className="font-display font-bold tabular">{fmtMult(m)}</span>
              <span className="ml-auto text-xs text-smoke">{((c / SEGMENTS) * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <GameShell id="golden-wheel" controls={controls} rules={[
      'Pick a risk level — each has its own set of wheel slices.',
      'Spin! The slice under the golden pointer decides your multiplier.',
      'Low risk pays often but small. High risk has one 29.70× golden slice.',
    ]}>
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
        <div className="absolute right-3 top-3 flex flex-col gap-1.5">
          {recent.map((r) => (
            <span key={r.id} className="animate-pop rounded-lg px-2 py-1 text-center font-display text-[11px] font-black min-w-[52px]"
              style={{ background: COLOR[String(r.m)], color: r.m === 0 ? '#A0A0A0' : '#0B0B0B' }}>{fmtMult(r.m)}</span>
          ))}
        </div>
        <div className="relative w-[min(88vw,440px)] aspect-square">
          {/* glow */}
          <div className="absolute inset-[6%] rounded-full bg-gold/20 blur-3xl" />
          {/* pointer */}
          <div className="absolute left-1/2 -top-1 z-10 -translate-x-1/2">
            <svg width="34" height="40" viewBox="0 0 34 40"><path d="M17 38 3 6a14 14 0 0 1 28 0Z" fill="#F4C430" stroke="#0B0B0B" strokeWidth="3" /><circle cx="17" cy="10" r="4" fill="#0B0B0B" /></svg>
          </div>
          <svg viewBox="-170 -170 340 340" className="relative h-full w-full">
            {/* bulbs ring */}
            <circle r="166" fill="#140a02" stroke="#F4C430" strokeWidth="4" />
            {Array.from({ length: 30 }).map((_, i) => {
              const a = (i / 30) * Math.PI * 2;
              return <circle key={i} cx={Math.sin(a) * 159} cy={-Math.cos(a) * 159} r="3.2" fill={i % 2 === (spinning ? Math.floor(Date.now() / 200) % 2 : 0) ? '#FFE08A' : '#E63946'} className={spinning ? 'animate-pulse' : ''} />;
            })}
            <g style={{ transform: `rotate(${rot}deg)`, transition: spinning ? `transform ${dur}ms cubic-bezier(.12,.72,.14,1)` : 'none' }}>
              {segs.map((m, i) => {
                const a0 = (i / SEGMENTS) * Math.PI * 2, a1 = ((i + 1) / SEGMENTS) * Math.PI * 2;
                const p = (a: number, r: number) => `${Math.sin(a) * r} ${-Math.cos(a) * r}`;
                const mid = (a0 + a1) / 2;
                const isHit = hit === i && !spinning;
                return (
                  <g key={i}>
                    <path d={`M0 0 L${p(a0, R)} A${R} ${R} 0 0 1 ${p(a1, R)}Z`} fill={COLOR[String(m)]} stroke="#0B0B0B" strokeWidth="1.5" opacity={hit !== null && !isHit && !spinning ? 0.45 : 1} />
                    {m > 0 && (
                      <text x={Math.sin(mid) * 118} y={-Math.cos(mid) * 118} transform={`rotate(${(mid * 180) / Math.PI} ${Math.sin(mid) * 118} ${-Math.cos(mid) * 118})`}
                        textAnchor="middle" dominantBaseline="middle" fontFamily="Montserrat" fontWeight="900" fontSize="10" fill={m === 1.2 ? '#0B0B0B' : '#0B0B0B'}>
                        {m}
                      </text>
                    )}
                  </g>
                );
              })}
              <circle r="72" fill="#0B0B0B" opacity=".25" />
            </g>
            <circle r="52" fill="#0B0B0B" stroke="#F4C430" strokeWidth="3" />
            <image href="./img/head.webp" x="-46" y="-46" width="92" height="92" clipPath="circle(46px)" style={{ clipPath: 'circle(46px at 46px 46px)' }} />
          </svg>
        </div>
        <div className="mt-4 h-10 text-center">
          {hit !== null && !spinning && (
            <div className="animate-pop font-display text-2xl font-black">
              {segs[hit] > 0 ? <span className="text-gold-grad">{fmtMult(segs[hit])} · +{fmt(bet * segs[hit] - bet)}</span> : <span className="text-smoke">Empty slice — spin again!</span>}
            </div>
          )}
        </div>
      </div>
    </GameShell>
  );
}
