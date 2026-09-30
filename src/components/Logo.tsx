import { Link } from 'react-router-dom';

export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const img = size === 'lg' ? 'h-14 w-14' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const t = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-sm' : 'text-lg';
  return (
    <Link to="/" className="group flex items-center gap-2 shrink-0" aria-label="Chicken Casino home">
      <img src="./img/head.webp" alt="" className={`${img} rounded-full object-cover ring-2 ring-gold/0 group-hover:ring-gold/60 transition duration-500 group-hover:rotate-[-12deg] group-hover:scale-110`} />
      <div className="leading-none">
        <div className={`font-display font-black tracking-tight text-cream ${t}`}>CHICKEN</div>
        <div className="flex items-center gap-1 font-display font-black text-gold text-[0.62em]" style={{ fontSize: size === 'lg' ? 14 : size === 'sm' ? 8 : 10 }}>
          <span className="h-[2px] w-2.5 bg-gold rounded" />
          <span className="tracking-[.2em]">CASINO</span>
          <span className="h-[2px] w-2.5 bg-gold rounded" />
        </div>
      </div>
    </Link>
  );
}
