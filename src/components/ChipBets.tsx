import { ReactNode } from 'react';
import { RotateCcw, Trash2, Repeat } from 'lucide-react';
import { fmt } from '../lib/format';
import { sfx } from '../lib/sound';
import { useStore } from '../store';
import { chipColor } from '../lib/equipped';

export const CHIP_VALUES = [1, 5, 25, 100, 500] as const;
/** Roulette's high-roller chips, 100 up to a million. */
export const BIG_CHIPS = [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000];
/** Chip value meaning "everything I have left". */
export const ALL_IN = -1;
const chipLabel = (v: number) => (v >= 1e6 ? `${v / 1e6}M` : v >= 1000 ? `${v / 1000}k` : String(v));

/** A chip in the player's equipped chip set. */
export function ChipToken({ value, size = 36, selected }: { value: number; size?: number; selected?: boolean }) {
  useStore((s) => s.equipped.chips); // re-render when the chip set changes
  if (value === ALL_IN) return (
    <span className={`relative grid place-items-center rounded-full bg-gradient-to-b from-[#ff5a6a] to-[#8e1320] font-display font-black text-white shadow-lg transition ${selected ? 'ring-2 ring-gold ring-offset-2 ring-offset-ink-800 -translate-y-1 shadow-[0_0_16px_rgba(230,57,70,.8)]' : ''}`}
      style={{ width: size, height: size, fontSize: size * 0.24, lineHeight: 1 }}>
      <span className="grid place-items-center rounded-full border-2 border-dashed border-white/60 text-center" style={{ width: size * 0.74, height: size * 0.74 }}>ALL<br />IN</span>
    </span>
  );
  const c = chipColor(value);
  return (
    <span className={`relative grid place-items-center rounded-full font-display font-black shadow-lg ${selected ? 'ring-2 ring-gold ring-offset-2 ring-offset-ink-800 -translate-y-1' : ''} transition`}
      style={{ width: size, height: size, backgroundColor: c.css, backgroundImage: `repeating-conic-gradient(${c.stripeCss}cc 0 10deg, transparent 10deg 45deg)`, boxShadow: c.glow ? `0 0 ${size * 0.35}px ${c.css}` : undefined }}>
      {/* a light centre disc so the value reads on every chip colour */}
      <span className="grid place-items-center rounded-full leading-none tracking-tight text-[#111]"
        style={{ width: size * 0.68, height: size * 0.68, background: 'radial-gradient(circle at 50% 35%, #ffffff, #ece6d6)', boxShadow: `inset 0 0 0 ${Math.max(1.5, size * 0.05)}px ${c.css}, 0 1px 2px rgba(0,0,0,.45)`, fontSize: size * (chipLabel(value).length >= 4 ? 0.23 : chipLabel(value).length === 3 ? 0.27 : 0.3) }}>{chipLabel(value)}</span>
    </span>
  );
}

/** Chip picker + clear / undo / rebet row used by chip-based table games. */
export function ChipPicker({ chip, setChip, total, onClear, onUndo, onRebet, disabled, values = CHIP_VALUES as readonly number[], allIn }: {
  chip: number; setChip: (v: number) => void; total: number; onClear: () => void; onUndo: () => void; onRebet?: () => void; disabled?: boolean; values?: readonly number[]; allIn?: boolean;
}) {
  const list = allIn ? [...values, ALL_IN] : values;
  return (
    <div className={disabled ? 'pointer-events-none opacity-50' : ''}>
      <div className="flex items-center justify-between"><span className="label">Chip</span><span className="text-xs text-smoke">Total bet <b className="font-display text-cream tabular">{fmt(total)}</b></span></div>
      <div className={`mt-2 ${list.length > 6 ? 'grid grid-cols-5 justify-items-center gap-x-1 gap-y-2.5' : 'flex items-center justify-between gap-1'}`}>
        {list.map((v) => (
          <button key={v} type="button" onClick={() => { sfx.click(); setChip(v); }} aria-label={v === ALL_IN ? 'All-in chip' : `${v} chip`} aria-pressed={chip === v}>
            <ChipToken value={v} selected={chip === v} size={list.length > 6 ? 40 : 36} />
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
      className={`relative min-w-0 rounded-xl border-2 px-1.5 py-2.5 text-center transition active:scale-[.97] disabled:cursor-default ${highlight === 'win' ? 'border-gold bg-gold/15 shadow-gold' : highlight === 'lose' ? 'border-white/10 opacity-60' : 'border-white/15 bg-black/30 hover:border-gold/50'} ${className}`}>
      <div className="truncate whitespace-nowrap font-display text-[13px] font-black leading-tight">{label}</div>
      {sub && <div className="mt-0.5 whitespace-nowrap text-[10px] font-semibold text-smoke">{sub}</div>}
      {children}
      {amount > 0 && (
        <span className="absolute -right-2 -top-2 animate-pop rounded-full bg-gold px-1.5 py-0.5 font-display text-[10px] font-black text-ink shadow-gold tabular">{fmt(amount, 0)}</span>
      )}
    </button>
  );
}

/** One-line chip selector + undo/clear for the phone action bar. */
export function ChipRow({ chip, setChip, onUndo, onClear, disabled, values = CHIP_VALUES as readonly number[], allIn }: { chip: number; setChip: (v: number) => void; onUndo: () => void; onClear: () => void; disabled?: boolean; values?: readonly number[]; allIn?: boolean }) {
  const list = allIn ? [...values, ALL_IN] : values;
  return (
    <div className={`flex items-center gap-1.5 ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
      <div className="no-scrollbar -my-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1.5">
        {list.map((v) => (
          <button key={v} type="button" className="shrink-0" onClick={() => { sfx.click(); setChip(v); }} aria-label={v === ALL_IN ? 'All-in chip' : `${v} chip`} aria-pressed={chip === v}>
            <ChipToken value={v} size={32} selected={chip === v} />
          </button>
        ))}
      </div>
      <button type="button" className="btn-dark h-9 w-9 shrink-0 !p-0" onClick={onUndo} aria-label="Undo"><RotateCcw size={15} /></button>
      <button type="button" className="btn-dark h-9 w-9 shrink-0 !p-0" onClick={onClear} aria-label="Clear"><Trash2 size={15} /></button>
    </div>
  );
}
