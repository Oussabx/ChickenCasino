import { useState } from 'react';
import { CreditCard, Plus, Star, Trash2 } from 'lucide-react';
import Modal from '../Modal';
import { CardErrors, CardForm, detectBrand, digits, isExpired, parseExpiry, testOutcome, validateCard } from '../../lib/payment';
import { sfx } from '../../lib/sound';
import { toast, useStore } from '../../store';
import { CardFields, CardPreview, SavedCardRow, cardLabel } from './CardBits';
import { DemoNotice } from './Checkout';

const EMPTY: CardForm = { number: '', name: '', expiry: '', cvc: '' };

/** Add a card to the account (demo: test cards only; keeps brand, last four, expiry, name). */
export function AddCardModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [f, setF] = useState<CardForm>(EMPTY);
  const [errors, setErrors] = useState<CardErrors>({});
  const [flip, setFlip] = useState(false);
  const [makeDefault, setMakeDefault] = useState(false);
  const [error, setError] = useState('');
  const reset = () => { setF(EMPTY); setErrors({}); setError(''); setFlip(false); setMakeDefault(false); };
  const close = () => { reset(); onClose(); };
  const submit = () => {
    const e = validateCard(f);
    setErrors(e);
    if (Object.keys(e).length) { setError('Check the highlighted fields.'); sfx.lose(); return; }
    const brand = detectBrand(f.number);
    // demo mode: only test numbers can be saved, so no real card details ever enter the app
    const isTest = testOutcome(f.number) !== null;
    if (!isTest) { setError('Demo mode only accepts test cards — tap “Use a test card”.'); sfx.lose(); return; }
    const ex = parseExpiry(f.expiry)!;
    const s = useStore.getState();
    useStore.getState().addCard({ brand, last4: digits(f.number).slice(-4), expMonth: ex.m, expYear: ex.y, name: f.name.trim() }, makeDefault || !s.cards.length);
    sfx.click();
    toast({ title: `${cardLabel({ brand, last4: digits(f.number).slice(-4) })} saved`, tone: 'gold' });
    close();
  };
  return (
    <Modal open={open} onClose={close} title={<span className="flex items-center gap-2"><CreditCard size={18} className="text-gold" />Add a card</span>}>
      <div className="space-y-4">
        <CardPreview f={f} flipped={flip} />
        <CardFields f={f} setF={(v) => { setF(v); if (Object.keys(errors).length) setErrors(validateCard(v)); }} errors={errors} onFlip={setFlip} />
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} className="h-4 w-4 accent-[#F4C430]" />
          Make this my default card
        </label>
        {error && <div role="alert" className="rounded-xl border border-blood/40 bg-blood/10 px-3 py-2.5 text-sm font-semibold text-[#ff8a95]">{error}</div>}
        <button type="button" className="btn-gold w-full py-3.5" onClick={submit}><Plus size={16} />Save card</button>
        <DemoNotice />
      </div>
    </Modal>
  );
}

/** Saved cards on the account: add, make default, remove. */
export default function PaymentMethods() {
  const cards = useStore((s) => s.cards);
  const def = useStore((s) => s.defaultCard);
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const toRemove = cards.find((c) => c.id === confirm);
  return (
    <section id="payment-methods" className="card scroll-mt-24 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2 font-display text-base font-extrabold sm:text-lg"><CreditCard size={18} className="shrink-0 text-gold" /><span className="truncate">Payment methods</span></h2>
        <button type="button" className="btn-ghost shrink-0 whitespace-nowrap px-3 py-2 text-xs sm:px-3.5 sm:text-sm" onClick={() => setAdding(true)}><Plus size={15} />Add card</button>
      </div>
      {cards.length ? (
        <ul className="mt-3 space-y-2">
          {cards.map((c) => {
            const expired = isExpired(c.expMonth, c.expYear);
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-ink-900/60 p-3 sm:flex-nowrap">
                <SavedCardRow c={c} isDefault={c.id === def} />
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  {expired && <span className="rounded-full bg-blood/15 px-2 py-0.5 text-[10px] font-black uppercase text-blood">Expired</span>}
                  {c.id !== def && !expired && (
                    <button type="button" onClick={() => { useStore.getState().setDefaultCard(c.id); sfx.click(); toast({ title: `${cardLabel(c)} is now your default`, tone: 'gold' }); }}
                      className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-bold text-cream/80 hover:border-gold/40 hover:text-gold"><Star size={13} />Make default</button>
                  )}
                  <button type="button" onClick={() => setConfirm(c.id)} aria-label={`Remove ${cardLabel(c)}`}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-smoke hover:border-blood/50 hover:text-blood"><Trash2 size={14} /></button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-white/15 p-6 text-center">
          <CreditCard className="mx-auto text-smoke" />
          <p className="mt-2 text-sm text-smoke">No saved cards yet. Add one here, or tick “Save this card” at checkout.</p>
        </div>
      )}
      <AddCardModal open={adding} onClose={() => setAdding(false)} />
      <Modal open={!!toRemove} onClose={() => setConfirm(null)} title="Remove card?">
        {toRemove && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-ink-900/60 p-3"><SavedCardRow c={toRemove} isDefault={toRemove.id === def} /></div>
            <p className="text-sm text-smoke">You can add it again any time.</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn-ghost py-3" onClick={() => setConfirm(null)}>Keep it</button>
              <button type="button" className="btn-red py-3" onClick={() => { useStore.getState().removeCard(toRemove.id); setConfirm(null); toast({ title: 'Card removed', tone: 'neutral' }); }}><Trash2 size={15} />Remove</button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
