import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import GameShell, { GameAction } from '../components/GameShell';
import BetControls, { MiniBet, Seg, confirmBet } from '../components/BetControls';
import Modal from '../components/Modal';
import { useCountUp } from '../components/TableUI';
import { useStore } from '../store';
import { sfx } from '../lib/sound';
import { fmt } from '../lib/format';
import { FREE_SPINS, FREE_SPIN_MULT, LINES, LINE_COLORS, LINE_PAYS, PAYLINES, SCATTER_PAYS, SYMBOL_NAME, SpinResult, Sym, spin as rollSpin } from '../lib/slots';
import { SlotsScene } from './three/slots3d';
import { loadSlotArt, symbolUrl } from './three/slotArt';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const AUTO = [0, 10, 25, 50, 100] as const;

interface Shown { amount: number; label: string; tone: 'win' | 'idle' | 'free' }

export default function Slots() {
  const [bet, setBet] = useState(() => Math.max(LINES / 10, useStore.getState().settings.defaultBet));
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState<(typeof AUTO)[number]>(0);
  const [autoLeft, setAutoLeft] = useState(0);
  const [free, setFree] = useState<{ left: number; total: number; won: number } | null>(null);
  const [shown, setShown] = useState<Shown>({ amount: 0, label: '20 lines · good luck!', tone: 'idle' });
  const [big, setBig] = useState<{ level: 1 | 2 | 3; amount: number } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [last, setLast] = useState<SpinResult | null>(null);
  const turbo = useStore((s) => s.settings.turbo);
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SlotsScene | null>(null);
  const [scene, setScene] = useState<SlotsScene | null>(null);
  const busyRef = useRef(false);
  const autoRef = useRef(0);
  autoRef.current = autoLeft;

  useEffect(() => {
    const sc = new SlotsScene(hostRef.current!);
    sceneRef.current = sc; setScene(sc);
    return () => { sc.dispose(); sceneRef.current = null; setScene(null); };
  }, []);

  /** Spin the reels for one result, with scatter anticipation on later reels. */
  const runReels = async (res: SpinResult) => {
    const sc = sceneRef.current!;
    const coopsBefore = (r: number) => res.grid.slice(0, r).flat().filter((s) => s === 'coop').length;
    const tease = res.grid.map((_, r) => r >= 2 && coopsBefore(r) >= 2);
    const t = useStore.getState().settings.turbo;
    await sc.spin(res.stops, {
      turbo: t, tease,
      onStop: (r) => {
        sfx.tick(r * 2);
        if (res.grid[r].includes('coop')) sfx.reveal();
        sc.setTease(r, false);
        if (tease[r + 1]) { sc.setTease(r + 1, true); }
      },
    });
  };

  /** Show the wins of one spin; returns the coins won (× multiplier). */
  const present = (res: SpinResult, lineBet: number, mult: number) => {
    const sc = sceneRef.current!;
    const lineWin = res.lines.reduce((a, l) => a + l.pay, 0) * lineBet * mult;
    const scatWin = res.scatterPay * lineBet * LINES * mult;
    const win = lineWin + scatWin;
    if (win > 0 || res.freeSpins) sc.showWins(res.lines.map((l) => l.line), res.lines.flatMap((l) => l.cells), res.scatters.length >= 3 ? res.scatters : []);
    return win;
  };

  const celebrateWin = (win: number, totalBet: number) => {
    const x = win / totalBet;
    const level = x >= 100 ? 3 : x >= 40 ? 2 : x >= 15 ? 1 : 0;
    if (level) { sceneRef.current?.celebrate(level as 1 | 2 | 3); setBig({ level: level as 1 | 2 | 3, amount: win }); sfx.bigWin(); }
    else if (win > 0) sfx.win();
  };

  const play = useCallback(async () => {
    if (busyRef.current || !sceneRef.current) return false;
    if (!(autoRef.current > 0) && !confirmBet(bet)) return false;
    if (bet < LINES * 0.01) return false;
    if (!useStore.getState().placeBet(bet)) return false;
    busyRef.current = true; setBusy(true); setBig(null); setLast(null);
    sfx.bet();
    const lineBet = bet / LINES;
    setShown({ amount: 0, label: 'Spinning…', tone: 'idle' });
    const res = rollSpin();
    await runReels(res);
    let total = present(res, lineBet, 1);
    if (total > 0) setShown({ amount: total, label: describe(res), tone: 'win' });
    else setShown({ amount: 0, label: res.freeSpins ? '' : 'No win — spin again', tone: 'idle' });
    let detail = res.lines.length ? `${res.lines.length} line${res.lines.length > 1 ? 's' : ''}` : 'No win';

    // ---- free spins feature ----
    if (res.freeSpins) {
      const t = useStore.getState().settings.turbo;
      sfx.bigWin();
      setBanner(`${res.freeSpins} FREE SPINS`);
      await wait(t ? 900 : 2000);
      setBanner(null);
      sceneRef.current?.setFreeMode(true);
      let left = res.freeSpins, played = 0, featureWin = 0;
      setFree({ left, total: res.freeSpins, won: 0 });
      while (left > 0 && sceneRef.current) {
        left--; played++;
        setFree({ left, total: played + left, won: featureWin });
        const fr = rollSpin();
        await runReels(fr);
        const w = present(fr, lineBet, FREE_SPIN_MULT);
        featureWin += w;
        if (w > 0) { sfx.win(); setShown({ amount: w, label: `${describe(fr)} · ×${FREE_SPIN_MULT}`, tone: 'free' }); }
        if (fr.freeSpins) {
          left += fr.freeSpins;
          setBanner(`+${fr.freeSpins} FREE SPINS`); sfx.bigWin();
          await wait(t ? 700 : 1500); setBanner(null);
        }
        setFree({ left, total: played + left, won: featureWin });
        await wait(w > 0 ? (t ? 500 : 1100) : (t ? 150 : 350));
      }
      sceneRef.current?.setFreeMode(false);
      sceneRef.current?.clearWins();
      total += featureWin;
      detail += ` · ${played} free spins won ${fmt(featureWin)}`;
      setFree(null);
      setShown({ amount: total, label: `Feature total · ${played} free spins`, tone: 'win' });
    }

    useStore.getState().settle('slots', bet, total / bet, detail);
    celebrateWin(total, bet);
    setLast(res.freeSpins ? null : res);
    busyRef.current = false; setBusy(false);
    return true;
  }, [bet]);

  // autoplay
  useEffect(() => {
    if (autoLeft <= 0 || busy) return;
    const t = setTimeout(async () => { const ok = await play(); setAutoLeft((n) => (ok ? n - 1 : 0)); }, last && last.mult > 0 ? (turbo ? 500 : 1100) : (turbo ? 120 : 300));
    return () => clearTimeout(t);
  }, [autoLeft, busy, play, last, turbo]);

  // after a spin, cycle through each winning line on the meter
  useEffect(() => {
    if (!last || busy || autoLeft > 0 || last.lines.length < 2) return;
    let i = 0;
    const lineBet = bet / LINES;
    const iv = setInterval(() => {
      const l = last.lines[i % last.lines.length]; i++;
      sceneRef.current?.showWins([l.line], l.cells);
      setShown((s) => ({ ...s, label: `Line ${l.line + 1} · ${l.count}× ${SYMBOL_NAME[l.sym].replace(/ \(.*\)/, '')} pays ${fmt(l.pay * lineBet)}` }));
    }, 1500);
    return () => clearInterval(iv);
  }, [last, busy, autoLeft, bet]);

  // space bar spins on desktop
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || (e.target as HTMLElement)?.closest('input,textarea,select,button')) return;
      e.preventDefault(); play();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [play]);

  const running = busy || autoLeft > 0;
  const controls = (
    <>
      <BetControls value={bet} onChange={setBet} disabled={running} label="Total bet" />
      <div className="phone-hide flex items-center justify-between rounded-xl bg-ink-900 px-3 py-2 text-xs">
        <span className="text-smoke">20 lines × <b className="font-display text-cream tabular">{fmt(bet / LINES)}</b> per line</span>
        <button type="button" onClick={() => setPayOpen(true)} className="flex items-center gap-1 font-bold text-gold hover:underline"><BookOpen size={13} />Paytable</button>
      </div>
      <div>
        <div className="label mb-1.5">Autoplay</div>
        <Seg options={AUTO} value={auto} onChange={setAuto} disabled={running} render={(v) => (v ? String(v) : 'Off')} />
      </div>
      <GameAction extra={<MiniBet value={bet} onChange={setBet} disabled={running} />}>
        {autoLeft > 0 ? (
          <button className="btn-red w-full py-4 text-base" onClick={() => setAutoLeft(0)}>Stop autoplay ({autoLeft})</button>
        ) : (
          <button className="btn-gold w-full py-4 text-base" disabled={busy}
            onClick={() => { if (auto) { if (confirmBet(bet)) setAutoLeft(auto); } else play(); }}>
            {busy ? (free ? `Free spins · ${free.left} left` : 'Spinning…') : auto ? `Autoplay ${auto} spins` : 'Spin'}
          </button>
        )}
      </GameAction>
      <button type="button" onClick={() => setPayOpen(true)} className="btn-dark hidden w-full py-2 text-xs [.phone-controls_&]:flex"><BookOpen size={13} />Paytable</button>
      <div className="phone-hide rounded-xl bg-ink-900 p-3 text-xs text-smoke space-y-1">
        <div className="flex justify-between"><span>Top line win</span><b className="text-gold">5 Wild Roosters · 3,000×</b></div>
        <div className="flex justify-between"><span>3+ Coops anywhere</span><b className="text-cream">10–20 free spins · wins ×3</b></div>
        <div className="flex justify-between"><span>Return to player</span><b className="text-cream">95.2%</b></div>
      </div>
    </>
  );

  return (
    <GameShell id="slots" controls={controls} rules={[
      'Set your total bet — it is split evenly across 20 fixed paylines.',
      'Press Spin (or the space bar). Each reel stops at random; a payline pays for 3, 4 or 5 matching symbols in a row from the leftmost reel.',
      'Only the highest win on each line is paid, and wins on different lines add up.',
      'The Golden Rooster is WILD: it stands in for any symbol except the Coop, and five of them pay 3,000× the line bet.',
      'The Coop is a scatter — it pays anywhere on the reels: 3 pays 3× your total bet, 4 pays 15×, 5 pays 100×.',
      '3, 4 or 5 Coops also award 10, 15 or 20 free spins at the same bet. Every free-spin win is tripled, and more Coops add more free spins.',
      'Theoretical return to player is 95.2%, calculated exactly from the reel strips.',
    ]}>
      <div ref={hostRef} className="absolute inset-0" aria-label="Slot machine" />
      <Meter scene={scene} shown={shown} />
      {free && (
        <div className="pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full border border-blood/60 bg-black/75 px-3 py-1.5 font-display text-xs font-black tracking-wider text-cream backdrop-blur sm:text-sm">
            <span className="text-blood">FREE SPINS</span><span className="tabular">{free.total - free.left}/{free.total}</span><span className="text-smoke">·</span><span className="text-gold tabular">+{fmt(free.won)}</span><span className="rounded bg-blood px-1.5 text-[10px] text-white">×3</span>
          </div>
        </div>
      )}
      {banner && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <div className="result-in rounded-3xl border-2 border-gold bg-gradient-to-b from-blood-700/95 to-black/90 px-8 py-4 text-center shadow-[0_0_60px_rgba(244,196,48,.45)]">
            <div className="h-display text-3xl text-gold-grad sm:text-5xl">{banner}</div>
            <div className="mt-1 text-sm font-bold text-cream/80">All wins tripled</div>
          </div>
        </div>
      )}
      {big && !busy && <BigWin key={big.amount} level={big.level} amount={big.amount} onDone={() => setBig(null)} />}
      <Paytable open={payOpen} onClose={() => setPayOpen(false)} lineBet={bet / LINES} />
    </GameShell>
  );
}

function describe(res: SpinResult) {
  const parts: string[] = [];
  if (res.lines.length) parts.push(`${res.lines.length} line${res.lines.length > 1 ? 's' : ''}`);
  if (res.scatters.length >= 3) parts.push(`${res.scatters.length} coops`);
  return parts.join(' + ') || 'Win';
}

/** Win meter pinned on the cabinet's display panel. */
function Meter({ scene, shown }: { scene: SlotsScene | null; shown: Shown }) {
  const ref = useRef<HTMLDivElement>(null);
  const amt = useCountUp(shown.amount, 700);
  useEffect(() => {
    const el = ref.current; if (!scene || !el) return;
    scene.anchor(el, [0, -3.05, 0.75]);
    return () => scene.anchor(el, null);
  }, [scene]);
  return (
    <div ref={ref} className="pointer-events-none absolute left-0 top-0 z-10 text-center will-change-transform">
      <div className={`font-display font-black tabular leading-none text-[clamp(16px,3.2vw,30px)] ${shown.tone === 'idle' ? 'text-cream/40' : shown.tone === 'free' ? 'text-blood' : 'text-gold drop-shadow-[0_0_10px_rgba(244,196,48,.7)]'}`}>
        {shown.amount > 0 ? `WIN ${fmt(amt)}` : shown.tone === 'idle' && !shown.label ? '' : 'WIN 0.00'}
      </div>
      <div className="mt-0.5 max-w-[60vw] truncate text-[clamp(9px,1.4vw,12px)] font-semibold text-cream/70">{shown.label}</div>
    </div>
  );
}

function BigWin({ level, amount, onDone }: { level: 1 | 2 | 3; amount: number; onDone: () => void }) {
  const shown = useCountUp(amount, 1800);
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-black/35">
      <div className="result-in relative overflow-hidden rounded-3xl border-2 border-gold bg-gradient-to-b from-black/85 to-[#2a1d02]/90 px-8 py-4 text-center shadow-[0_0_80px_rgba(244,196,48,.55)]">
        <span className="shine-sweep" />
        <div className="h-display text-3xl text-gold-grad sm:text-6xl">{['', 'BIG WIN', 'MEGA WIN', 'EPIC CLUCK'][level]}</div>
        <div className="mt-1 font-display text-2xl font-black text-cream tabular sm:text-3xl">{fmt(shown)}</div>
      </div>
    </div>
  );
}

const PAY_ORDER: Sym[] = ['wild', 'golden', 'seven', 'bell', 'chick', 'horseshoe', 'egg', 'feather', 'corn'];

function Paytable({ open, onClose, lineBet }: { open: boolean; onClose: () => void; lineBet: number }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open || Object.keys(urls).length) return;
    loadSlotArt().then(() => document.fonts?.ready).then(() => setUrls(Object.fromEntries([...PAY_ORDER, 'coop'].map((s) => [s, symbolUrl(s as Sym)]))));
  }, [open, urls]);
  const lines = useMemo(() => PAYLINES, []);
  return (
    <Modal open={open} onClose={onClose} title="Paytable" wide>
      <p className="text-xs text-smoke">Line wins pay left to right on the 20 paylines, shown in coins for your current line bet of <b className="text-cream">{fmt(lineBet)}</b>.</p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {PAY_ORDER.map((s) => (
          <div key={s} className="flex items-center gap-3 rounded-xl bg-ink-900 p-2">
            {urls[s] ? <img src={urls[s]} alt="" className="h-14 w-14 shrink-0" /> : <span className="h-14 w-14 shrink-0" />}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{SYMBOL_NAME[s]}</div>
              <div className="mt-0.5 grid grid-cols-3 gap-1 text-[11px] tabular">
                {LINE_PAYS[s]!.map((p, i) => <span key={i} className="rounded bg-white/5 px-1 py-0.5 text-center"><b className="text-smoke">{i + 3}×</b> <span className="text-gold">{fmt(p * lineBet, Number.isInteger(p * lineBet) ? 0 : 2)}</span></span>)}
              </div>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3 rounded-xl border border-blood/40 bg-blood/10 p-2 sm:col-span-2">
          {urls.coop ? <img src={urls.coop} alt="" className="h-14 w-14 shrink-0" /> : <span className="h-14 w-14 shrink-0" />}
          <div className="text-xs">
            <div className="text-sm font-bold">Coop · scatter</div>
            Anywhere on the reels: 3 = {SCATTER_PAYS[3]}× · 4 = {SCATTER_PAYS[4]}× · 5 = {SCATTER_PAYS[5]}× total bet, plus {FREE_SPINS[3]} / {FREE_SPINS[4]} / {FREE_SPINS[5]} free spins with every win ×{FREE_SPIN_MULT}.
          </div>
        </div>
      </div>
      <div className="mt-4 label">The 20 paylines</div>
      <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-5">
        {lines.map((rows, i) => (
          <div key={i} className="rounded-lg bg-ink-900 p-1.5">
            <div className="mb-1 text-[10px] font-bold" style={{ color: LINE_COLORS[i] }}>Line {i + 1}</div>
            <div className="grid grid-cols-5 gap-[2px]">
              {[0, 1, 2].map((row) => rows.map((r, c) => <span key={`${row}${c}`} className="h-2 rounded-[2px]" style={{ background: r === row ? LINE_COLORS[i] : 'rgba(255,255,255,.08)' }} />))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-smoke">The Golden Rooster wild replaces every symbol except the Coop. Only the highest win per line is paid.</p>
    </Modal>
  );
}
