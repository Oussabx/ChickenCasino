import { ReactNode } from 'react';
import { RotateCcw, Trash2, Repeat } from 'lucide-react';
import { fmt } from '../lib/format';
import { sfx } from '../lib/sound';

export const CHIP_VALUES = [1, 5, 25, 100, 500] as const;
const CHIP_STYLE: Record<number, string> = {
  1: 'bg-cream text-ink', 5: 'bg-blood text-white', 25: 'bg-emerald-500 text-ink', 100: 'bg-gold text-ink', 500: 'bg-ink-500 text-cream',
};

export function ChipToken({ value, size = 36, selected }: { value: number; size?: number; selected?: boolean }) {
  return (
    <span className={`relative grid place-items-center rounded-full font-display font-black shadow-lg ${CHIP_STYLE[value] ?? CHIP_STYLE[500]} ${selected ? 'ring-2 ring-gold ring-offset-2 ring-offset-ink-800 -translate-y-1' : ''} transition`}
      style={{ width: size, height: size, fontSize: size * 0.32, backgroundImage: 'repeating-conic-gradient(rgba(255,255,255,.55) 0 10deg, transparent 10deg 45deg)' }}>
      <span className="grid place-items-center rounded-full border-2 border-dashed border-white/60" style={{ width: size * 0.66, height: size * 0.66, background: 'inherit' }}>{value >= 1000 ? `${value / 1000}k` : value}</span>
    </span>
  );
}

/** Chip picker + clear / undo / rebet row used by chip-based table games. */
export function ChipPicker({ chip, setChip, total, onClear, onUndo, onRebet, disabled }: {
  chip: number; setChip: (v: number) => void; total: number; onClear: () => void; onUndo: () => void; onRebet?: () => void; disabled?: boolean;
}) {
  return (
    <div className={disabled ? 'pointer-events-none opacity-50' : ''}>
      <div className="flex items-center justify-between"><span className="label">Chip</span><span className="text-xs text-smoke">Total bet <b className="font-display text-cream tabular">{fmt(total)}</b></span></div>
      <div className="mt-2 flex items-center justify-between gap-1">
        {CHIP_VALUES.map((v) => (
          <button key={v} type="button" onClick={() => { sfx.click(); setChip(v); }} aria-label={`${v} chip`} aria-pressed={chip === v}>
            <ChipToken value={v} selected={chip === v} />
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <button type="button" className="btn-dark py-2 text-xs" onClick={onUndo}><RotateCcw size={13} />Undo</button>
        <button type="button" className="btn-dark py-2 text-xs" onClick={onClear}><Trash2 size={13} />Clear</button>
        <button type="button" className="btn-dark py-2 text-xs" onClick={onRebet} disabled={!onRebet}><Repeat size={13} />Rebet</button>
      </div>
    </div>
  );
}

/** A clickable betting area showing the chips placed on it. */
export function BetSpot({ label, sub, amount, onClick, className = '', disabled, highlight, children }: {
  label: ReactNode; sub?: ReactNode; amount: number; onClick: () => void; className?: string; disabled?: boolean; highlight?: 'win' | 'lose' | null; children?: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`relative rounded-xl border-2 px-2 py-2 text-center transition active:scale-[.97] disabled:cursor-default ${highlight === 'win' ? 'border-gold bg-gold/15 shadow-gold' : highlight === 'lose' ? 'border-white/10 opacity-60' : 'border-white/15 bg-black/30 hover:border-gold/50'} ${className}`}>
      <div className="font-display text-sm font-black leading-tight">{label}</div>
      {sub && <div className="text-[10px] text-smoke">{sub}</div>}
      {children}
      {amount > 0 && (
        <span className="absolute -right-2 -top-2 animate-pop rounded-full bg-gold px-1.5 py-0.5 font-display text-[10px] font-black text-ink shadow-gold tabular">{fmt(amount, 0)}</span>
      )}
    </button>
  );
}
