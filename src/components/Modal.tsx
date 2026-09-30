import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, children, title, wide = false }: { open: boolean; onClose: () => void; children: ReactNode; title?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92%] overflow-y-auto overscroll-contain rounded-t-3xl sm:rounded-3xl border border-white/10 bg-ink-800 shadow-2xl animate-slideUp`}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-ink-800/95 backdrop-blur px-5 pt-5 pb-3">
          <div className="font-display text-lg font-extrabold">{title}</div>
          <button onClick={onClose} className="rounded-full p-2 text-smoke hover:bg-white/5 hover:text-cream" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="px-5 pb-6">{children}</div>
      </div>
    </div>
  );
}
