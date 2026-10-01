import { useMemo, useState } from 'react';
import { ChevronDown, Info, Shirt } from 'lucide-react';
import Modal from '../../components/Modal';
import { EggArt, ItemArt } from '../../components/CosmeticArt';
import { EGGS, EggDef, Rarity } from '../../lib/cosmetics';
import { eggPool } from '../../lib/shopLogic';
import { ShopItem, itemById } from '../../lib/data';
import { fmt } from '../../lib/format';
import { sfx } from '../../lib/sound';
import { toast, useStore } from '../../store';
import { Coin } from '../../components/Icons';
import { RARITY_COLOR, UnlockBurst } from './common';

/**
 * Egg Shop — cosmetic-only, never a duplicate, and the exact odds are shown.
 * Each egg lists everything it can hatch for *you* (only items you don't own).
 */
export default function EggShop({ onOpen }: { onOpen: (it: ShopItem) => void }) {
  const [hatching, setHatching] = useState<EggDef | null>(null);
  return (
    <section>
      <div className="mb-3 flex items-start gap-2 rounded-2xl border border-gold/20 bg-gold/[0.06] p-3 text-xs text-cream/80">
        <Info size={15} className="mt-0.5 shrink-0 text-gold" />
        <span>Eggs only hatch <b>cosmetics</b> — never coins, never anything that changes a game. You can’t hatch something you already own, and the odds below are worked out for your collection.</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {EGGS.map((e) => <EggCard key={e.id} egg={e} onHatch={() => setHatching(e)} onOpen={onOpen} />)}
      </div>
      <Hatch egg={hatching} onClose={() => setHatching(null)} />
    </section>
  );
}

function EggCard({ egg, onHatch, onOpen }: { egg: EggDef; onHatch: () => void; onOpen: (it: ShopItem) => void }) {
  const inv = useStore((s) => s.inventory);
  const balance = useStore((s) => s.balance);
  const [show, setShow] = useState(false);
  const { byRarity, odds, empty } = useMemo(() => eggPool(egg, inv), [egg, inv]);
  const items = (Object.keys(odds) as Rarity[]).flatMap((r) => byRarity[r] ?? []);
  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="relative grid h-48 place-items-center" style={{ background: `radial-gradient(circle at 50% 60%, ${egg.shell[0]}30, transparent 60%), linear-gradient(180deg,#1b1b22,#111)` }}>
        <div className="shop-egg-idle"><EggArt egg={egg.id} size={104} /></div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-baseline justify-between gap-2">
          <div className="font-display text-lg font-black">{egg.name}</div>
          <div className="flex items-center gap-1 font-display font-black text-gold"><Coin className="h-4 w-4" />{fmt(egg.price, 0)}</div>
        </div>
        <p className="text-xs text-smoke">{egg.desc}</p>
        <div className="mt-3 min-h-[60px] space-y-1.5">
          {(Object.keys(egg.weights) as Rarity[]).map((r) => {
            const p = odds[r] ?? 0;
            return (
              <div key={r} className="flex items-center gap-2 text-[11px]">
                <span className="w-16 font-bold capitalize" style={{ color: RARITY_COLOR[r] }}>{r}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${p * 100}%`, background: RARITY_COLOR[r] }} /></div>
                <span className="w-10 text-right font-bold tabular">{p ? `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%` : '—'}</span>
              </div>
            );
          })}
        </div>
        <button type="button" onClick={() => setShow((s) => !s)} className="mt-3 flex items-center justify-between rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-xs font-bold text-cream/80 hover:bg-white/[0.07]">
          {empty ? 'You own everything inside' : `What it can hatch (${items.length})`}<ChevronDown size={14} className={`transition ${show ? 'rotate-180' : ''}`} />
        </button>
        {show && !empty && (
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {items.map((x) => (
              <button key={x.id} type="button" onClick={() => onOpen(x)} title={x.name} className="grid aspect-square place-items-center rounded-lg bg-white/[0.04] ring-1 transition hover:bg-white/[0.08]" style={{ ['--tw-ring-color' as string]: `${RARITY_COLOR[x.rarity]}55` }}>
                <ItemArt it={x} size={48} tryOn={false} />
              </button>
            ))}
          </div>
        )}
        <div className="flex-1" />
        <button className="btn-gold mt-4 w-full py-2.5" disabled={empty || balance < egg.price} onClick={onHatch}>
          {empty ? 'Collection complete' : balance < egg.price ? `Need ${fmt(egg.price - balance, 0)} more` : 'Hatch it'}
        </button>
      </div>
    </div>
  );
}

/** Wobble → crack → burst → reveal. */
function Hatch({ egg, onClose }: { egg: EggDef | null; onClose: () => void }) {
  const [phase, setPhase] = useState<'ready' | 'shake' | 'burst' | 'reveal'>('ready');
  const [won, setWon] = useState<string | null>(null);
  const start = () => {
    if (!egg) return;
    const r = useStore.getState().openEgg(egg.id);
    if (r.error) { toast({ title: r.error, tone: 'red' }); onClose(); return; }
    setWon(r.item!);
    setPhase('shake'); sfx.tick(1);
    [300, 650, 950, 1200].forEach((t, i) => setTimeout(() => sfx.tick(3 + i * 2), t));
    setTimeout(() => { setPhase('burst'); sfx.bigWin(); }, 1500);
    setTimeout(() => setPhase('reveal'), 1900);
  };
  const close = () => { setPhase('ready'); setWon(null); onClose(); };
  const it = won ? itemById(won) : null;
  const col = it ? RARITY_COLOR[it.rarity] : '#F4C430';
  return (
    <Modal open={!!egg} onClose={phase === 'shake' || phase === 'burst' ? () => {} : close} title={egg?.name ?? ''}>
      {egg && (
        <div className="relative grid min-h-[340px] place-items-center overflow-hidden rounded-3xl" style={{ background: `radial-gradient(circle at 50% 55%, ${phase === 'reveal' ? col : egg.shell[0]}38, transparent 60%), #0d0d11` }}>
          {(phase === 'burst' || phase === 'reveal') && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[220%] w-[220%] -translate-x-1/2 -translate-y-1/2"
              style={{ background: `repeating-conic-gradient(from 0deg, ${col}55 0deg 7deg, transparent 7deg 18deg)`, animation: 'winfx-spin 18s linear infinite', maskImage: 'radial-gradient(circle, black 8%, transparent 45%)', WebkitMaskImage: 'radial-gradient(circle, black 8%, transparent 45%)' }} />
          )}
          {phase === 'ready' && (
            <div className="flex flex-col items-center gap-4 p-6 text-center">
              <div className="shop-egg-idle"><EggArt egg={egg.id} size={130} /></div>
              <p className="max-w-xs text-sm text-cream/75">{fmt(egg.price, 0)} coins. You’ll get one cosmetic you don’t own yet.</p>
              <button className="btn-gold px-8 py-3 text-base" onClick={start}>Crack it open</button>
            </div>
          )}
          {phase === 'shake' && <div className="shop-egg-shake"><EggArt egg={egg.id} size={150} cracked={2} /></div>}
          {phase === 'burst' && (
            <>
              <div className="absolute h-40 w-40 rounded-full bg-white shop-flash" />
              <div className="shop-shell-l absolute"><EggArt egg={egg.id} size={150} cracked={3} /></div>
            </>
          )}
          {phase === 'reveal' && it && (
            <div className="relative flex flex-col items-center gap-3 p-6 text-center">
              <UnlockBurst color={col} n={30} />
              <div className="shop-unlock-pop"><ItemArt it={it} size={190} /></div>
              <div className="font-display text-xs font-black uppercase tracking-[.3em]" style={{ color: col }}>{it.rarity}</div>
              <div className="h-display text-3xl text-gold-grad">{it.name}</div>
              <div className="flex gap-2">
                <button className="btn-gold px-5 py-2.5" onClick={() => { useStore.getState().equip(it.id); sfx.click(); toast({ title: `${it.name} equipped`, tone: 'gold' }); close(); }}><Shirt size={15} />Equip now</button>
                <button className="btn-ghost px-5 py-2.5" onClick={close}>Nice</button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
