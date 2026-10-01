import { Check, Crown, Lock } from 'lucide-react';
import { VIP_TIERS } from '../../lib/cosmetics';
import { ShopItem, itemById, xpForLevel } from '../../lib/data';
import { ItemArt } from '../../components/CosmeticArt';
import { sfx } from '../../lib/sound';
import { toast, useLevel, useStore } from '../../store';
import { RARITY_COLOR } from './common';

/** Rooster VIP: an in-game progression ladder. Levels come from playing; rewards are claimed free. */
export default function VipTrack({ onOpen, compact }: { onOpen: (it: ShopItem) => void; compact?: boolean }) {
  const { level, xp } = useLevel();
  const inv = useStore((s) => s.inventory);
  const reached = VIP_TIERS.filter((t) => level >= t.level).length;
  const next = VIP_TIERS[reached];
  // progress along the ladder: completed tiers + partial XP toward the next one
  const prevLvl = reached ? VIP_TIERS[reached - 1].level : 1;
  const frac = next ? Math.min(1, Math.max(0, (xp - xpForLevel(prevLvl)) / (xpForLevel(next.level) - xpForLevel(prevLvl)))) : 1;
  const pct = ((reached - 1 + (next ? frac : 0)) / (VIP_TIERS.length - 1)) * 100;
  const claim = (id: string) => {
    const err = useStore.getState().claimVip(id);
    if (err) toast({ title: err, tone: 'red' });
    else { sfx.win(); toast({ title: `${itemById(id)?.name} unlocked!`, tone: 'gold' }); }
  };
  return (
    <section className="relative overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-[#2a1d02] via-[#120c02] to-black p-5 sm:p-7">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-display text-[11px] font-black uppercase tracking-[.3em] text-gold/80"><Crown size={14} />Rooster VIP</div>
          <h2 className="h-display mt-1 text-3xl text-gold-grad sm:text-4xl">{reached ? VIP_TIERS[reached - 1].name : 'Not VIP yet'}</h2>
          <p className="text-sm text-cream/70">Level {level}. {next ? <>Reach <b className="text-cream">level {next.level}</b> for <b style={{ color: next.color }}>{next.name}</b>.</> : 'Every tier unlocked — you’re Rooster Elite.'} Play any game to earn XP.</p>
        </div>
      </div>
      {/* ladder */}
      <div className="relative mt-6 px-8 [--vip-inset:2rem] sm:px-12 sm:[--vip-inset:3rem]">
        <div className="absolute left-8 right-8 top-5 sm:left-12 sm:right-12 h-1.5 rounded-full bg-white/10" />
        <div className="absolute left-8 top-5 h-1.5 sm:left-12 rounded-full bg-gradient-to-r from-gold-600 via-gold to-gold-300 shine transition-all duration-700" style={{ width: `calc((100% - var(--vip-inset) * 2) * ${Math.max(0, pct) / 100})` }} />
        <div className="relative flex justify-between">
          {VIP_TIERS.map((t) => {
            const on = level >= t.level;
            return (
              <div key={t.name} className="flex w-0 flex-col items-center">
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 transition ${on ? 'shop-vip-on' : 'bg-ink-900'}`} style={{ borderColor: on ? t.color : 'rgba(255,255,255,.15)', background: on ? `${t.color}30` : undefined }}>
                  {on ? <Crown size={18} style={{ color: t.color }} /> : <Lock size={14} className="text-smoke" />}
                </div>
                <div className="mt-1.5 w-16 text-center font-display text-[10px] leading-tight sm:w-auto sm:whitespace-nowrap font-black uppercase tracking-wider sm:text-xs" style={{ color: on ? t.color : '#8a8a8a' }}>{t.name}</div>
                <div className="whitespace-nowrap text-[10px] text-smoke">Lv {t.level}</div>
              </div>
            );
          })}
        </div>
      </div>
      {/* rewards */}
      {!compact && (
        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {VIP_TIERS.map((t) => {
            const on = level >= t.level;
            return (
              <div key={t.name} className={`rounded-2xl border p-3 ${on ? 'bg-white/[0.05]' : 'bg-black/30'}`} style={{ borderColor: on ? `${t.color}66` : 'rgba(255,255,255,.08)' }}>
                <div className="font-display text-xs font-black uppercase tracking-wider" style={{ color: t.color }}>{t.name}</div>
                <div className="mt-2 space-y-2">
                  {t.rewards.map((id) => {
                    const it = itemById(id)!;
                    const have = inv.includes(id);
                    return (
                      <div key={id} className="flex items-center gap-2">
                        <button type="button" onClick={() => onOpen(it)} aria-label={`Look at ${it.name}`} className={`grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-black/40 ring-1 ${on ? '' : 'opacity-50 grayscale'}`} style={{ ['--tw-ring-color' as string]: `${RARITY_COLOR[it.rarity]}66` }}>
                          <ItemArt it={it} size={52} tryOn={false} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-bold">{it.name}</div>
                          {have ? <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400"><Check size={11} />Claimed</span>
                            : on ? <button className="btn-gold mt-0.5 min-h-[32px] px-3 py-1.5 text-xs" onClick={() => claim(id)}>Claim</button>
                            : <span className="text-[11px] text-smoke">Level {t.level}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
