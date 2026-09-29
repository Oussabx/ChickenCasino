import { ReactNode, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Volume2, Gamepad2, Eye, ShieldCheck, Database, User } from 'lucide-react';
import { toast, todaysNet, useStore } from '../store';
import { fmt } from '../lib/format';
import Avatar from '../components/Avatar';

export default function Settings() {
  const s = useStore();
  const set = s.updateSettings;
  const nav = useNavigate();
  const [name, setName] = useState(s.user?.name ?? '');
  const onBreak = s.breakUntil > Date.now();

  return (
    <div className="mx-auto max-w-3xl px-4 lg:px-6 pt-6 space-y-6">
      <h1 className="h-display text-4xl">Settings</h1>

      {s.user && (
        <Section icon={<User size={18} />} title="Account">
          <div className="flex items-center gap-4 py-3">
            <Avatar size={56} />
            <div className="flex-1">
              <label className="label" htmlFor="nm">Username</label>
              <div className="mt-1 flex gap-2">
                <input id="nm" className="input" value={name} maxLength={18} onChange={(e) => setName(e.target.value)} />
                <button className="btn-gold px-4" disabled={name.trim().length < 3 || name === s.user.name}
                  onClick={() => { useStore.setState({ user: { ...s.user!, name: name.trim() } }); toast({ title: 'Username updated', tone: 'green' }); }}>Save</button>
              </div>
            </div>
          </div>
          <Row label="Avatar, frame & title" desc="Unlock and equip in the shop."><Link to="/shop" className="btn-ghost px-3 py-1.5 text-sm">Open shop</Link></Row>
        </Section>
      )}

      <Section icon={<Volume2 size={18} />} title="Sound">
        <Row label="Sound effects" desc="Clicks, clucks and big-win fanfares."><Toggle on={s.settings.sound} onChange={(v) => set({ sound: v })} /></Row>
        <Row label="Volume">
          <input type="range" min={0} max={1} step={0.05} value={s.settings.volume} onChange={(e) => set({ volume: +e.target.value })} className="w-36 accent-[#F4C430]" aria-label="Volume" />
        </Row>
      </Section>

      <Section icon={<Gamepad2 size={18} />} title="Gameplay">
        <Row label="Turbo mode" desc="Speed up animations in every game."><Toggle on={s.settings.turbo} onChange={(v) => set({ turbo: v })} /></Row>
        <Row label="Big win celebration" desc="Coin shower on 10×+ wins."><Toggle on={s.settings.bigWinCelebration} onChange={(v) => set({ bigWinCelebration: v })} /></Row>
        <Row label="Default bet" desc="Pre-filled bet when you open a game.">
          <input type="number" min={0} className="input w-28 text-right" value={s.settings.defaultBet} onChange={(e) => set({ defaultBet: Math.max(0, +e.target.value || 0) })} aria-label="Default bet" />
        </Row>
        <Row label="Confirm large bets" desc="Ask before placing bets at or above this amount (0 = off).">
          <input type="number" min={0} className="input w-28 text-right" value={s.settings.confirmOver} onChange={(e) => set({ confirmOver: Math.max(0, +e.target.value || 0) })} aria-label="Confirm threshold" />
        </Row>
      </Section>

      <Section icon={<Eye size={18} />} title="Display">
        <Row label="Hide balance" desc="Streamer mode — masks your balance in the header."><Toggle on={s.settings.hideBalance} onChange={(v) => set({ hideBalance: v })} /></Row>
        <Row label="Reduce motion" desc="Minimise animations across the site."><Toggle on={s.settings.reduceMotion} onChange={(v) => set({ reduceMotion: v })} /></Row>
      </Section>

      <Section icon={<ShieldCheck size={18} />} title="Responsible play">
        <Row label="Session reminder" desc="A gentle nudge after playing for a while.">
          <select className="input w-32" value={s.settings.sessionReminder} onChange={(e) => set({ sessionReminder: +e.target.value })} aria-label="Session reminder">
            <option value={0}>Off</option><option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>60 min</option>
          </select>
        </Row>
        <Row label="Daily loss limit" desc={`Betting pauses once today's losses reach this (0 = off). Today: ${fmt(todaysNet(s.rounds))}`}>
          <input type="number" min={0} className="input w-28 text-right" value={s.settings.lossLimit} onChange={(e) => set({ lossLimit: Math.max(0, +e.target.value || 0) })} aria-label="Daily loss limit" />
        </Row>
        <Row label="Take a break" desc={onBreak ? `On break until ${new Date(s.breakUntil).toLocaleString()}` : 'Pause all betting for a while. Cannot be undone early.'}>
          <select className="input w-32" disabled={onBreak} value="" onChange={(e) => {
            const h = +e.target.value; if (!h) return;
            if (window.confirm(`Pause betting for ${h >= 24 ? `${h / 24} day(s)` : `${h} hours`}?`)) { s.takeBreak(h); toast({ title: 'Break started. See you soon 🐔', tone: 'neutral' }); }
          }} aria-label="Take a break">
            <option value="">{onBreak ? 'Active' : 'Choose…'}</option><option value={1}>1 hour</option><option value={24}>24 hours</option><option value={168}>7 days</option>
          </select>
        </Row>
      </Section>

      <Section icon={<Database size={18} />} title="Data">
        <Row label="Bet history" desc={`${s.rounds.length} rounds stored on this device.`}><Link to="/history" className="btn-ghost px-3 py-1.5 text-sm">View / export</Link></Row>
        <Row label="Reset everything" desc="Wipes your account, balance, items and history on this device.">
          <button className="btn px-3 py-1.5 text-sm border border-blood/40 text-blood hover:bg-blood/10"
            onClick={() => { if (window.confirm('Reset all Chicken Casino data? This cannot be undone.')) { s.resetAll(); toast({ title: 'All data reset', tone: 'red' }); nav('/'); } }}>Reset</button>
        </Row>
      </Section>
      <p className="text-center text-xs text-smoke">Chicken Casino v1.0 · Virtual coins only · Data saved locally in your browser</p>
    </div>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-extrabold"><span className="text-gold">{icon}</span>{title}</h2>
      <div className="mt-2 divide-y divide-white/[0.05]">{children}</div>
    </section>
  );
}

function Row({ label, desc, children }: { label: string; desc?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0"><div className="text-sm font-semibold">{label}</div>{desc && <div className="text-xs text-smoke mt-0.5">{desc}</div>}</div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`relative h-7 w-12 rounded-full transition ${on ? 'bg-gold' : 'bg-ink-500'}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full transition-all ${on ? 'left-6 bg-ink' : 'left-1 bg-cream'}`} />
    </button>
  );
}
