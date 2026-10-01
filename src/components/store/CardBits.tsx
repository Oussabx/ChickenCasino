import { useState } from 'react';
import { Brand, BRAND_NAME, CardErrors, CardForm, SavedCard, TEST_CARDS, cvcLength, detectBrand, digits, formatExpiry, formatNumber } from '../../lib/payment';

/** Small card-network logo. */
export function BrandLogo({ brand, className = 'h-6 w-9' }: { brand: Brand; className?: string }) {
  const box = 'rounded-md grid place-items-center overflow-hidden shrink-0';
  switch (brand) {
    case 'visa':
      return <span className={`${box} bg-white ${className}`} aria-label="Visa"><svg viewBox="0 0 48 16" className="h-[55%]"><text x="24" y="13" textAnchor="middle" fontFamily="Arial Black, Arial" fontStyle="italic" fontWeight="900" fontSize="15" fill="#1a1f71">VISA</text></svg></span>;
    case 'mastercard':
      return <span className={`${box} bg-[#111] ${className}`} aria-label="Mastercard"><svg viewBox="0 0 40 24" className="h-[70%]"><circle cx="15" cy="12" r="9" fill="#eb001b" /><circle cx="25" cy="12" r="9" fill="#f79e1b" fillOpacity=".9" /><path d="M20 5 A9 9 0 0 1 20 19 A9 9 0 0 1 20 5Z" fill="#ff5f00" /></svg></span>;
    case 'amex':
      return <span className={`${box} bg-[#2e77bc] ${className}`} aria-label="American Express"><svg viewBox="0 0 48 16" className="h-[55%]"><text x="24" y="12.5" textAnchor="middle" fontFamily="Arial Black, Arial" fontWeight="900" fontSize="11" fill="#fff" letterSpacing="1">AMEX</text></svg></span>;
    case 'discover':
      return <span className={`${box} bg-white ${className}`} aria-label="Discover"><svg viewBox="0 0 60 16" className="h-[50%]"><text x="27" y="12.5" textAnchor="middle" fontFamily="Arial" fontWeight="800" fontSize="11" fill="#111">DISC</text><circle cx="45" cy="8" r="5.5" fill="#f58220" /></svg></span>;
    default:
      return <span className={`${box} border border-white/15 bg-white/5 ${className}`} aria-hidden="true"><svg viewBox="0 0 24 16" className="h-[60%]"><rect x="1" y="1" width="22" height="14" rx="2" fill="none" stroke="#8a8a8a" strokeWidth="1.5" /><rect x="1" y="4" width="22" height="3" fill="#8a8a8a" /></svg></span>;
  }
}

const GRAD: Record<Brand, string> = {
  visa: 'linear-gradient(135deg,#1a2a6c,#2b4cb3 55%,#0f1a45)',
  mastercard: 'linear-gradient(135deg,#2b2b2b,#4a2512 60%,#121212)',
  amex: 'linear-gradient(135deg,#0d6b8f,#2e9cc9 55%,#0a4b66)',
  discover: 'linear-gradient(135deg,#3a2006,#e0761c 70%,#5a2c04)',
  unknown: 'linear-gradient(135deg,#3a0b10,#1a1214 60%,#0b0b0b)',
};

/** Live card preview: fills in as you type and flips to show the CVC. */
export function CardPreview({ f, flipped }: { f: CardForm; flipped: boolean }) {
  const brand = detectBrand(f.number);
  const num = formatNumber(f.number);
  const placeholder = brand === 'amex' ? '•••• •••••• •••••' : '•••• •••• •••• ••••';
  const shown = num + placeholder.slice(num.length);
  return (
    <div className="mx-auto w-full max-w-[340px] [container-type:inline-size] [perspective:1200px]">
      <div className="relative aspect-[1.586] w-full transition-transform duration-500 [transform-style:preserve-3d]" style={{ transform: flipped ? 'rotateY(180deg)' : 'none' }}>
        {/* front */}
        <div className="absolute inset-0 overflow-hidden rounded-[5cqw] p-[6cqw] text-white shadow-[0_20px_40px_-18px_rgba(0,0,0,.9)] [backface-visibility:hidden]" style={{ background: GRAD[brand] }}>
          <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-white/5" />
          <div className="relative flex items-start justify-between">
            <div className="h-[9.5cqw] w-[13cqw] rounded-[1.6cqw] bg-gradient-to-br from-[#f6e27a] via-[#cfa83a] to-[#8a6a1a] shadow-inner" aria-hidden="true" />
            <BrandLogo brand={brand} className="h-[9.5cqw] w-[14cqw]" />
          </div>
          <div className="relative mt-[7cqw] whitespace-nowrap font-mono text-[5.8cqw] tracking-[.1em] tabular">{shown}</div>
          <div className="relative mt-[5cqw] flex items-end justify-between gap-3 text-[3cqw] uppercase tracking-wider text-white/70">
            <div className="min-w-0"><div>Card holder</div><div className="truncate text-[4.4cqw] font-semibold normal-case tracking-normal text-white">{f.name || 'Your Name'}</div></div>
            <div className="text-right"><div>Expires</div><div className="whitespace-nowrap text-[4.4cqw] font-semibold tracking-normal text-white">{f.expiry || 'MM / YY'}</div></div>
          </div>
        </div>
        {/* back */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl text-white shadow-[0_20px_40px_-18px_rgba(0,0,0,.9)] [backface-visibility:hidden] [transform:rotateY(180deg)]" style={{ background: GRAD[brand] }}>
          <div className="mt-6 h-10 bg-black/80" />
          <div className="mx-5 mt-4 flex items-center justify-end rounded bg-white/90 px-3 py-1.5 font-mono text-sm italic text-ink">{digits(f.cvc) || '•'.repeat(cvcLength(brand))}</div>
          <div className="mx-5 mt-2 text-right text-[10px] text-white/60">Security code</div>
        </div>
      </div>
    </div>
  );
}

const input = 'w-full rounded-xl border bg-ink-900 px-3.5 py-3 text-base text-cream placeholder:text-smoke/60 outline-none transition focus:border-gold/60 focus:ring-2 focus:ring-gold/20';

/** Card entry fields with live formatting, brand detection and inline errors. */
export function CardFields({ f, setF, errors, onFlip }: { f: CardForm; setF: (f: CardForm) => void; errors: CardErrors; onFlip: (b: boolean) => void }) {
  const brand = detectBrand(f.number);
  const [tests, setTests] = useState(false);
  const err = (k: keyof CardForm) => (errors[k] ? <p className="mt-1 text-xs font-semibold text-blood">{errors[k]}</p> : null);
  const ring = (k: keyof CardForm) => (errors[k] ? 'border-blood/60' : 'border-white/10');
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="cc-number" className="label">Card number</label>
          <button type="button" onClick={() => setTests((v) => !v)} className="text-xs font-bold text-gold hover:underline">{tests ? 'Hide test cards' : 'Use a test card'}</button>
        </div>
        {tests && (
          <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {TEST_CARDS.map((t) => (
              <button key={t.number} type="button" onClick={() => { setF({ ...f, number: t.number, name: f.name || 'Test Chicken', expiry: f.expiry || '12 / 30', cvc: f.cvc || (detectBrand(t.number) === 'amex' ? '1234' : '123') }); setTests(false); }}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-left text-xs hover:border-gold/40">
                <BrandLogo brand={detectBrand(t.number)} className="h-5 w-8" />
                <span className="min-w-0"><span className="block font-mono text-cream">{t.number}</span><span className={t.outcome === 'ok' ? 'text-emerald-400' : 'text-blood'}>{t.label}</span></span>
              </button>
            ))}
          </div>
        )}
        <div className="relative mt-1.5">
          <input id="cc-number" className={`${input} ${ring('number')} pr-14 font-mono tracking-wider`} inputMode="numeric" autoComplete="cc-number" placeholder="1234 1234 1234 1234"
            value={formatNumber(f.number)} onChange={(e) => setF({ ...f, number: e.target.value })} onFocus={() => onFlip(false)} aria-invalid={!!errors.number} />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"><BrandLogo brand={brand} /></span>
        </div>
        {err('number')}
      </div>
      <div>
        <label htmlFor="cc-name" className="label">Name on card</label>
        <input id="cc-name" className={`${input} ${ring('name')} mt-1.5`} autoComplete="cc-name" placeholder="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} onFocus={() => onFlip(false)} aria-invalid={!!errors.name} />
        {err('name')}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="cc-exp" className="label">Expiry</label>
          <input id="cc-exp" className={`${input} ${ring('expiry')} mt-1.5 font-mono`} inputMode="numeric" autoComplete="cc-exp" placeholder="MM / YY"
            value={f.expiry} onChange={(e) => { const v = e.target.value; setF({ ...f, expiry: v.length < f.expiry.length ? v.replace(/\s*\/\s*$/, '') : formatExpiry(v) }); }} onFocus={() => onFlip(false)} aria-invalid={!!errors.expiry} />
          {err('expiry')}
        </div>
        <div>
          <label htmlFor="cc-cvc" className="label">CVC</label>
          <input id="cc-cvc" className={`${input} ${ring('cvc')} mt-1.5 font-mono`} inputMode="numeric" autoComplete="cc-csc" placeholder={brand === 'amex' ? '4 digits' : '3 digits'}
            value={f.cvc} onChange={(e) => setF({ ...f, cvc: digits(e.target.value).slice(0, cvcLength(brand)) })} onFocus={() => onFlip(true)} onBlur={() => onFlip(false)} aria-invalid={!!errors.cvc} />
          {err('cvc')}
        </div>
      </div>
    </div>
  );
}

/** One saved card as a row. */
export function SavedCardRow({ c, isDefault, right }: { c: SavedCard; isDefault?: boolean; right?: React.ReactNode }) {
  const exp = `${String(c.expMonth).padStart(2, '0')}/${String(c.expYear).slice(-2)}`;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <BrandLogo brand={c.brand} className="h-8 w-12" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-bold"><span className="whitespace-nowrap font-mono tracking-wider">•••• {c.last4}</span>{isDefault && <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-gold">Default</span>}</div>
        <div className="truncate text-xs text-smoke">{BRAND_NAME[c.brand]} · {c.name} · Exp {exp}</div>
      </div>
      {right}
    </div>
  );
}

export const cardLabel = (c: { brand: Brand; last4: string }) => `${BRAND_NAME[c.brand]} •••• ${c.last4}`;
