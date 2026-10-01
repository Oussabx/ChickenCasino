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
import SlotMachine, { MachineHandle } from './SlotMachine';
import { loadSlotArt, symbolUrl } from './three/slotArt';
import { usePhoneLayout } from '../lib/phone';

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
  const [banner, setBanner] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [last, setLast] = useState<SpinResult | null>(null);
  const [lit, setLit] = useState<{ syms: Sym[]; coop: boolean }>({ syms: [], coop: false });
  const [sideLegend, setSideLegend] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const phone = usePhoneLayout().phone;
  const urls = useSymbolUrls();
  const [sess, setSess] = useState<Session>(loadSession);
  useEffect(() => saveSession(sess), [sess]);
  const turbo = useStore((s) => s.settings.turbo);
  const machine = useRef<MachineHandle>(null);
  const busyRef = useRef(false);
  const autoRef = useRef(0);
  autoRef.current = autoLeft;

  useEffect(() => {
    // wide game areas get the legend beside the machine; otherwise it sits in the controls
    const box = boxRef.current!;
    const ro = new ResizeObserver(() => setSideLegend(box.clientWidth >= 720));
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  /** Spin the reels for one result, with scatter anticipation on later reels. */
  const runReels = async (res: SpinResult) => {
    const m = machine.current!;
    const coopsBefore = (r: number) => res.grid.slice(0, r).flat().filter((s) => s === 'coop').length;
    const tease = res.grid.map((_, r) => r >= 2 && coopsBefore(r) >= 2);
    const t = useStore.getState().settings.turbo;
    await m.spin(res.stops, {
      turbo: t, tease,
      onStop: (r) => { sfx.tick(r * 2); if (res.grid[r].includes('coop')) sfx.reveal(); },
    });
  };

  /** Show the wins of one spin; returns the coins won (× multiplier). */
  const present = (res: SpinResult, lineBet: number, mult: number) => {
    const m = machine.current!;
    const lineWin = res.lines.reduce((a, l) => a + l.pay, 0) * lineBet * mult;
    const scatWin = res.scatterPay * lineBet * LINES * mult;
    const win = lineWin + scatWin;
    setLit({ syms: [...new Set(res.lines.map((l) => l.sym))], coop: res.scatters.length >= 3 });
    if (win > 0 || res.freeSpins) m.showWins(res.lines.map((l) => l.line), res.lines.flatMap((l) => l.cells), res.scatters.length >= 3 ? res.scatters : []);
    return win;
  };

  // the win show itself is the shared WinFX; small wins just get the chime here
  const celebrateWin = (win: number, totalBet: number) => { if (win > 0 && win / totalBet < 15) sfx.win(); };

  const play = useCallback(async () => {
    if (busyRef.current || !machine.current) return false;
    if (!(autoRef.current > 0) && !confirmBet(bet)) return false;
    if (bet < LINES * 0.01) return false;
    if (!useStore.getState().placeBet(bet)) return false;
    busyRef.current = true; setBusy(true); setLast(null); setLit({ syms: [], coop: false });
    sfx.bet();
    setSess((x) => ({ ...x, spins: x.spins + 1, spent: x.spent + bet }));
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
      let left = res.freeSpins, played = 0, featureWin = 0;
      setFree({ left, total: res.freeSpins, won: 0 });
      while (left > 0 && machine.current) {
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
      machine.current?.clear();
      total += featureWin;
      detail += ` · ${played} free spins won ${fmt(featureWin)}`;
      setFree(null);
      setShown({ amount: total, label: `Feature total · ${played} free spins`, tone: 'win' });
    }

    useStore.getState().settle('slots', bet, total / bet, detail);
    setSess((x) => ({ ...x, won: x.won + total, best: Math.max(x.best, total) }));
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
      machine.current?.showWins([l.line], l.cells);
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
        <button type="button" onClick={() => setPayOpen(true)} className="-my-2 flex items-center gap-1 py-2 font-bold text-gold hover:underline"><BookOpen size={13} />Paytable</button>
      </div>
      <div>
        <div className="label mb-1.5">Autoplay</div>
        <Seg options={AUTO} value={auto} onChange={setAuto} disabled={running} render={(v) => (v ? String(v) : 'Off')} />
      </div>
      {(!sideLegend || phone) && <SessionStats s={sess} onReset={() => setSess(EMPTY_SESSION)} compact />}
      {(!sideLegend || phone) && <Legend urls={urls} lineBet={bet / LINES} bet={bet} lit={lit} free={!!free} compact />}
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
      <div ref={boxRef} className="absolute inset-0 flex">
        <div className="relative min-w-0 flex-1">
          <SlotMachine ref={machine} free={!!free} jackpot={JACKPOT * (bet / LINES)}
            freeInfo={free && (
              <div className="flex items-center gap-2 whitespace-nowrap rounded-full border-2 border-blood bg-black/85 px-3 py-1 font-display text-xs font-black tracking-wider text-cream shadow-[0_0_20px_rgba(230,57,70,.6)] sm:text-sm">
                <span className="text-blood">FREE SPINS</span><span className="tabular">{free.total - free.left}/{free.total}</span><span className="text-gold tabular">+{fmt(free.won)}</span><span className="rounded bg-blood px-1.5 text-[10px] text-white">×3</span>
              </div>
            )}
            footer={<Meter shown={shown} />} />
        </div>
        {(!sideLegend || phone) && (
          <>
            <button type="button" onClick={() => setLegendOpen((o) => !o)} aria-expanded={legendOpen}
              className="absolute bottom-2 right-2 z-20 flex items-center gap-1 rounded-full border border-gold/60 bg-black/75 px-3 py-1.5 font-display text-[11px] font-black tracking-wider text-gold shadow-gold backdrop-blur">
              <BookOpen size={13} />{legendOpen ? 'Close' : 'Paytable'}
            </button>
            {legendOpen && (
              <div className="absolute inset-y-0 right-0 z-[15] w-[min(300px,62%)] overflow-y-auto overscroll-contain border-l border-gold/30 bg-ink/90 p-2.5 pb-12 backdrop-blur-md animate-slideUp">
                <Legend urls={urls} lineBet={bet / LINES} bet={bet} lit={lit} free={!!free} />
              </div>
            )}
          </>
        )}
        {sideLegend && !phone && (
          <div className="relative z-10 w-[clamp(220px,27%,280px)] shrink-0 overflow-y-auto border-l border-white/[0.06] bg-black/45 p-3 backdrop-blur-sm">
            <SessionStats s={sess} onReset={() => setSess(EMPTY_SESSION)} />
            <div className="h-2" />
            <Legend urls={urls} lineBet={bet / LINES} bet={bet} lit={lit} free={!!free} />
          </div>
        )}
      </div>
      {banner && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <div className="result-in rounded-3xl border-2 border-gold bg-gradient-to-b from-blood-700/95 to-black/90 px-8 py-4 text-center shadow-[0_0_60px_rgba(244,196,48,.45)]">
            <div className="h-display text-3xl text-gold-grad sm:text-5xl">{banner}</div>
            <div className="mt-1 text-sm font-bold text-cream/80">All wins tripled</div>
          </div>
        </div>
      )}
      <Paytable open={payOpen} onClose={() => setPayOpen(false)} lineBet={bet / LINES} urls={urls} />
    </GameShell>
  );
}

function describe(res: SpinResult) {
  const parts: string[] = [];
  if (res.lines.length) parts.push(`${res.lines.length} line${res.lines.length > 1 ? 's' : ''}`);
  if (res.scatters.length >= 3) parts.push(`${res.scatters.length} coops`);
  return parts.join(' + ') || 'Win';
}

/** Win meter under the reels. */
function Meter({ shown }: { shown: Shown }) {
  const amt = useCountUp(shown.amount, 700);
  const lit = shown.amount > 0;
  return (
    <div className={`min-w-[min(60vw,320px)] rounded-2xl border-2 bg-black/70 px-5 py-1.5 text-center backdrop-blur ${lit ? (shown.tone === 'free' ? 'border-blood shadow-[0_0_24px_rgba(230,57,70,.5)]' : 'border-gold shadow-[0_0_24px_rgba(244,196,48,.45)]') : 'border-white/10'}`}>
      <div className={`font-display font-black tabular leading-none text-[clamp(16px,2.6vw,28px)] ${lit ? (shown.tone === 'free' ? 'text-blood' : 'text-gold-grad') : 'text-cream/35'}`}>
        {lit ? `WIN ${fmt(amt)}` : 'WIN 0.00'}
      </div>
      <div className="mt-0.5 max-w-[70vw] truncate text-[clamp(10px,1.3vw,12px)] font-semibold text-cream/70">{shown.label || '\u00a0'}</div>
    </div>
  );
}

const PAY_ORDER: Sym[] = ['wild', 'golden', 'seven', 'bell', 'chick', 'horseshoe', 'egg', 'feather', 'corn'];

function Paytable({ open, onClose, lineBet, urls }: { open: boolean; onClose: () => void; lineBet: number; urls: Record<string, string> }) {
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

/** Five Golden Roosters on a line — the top prize, in line bets. */
const JACKPOT = LINE_PAYS.wild![2];

/** Symbol art as image URLs (drawn once, shared by the legend and the paytable). */
let urlCache: Record<string, string> | null = null;
function useSymbolUrls() {
  const [urls, setUrls] = useState<Record<string, string>>(urlCache ?? {});
  useEffect(() => {
    if (urlCache) return;
    let alive = true;
    loadSlotArt().then(() => document.fonts?.ready).then(() => {
      urlCache = Object.fromEntries([...PAY_ORDER, 'coop'].map((s) => [s, symbolUrl(s as Sym)]));
      if (alive) setUrls(urlCache);
    });
    return () => { alive = false; };
  }, []);
  return urls;
}

const money = (v: number) => (v >= 10000 ? `${fmt(v / 1000, v % 1000 ? 1 : 0)}k` : fmt(v, Number.isInteger(v) ? 0 : 2));

/**
 * Always-visible legend: the jackpot, how free spins are won, what the wild
 * does, and what each symbol pays at the current bet. Rows light up on a win.
 */
function Legend({ urls, lineBet, bet, lit, free, compact }: { urls: Record<string, string>; lineBet: number; bet: number; lit: { syms: Sym[]; coop: boolean }; free: boolean; compact?: boolean }) {
  const img = (s: string, size: string) => (urls[s] ? <img src={urls[s]} alt="" className={`${size} shrink-0`} draggable={false} /> : <span className={`${size} shrink-0`} />);
  const hot = (s: Sym) => lit.syms.includes(s);
  return (
    <div className={`space-y-1.5 ${compact ? '' : 'text-cream'}`} aria-label="Slot legend">
      {/* jackpot */}
      <div className={`relative overflow-hidden rounded-xl border-2 p-2 ${hot('wild') ? 'border-gold bg-gold/20 shadow-gold' : 'border-gold/60 bg-gradient-to-b from-[#2a1d02] to-black/60'}`}>
        <span className="shine-sweep" />
        <div className="flex items-center gap-2">
          {img('wild', compact ? 'h-9 w-9' : 'h-11 w-11')}
          <div className="min-w-0">
            <div className="font-display text-[10px] font-black uppercase tracking-[.2em] text-gold/80">Jackpot</div>
            <div className="font-display text-lg font-black leading-tight text-gold-grad tabular">{money(JACKPOT * lineBet)}</div>
            <div className="text-[10px] leading-tight text-cream/75">5 Golden Roosters on a line{free ? ' · ×3 now!' : ''}</div>
            <div className="text-[10px] leading-tight text-cream/60"><b className="text-gold">Wild</b> — stands in for any symbol except the Coop</div>
          </div>
        </div>
      </div>
      {/* free spins */}
      <div className={`rounded-xl border p-2 ${lit.coop || free ? 'border-blood bg-blood/25' : 'border-blood/40 bg-blood/10'}`}>
        <div className="flex items-center gap-2">
          {img('coop', compact ? 'h-9 w-9' : 'h-11 w-11')}
          <div className="min-w-0 text-[11px] leading-tight">
            <div className="font-display text-[10px] font-black uppercase tracking-[.2em] text-blood">Free spins</div>
            <div className="font-bold text-cream">3+ Coops <span className="text-cream/70">anywhere</span></div>
          </div>
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-1 text-center text-[10px] tabular">
          {[3, 4, 5].map((n) => (
            <div key={n} className="rounded bg-black/40 px-1 py-0.5">
              <div className="font-bold text-cream">{n}× coop</div>
              <div className="font-display font-black text-gold">{FREE_SPINS[n]} spins</div>
              <div className="text-cream/60">pays {money(SCATTER_PAYS[n] * bet)}</div>
            </div>
          ))}
        </div>
        <div className="mt-1 text-center text-[10px] font-bold text-cream/80">All free-spin wins ×{FREE_SPIN_MULT}</div>
      </div>
      {/* symbol pays */}
      <div className="rounded-xl bg-white/[0.04] p-1.5">
        <div className="mb-1 grid grid-cols-[28px_1fr_1fr_1fr] gap-1 px-0.5 text-center text-[10px] font-bold uppercase tracking-wider text-smoke">
          <span /><span>×3</span><span>×4</span><span>×5</span>
        </div>
        {PAY_ORDER.filter((s) => s !== 'wild').map((s) => (
          <div key={s} className={`grid grid-cols-[28px_1fr_1fr_1fr] items-center gap-1 rounded-md px-0.5 text-center font-display text-[11px] font-bold tabular transition ${hot(s) ? 'bg-gold text-ink' : 'text-cream/90'}`} title={SYMBOL_NAME[s]}>
            {img(s, 'h-6 w-6')}
            {LINE_PAYS[s]!.map((p, i) => <span key={i}>{money(p * lineBet)}</span>)}
          </div>
        ))}
        <div className="mt-1 text-center text-[10px] text-smoke">Coins per line · left to right · 20 lines</div>
      </div>
    </div>
  );
}

interface Session { spins: number; spent: number; won: number; best: number }
const EMPTY_SESSION: Session = { spins: 0, spent: 0, won: 0, best: 0 };
const SESSION_KEY = 'chicken-casino-slots-session';
// kept for this browser tab, so a reload doesn't wipe it
function loadSession(): Session {
  try { const v = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null'); return v && typeof v.spent === 'number' ? v : EMPTY_SESSION; } catch { return EMPTY_SESSION; }
}
function saveSession(s: Session) { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } }

/** What you've put in and taken out this session. */
function SessionStats({ s, onReset, compact }: { s: Session; onReset: () => void; compact?: boolean }) {
  const net = s.won - s.spent;
  const cell = (label: string, value: string, tone = 'text-cream') => (
    <div className="min-w-0 rounded-lg bg-black/40 px-1.5 py-1">
      <div className="truncate text-[10px] font-bold uppercase tracking-wider text-smoke">{label}</div>
      <div className={`truncate font-display text-[13px] font-black tabular leading-tight ${tone}`}>{value}</div>
    </div>
  );
  return (
    <div className={`rounded-xl border border-white/10 p-2 ${compact ? 'bg-ink-900' : 'bg-white/[0.04]'}`} aria-label="Session stats">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-display text-[10px] font-black uppercase tracking-[.15em] text-smoke">Session · {s.spins} spin{s.spins === 1 ? '' : 's'}</span>
        {s.spins > 0 && <button type="button" onClick={onReset} className="text-[10px] font-bold text-gold hover:underline">Reset</button>}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {cell('Spent', money(s.spent))}
        {cell('Won', money(s.won), s.won > 0 ? 'text-gold' : 'text-cream')}
        {cell('Net', `${net > 0 ? '+' : net < 0 ? '−' : ''}${money(Math.abs(net))}`, net > 0 ? 'text-emerald-400' : net < 0 ? 'text-blood' : 'text-cream')}
        {cell('Best win', money(s.best), s.best > 0 ? 'text-gold' : 'text-cream')}
      </div>
    </div>
  );
}
