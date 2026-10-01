import { useToasts } from '../store';

const TONE = {
  gold: 'border-gold/40 bg-gradient-to-r from-gold/15 to-ink-800',
  red: 'border-blood/40 bg-gradient-to-r from-blood/20 to-ink-800',
  green: 'border-emerald-400/40 bg-gradient-to-r from-emerald-500/15 to-ink-800',
  neutral: 'border-white/10 bg-ink-800',
};

export default function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[90] flex flex-col-reverse items-center gap-2 px-3 lg:bottom-auto lg:top-[72px] lg:flex-col lg:items-end lg:right-4 lg:left-auto" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto w-full max-w-sm text-left rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur animate-slideUp ${TONE[t.tone ?? 'neutral']}`}
        >
          <div className="font-display text-sm font-bold">{t.title}</div>
          {t.desc && <div className="text-xs text-smoke mt-0.5">{t.desc}</div>}
        </button>
      ))}
    </div>
  );
}
