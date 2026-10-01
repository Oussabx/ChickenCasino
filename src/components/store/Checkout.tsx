import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, CreditCard, Loader2, Lock, Plus, ShieldCheck, Sparkles } from 'lucide-react';
import { Product } from '../../lib/coinStore';
import { itemById } from '../../lib/data';
import { fmt } from '../../lib/format';
import { CardErrors, CardForm, charge, detectBrand, digits, isExpired, parseExpiry, usd, validateCard } from '../../lib/payment';
import { sfx } from '../../lib/sound';
import { useStore, useUI } from '../../store';
import { useCountUp } from '../TableUI';
import { Coin, Egg } from '../Icons';
import { CardFields, CardPreview, SavedCardRow, cardLabel } from './CardBits';
import { ProductArt } from './CoinStore';

const EMPTY: CardForm = { number: '', name: '', expiry: '', cvc: '' };

export function DemoNotice() {
  return (
    <div className="flex gap-2.5 rounded-xl border border-sky-400/25 bg-sky-400/[0.07] p-3 text-xs text-cream/80">
      <ShieldCheck size={16} className="mt-0.5 shrink-0 text-sky-300" />
      <p><b className="text-cream">Demo checkout — no real money is charged.</b> Only test cards work (e.g. 4242 4242 4242 4242, any future expiry, any CVC). Saved cards keep just the brand, last four digits and expiry.</p>
    </div>
  );
}

/**
 * Checkout for one coin-store product: pick a saved card or enter a new one,
 * pay, then a success screen with the goods. Never stores a full card number.
 */
export default function Checkout({ p, onBack, onDone }: { p: Product; onBack?: () => void; onDone: () => void }) {
  const user = useStore((s) => s.user);
  const cards = useStore((s) => s.cards);
  const def = useStore((s) => s.defaultCard);
  const usable = useMemo(() => cards.filter((c) => !isExpired(c.expMonth, c.expYear)), [cards]);
  const [method, setMethod] = useState<string>(() => (def && usable.some((c) => c.id === def) ? def : usable[0]?.id ?? 'new'));
  const [f, setF] = useState<CardForm>(EMPTY);
  const [errors, setErrors] = useState<CardErrors>({});
  const [flip, setFlip] = useState(false);
  const [save, setSave] = useState(true);
  const [phase, setPhase] = useState<'form' | 'paying' | 'done'>('form');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [paidWith, setPaidWith] = useState('');

  useEffect(() => { if (Object.keys(errors).length) setErrors(validateCard(f)); }, [f]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) {
    return (
      <div className="py-6 text-center">
        <Lock className="mx-auto text-gold" />
        <h3 className="mt-3 font-display text-xl font-black">Sign in to buy</h3>
        <p className="mt-1 text-sm text-smoke">Purchases and saved cards belong to your account.</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" className="btn-ghost py-3" onClick={() => useUI.getState().openAuth('login')}>Log in</button>
          <button type="button" className="btn-gold py-3" onClick={() => useUI.getState().openAuth('signup')}>Sign up</button>
        </div>
      </div>
    );
  }

  const fail = (msg: string) => { setError(msg); setShake(true); sfx.lose(); setTimeout(() => setShake(false), 500); };

  const pay = async () => {
    setError('');
    let label = '';
    let result;
    if (method === 'new') {
      const e = validateCard(f);
      setErrors(e);
      if (Object.keys(e).length) { fail('Check the highlighted fields.'); return; }
      const brand = detectBrand(f.number);
      label = cardLabel({ brand, last4: digits(f.number).slice(-4) });
      setPhase('paying');
      result = await charge({ number: f.number });
      if (result.ok && save) {
        const ex = parseExpiry(f.expiry)!;
        useStore.getState().addCard({ brand, last4: digits(f.number).slice(-4), expMonth: ex.m, expYear: ex.y, name: f.name.trim() }, !useStore.getState().cards.length);
      }
    } else {
      const c = cards.find((x) => x.id === method)!;
      label = cardLabel(c);
      setPhase('paying');
      result = await charge({ saved: c });
    }
    if (!result.ok) { setPhase('form'); fail(result.error); return; }
    const err = useStore.getState().deliver(p.id, label);
    if (err) { setPhase('form'); fail(err); return; }
    setPaidWith(label);
    sfx.cashout(); setTimeout(() => sfx.win(), 200);
    setPhase('done');
  };

  if (phase === 'done') return <Success p={p} paidWith={paidWith} onDone={onDone} onMore={onBack} />;

  return (
    <div className={shake ? 'animate-shake' : ''}>
      {onBack && <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold text-smoke hover:text-cream"><ArrowLeft size={15} />All packs</button>}
      {/* order summary */}
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-ink-900/70 p-3">
        <div className="grid h-16 w-20 shrink-0 place-items-center overflow-hidden"><ProductArt p={p} size={58} /></div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display font-black">{p.name}</div>
          <div className="text-xs text-smoke">
            {[p.coins ? `${fmt(p.coins, 0)} coins` : '', p.eggs ? `${fmt(p.eggs, 0)} golden eggs` : '', ...(p.items ?? []).map((i) => itemById(i)?.name ?? '')].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="font-display text-xl font-black tabular">{usd(p.usd)}</div>
      </div>

      {/* payment method */}
      <div className="mt-4">
        <div className="label mb-2">Pay with</div>
        <div className="space-y-2" role="radiogroup" aria-label="Payment method">
          {usable.map((c) => (
            <label key={c.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${method === c.id ? 'border-gold/60 bg-gold/[0.06]' : 'border-white/10 hover:border-white/25'}`}>
              <input type="radio" name="pm" className="sr-only" checked={method === c.id} onChange={() => setMethod(c.id)} />
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${method === c.id ? 'border-gold' : 'border-white/30'}`}>{method === c.id && <span className="h-2.5 w-2.5 rounded-full bg-gold" />}</span>
              <SavedCardRow c={c} isDefault={c.id === def} />
            </label>
          ))}
          {usable.length > 0 && (
            <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${method === 'new' ? 'border-gold/60 bg-gold/[0.06]' : 'border-white/10 hover:border-white/25'}`}>
              <input type="radio" name="pm" className="sr-only" checked={method === 'new'} onChange={() => setMethod('new')} />
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${method === 'new' ? 'border-gold' : 'border-white/30'}`}>{method === 'new' && <span className="h-2.5 w-2.5 rounded-full bg-gold" />}</span>
              <span className="flex items-center gap-2 text-sm font-bold"><Plus size={15} />Use a new card</span>
            </label>
          )}
        </div>
      </div>

      {method === 'new' && (
        <>
        <div className="mt-4 grid items-start gap-4 sm:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
          <div className="sm:sticky sm:top-2"><CardPreview f={f} flipped={flip} /></div>
          <CardFields f={f} setF={setF} errors={errors} onFlip={setFlip} />
        </div>
        <div className="mt-4 space-y-4">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} className="h-4 w-4 accent-[#F4C430]" />
            Save this card to my account for next time
          </label>
        </div>
        </>
      )}

      {error && <div role="alert" className="mt-4 rounded-xl border border-blood/40 bg-blood/10 px-3 py-2.5 text-sm font-semibold text-[#ff8a95]">{error}</div>}

      <button type="button" onClick={pay} disabled={phase === 'paying'} className="btn-gold mt-5 w-full py-3.5 text-base">
        {phase === 'paying' ? <><Loader2 size={18} className="animate-spin" />Processing…</> : <><Lock size={16} />Pay {usd(p.usd)}</>}
      </button>
      <div className="mt-3"><DemoNotice /></div>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-smoke"><CreditCard size={12} />Virtual coins have no cash value and can’t be withdrawn.</p>
    </div>
  );
}

function Success({ p, paidWith, onDone, onMore }: { p: Product; paidWith: string; onDone: () => void; onMore?: () => void }) {
  const coins = useCountUp(p.coins ?? 0, 1400);
  const eggs = useCountUp(p.eggs ?? 0, 1400);
  return (
    <div className="relative overflow-hidden py-4 text-center">
      <div className="rays pointer-events-none absolute left-1/2 top-[40%] h-[160%] w-[160%] -translate-x-1/2 -translate-y-1/2 opacity-40"
        style={{ background: 'repeating-conic-gradient(from 0deg, rgba(244,196,48,.4) 0deg 7deg, transparent 7deg 18deg)', animation: 'winfx-spin 22s linear infinite', maskImage: 'radial-gradient(circle, black 10%, transparent 50%)', WebkitMaskImage: 'radial-gradient(circle, black 10%, transparent 50%)' }} />
      <div className="relative">
        <div className="shop-check mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500 text-ink shadow-[0_0_40px_rgba(16,185,129,.6)]"><Check size={34} strokeWidth={3} /></div>
        <h3 className="mt-4 font-display text-2xl font-black">Payment complete</h3>
        <p className="text-sm text-smoke">{usd(p.usd)} · {paidWith} <span className="text-sky-300">(demo)</span></p>
        <div className="shop-unlock-pop mx-auto mt-4 grid place-items-center"><ProductArt p={p} size={110} /></div>
        <div className="mt-3 space-y-1">
          {p.coins ? <div className="flex items-center justify-center gap-2 font-display text-3xl font-black text-gold tabular"><Coin className="h-7 w-7" />+{fmt(coins, 0)}</div> : null}
          {p.eggs ? <div className="flex items-center justify-center gap-2 font-display text-2xl font-black text-gold tabular"><Egg className="h-6 w-6" />+{fmt(eggs, 0)}</div> : null}
          {p.items?.length ? <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1 text-sm font-bold text-fuchsia-300"><Sparkles size={14} />{p.items.map((i) => itemById(i)?.name).join(' · ')} unlocked</div> : null}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2">
          {onMore ? <button type="button" className="btn-ghost py-3" onClick={onMore}>Buy more</button> : <span />}
          <button type="button" className={`btn-gold py-3 ${onMore ? '' : 'col-span-2'}`} onClick={onDone}>Done</button>
        </div>
      </div>
    </div>
  );
}
