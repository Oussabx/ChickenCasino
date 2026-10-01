/**
 * Card helpers for the coin store's checkout.
 *
 * DEMO MODE: there is no payment processor behind this app, so checkout runs
 * like a payment provider's test mode — only the published test card numbers
 * are accepted, nothing is ever charged, and a full card number or CVC is
 * never stored (saved cards keep brand, last four digits, expiry and name).
 * To take real payments, swap `charge()` for a provider such as Stripe
 * Elements, which keeps card data off this app entirely.
 */

export type Brand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown';

export interface SavedCard {
  id: string;
  brand: Brand;
  last4: string;
  expMonth: number;
  expYear: number; // 4-digit
  name: string;
  addedAt: number;
}

export const BRAND_NAME: Record<Brand, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover', unknown: 'Card' };

export const digits = (s: string) => s.replace(/\D/g, '');

export function detectBrand(num: string): Brand {
  const n = digits(num);
  if (/^4/.test(n)) return 'visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  if (/^(6011|65|64[4-9])/.test(n)) return 'discover';
  return 'unknown';
}

export const cardLength = (b: Brand) => (b === 'amex' ? 15 : 16);
export const cvcLength = (b: Brand) => (b === 'amex' ? 4 : 3);

/** 4-4-4-4, or 4-6-5 for Amex. */
export function formatNumber(raw: string) {
  const b = detectBrand(raw);
  const n = digits(raw).slice(0, cardLength(b));
  if (b === 'amex') return [n.slice(0, 4), n.slice(4, 10), n.slice(10, 15)].filter(Boolean).join(' ');
  return n.replace(/(.{4})/g, '$1 ').trim();
}

export function formatExpiry(raw: string) {
  const n = digits(raw).slice(0, 4);
  if (n.length === 1 && Number(n) > 1) return `0${n} / `;
  return n.length > 2 ? `${n.slice(0, 2)} / ${n.slice(2)}` : n;
}

export function luhn(num: string) {
  const n = digits(num);
  let sum = 0;
  for (let i = 0; i < n.length; i++) {
    let d = Number(n[n.length - 1 - i]);
    if (i % 2) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return n.length > 11 && sum % 10 === 0;
}

export function parseExpiry(v: string): { m: number; y: number } | null {
  const n = digits(v);
  if (n.length !== 4) return null;
  const m = Number(n.slice(0, 2)), y = 2000 + Number(n.slice(2));
  if (m < 1 || m > 12) return null;
  return { m, y };
}

export const isExpired = (m: number, y: number, now = new Date()) => y < now.getFullYear() || (y === now.getFullYear() && m < now.getMonth() + 1);

export interface CardForm { number: string; name: string; expiry: string; cvc: string }
export type CardErrors = Partial<Record<keyof CardForm, string>>;

export function validateCard(f: CardForm): CardErrors {
  const e: CardErrors = {};
  const b = detectBrand(f.number);
  const n = digits(f.number);
  if (!n) e.number = 'Enter your card number';
  else if (n.length < cardLength(b) || !luhn(n)) e.number = 'That card number isn’t valid';
  if (f.name.trim().length < 2) e.name = 'Enter the name on the card';
  const ex = parseExpiry(f.expiry);
  if (!ex) e.expiry = 'Use MM / YY';
  else if (isExpired(ex.m, ex.y)) e.expiry = 'This card has expired';
  if (digits(f.cvc).length !== cvcLength(b)) e.cvc = `${cvcLength(b)} digits`;
  return e;
}

/** Published test numbers (same convention as Stripe test mode). */
export const TEST_CARDS: { number: string; label: string; outcome: 'ok' | 'declined' | 'funds' }[] = [
  { number: '4242 4242 4242 4242', label: 'Visa · succeeds', outcome: 'ok' },
  { number: '5555 5555 5555 4444', label: 'Mastercard · succeeds', outcome: 'ok' },
  { number: '3782 822463 10005', label: 'Amex · succeeds', outcome: 'ok' },
  { number: '6011 1111 1111 1117', label: 'Discover · succeeds', outcome: 'ok' },
  { number: '4000 0000 0000 0002', label: 'Visa · declined', outcome: 'declined' },
  { number: '4000 0000 0000 9995', label: 'Visa · insufficient funds', outcome: 'funds' },
];

/** Demo-mode check: only test numbers are accepted, so no real card is ever entered or kept. */
export function testOutcome(num: string) {
  const n = digits(num);
  return TEST_CARDS.find((t) => digits(t.number) === n)?.outcome ?? null;
}

/**
 * "Charge" a card. Demo mode: resolves after a short processing delay, using
 * the test number's scripted outcome. Saved cards always succeed.
 */
export function charge(opts: { number?: string; saved?: SavedCard }): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (opts.saved) {
        if (isExpired(opts.saved.expMonth, opts.saved.expYear)) return resolve({ ok: false, error: 'This card has expired. Add a new one.' });
        return resolve({ ok: true });
      }
      const o = testOutcome(opts.number ?? '');
      if (o === 'ok') resolve({ ok: true });
      else if (o === 'declined') resolve({ ok: false, error: 'Your card was declined. Try another card.' });
      else if (o === 'funds') resolve({ ok: false, error: 'Insufficient funds on this card.' });
      else resolve({ ok: false, error: 'Demo checkout only accepts test cards — tap “Use a test card”.' });
    }, 1300);
  });
}

export const usd = (n: number) => `$${n.toFixed(2)}`;
