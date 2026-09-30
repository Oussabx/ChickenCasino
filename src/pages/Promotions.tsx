import { useState } from 'react';
import { Check, Gift, Lock, Ticket, Target, Droplets } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { MISSIONS, missionProgress, toast, today, useStore, useUI } from '../store';
import { DAILY_REWARDS } from '../lib/data';
import { fmt } from '../lib/format';
import { Coin, Egg } from '../components/Icons';
import { sfx } from '../lib/sound';
import { Reveal, Tilt } from '../lib/motion';

export default function Promotions() {
  const s = useStore();
  const openAuth = useUI((x) => x.openAuth);
  const [code, setCode] = useState('');
  const [codeMsg, setCodeMsg] = useState<string | null>(null);

  const claimedToday = s.daily.last === today();
  const yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const streakAlive = s.daily.last === yest || claimedToday;
  const curDay = claimedToday ? s.daily.streak : streakAlive ? (s.daily.streak % 7) + 1 : 1;
  const claimed = s.missions.date === today() ? s.missions.claimed : [];
  const faucetReady = s.balance < 100 && Date.now() - s.lastFaucet > 36e5;

  const needUser = () => { if (!s.user) { openAuth('signup'); return true; } return false; };

  return (
    <div className="mx-auto max-w-7xl px-4 lg:px-6 pt-6 space-y-6">
      <PageHeader kicker="Rewards" title={<>Promotions <span className="text-gold-grad">&</span> perks</>} sub="Daily streaks, missions and codes. Every day in the coop pays." img="mood-crown.webp" />

      {/* daily */}
      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-extrabold flex items-center gap-2"><Gift className="text-gold" size={20} />Daily streak</h2>
            <p className="text-sm text-smoke">Come back every day. Miss one and the streak resets.</p>
          </div>
          <button className="btn-gold px-5 py-2.5" disabled={claimedToday}
            onClick={() => { if (needUser()) return; if (s.claimDaily()) { sfx.win(); toast({ title: `Day ${useStore.getState().daily.streak} reward claimed!`, tone: 'gold' }); } }}>
            {claimedToday ? 'Come back tomorrow' : `Claim day ${curDay}`}
          </button>
        </div>
        <div className="mt-5 grid grid-cols-4 sm:grid-cols-7 gap-2 sm:gap-3">
          {DAILY_REWARDS.map((r, i) => {
            const day = i + 1;
            const done = claimedToday ? day <= curDay : day < curDay;
            const next = !claimedToday && day === curDay;
            return (
              <div key={i} style={{ animationDelay: `${i * 70}ms` }} className={`relative rounded-2xl border p-3 text-center transition animate-pop hover:-translate-y-1 ${next ? 'animate-[pop_.45s_both,floaty_3s_ease-in-out_.5s_infinite]' : ''} ${next ? 'border-gold bg-gold/10 shadow-gold' : done ? 'border-emerald-400/30 bg-emerald-500/5' : 'border-white/5 bg-ink-700/50'} ${day === 7 ? 'col-span-4 sm:col-span-1 bg-gradient-to-b from-blood/20 to-transparent' : ''}`}>
                <div className="label !text-[10px]">Day {day}</div>
                <div className="my-2 flex justify-center">{r.eggs ? <Egg className="h-8 w-8" /> : <Coin className="h-8 w-8" />}</div>
                <div className="font-display text-sm font-black">{fmt(r.coins, 0)}</div>
                {r.eggs && <div className="text-[11px] text-gold font-bold">+{r.eggs} eggs</div>}
                {done && <div className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-ink"><Check size={12} strokeWidth={3} /></div>}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* missions */}
        <section className="card p-5 sm:p-6">
          <h2 className="font-display text-xl font-extrabold flex items-center gap-2"><Target className="text-blood" size={20} />Daily missions</h2>
          <p className="text-sm text-smoke">Reset at midnight UTC.</p>
          <div className="mt-4 space-y-3">
            {MISSIONS.map((m) => {
              const p = Math.min(m.goal, missionProgress(m.id, s.rounds));
              const done = p >= m.goal;
              const isClaimed = claimed.includes(m.id);
              const rw = m.reward as { coins?: number; eggs?: number };
              return (
                <div key={m.id} className="rounded-2xl bg-ink-700/60 border border-white/5 p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{m.label}</div>
                    <div className="mt-2 h-2 rounded-full bg-ink-900 overflow-hidden"><div className={`h-full rounded-full ${done ? 'bg-emerald-400' : 'bg-gold'}`} style={{ width: `${(p / m.goal) * 100}%` }} /></div>
                    <div className="mt-1 text-[11px] text-smoke tabular">{fmt(p, 0)} / {fmt(m.goal, 0)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1 font-display font-black text-sm">{rw.eggs ? <><Egg className="h-4 w-4" />{rw.eggs}</> : <><Coin className="h-4 w-4" />{fmt(rw.coins!, 0)}</>}</div>
                    <button className="mt-2 btn-gold px-3 py-1.5 text-xs" disabled={!done || isClaimed}
                      onClick={() => { if (s.claimMission(m.id)) { sfx.win(); toast({ title: 'Mission complete!', desc: m.label, tone: 'gold' }); } }}>
                      {isClaimed ? 'Claimed' : done ? 'Claim' : <><Lock size={11} />Locked</>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="space-y-6">
          {/* promo code */}
          <section className="card p-5 sm:p-6">
            <h2 className="font-display text-xl font-extrabold flex items-center gap-2"><Ticket className="text-gold" size={20} />Promo code</h2>
            <p className="text-sm text-smoke">Psst… try <b className="text-cream">CLUCK</b>, <b className="text-cream">GOLDENEGG</b> or <b className="text-cream">WINBIGGER</b>.</p>
            <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); const r = s.redeem(code); setCodeMsg(r); if (r.startsWith('Redeemed')) { sfx.win(); setCode(''); } }}>
              <input className="input uppercase tracking-widest font-bold" placeholder="ENTER CODE" value={code} onChange={(e) => setCode(e.target.value)} />
              <button className="btn-gold px-5" disabled={!code.trim()}>Redeem</button>
            </form>
            {codeMsg && <p className={`mt-2 text-sm ${codeMsg.startsWith('Redeemed') ? 'text-emerald-400' : 'text-blood'}`}>{codeMsg}</p>}
          </section>

          {/* faucet */}
          <section className="card p-5 sm:p-6 relative overflow-hidden">
            <img src="./img/mood-chips.webp" alt="" className="absolute right-0 top-0 h-full w-1/2 object-cover opacity-25 [mask-image:linear-gradient(to_right,transparent,black)]" />
            <div className="relative">
              <h2 className="font-display text-xl font-extrabold flex items-center gap-2"><Droplets className="text-sky-400" size={20} />Chicken feed</h2>
              <p className="text-sm text-smoke max-w-xs">Running on empty? Grab 1,000 free coins once an hour whenever your balance is under 100.</p>
              <button className="btn-dark mt-4 px-5 py-2.5" disabled={!faucetReady}
                onClick={() => { if (needUser()) return; if (s.faucet()) { sfx.cashout(); toast({ title: '+1,000 coins of chicken feed', tone: 'gold' }); } }}>
                {faucetReady ? 'Refill 1,000 coins' : s.balance >= 100 ? 'Balance too high' : 'Recharging…'}
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* static promos */}
      <section className="grid gap-4 md:grid-cols-3">
        {[
          { img: 'strip-closeup.webp', t: 'Rooster Rush Weekend', d: 'Double XP on Rocket Rooster every Saturday & Sunday.', tag: 'Weekend' },
          { img: 'strip-cards.webp', t: 'Crossing Guard Cashback', d: 'Get flattened on lane 1 in Chicken Cross? Blame the traffic, not us.', tag: 'Fun fact' },
          { img: 'mood-face.webp', t: 'Refer a Hen', d: 'Bring a friend to the coop and you both get 5 golden eggs. Coming soon.', tag: 'Soon' },
        ].map((p, i) => (
          <Reveal key={p.t} delay={i * 100}><Tilt className="card overflow-hidden h-full">
            <div className="relative h-36"><img src={`./img/${p.img}`} alt="" className="h-full w-full object-cover" loading="lazy" /><span className="chip absolute left-3 top-3 bg-ink/80 text-gold backdrop-blur">{p.tag}</span></div>
            <div className="p-4"><div className="font-display font-bold">{p.t}</div><p className="text-sm text-smoke mt-1">{p.d}</p></div>
          </Tilt></Reveal>
        ))}
      </section>
    </div>
  );
}
