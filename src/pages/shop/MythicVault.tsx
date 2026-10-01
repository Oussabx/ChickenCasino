import { useState } from 'react';
import { ArrowRight, Gem } from 'lucide-react';
import { ItemArt } from '../../components/CosmeticArt';
import { SHOP, ShopItem } from '../../lib/data';
import { useStore } from '../../store';
import { Price, RARITY_COLOR } from './common';

const MYTHICS = SHOP.filter((i) => i.rarity === 'mythic' && i.kind !== 'set');
const col = RARITY_COLOR.mythic;

/**
 * The Mythic Vault: the rarest cosmetics in the coop on a spotlight stage.
 * Tap a thumbnail to put it on the pedestal; tap the pedestal for details.
 */
export default function MythicVault({ onOpen, go }: { onOpen: (it: ShopItem) => void; go?: () => void }) {
  const inv = useStore((s) => s.inventory);
  const [pick, setPick] = useState(MYTHICS[0]);
  const owned = MYTHICS.filter((i) => inv.includes(i.id)).length;
  return (
    <section className="own-layer relative isolate overflow-hidden rounded-3xl p-[2px] shop-mythic-frame">
      <div className="relative overflow-hidden rounded-[22px] bg-[radial-gradient(ellipse_at_30%_40%,#3a0712,#0b0306_65%)]">
        <div className="relative grid grid-cols-1 items-center gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] sm:p-8">
          {/* pedestal */}
          <button type="button" onClick={() => onOpen(pick)} className="group relative mx-auto grid h-[260px] w-[260px] place-items-center sm:h-[320px] sm:w-[320px]" aria-label={`Look at ${pick.name}`}>
            <div className="rays pointer-events-none absolute left-1/2 top-1/2 h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2 opacity-60"
              style={{ background: `repeating-conic-gradient(from 0deg, ${col}55 0deg 6deg, transparent 6deg 16deg)`, animation: 'winfx-spin 26s linear infinite', maskImage: 'radial-gradient(circle, black 12%, transparent 55%)', WebkitMaskImage: 'radial-gradient(circle, black 12%, transparent 55%)' }} />
            <div className="pointer-events-none absolute bottom-6 h-8 w-48 rounded-[50%] bg-[radial-gradient(ellipse,rgba(255,77,109,.55),transparent_70%)]" />
            <div key={pick.id} className="cos-live shop-stage-in relative transition duration-500 group-hover:scale-105"><ItemArt it={pick} size={230} /></div>
          </button>

          <div className="min-w-0 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 font-display text-[11px] font-black uppercase tracking-[.3em]" style={{ borderColor: `${col}88`, color: '#ff9fb2', background: `${col}22` }}><Gem size={13} />The Mythic Vault</div>
            <h2 className="h-display mt-3 text-4xl leading-[.95] sm:text-5xl"><span className="text-mythic-grad">{pick.name}</span></h2>
            <p className="mt-2 text-sm text-cream/75">{pick.desc}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              {inv.includes(pick.id)
                ? <span className="rounded-xl bg-emerald-500/15 px-4 py-2.5 text-sm font-bold text-emerald-400">In your locker</span>
                : <button type="button" onClick={() => onOpen(pick)} className="btn-mythic px-6 py-3 text-base">Unlock · <Price it={pick} /></button>}
              <span className="text-xs text-smoke">{owned}/{MYTHICS.length} mythics owned · cosmetic only</span>
            </div>
            {/* vault strip */}
            <div className="no-scrollbar -mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-1">
              {MYTHICS.map((it) => (
                <button key={it.id} type="button" onClick={() => setPick(it)} aria-label={it.name}
                  className={`relative grid h-16 w-16 shrink-0 place-items-center rounded-xl border bg-black/40 transition ${pick.id === it.id ? 'scale-105' : 'opacity-75 hover:opacity-100'}`}
                  style={{ borderColor: pick.id === it.id ? col : 'rgba(255,255,255,.1)', boxShadow: pick.id === it.id ? `0 0 16px ${col}88` : undefined }}>
                  <ItemArt it={it} size={50} tryOn={false} />
                  {inv.includes(it.id) && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-black bg-emerald-400" />}
                </button>
              ))}
            </div>
            {go && <button type="button" onClick={go} className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#ff9fb2] hover:underline">Enter the vault <ArrowRight size={14} /></button>}
          </div>
        </div>
      </div>
    </section>
  );
}
