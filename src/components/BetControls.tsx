import { useStore } from '../store';
import { Coin } from './Icons';
import { sfx } from '../lib/sound';

/** Standard bet-amount input with quick modifiers. */
export default function BetControls({ value, onChange, disabled, label = 'Bet amount' }: { value: number; onChange: (v: number) => void; disabled?: boolean; label?: string }) {
  const balance = useStore((s) => s.balance);
  const set = (v: number) => { sfx.click(); onChange(Math.max(0, +v.toFixed(2))); };
  return (
    <div>
      <div className="flex justify-between"><span className="label">{label}</span></div>
      <div className={`mt-1.5 flex items-center rounded-xl border border-white/10 bg-ink-900 pl-3 focus-within:border-gold/60 ${disabled ? 'opacity-50' : ''}`}>
        <Coin className="h-5 w-5 shrink-0" />
        <input
          type="number" inputMode="decimal" min={0} step="any" disabled={disabled}
          className="w-full bg-transparent px-2 py-2.5 font-display font-bold tabular outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
          aria-label={label}
        />
        <div className="flex gap-1 pr-1">
          <button type="button" disabled={disabled} onClick={() => set(value / 2)} className="rounded-lg bg-ink-600 px-2.5 py-1.5 text-xs font-bold hover:bg-ink-500">½</button>
          <button type="button" disabled={disabled} onClick={() => set(Math.min(balance, value * 2 || 1))} className="rounded-lg bg-ink-600 px-2.5 py-1.5 text-xs font-bold hover:bg-ink-500">2×</button>
          <button type="button" disabled={disabled} onClick={() => set(Math.floor(balance * 100) / 100)} className="rounded-lg bg-ink-600 px-2.5 py-1.5 text-xs font-bold hover:bg-ink-500">Max</button>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {[10, 50, 100, 500].map((v) => (
          <button key={v} type="button" disabled={disabled} onClick={() => set(v)} className={`rounded-lg border py-1 text-xs font-semibold transition ${value === v ? 'border-gold/60 text-gold bg-gold/10' : 'border-white/5 bg-ink-700 text-smoke hover:text-cream'}`}>{v}</button>
        ))}
      </div>
    </div>
  );
}

export function Seg<T extends string | number>({ options, value, onChange, disabled, render }: { options: readonly T[]; value: T; onChange: (v: T) => void; disabled?: boolean; render?: (v: T) => string }) {
  return (
    <div className={`seg ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {options.map((o) => (
        <button key={String(o)} type="button" data-active={o === value} onClick={() => { sfx.click(); onChange(o); }}>
          {render ? render(o) : String(o)}
        </button>
      ))}
    </div>
  );
}

/** Returns true if the bet should proceed (asks for confirmation above the user's threshold). */
export function confirmBet(amount: number) {
  const t = useStore.getState().settings.confirmOver;
  if (t > 0 && amount >= t) return window.confirm(`Confirm bet of ${amount.toLocaleString()} coins?`);
  return true;
}

/** Compact bet stepper for the pinned mobile action bar. */
export function MiniBet({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const balance = useStore((s) => s.balance);
  const set = (v: number) => { sfx.click(); onChange(Math.max(0, +v.toFixed(2))); };
  return (
    <div className={`flex items-center gap-2 rounded-xl border border-white/10 bg-ink-800/95 p-1.5 pl-3 backdrop-blur ${disabled ? 'opacity-60' : ''}`}>
      <Coin className="h-4 w-4 shrink-0" />
      <input type="number" inputMode="decimal" min={0} step="any" disabled={disabled} value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(Math.max(0, parseFloat(e.target.value) || 0))} aria-label="Bet amount"
        className="min-w-0 flex-1 bg-transparent font-display text-sm font-bold tabular outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
      <button type="button" disabled={disabled} onClick={() => set(value / 2)} className="rounded-lg bg-ink-600 px-3 py-1.5 text-xs font-bold">½</button>
      <button type="button" disabled={disabled} onClick={() => set(Math.min(balance, value * 2 || 1))} className="rounded-lg bg-ink-600 px-3 py-1.5 text-xs font-bold">2×</button>
    </div>
  );
}
