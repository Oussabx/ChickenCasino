import { ReactNode } from 'react';

export default function PageHeader({ kicker, title, sub, img, right }: { kicker: string; title: ReactNode; sub?: string; img?: string; right?: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-ink-900 p-6 sm:p-10 grain">
      {img && <img src={`./img/${img}`} alt="" className="absolute right-0 top-0 h-full w-2/3 object-cover opacity-50 [mask-image:linear-gradient(to_right,transparent,black_50%)]" />}
      <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_90%_10%,rgba(230,57,70,.2),transparent)]" />
      <div className="relative flex flex-col md:flex-row md:items-end gap-4 justify-between">
        <div>
          <div className="label text-gold">{kicker}</div>
          <h1 className="h-display text-4xl sm:text-5xl mt-1">{title}</h1>
          {sub && <p className="mt-2 text-cream/70 max-w-lg">{sub}</p>}
        </div>
        {right}
      </div>
    </div>
  );
}
