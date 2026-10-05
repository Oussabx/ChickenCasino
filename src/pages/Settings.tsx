import { ask } from '../components/Confirm';
import { ReactNode, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Volume2, Gamepad2, Eye, ShieldCheck, Database, User, KeyRound, AlertTriangle } from 'lucide-react';
import { toast, todaysNet, useStore } from '../store';
import { fmt } from '../lib/format';
import Avatar from '../components/Avatar';
import Modal from '../components/Modal';
import { RecoveryCodeView } from '../components/AuthModal';
import { changePassword, currentAccount, deleteAccount, passwordValid, regenerateRecoveryCode, renameAccount, useAccounts } from '../lib/auth';

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
                <button className="btn-gold shrink-0 px-4" disabled={name.trim().length < 3 || name === s.user.name}
                  onClick={() => { const r = renameAccount(name); toast(r.ok ? { title: 'Username updated', tone: 'green' } : { title: r.error, tone: 'red' }); }}>Save</button>
              </div>
            </div>
          </div>
          <Row label="Avatar, frame & title" desc="Unlock and equip in the shop."><Link to="/shop" className="btn-ghost px-3 py-1.5 text-sm">Open shop</Link></Row>
        </Section>
      )}

      {s.user && <Security />}

      <Section icon={<Volume2 size={18} />} title="Sound">
        <Row label="Sound effects" desc="Clicks, clucks and big-win fanfares."><Toggle label="Sound effects" on={s.settings.sound} onChange={(v) => set({ sound: v })} /></Row>
        <Row label="Volume">
          <input type="range" min={0} max={1} step={0.05} value={s.settings.volume} onChange={(e) => set({ volume: +e.target.value })} className="w-36 accent-[#F4C430]" aria-label="Volume" />
        </Row>
      </Section>

      <Section icon={<Gamepad2 size={18} />} title="Gameplay">
        <Row label="Turbo mode" desc="Speed up animations in every game."><Toggle label="Turbo mode" on={s.settings.turbo} onChange={(v) => set({ turbo: v })} /></Row>
        <Row label="Big win celebration" desc="Full-screen show for wins of 15× or more (otherwise a smaller banner)."><Toggle label="Big win celebration" on={s.settings.bigWinCelebration} onChange={(v) => set({ bigWinCelebration: v })} /></Row>
        <Row label="Default bet" desc="Pre-filled bet when you open a game.">
          <input type="number" min={0} className="input w-28 text-right" value={s.settings.defaultBet} onChange={(e) => set({ defaultBet: Math.max(0, +e.target.value || 0) })} aria-label="Default bet" />
        </Row>
        <Row label="Confirm large bets" desc={s.settings.confirmOver > 0 ? `Ask before placing a bet of ${fmt(s.settings.confirmOver, 0)} or more.` : 'Ask before placing big bets.'}>
          <Toggle on={s.settings.confirmOver > 0} onChange={(v) => set({ confirmOver: v ? 1000 : 0 })} label="Confirm large bets" />
        </Row>
        {s.settings.confirmOver > 0 && (
          <Row label="Ask at or above" desc="Bets this size or bigger need a tap to confirm.">
            <input type="number" min={1} className="input w-28 text-right" value={s.settings.confirmOver} onChange={(e) => set({ confirmOver: Math.max(1, +e.target.value || 1) })} aria-label="Confirm threshold" />
          </Row>
        )}
      </Section>

      <Section icon={<Eye size={18} />} title="Display">
        <Row label="Hide balance" desc="Streamer mode — masks your balance in the header."><Toggle label="Hide balance" on={s.settings.hideBalance} onChange={(v) => set({ hideBalance: v })} /></Row>
        <Row label="Reduce motion" desc="Minimise animations across the site."><Toggle label="Reduce motion" on={s.settings.reduceMotion} onChange={(v) => set({ reduceMotion: v })} /></Row>
        <Row label="Visual effects" desc="Lite turns off blur and background effects and lowers 3D resolution, for smooth play on any device. Auto picks lite on phones and low-power laptops.">
          <div className="flex rounded-xl bg-ink-700 p-1 text-xs font-bold">
            {(['auto', 'full', 'lite'] as const).map((k) => (
              <button key={k} type="button" onClick={() => set({ effects: k })} aria-pressed={(s.settings.effects ?? 'auto') === k}
                className={`rounded-lg px-3 py-1.5 capitalize transition ${(s.settings.effects ?? 'auto') === k ? 'bg-gold text-ink' : 'text-cream/70 hover:text-cream'}`}>{k}</button>
            ))}
          </div>
        </Row>
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
            ask({ title: 'Take a break?', body: `Betting will be paused for ${h >= 24 ? `${h / 24} day${h > 24 ? 's' : ''}` : `${h} hour${h === 1 ? '' : 's'}`}. You can still browse, but you won’t be able to place bets until it ends.`, confirm: 'Start break' })
              .then((ok) => { if (ok) { s.takeBreak(h); toast({ title: 'Break started. See you soon 🐔', tone: 'neutral' }); } });
          }} aria-label="Take a break">
            <option value="">{onBreak ? 'Active' : 'Choose…'}</option><option value={1}>1 hour</option><option value={24}>24 hours</option><option value={168}>7 days</option>
          </select>
        </Row>
      </Section>

      <Section icon={<Database size={18} />} title="Data">
        <Row label="Bet history" desc={`${s.rounds.length} rounds stored on this device.`}><Link to="/history" className="btn-ghost px-3 py-1.5 text-sm">View / export</Link></Row>
        {s.user && (
          <Row label="Delete account" desc="Permanently removes this account, its balance, items and history from this device.">
            <button className="btn px-3 py-1.5 text-sm border border-blood/40 text-blood hover:bg-blood/10"
              onClick={() => { ask({ title: 'Delete account?', body: `“${s.user!.name}” and all its coins, items, cards and history will be removed from this device. This can’t be undone.`, confirm: 'Delete account', danger: true }).then((ok) => { if (ok) { deleteAccount(); toast({ title: 'Account deleted', tone: 'red' }); nav('/'); } }); }}>Delete</button>
          </Row>
        )}
      </Section>
      <p className="text-center text-xs text-smoke">Chicken Casino v1.0 · Virtual coins only · Data saved locally in your browser</p>
    </div>
  );
}

function Security() {
  const needsPassword = useAccounts((a) => !!currentAccount()?.needsPassword && !!a);
  const hasCode = useAccounts((a) => !!currentAccount()?.rHash && !!a);
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [codePw, setCodePw] = useState('');
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');
  const [codeErr, setCodeErr] = useState('');
  const name = useStore((s) => s.user?.name ?? '');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordValid(pw)) return setMsg({ ok: false, text: 'Use 8+ characters with a letter and a number.' });
    if (pw !== pw2) return setMsg({ ok: false, text: 'New passwords don’t match.' });
    setBusy(true);
    const r = await changePassword(cur, pw);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setCur(''); setPw(''); setPw2('');
    setMsg({ ok: true, text: needsPassword ? 'Password set. Now create a recovery code below.' : 'Password changed.' });
  };

  const genCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await regenerateRecoveryCode(codePw);
    setBusy(false);
    if (!r.ok) return setCodeErr(r.error);
    setCodePw(''); setCodeErr(''); setCode(r.recoveryCode);
  };

  return (
    <Section icon={<KeyRound size={18} />} title="Security">
      {needsPassword && (
        <div className="my-3 flex gap-3 rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm">
          <AlertTriangle size={18} className="shrink-0 text-gold" />
          <span>This profile was created before passwords existed. <b>Set a password</b> so nobody else on this device can play as you.</span>
        </div>
      )}
      <form onSubmit={save} className="py-3.5 space-y-2.5">
        <div className="text-sm font-semibold">{needsPassword ? 'Set a password' : 'Change password'}</div>
        <input type="text" name="username" autoComplete="username" value={name} readOnly hidden />
        {!needsPassword && <input className="input" type="password" placeholder="Current password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />}
        <div className="grid gap-2.5 sm:grid-cols-2">
          <input className="input" type="password" placeholder="New password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <input className="input" type="password" placeholder="Confirm new password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-gold px-4 py-2 text-sm" disabled={busy || !pw}>{needsPassword ? 'Set password' : 'Update password'}</button>
          {msg && <span className={`text-xs ${msg.ok ? 'text-emerald-400' : 'text-blood'}`}>{msg.text}</span>}
        </div>
      </form>
      <Row label="Recovery code" desc={hasCode ? 'Used to reset your password if you forget it. Making a new one cancels the old one.' : 'You don’t have one yet — without it a forgotten password can’t be reset.'}>
        <button className="btn-ghost px-3 py-1.5 text-sm" disabled={needsPassword} onClick={() => { setCodeOpen(true); setCode(''); setCodeErr(''); }}>{hasCode ? 'New code' : 'Create code'}</button>
      </Row>
      <Modal open={codeOpen} onClose={() => setCodeOpen(false)} title={code ? '' : 'New recovery code'}>
        {code ? (
          <RecoveryCodeView code={code} username={name} title="Your new recovery code" intro="Your previous code no longer works." cta="Done" onContinue={() => setCodeOpen(false)} />
        ) : (
          <form onSubmit={genCode} className="space-y-3">
            <p className="text-sm text-smoke">Confirm your password to generate a new code.</p>
            <input className="input" type="password" placeholder="Password" autoComplete="current-password" autoFocus value={codePw} onChange={(e) => setCodePw(e.target.value)} />
            {codeErr && <p className="text-xs text-blood">{codeErr}</p>}
            <button className="btn-gold w-full py-3" disabled={busy || !codePw}>Generate code</button>
          </form>
        )}
      </Modal>
    </Section>
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

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-7 w-12 rounded-full transition ${on ? 'bg-gold' : 'bg-ink-500'}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full transition-all ${on ? 'left-6 bg-ink' : 'left-1 bg-cream'}`} />
    </button>
  );
}
