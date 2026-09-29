import { Check, Crown, Lock } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { toast, useLevel, useStore } from '../store';
import { TIERS, xpForLevel } from '../lib/data';
import { fmt } from '../lib/format';
import { Coin } from '../components/Icons';
import { sfx } from '../lib/sound';

export default function VIP() {
  const { level, tier, xp } = useLevel();
  const stats = useStore((s) => s.stats);
  const base = useStore((s) => s.rakebackBase);
  const claim = useStore((s) => s.claimRakeback);
  const user = useStore((s) => s.user);
  const pending = ((stats.wagered - base) * tier.rakeback) / 100;
  const idx = TIERS.indexOf(tier);
  const nextTier = TIERS[idx + 1];
  const pct = Math.min(100, ((xp - xpForLevel(level)) / (xpForLevel(level + 1) - xpForLevel(level))) * 100);

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 pt-6 space-y-6">
      <PageHeader kicker="VIP Club" title={<>Rule the <span className="text-gold-grad">roost</span></>} sub="Every coin you wager earns XP. Level up to unlock bigger rakeback, exclusive items and bragging rights." img="phone-chicken.webp" />

      <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="card p-6 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full blur-3xl opacity-30" style={{ background: tier.color }} />
          <div className="relative flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl border-2" style={{ borderColor: tier.color, background: `${tier.color}22` }}><Crown style={{ color: tier.color }} size={30} /></div>
            <div>
              <div className="label">Current tier</div>
              <div className="font-display text-3xl font-black" style={{ color: tier.color }}>{tier.name}</div>
              <div className="text-sm text-smoke">Level {level} · {fmt(xp, 0)} XP</div>
            </div>
          </div>
          <div className="relative mt-6">
            <div className="flex justify-between text-xs"><span>Level {level}</span><span className="text-smoke">{fmt(xpForLevel(level + 1) - xp, 0)} XP to level {level + 1}</span></div>
            <div className="mt-2 h-3 rounded-full bg-ink-900 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-gold-600 via-gold to-gold-300 shine" style={{ width: `${pct}%` }} /></div>
            {nextTier && <p className="mt-3 text-sm text-smoke">Reach <b className="text-cream">level {nextTier.minLevel}</b> to become <b style={{ color: nextTier.color }}>{nextTier.name}</b>.</p>}
          </div>
        </div>
        <div className="card p-6">
          <div className="label">Rakeback · {tier.rakeback}% of wagers</div>
          <div className="mt-2 flex items-center gap-2 font-display text-4xl font-black tabular"><Coin className="h-8 w-8" />{fmt(Math.max(0, pending))}</div>
          <p className="mt-1 text-sm text-smoke">Accrues on every bet, win or lose.</p>
          <button className="btn-gold mt-5 w-full py-3" disabled={!user || pending < 0.01}
            onClick={() => { const a = claim(); if (a) { sfx.cashout(); toast({ title: `+${fmt(a)} rakeback claimed`, tone: 'gold' }); } }}>
            Claim rakeback
          </button>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-ink-900 p-3"><div className="label !text-[10px]">Total wagered</div><div className="font-display font-black tabular">{fmt(stats.wagered, 0)}</div></div>
            <div className="rounded-xl bg-ink-900 p-3"><div className="label !text-[10px]">Rounds</div><div className="font-display font-black tabular">{fmt(stats.rounds, 0)}</div></div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl font-extrabold mb-4">Tier ladder</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {TIERS.map((t, i) => {
            const unlocked = i <= idx;
            return (
              <div key={t.name} className={`card p-5 relative ${t === tier ? 'ring-2' : ''}`} style={t === tier ? { boxShadow: `0 0 0 2px ${t.color}, 0 10px 40px -10px ${t.color}` } : undefined}>
                <div className="flex items-center justify-between">
                  <Crown style={{ color: t.color }} size={22} />
                  {unlocked ? <Check size={16} className="text-emerald-400" /> : <Lock size={14} className="text-smoke" />}
                </div>
                <div className="mt-3 font-display text-lg font-black" style={{ color: t.color }}>{t.name}</div>
                <div className="text-xs text-smoke">Level {t.minLevel}+</div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {t.perks.map((p) => <li key={p} className="flex gap-2"><span style={{ color: t.color }}>•</span><span className="text-cream/80">{p}</span></li>)}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
