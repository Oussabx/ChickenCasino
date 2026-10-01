import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

/**
 * In-app confirmation dialog (replaces the browser's window.confirm, which
 * looks out of place and can't follow the rotated phone game layer).
 */
interface Ask { title: string; body?: string; confirm?: string; cancel?: string; danger?: boolean }
interface ConfirmState {
  ask: (Ask & { resolve: (ok: boolean) => void }) | null;
  hosts: number[];
}
const useConfirm = create<ConfirmState>(() => ({ ask: null, hosts: [] }));

export function ask(a: Ask): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirm.getState().ask?.resolve(false);
    useConfirm.setState({ ask: { ...a, resolve } });
  });
}

let hostSeq = 0;
/**
 * Renders the dialog. Mounted by the layout and again inside game screens;
 * only the most recently mounted host draws it, so on a phone game it lives in
 * the (possibly rotated) game layer.
 */
export function ConfirmHost() {
  const id = useRef(++hostSeq).current;
  useEffect(() => {
    useConfirm.setState((s) => ({ hosts: [...s.hosts, id] }));
    return () => useConfirm.setState((s) => ({ hosts: s.hosts.filter((h) => h !== id) }));
  }, [id]);
  const a = useConfirm((s) => s.ask);
  const top = useConfirm((s) => s.hosts[s.hosts.length - 1] === id);
  if (!top || !a) return null;
  const done = (ok: boolean) => { useConfirm.setState({ ask: null }); a.resolve(ok); };
  return (
    <Modal open onClose={() => done(false)} title={<span className="flex items-center gap-2">{a.danger && <AlertTriangle size={18} className="text-blood" />}{a.title}</span>}>
      {a.body && <p className="text-sm text-cream/80">{a.body}</p>}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" className="btn-ghost py-3" onClick={() => done(false)}>{a.cancel ?? 'Cancel'}</button>
        <button type="button" autoFocus className={`${a.danger ? 'btn-red' : 'btn-gold'} py-3`} onClick={() => done(true)}>{a.confirm ?? 'Confirm'}</button>
      </div>
    </Modal>
  );
}

// ---- replay the action that needed confirming ----
let lastClick: { el: HTMLElement; at: number } | null = null;
let lastKey: { key: string; code: string; at: number } | null = null;
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement | null)?.closest?.('button, [role=button], a') as HTMLElement | null;
    if (el) lastClick = { el, at: performance.now() };
  }, true);
  window.addEventListener('keydown', (e) => { if (e.isTrusted) lastKey = { key: e.key, code: e.code, at: performance.now() }; }, true);
}
/** Re-run whatever the user just did (button click or key press). */
export function captureReplay(): () => void {
  const c = lastClick, k = lastKey;
  if (c && (!k || c.at >= k.at)) return () => { if (c.el.isConnected) c.el.click(); };
  if (k) return () => window.dispatchEvent(new KeyboardEvent('keydown', { key: k.key, code: k.code, bubbles: true }));
  return () => {};
}
