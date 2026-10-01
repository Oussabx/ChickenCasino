import { useEffect, useMemo, useRef, useState } from 'react';
import { Hand, Plus } from 'lucide-react';
import GameShell, { GameAction } from '../components/GameShell';
import { ChipPicker, ChipRow } from '../components/ChipBets';
import { Seg, confirmBet } from '../components/BetControls';
import { toast, useStore } from '../store';
import { sfx } from '../lib/sound';
import { fmt } from '../lib/format';
import { randInt } from '../lib/rng';
import {
  BetKey, CrapsState, PointNum, canPlace, canRemove, maxFor, maxLayOdds, maxTakeOdds, newState, onTable, resolveRoll, settleTotals,
} from '../lib/craps';
import { CrapsScene } from './three/craps3d';

/** Chip positions on the layout for the current state (come points sit inside the number boxes). */
function display(st: CrapsState) {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(st.bets)) if (v) out[k] = v;
  for (const c of st.come) { out[`come:${c.n}`] = c.base; if (c.odds) out[`comeOdds:${c.n}`] = c.odds; }
  for (const c of st.dontCome) { out[`dc:${c.n}`] = c.base; if (c.odds) out[`dcOdds:${c.n}`] = c.odds; }
  return out;
}

interface Roll { d1: number; d2: number; id: number }

// chips stay on the layout between visits (like walking away from a real table and coming back)
const SAVE = 'chicken-casino-craps';
const load = (): CrapsState | null => { try { const v = JSON.parse(localStorage.getItem(SAVE) ?? 'null'); return v && typeof v === 'object' && 'bets' in v ? v : null; } catch { return null; } };
const save = (s: CrapsState) => { try { localStorage.setItem(SAVE, JSON.stringify(s)); } catch { /* storage unavailable */ } };

export default function Craps() {
  const [chip, setChip] = useState(5);
  const [st, setSt] = useState<CrapsState>(() => load() ?? newState());
  const [mode, setMode] = useState<'bet' | 'remove'>('bet');
  const [rolling, setRolling] = useState(false);
  const [undo, setUndo] = useState<{ key: string; amt: number }[]>([]);
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [callout, setCallout] = useState<{ text: string; net: number; id: number } | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CrapsScene | null>(null);
  const stRef = useRef(st); stRef.current = st;
  const rollingRef = useRef(false); rollingRef.current = rolling;
  const tapRef = useRef<(k: string) => void>(() => {});
  const seq = useRef(0);
  const total = onTable(st);

  useEffect(() => {
    const sc = new CrapsScene(hostRef.current!);
    sceneRef.current = sc;
    sc.onSpot((k) => tapRef.current(k), () => !rollingRef.current);
    sc.setBets(display(stRef.current));
    if (stRef.current.point) sc.setPoint(stRef.current.point);
    return () => { sc.dispose(); sceneRef.current = null; };
  }, []);
  useEffect(() => save(st), [st]);
  // the stick call fades after a moment so the number boxes stay visible
  useEffect(() => { if (!callout) return; const t = setTimeout(() => setCallout(null), 2200); return () => clearTimeout(t); }, [callout]);

  const commit = (next: CrapsState, moves?: Record<string, string>) => { setSt(next); sceneRef.current?.setBets(display(next), moves); };

  /** Put `amt` more on a bet key (deducted from the balance now). */
  const add = (key: BetKey, amt: number) => {
    const s = stRef.current;
    const err = canPlace(s, key);
    if (err) { toast({ title: err, tone: 'neutral' }); return; }
    const room = maxFor(s, key) - (s.bets[key] ?? 0);
    const a = Math.min(amt, Math.floor(room * 100) / 100);
    if (a <= 0) { toast({ title: 'That’s the maximum odds', desc: key === 'passOdds' ? '3-4-5× odds: 3× on 4/10, 4× on 5/9, 5× on 6/8.' : 'Lay odds can win up to 6× your Don’t Pass bet.', tone: 'neutral' }); return; }
    if (!useStore.getState().placeBet(a)) return;
    sfx.bet();
    commit({ ...s, bets: { ...s.bets, [key]: +((s.bets[key] ?? 0) + a).toFixed(2) } });
    setUndo((u) => [...u, { key, amt: a }]);
  };

  /** Odds on a come point (take) or a don't come point (lay). */
  const addTravelOdds = (kind: 'come' | 'dc', n: PointNum) => {
    const s = stRef.current;
    const list = kind === 'come' ? s.come : s.dontCome;
    const t = list.find((c) => c.n === n); if (!t) return;
    const max = kind === 'come' ? maxTakeOdds(n, t.base) : maxLayOdds(n, t.base);
    const a = Math.min(chip, Math.floor((max - t.odds) * 100) / 100);
    if (a <= 0) { toast({ title: 'That’s the maximum odds', tone: 'neutral' }); return; }
    if (!useStore.getState().placeBet(a)) return;
    sfx.bet();
    const upd = list.map((c) => (c.n === n ? { ...c, odds: +(c.odds + a).toFixed(2) } : c));
    commit(kind === 'come' ? { ...s, come: upd } : { ...s, dontCome: upd });
    setUndo((u) => [...u, { key: `${kind}Odds:${n}`, amt: a }]);
  };

  const remove = (key: BetKey) => {
    const s = stRef.current;
    const v = s.bets[key] ?? 0;
    if (!v) return;
    if (!canRemove(s, key)) { toast({ title: 'The Pass Line is a contract bet', desc: 'Once a point is set it stays up until the point or a seven rolls.', tone: 'neutral' }); return; }
    const bets = { ...s.bets }; delete bets[key];
    let back = v;
    if (key === 'dp' && bets.dpOdds) { back += bets.dpOdds; delete bets.dpOdds; }
    if (key === 'pass' && bets.passOdds) { back += bets.passOdds; delete bets.passOdds; }
    useStore.getState().refund(back);
    sfx.click();
    commit({ ...s, bets });
    setUndo((u) => u.filter((x) => x.key !== key));
  };

  tapRef.current = (k: string) => { if (mode === 'remove') remove(k as BetKey); else add(k as BetKey, chip); };

  const undoLast = () => {
    const last = undo[undo.length - 1]; if (!last || rolling) return;
    const s = stRef.current;
    const m = last.key.match(/^(come|dc)Odds:(\d+)$/);
    if (m) {
      const n = +m[2];
      const fix = (l: typeof s.come) => l.map((c) => (c.n === n ? { ...c, odds: +Math.max(0, c.odds - last.amt).toFixed(2) } : c));
      commit(m[1] === 'come' ? { ...s, come: fix(s.come) } : { ...s, dontCome: fix(s.dontCome) });
    } else {
      const k = last.key as BetKey;
      const v = +Math.max(0, (s.bets[k] ?? 0) - last.amt).toFixed(2);
      const bets = { ...s.bets }; if (v) bets[k] = v; else delete bets[k];
      commit({ ...s, bets });
    }
    useStore.getState().refund(last.amt);
    setUndo((u) => u.slice(0, -1));
  };

  const clearAll = () => {
    if (rolling) return;
    const s = stRef.current;
    let back = 0; const bets = { ...s.bets };
    for (const [k, v] of Object.entries(bets) as [BetKey, number][]) if (canRemove(s, k) && v) { back += v; delete bets[k]; }
    if (!bets.pass && bets.passOdds) { back += bets.passOdds; delete bets.passOdds; }
    if (back) { useStore.getState().refund(back); sfx.click(); }
    commit({ ...s, bets }); setUndo([]);
  };

  const roll = async () => {
    const sc = sceneRef.current;
    if (!sc || rolling) return;
    const s = stRef.current;
    if (onTable(s) <= 0) { toast({ title: s.point ? 'Place a bet first' : 'Put a bet on the Pass Line (or Don’t Pass) to start', tone: 'neutral' }); return; }
    const fresh = undo.reduce((a, b) => a + b.amt, 0);
    if (fresh > 0 && !confirmBet(fresh)) return;
    setRolling(true); setCallout(null);
    const d1 = randInt(1, 6), d2 = randInt(1, 6);
    const t = useStore.getState().settings.turbo;
    sfx.cluck();
    await sc.throwDice(d1, d2, t ? 900 : 1700, () => sfx.tick(2));
    const { state: next, resolved, event } = resolveRoll(s, d1, d2);
    const tot = settleTotals(resolved);
    const wins = resolved.filter((r) => r.outcome === 'win');
    const losses = resolved.filter((r) => r.outcome === 'lose');
    // money: decided bets settle as one round; winners that stay up are re-committed; pushes return
    if (tot.stake > 0) {
      useStore.getState().settle('craps', tot.stake, tot.returned / tot.stake, `${d1}+${d2} = ${d1 + d2} · ${event}`);
      if (tot.stayed) useStore.getState().refund(-tot.stayed);
    }
    if (tot.refunded) useStore.getState().refund(tot.refunded);
    const net = wins.reduce((a, r) => a + r.win, 0) - losses.reduce((a, r) => a + r.stake, 0);
    // chips: come bets travel to their numbers
    const moves: Record<string, string> = {};
    const newCome = next.come.find((c) => !s.come.some((o) => o.n === c.n)); if (newCome && s.bets.come) moves[`come:${newCome.n}`] = 'come';
    const newDc = next.dontCome.find((c) => !s.dontCome.some((o) => o.n === c.n)); if (newDc && s.bets.dc) moves[`dc:${newDc.n}`] = 'dc';
    const spotOf = (k: string) => (k.match(/^come(\d+)/) ? `place${k.match(/^come(\d+)/)![1]}` : k.match(/^dc(\d+)/) ? `place${k.match(/^dc(\d+)/)![1]}` : k);
    sc.flash([...new Set(wins.map((r) => spotOf(r.key)))], [...new Set(losses.map((r) => spotOf(r.key)))]);
    wins.forEach((r, i) => setTimeout(() => sc.payout(r.key.replace(/^(come|dc)(\d+)odds$/, '$1Odds:$2').replace(/^(come|dc)(\d+)$/, '$1:$2'), r.win + (r.stays ? 0 : r.stake)), 120 * i));
    commit(next, moves);
    if (next.point !== s.point) sc.setPoint(next.point);
    if (wins.length && (net > 0 || (s.point && d1 + d2 === s.point))) sc.cheer();
    net > 0 ? sfx.win() : net < 0 ? sfx.lose() : sfx.reveal();
    setRolls((h) => [{ d1, d2, id: ++seq.current }, ...h].slice(0, 12));
    setCallout({ text: event, net, id: seq.current });
    setUndo([]);
    setRolling(false);
  };

  // space bar rolls
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === 'Space' && !(e.target as HTMLElement)?.closest('input,textarea,select,button')) { e.preventDefault(); roll(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const comeOdds = useMemo(() => [
    ...st.come.map((c) => ({ kind: 'come' as const, n: c.n, have: c.odds, max: maxTakeOdds(c.n, c.base) })),
    ...st.dontCome.map((c) => ({ kind: 'dc' as const, n: c.n, have: c.odds, max: maxLayOdds(c.n, c.base) })),
  ], [st]);

  const quick: [BetKey, string][] = st.point
    ? [['passOdds', 'Pass odds'], ['come', 'Come'], ['field', 'Field'], [`place${st.point === 6 ? 8 : 6}` as BetKey, `Place ${st.point === 6 ? 8 : 6}`]]
    : [['pass', 'Pass Line'], ['dp', 'Don’t Pass'], ['field', 'Field'], ['any7', 'Any 7']];

  const controls = (
    <>
      <div className="hidden lg:block"><ChipPicker chip={chip} setChip={setChip} total={total} onClear={clearAll} onUndo={undoLast} disabled={rolling} /></div>
      <div className={rolling ? 'pointer-events-none opacity-50' : ''}>
        <div className="flex items-center justify-between">
          <span className="label">Tap the table to</span>
          <Seg options={['bet', 'remove'] as const} value={mode} onChange={setMode} render={(v) => (v === 'bet' ? 'Bet' : 'Take down')} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {quick.map(([k, l]) => (
            <button key={k} type="button" onClick={() => add(k, chip)}
              className="relative rounded-lg border border-gold/25 bg-[#0b4a2e]/60 px-2 py-2 font-display text-xs font-black text-gold transition active:scale-95">
              {l}
              {st.bets[k] ? <span className="absolute -right-1.5 -top-1.5 rounded-full bg-gold px-1.5 text-[9px] leading-4 text-ink tabular">{fmt(st.bets[k]!, 0)}</span> : null}
            </button>
          ))}
        </div>
        {comeOdds.length > 0 && (
          <div className="mt-2 space-y-1">
            {comeOdds.map((c) => (
              <button key={`${c.kind}${c.n}`} type="button" onClick={() => addTravelOdds(c.kind, c.n)} disabled={c.have >= c.max}
                className="flex w-full items-center justify-between rounded-lg bg-ink-900 px-2.5 py-1.5 text-xs disabled:opacity-50">
                <span className="flex items-center gap-1"><Plus size={12} className="text-gold" />{c.kind === 'come' ? 'Odds on Come' : 'Lay on Don’t Come'} <b>{c.n}</b></span>
                <span className="tabular text-smoke">{fmt(c.have, 0)} / {fmt(c.max, 0)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <GameAction extra={<ChipRow chip={chip} setChip={setChip} onUndo={undoLast} onClear={clearAll} disabled={rolling} />}>
        <button className="btn-gold w-full py-4 text-base" disabled={rolling} onClick={roll}>
          {rolling ? 'Dice are rolling…' : st.point ? `Roll · point is ${st.point}` : 'Come-out roll'}
        </button>
      </GameAction>
      <div className="phone-hide rounded-xl bg-ink-900 p-3 text-xs text-smoke space-y-1">
        <div className="flex justify-between"><span>Pass / Don’t Pass / Come</span><b className="text-cream">1 : 1</b></div>
        <div className="flex justify-between"><span>Odds 4·10 / 5·9 / 6·8</span><b className="text-gold">2:1 · 3:2 · 6:5</b></div>
        <div className="flex justify-between"><span>Place 4·10 / 5·9 / 6·8</span><b className="text-cream">9:5 · 7:5 · 7:6</b></div>
        <div className="flex justify-between"><span>Field (2 ×2, 12 ×3)</span><b className="text-cream">1 : 1</b></div>
        <div className="flex justify-between"><span>Hard 6·8 / 4·10</span><b className="text-cream">9:1 · 7:1</b></div>
      </div>
    </>
  );

  const pointLabel = st.point ? `POINT ${st.point}` : 'COME-OUT';

  return (
    <GameShell id="craps" tall controls={controls} rules={[
      'Come-out roll: put chips on the Pass Line. A 7 or 11 wins even money; 2, 3 or 12 (craps) loses. Any other number becomes the point and the puck flips to ON.',
      'With a point on, keep rolling: the point again before a 7 wins the Pass Line; a 7 first is a “seven-out” and the line loses.',
      'Don’t Pass is the opposite: it wins on 2 or 3 and on a seven-out, loses on 7/11 and when the point is made. 12 is a push (“bar 12”).',
      'Free odds: once a point is set, add Pass Odds behind your line bet (up to 3× on 4/10, 4× on 5/9, 5× on 6/8). They pay true odds — 2:1, 3:2 and 6:5 — with no house edge. Don’t Pass players can lay odds.',
      'Come / Don’t Come work like the line bets but are made while a point is on; the chips travel to the number that rolls next. Add odds to them from the panel.',
      'Place bets win when their number rolls before a 7: 4 and 10 pay 9:5, 5 and 9 pay 7:5, 6 and 8 pay 7:6. Place bets and hardways are off on the come-out roll.',
      'Field is a one-roll bet on 2, 3, 4, 9, 10, 11 or 12 (2 pays double, 12 triple). Center props: Any 7 4:1, Any Craps 7:1, 2 or 12 30:1, 3 or 11 15:1. Hardways win when the number rolls as a pair before a 7 or the “easy” way.',
      'Winning place, field, prop and line bets stay up for the next roll — switch to “Take down” and tap a bet to pick it up (the Pass Line is locked while a point is on).',
    ]}>
      <div ref={hostRef} className="absolute inset-0" aria-label="Craps table" />
      <div className="table-vignette pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[62%] flex-wrap items-center gap-1">
        {rolls.map((r, i) => (
          <span key={r.id} className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-display text-[11px] font-black shadow ${i === 0 ? 'animate-pop bg-gold text-ink' : r.d1 + r.d2 === 7 ? 'bg-blood/80 text-white opacity-80' : 'bg-black/60 text-cream opacity-80'}`}>
            {r.d1 + r.d2}<span className="text-[9px] opacity-70">{r.d1}·{r.d2}</span>
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute right-3 top-3 z-10">
        <span className={`flex items-center gap-2 rounded-full border px-3 py-1.5 font-display text-xs font-black tracking-wider backdrop-blur ${st.point ? 'border-gold/60 bg-black/70 text-gold' : 'border-white/15 bg-black/60 text-cream'}`}>
          <span className={`h-2 w-2 rounded-full ${st.point ? 'bg-gold' : 'bg-smoke'}`} />{pointLabel}
        </span>
      </div>
      {callout && (
        <div key={callout.id} className="pointer-events-none absolute left-1/2 top-[44%] z-20 -translate-x-1/2 -translate-y-1/2">
          <div className="result-in rounded-2xl border-2 border-gold/60 bg-black/75 px-5 py-2 text-center shadow-2xl backdrop-blur-md">
            <div className="h-display whitespace-nowrap text-xl text-gold-grad sm:text-3xl">{callout.text}</div>
            {callout.net < 0 && <div className="font-display text-sm font-black tabular text-blood">−{fmt(Math.abs(callout.net))}</div>}
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center">
        <span className="flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-cream backdrop-blur-md">
          {mode === 'remove' ? <><Hand size={12} className="text-gold" />Tap a bet to take it down</> : total > 0 ? <>On the table <b className="font-display text-gold tabular">{fmt(total, 0)}</b></> : 'Tap the layout to place chips'}
        </span>
      </div>
    </GameShell>
  );
}

