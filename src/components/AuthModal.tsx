import { FormEvent, InputHTMLAttributes, ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, ArrowLeft, Check, CheckCircle2, Copy, Download, Eye, EyeOff, KeyRound, Loader2, Lock, Mail, User, X, XCircle } from 'lucide-react';
import { AuthView, toast, useUI } from '../store';
import { SHOP } from '../lib/data';
import {
  EMAIL_RE, USERNAME_RE, emailTaken, lockoutRemaining, login, passwordChecks, passwordStrength, passwordValid, register, resetPassword, usernameTaken,
} from '../lib/auth';
import { Coin, Egg } from './Icons';
import { sfx } from '../lib/sound';

const STARTER_AVATARS = SHOP.filter((i) => i.kind === 'avatar').slice(0, 4);

export default function AuthModal() {
  const { auth, openAuth } = useUI();
  const close = () => openAuth(null);

  useEffect(() => {
    if (!auth) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!auth]);

  if (!auth) return null;
  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label="Account">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={close} />
      <div className="relative grid w-full sm:max-w-[880px] max-h-[94dvh] overflow-hidden rounded-t-3xl sm:rounded-3xl border border-white/10 bg-ink-800 shadow-2xl md:grid-cols-[380px_1fr] animate-slideUp">
        <BrandPanel view={auth} />
        <div className="relative overflow-y-auto max-h-[94dvh]">
          <button onClick={close} className="absolute right-3 top-3 z-10 rounded-full p-2 text-smoke hover:bg-white/5 hover:text-cream" aria-label="Close"><X size={18} /></button>
          <AuthBody view={auth} setView={openAuth} close={close} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function BrandPanel({ view }: { view: AuthView }) {
  return (
    <aside className="relative hidden md:flex flex-col justify-end overflow-hidden bg-ink-900 p-7 grain">
      <img src="./img/hero.webp" alt="" className="absolute inset-0 h-full w-full object-cover object-[40%_30%] opacity-80" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/70 to-ink-900/10" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <img src="./img/head.webp" alt="" className="h-9 w-9 rounded-full" />
          <div className="font-display font-black leading-none">CHICKEN<div className="text-[9px] tracking-[.25em] text-gold">— CASINO —</div></div>
        </div>
        {view === 'signup' ? (
          <>
            <div className="mt-6 label text-gold">Welcome bonus</div>
            <div className="mt-1 flex items-center gap-3 h-display text-3xl">
              <span className="flex items-center gap-1.5"><Coin className="h-7 w-7" />10,000</span>
              <span className="flex items-center gap-1.5 text-2xl"><Egg className="h-6 w-6" />10</span>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-cream/80">
              {['6 original games', 'Daily rewards & missions', 'Unlockable skins, avatars & titles'].map((t) => (
                <li key={t} className="flex items-center gap-2"><CheckCircle2 size={15} className="text-gold" />{t}</li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h2 className="mt-6 h-display text-3xl">Play big.<br /><span className="text-gold-grad">Win bigger.</span></h2>
            <p className="mt-2 text-sm text-cream/70">Your coins, streak and skins are waiting.</p>
          </>
        )}
        <p className="mt-6 text-[11px] text-smoke">18+ · Virtual coins only · Accounts are stored on this device</p>
      </div>
    </aside>
  );
}

function AuthBody({ view, setView, close }: { view: AuthView; setView: (v: AuthView) => void; close: () => void }) {
  const [prefill, setPrefill] = useState('');
  const [locked, setLocked] = useState(false); // hide tabs while a recovery code is on screen
  return (
    <div className="p-6 sm:p-8">
      {/* compact mobile banner */}
      <div className="md:hidden -mx-6 -mt-6 mb-5 relative h-24 overflow-hidden">
        <img src="./img/hero.webp" alt="" className="h-full w-full object-cover object-[50%_35%] opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-800 to-transparent" />
      </div>
      {view !== 'forgot' && !locked && (
        <div className="seg mb-6 max-w-xs" role="tablist">
          <button role="tab" aria-selected={view === 'login'} data-active={view === 'login'} onClick={() => setView('login')} className="!py-2 !text-sm">Log in</button>
          <button role="tab" aria-selected={view === 'signup'} data-active={view === 'signup'} onClick={() => setView('signup')} className="!py-2 !text-sm">Sign up</button>
        </div>
      )}
      {view === 'login' && <LoginForm key="login" prefill={prefill} onForgot={() => setView('forgot')} onDone={close} />}
      {view === 'signup' && <SignupFlow key="signup" onDone={close} onLock={setLocked} />}
      {view === 'forgot' && <ForgotFlow key="forgot" onBack={(id) => { setPrefill(id); setView('login'); }} />}
    </div>
  );
}

/* ================= LOGIN ================= */

function LoginForm({ prefill, onForgot, onDone }: { prefill: string; onForgot: () => void; onDone: () => void }) {
  const [id, setId] = useState(prefill);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<{ msg: string; field?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const shake = useShake();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id.trim() || !pw) return setErr({ msg: 'Enter your username and password' });
    setBusy(true); setErr(null);
    const r = await login(id, pw);
    setBusy(false);
    if (!r.ok) { setErr({ msg: r.error, field: r.field }); shake.trigger(); sfx.lose(); return; }
    sfx.win();
    toast({ title: 'Welcome back! 🐔', tone: 'gold' });
    onDone();
  };

  return (
    <form onSubmit={submit} className={`space-y-4 ${shake.cls}`} noValidate>
      <div>
        <h1 className="font-display text-2xl font-black">Welcome back</h1>
        <p className="text-sm text-smoke">Log in to pick up where you left off.</p>
      </div>
      <Field label="Username or email" icon={<User size={16} />} error={err?.field === 'identifier' ? err.msg : undefined}
        value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" autoFocus={!prefill} name="username" />
      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="login-pw">Password</label>
          <button type="button" onClick={onForgot} className="text-xs font-semibold text-gold hover:underline">Forgot password?</button>
        </div>
        <PasswordInput id="login-pw" value={pw} onChange={setPw} autoComplete="current-password" autoFocus={!!prefill} invalid={err?.field === 'password'} />
        {err?.field === 'password' && <FieldError msg={err.msg} />}
      </div>
      {err && !err.field && <Banner msg={err.msg} />}
      <button className="btn-gold w-full py-3.5 text-base" disabled={busy || lockoutRemaining() > 0}>
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Lock size={16} />}{busy ? 'Checking…' : 'Log in'}
      </button>
    </form>
  );
}

/* ================= SIGN UP ================= */

function SignupFlow({ onDone, onLock }: { onDone: () => void; onLock: (v: boolean) => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [avatar, setAvatar] = useState('av-classic');
  const [age, setAge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const shake = useShake();

  const uErr = !username ? 'Pick a username' : !USERNAME_RE.test(username) ? '3–18 letters, numbers or underscores' : usernameTaken(username) ? 'That username is taken' : null;
  const eErr = email && !EMAIL_RE.test(email) ? 'Enter a valid email' : email && emailTaken(email) ? 'An account already uses this email' : null;
  const pErr = !passwordValid(pw) ? 'Password doesn’t meet the requirements' : null;
  const cErr = pw2 !== pw ? 'Passwords don’t match' : null;
  const step1Ok = !uErr && !eErr && !pErr && !cErr && !!pw2;

  const next = (e: FormEvent) => {
    e.preventDefault();
    setTouched({ username: true, email: true, pw: true, pw2: true });
    if (!step1Ok) { shake.trigger(); return; }
    setStep(2);
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!age) { setErr('Please confirm you’re 18+'); shake.trigger(); return; }
    setBusy(true); setErr(null);
    const r = await register({ username, email, password: pw, avatar });
    setBusy(false);
    if (!r.ok) { setErr(r.error); setStep(r.field === 'username' || r.field === 'email' || r.field === 'password' ? 1 : 2); shake.trigger(); return; }
    sfx.win();
    setCode(r.recoveryCode);
    setStep(3);
    onLock(true);
  };

  return (
    <div className={shake.cls}>
      <Steps step={step} labels={['Account', 'Profile', 'Secure']} />
      {step === 1 && (
        <form onSubmit={next} className="mt-5 space-y-4" noValidate>
          <div>
            <h1 className="font-display text-2xl font-black">Create your account</h1>
            <p className="text-sm text-smoke">Takes 30 seconds. Bonus lands instantly.</p>
          </div>
          <Field label="Username" icon={<User size={16} />} value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
            onBlur={() => setTouched((t) => ({ ...t, username: true }))} autoComplete="username" autoFocus maxLength={18} name="username"
            error={touched.username || username.length >= 3 ? uErr ?? undefined : undefined}
            success={username.length >= 3 && !uErr ? 'Available!' : undefined} />
          <Field label="Email" hint="optional — lets you log in with email" icon={<Mail size={16} />} type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))} autoComplete="email" name="email" error={touched.email ? eErr ?? undefined : undefined} />
          <div>
            <label className="label" htmlFor="su-pw">Password</label>
            <PasswordInput id="su-pw" value={pw} onChange={setPw} autoComplete="new-password" invalid={!!(touched.pw && pErr)} onBlur={() => setTouched((t) => ({ ...t, pw: true }))} />
            <StrengthMeter pw={pw} />
          </div>
          <div>
            <label className="label" htmlFor="su-pw2">Confirm password</label>
            <PasswordInput id="su-pw2" value={pw2} onChange={setPw2} autoComplete="new-password" invalid={!!(touched.pw2 && pw2 && cErr)} onBlur={() => setTouched((t) => ({ ...t, pw2: true }))} />
            {touched.pw2 && pw2 && cErr && <FieldError msg={cErr} />}
            {pw2 && !cErr && <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-400"><Check size={12} />Passwords match</p>}
          </div>
          {err && <Banner msg={err} />}
          <button className="btn-gold w-full py-3.5 text-base">Continue</button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={create} className="mt-5 space-y-5" noValidate>
          <div>
            <h1 className="font-display text-2xl font-black">Pick your chicken</h1>
            <p className="text-sm text-smoke">You can unlock more avatars in the shop.</p>
          </div>
          <div className="grid grid-cols-4 gap-2.5">
            {STARTER_AVATARS.map((a) => (
              <button type="button" key={a.id} onClick={() => { setAvatar(a.id); sfx.click(); }} aria-pressed={avatar === a.id}
                className={`relative rounded-2xl p-1 border-2 transition ${avatar === a.id ? 'border-gold bg-gold/10 shadow-gold' : 'border-white/10 hover:border-white/25'}`}>
                <img src={`./img/${a.img}`} alt={a.name} className="aspect-square w-full rounded-xl object-cover" />
                {avatar === a.id && <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-gold text-ink"><Check size={12} strokeWidth={3} /></span>}
                <span className="mt-1 block truncate text-[10px] font-semibold text-smoke">{a.name}</span>
              </button>
            ))}
          </div>
          <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-ink-900 p-3 text-sm cursor-pointer hover:border-white/20">
            <input type="checkbox" checked={age} onChange={(e) => { setAge(e.target.checked); setErr(null); }} className="mt-0.5 h-4 w-4 accent-[#F4C430]" />
            <span className="text-cream/80">I’m 18 or older and understand Chicken Casino uses <b className="text-cream">virtual coins only</b> — nothing can be bought or withdrawn.</span>
          </label>
          {err && <Banner msg={err} />}
          <div className="flex gap-2">
            <button type="button" className="btn-ghost px-4 py-3.5" onClick={() => setStep(1)} aria-label="Back"><ArrowLeft size={18} /></button>
            <button className="btn-gold flex-1 py-3.5 text-base" disabled={busy}>
              {busy && <Loader2 size={18} className="animate-spin" />}{busy ? 'Creating account…' : 'Create account & claim bonus'}
            </button>
          </div>
        </form>
      )}

      {step === 3 && (
        <RecoveryCodeView code={code} title="Save your recovery code" intro={<>Welcome, <b className="text-cream">{username}</b>! 10,000 coins and 10 golden eggs are in your wallet.</>}
          cta="Start playing" onContinue={() => { onLock(false); toast({ title: 'Welcome to the coop! 🐔', desc: '10,000 coins + 10 golden eggs added', tone: 'gold' }); onDone(); }} username={username} />
      )}
    </div>
  );
}

/* ================= FORGOT ================= */

function ForgotFlow({ onBack }: { onBack: (identifier: string) => void }) {
  const [id, setId] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ msg: string; field?: string } | null>(null);
  const [newCode, setNewCode] = useState('');
  const shake = useShake();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id.trim()) return setErr({ msg: 'Enter your username or email', field: 'identifier' });
    if (code.replace(/[^A-Z0-9]/gi, '').length !== 16) return setErr({ msg: 'Recovery codes have 16 characters', field: 'code' });
    if (!passwordValid(pw)) return setErr({ msg: 'Choose a stronger password', field: 'password' });
    if (pw !== pw2) return setErr({ msg: 'Passwords don’t match', field: 'pw2' });
    setBusy(true); setErr(null);
    const r = await resetPassword(id, code, pw);
    setBusy(false);
    if (!r.ok) { setErr({ msg: r.error, field: r.field }); shake.trigger(); sfx.lose(); return; }
    sfx.win();
    setNewCode(r.recoveryCode);
  };

  if (newCode) {
    return <RecoveryCodeView code={newCode} title="Password updated ✅" username={id}
      intro="Your old recovery code no longer works. Here’s your new one — save it somewhere safe." cta="Log in with new password" onContinue={() => onBack(id)} />;
  }

  return (
    <form onSubmit={submit} className={`space-y-4 ${shake.cls}`} noValidate>
      <button type="button" onClick={() => onBack(id)} className="flex items-center gap-1 text-sm text-smoke hover:text-cream"><ArrowLeft size={15} />Back to log in</button>
      <div>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gold/10 text-gold"><KeyRound /></div>
        <h1 className="mt-3 font-display text-2xl font-black">Reset your password</h1>
        <p className="text-sm text-smoke">Enter the recovery code you saved when you signed up. Accounts live on this device, so we can’t send reset emails.</p>
      </div>
      <Field label="Username or email" icon={<User size={16} />} value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" autoFocus
        error={err?.field === 'identifier' ? err.msg : undefined} />
      <Field label="Recovery code" icon={<KeyRound size={16} />} value={code} placeholder="XXXX-XXXX-XXXX-XXXX" maxLength={19} spellCheck={false}
        className="font-mono tracking-widest uppercase" onChange={(e) => setCode(formatCode(e.target.value))} error={err?.field === 'code' ? err.msg : undefined} />
      <div>
        <label className="label" htmlFor="fp-pw">New password</label>
        <PasswordInput id="fp-pw" value={pw} onChange={setPw} autoComplete="new-password" invalid={err?.field === 'password'} />
        <StrengthMeter pw={pw} />
      </div>
      <div>
        <label className="label" htmlFor="fp-pw2">Confirm new password</label>
        <PasswordInput id="fp-pw2" value={pw2} onChange={setPw2} autoComplete="new-password" invalid={err?.field === 'pw2'} />
        {err?.field === 'pw2' && <FieldError msg={err.msg} />}
      </div>
      {err && !['identifier', 'code', 'pw2'].includes(err.field ?? '') && <Banner msg={err.msg} />}
      <button className="btn-gold w-full py-3.5 text-base" disabled={busy}>
        {busy && <Loader2 size={18} className="animate-spin" />}{busy ? 'Resetting…' : 'Reset password'}
      </button>
      <p className="text-center text-xs text-smoke">Lost your code too? Unfortunately that profile can’t be recovered — you can always start fresh with a new account.</p>
    </form>
  );
}

/* ================= shared bits ================= */

export function RecoveryCodeView({ code, title, intro, cta, onContinue, username }: { code: string; title: string; intro: ReactNode; cta: string; onContinue: () => void; username: string }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setSaved(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ }
  };
  const download = () => {
    const blob = new Blob([`Chicken Casino recovery code\nAccount: ${username}\nCode: ${code}\n\nUse this on the "Forgot password?" screen. It works once.\n`], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `chicken-casino-recovery-${username}.txt`; a.click();
    setSaved(true);
  };
  return (
    <div className="mt-5 space-y-4">
      <div>
        <h1 className="font-display text-2xl font-black">{title}</h1>
        <p className="text-sm text-smoke">{intro}</p>
      </div>
      <div className="rounded-2xl border border-gold/40 bg-gold/5 p-4">
        <div className="label text-gold">Recovery code</div>
        <div className="mt-2 select-all break-all font-mono text-xl sm:text-2xl font-bold tracking-[.12em] text-cream">{code}</div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={copy} className="btn-dark px-3 py-2 text-sm">{copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy'}</button>
          <button type="button" onClick={download} className="btn-dark px-3 py-2 text-sm"><Download size={15} />Download .txt</button>
        </div>
      </div>
      <p className="text-xs text-smoke">This is the <b className="text-cream">only way</b> to reset your password. We only store a scrambled version, so we can’t show it again.</p>
      <label className="flex items-center gap-2.5 text-sm cursor-pointer">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="h-4 w-4 accent-[#F4C430]" />
        I’ve saved my recovery code
      </label>
      <button className="btn-gold w-full py-3.5 text-base" disabled={!saved} onClick={onContinue}>{cta}</button>
    </div>
  );
}

function Steps({ step, labels }: { step: number; labels: string[] }) {
  return (
    <ol className="flex items-center gap-2">
      {labels.map((l, i) => {
        const n = i + 1, done = n < step, cur = n === step;
        return (
          <li key={l} className="flex flex-1 items-center gap-2">
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-black ${done ? 'bg-emerald-500 text-ink' : cur ? 'bg-gold text-ink' : 'bg-ink-500 text-smoke'}`}>{done ? <Check size={12} strokeWidth={3} /> : n}</span>
            <span className={`text-xs font-semibold ${cur ? 'text-cream' : 'text-smoke'}`}>{l}</span>
            {n < labels.length && <span className={`h-px flex-1 ${done ? 'bg-emerald-500/60' : 'bg-white/10'}`} />}
          </li>
        );
      })}
    </ol>
  );
}

function Field({ label, hint, icon, error, success, className = '', ...rest }: { label: string; hint?: string; icon?: ReactNode; error?: string; success?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = rest.id ?? `f-${label.replace(/\W/g, '').toLowerCase()}`;
  return (
    <div>
      <label className="label" htmlFor={id}>{label}{hint && <span className="ml-1.5 normal-case tracking-normal font-normal text-smoke/70">({hint})</span>}</label>
      <div className="relative mt-1.5">
        {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-smoke">{icon}</span>}
        <input id={id} {...rest} aria-invalid={!!error} className={`input ${icon ? 'pl-10' : ''} ${error ? '!border-blood/70 focus:!ring-blood/20' : success ? '!border-emerald-500/50' : ''} ${className}`} />
        {success && !error && <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400" />}
      </div>
      {error ? <FieldError msg={error} /> : success ? <p className="mt-1.5 text-xs text-emerald-400">{success}</p> : null}
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete, invalid, autoFocus, onBlur }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean; autoFocus?: boolean; onBlur?: () => void }) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  return (
    <>
      <div className="relative mt-1.5">
        <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-smoke" />
        <input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} autoFocus={autoFocus} onBlur={onBlur}
          onKeyUp={(e) => setCaps(e.getModifierState?.('CapsLock'))} aria-invalid={invalid} name={id}
          className={`input pl-10 pr-11 ${invalid ? '!border-blood/70' : ''}`} />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-smoke hover:text-cream" aria-label={show ? 'Hide password' : 'Show password'}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {caps && <p className="mt-1.5 text-xs text-gold">Caps Lock is on</p>}
    </>
  );
}

function StrengthMeter({ pw }: { pw: string }) {
  const s = passwordStrength(pw);
  const labels = ['Too weak', 'Weak', 'Okay', 'Strong', 'Very strong'];
  const colors = ['bg-blood', 'bg-blood', 'bg-gold', 'bg-emerald-500', 'bg-emerald-400'];
  const valid = passwordValid(pw);
  return (
    <div className="mt-2">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2, 3].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${pw && i < Math.max(1, s) ? colors[valid ? s : Math.min(s, 1)] : 'bg-ink-500'}`} />)}
        <span className="ml-1 w-20 text-right text-[11px] font-semibold text-smoke">{pw ? labels[valid ? s : Math.min(s, 1)] : ''}</span>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {passwordChecks(pw).map((c) => (
          <li key={c.label} className={`flex items-center gap-1.5 whitespace-nowrap text-[11px] ${c.ok ? 'text-emerald-400' : 'text-smoke'}`}>
            {c.ok ? <Check size={11} strokeWidth={3} /> : c.optional ? <span className="h-1 w-1 mx-[3px] rounded-full bg-smoke/60" /> : <XCircle size={11} />}
            {c.label}{c.optional && !c.ok && <span className="opacity-60">(bonus)</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

const FieldError = ({ msg }: { msg: string }) => (
  <p className="mt-1.5 flex items-center gap-1 text-xs text-blood" role="alert"><AlertCircle size={12} />{msg}</p>
);
const Banner = ({ msg }: { msg: string }) => (
  <div className="flex items-start gap-2 rounded-xl border border-blood/40 bg-blood/10 px-3 py-2.5 text-sm text-blood" role="alert"><AlertCircle size={16} className="mt-0.5 shrink-0" />{msg}</div>
);

function useShake() {
  const [on, setOn] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout>>();
  return {
    cls: on ? 'animate-shake' : '',
    trigger: () => { setOn(false); requestAnimationFrame(() => setOn(true)); clearTimeout(t.current); t.current = setTimeout(() => setOn(false), 450); },
  };
}

export function formatCode(v: string) {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16).match(/.{1,4}/g)?.join('-') ?? '';
}
