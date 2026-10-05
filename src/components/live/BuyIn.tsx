import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import Modal from '../Modal';
import { Coin } from '../Icons';
import { fmt, fmtCompact } from '../../lib/format';
import { LiveTable, hex } from '../../lib/net/tables';
import { useStore, useUI } from '../../store';
import { usePhoneGame } from '../../lib/phone';

/**
 * Pick how many coins to bring to the table (between the table's minimum and maximum buy-in),
 * or — with `addTo` (your current stack) — how many more to add, up to the table maximum.
 */
export default function BuyIn({ table, open, onClose, onConfirm, addTo }: { table: LiveTable; open: boolean; onClose: () => void; onConfirm: (buy: number) => void; addTo?: number }) {
  const balance = useStore((s) => s.balance);
  const signedIn = useStore((s) => !!s.user);
  const adding = addTo !== undefined;
  const step = table.game === 'poker' ? table.hi : table.lo;
  const room = adding ? Math.floor((table.buyMax - addTo) / step) * step : table.buyMax;
  const lo = adding ? step : table.buyMin;
  const max = Math.min(room, Math.floor(balance));
  const full = adding && room < lo;
  const short = !full && balance < lo;
  const snap = (v: number) => Math.min(max, Math.max(lo, Math.round(v / step) * step));
  const [buy, setBuy] = useState(lo);
  useEffect(() => { if (open) setBuy(snap(adding ? Math.min(max, table.buyMin) : Math.min(max, table.buyMin * 4))); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const bigBlinds = Math.round(buy / table.hi);
  // inside the sideways phone game the dialog has little height: keep it tight
  const tight = usePhoneGame();
  const presets: [string, number][] = adding ? [['Min', lo], ['¼', room * 0.25], ['½', room * 0.5], ['Max', room]] : [['Min', table.buyMin], ['¼', table.buyMax * 0.25], ['½', table.buyMax * 0.5], ['Max', table.buyMax]];
  return (
    <Modal open={open} onClose={onClose} title={`${adding ? 'Add chips' : 'Buy in'} · ${table.name}`}>
      <div className="rounded-2xl p-[1.5px]" style={{ background: `linear-gradient(135deg, ${hex(table.theme.trim)}, transparent 60%)` }}>
        <div className={`rounded-[15px] bg-ink-900 ${tight ? 'p-3' : 'p-4'}`}>
          <div className="flex items-center justify-between text-xs text-smoke">
            <span>{table.game === 'poker' ? `Blinds ${fmtCompact(table.lo)}/${fmtCompact(table.hi)}` : `Bets ${fmtCompact(table.lo)}–${fmtCompact(table.hi)}`}</span>
            <span>{adding ? <>Your chips {fmtCompact(addTo)} · table max {fmtCompact(table.buyMax)}</> : <>Range {fmtCompact(table.buyMin)} – {fmtCompact(table.buyMax)}</>}</span>
          </div>
          {full ? (
            <div className="mt-4 text-center">
              <div className="font-display text-lg font-black">You’re at the table maximum</div>
              <p className="mt-1 text-sm text-smoke">You can have up to {fmt(table.buyMax, 0)} in front of you here.</p>
              <button type="button" className="btn-dark mt-4 w-full py-3" onClick={onClose}>OK</button>
            </div>
          ) : short ? (
            <div className="mt-4 text-center">
              <div className="font-display text-lg font-black">You need {fmt(lo - balance, 0)} more coins</div>
              <p className="mt-1 text-sm text-smoke">{adding ? `You can add ${fmt(lo, 0)} at a time here.` : `The minimum buy-in here is ${fmt(table.buyMin, 0)}.`}</p>
              <button type="button" className="btn-gold mt-4 w-full py-3" onClick={() => { onClose(); if (signedIn) useUI.getState().openStore({ tab: 'coins' }); else useUI.getState().openAuth('signup'); }}>{signedIn ? 'Get coins' : 'Sign up to play'}</button>
            </div>
          ) : (
            <>
              <div className={`${tight ? 'mt-2' : 'mt-3'} flex items-center gap-2`}>
                <button type="button" className="btn-dark h-11 w-11 shrink-0 !p-0" onClick={() => setBuy(snap(buy - step * Math.max(1, Math.round(table.buyMin / step / 2))))} aria-label="Less"><Minus size={16} /></button>
                <div className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-black/40 py-2">
                  <Coin className="h-6 w-6" />
                  <span className="font-display text-2xl font-black text-gold tabular">{fmt(buy, 0)}</span>
                </div>
                <button type="button" className="btn-dark h-11 w-11 shrink-0 !p-0" onClick={() => setBuy(snap(buy + step * Math.max(1, Math.round(table.buyMin / step / 2))))} aria-label="More"><Plus size={16} /></button>
              </div>
              <input type="range" className="mt-3 w-full accent-[#F4C430]" min={lo} max={max} step={step} value={buy} onChange={(e) => setBuy(snap(+e.target.value))} aria-label={adding ? 'Chips to add' : 'Buy-in amount'} />
              <div className="mt-1 flex justify-between text-[11px] text-smoke tabular"><span>{fmt(lo, 0)}</span><span>{fmt(max, 0)}</span></div>
              <div className={`${tight ? 'mt-2' : 'mt-3'} grid grid-cols-4 gap-1.5`}>
                {presets.map(([l, v]) => {
                  const val = snap(v);
                  return <button key={l} type="button" onClick={() => setBuy(val)} disabled={v > max && l !== 'Max'} className={`rounded-lg py-2 text-xs font-bold transition disabled:opacity-35 ${buy === val ? 'bg-gold text-ink' : 'bg-ink-700 text-smoke hover:text-cream'}`}>{l}</button>;
                })}
              </div>
              {!tight && adding && <p className="mt-3 text-center text-xs text-smoke">{table.game === 'poker' ? 'Added between hands' : 'Added right away'} · you’ll have {fmt(addTo + buy, 0)} in front of you</p>}
              {!tight && !adding && table.game === 'poker' && <p className="mt-3 text-center text-xs text-smoke">{bigBlinds} big blinds · you keep whatever you leave with</p>}
              {!tight && !adding && table.game === 'blackjack' && <p className="mt-3 text-center text-xs text-smoke">Enough for {Math.floor(buy / table.lo)} minimum bets · cash out any time between rounds</p>}
              <button type="button" className={`btn-gold w-full py-3 text-base ${tight ? 'mt-3' : 'mt-4'}`} onClick={() => onConfirm(buy)}>{adding ? `Add ${fmtCompact(buy)} chips` : `Sit down with ${fmtCompact(buy)}`}</button>
              <div className={`${tight ? 'mt-1' : 'mt-2'} text-center text-[11px] text-smoke`}>Wallet after{adding ? '' : ' buy-in'}: <b className="text-cream tabular">{fmt(balance - buy, 0)}</b></div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
