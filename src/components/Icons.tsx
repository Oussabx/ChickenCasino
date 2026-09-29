import { SVGProps, useId } from 'react';

export const Coin = ({ className = 'h-4 w-4', ...p }: SVGProps<SVGSVGElement>) => {
  const id = 'g' + useId().replace(/:/g, '');
  return (
  <svg viewBox="0 0 24 24" className={className} {...p}>
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFE08A" />
        <stop offset=".55" stopColor="#F4C430" />
        <stop offset="1" stopColor="#B8860B" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="11" fill={`url(#${id})`} />
    <circle cx="12" cy="12" r="8" fill="none" stroke="#8a6500" strokeWidth="1.2" opacity=".6" />
    <path d="M9 8.5c0-.8.9-1.5 2-1.5h2c1.1 0 2 .7 2 1.5M12 6v12M9 15.5c0 .8.9 1.5 2 1.5h2c1.1 0 2-.7 2-1.5s-.9-1.5-2-1.5h-2c-1.1 0-2-.7-2-1.5S9.9 10.5 11 10.5h2"
      stroke="#6b4d00" strokeWidth="1.4" fill="none" strokeLinecap="round" />
  </svg>
  );
};

export const Egg = ({ className = 'h-4 w-4', ...p }: SVGProps<SVGSVGElement>) => {
  const id = 'g' + useId().replace(/:/g, '');
  return (
  <svg viewBox="0 0 24 24" className={className} {...p}>
    <defs>
      <radialGradient id={id} cx=".35" cy=".3" r=".8">
        <stop offset="0" stopColor="#FFF6CF" />
        <stop offset=".45" stopColor="#F4C430" />
        <stop offset="1" stopColor="#9C6B00" />
      </radialGradient>
    </defs>
    <path d="M12 2C8 2 4.5 8.5 4.5 14a7.5 7.5 0 0 0 15 0C19.5 8.5 16 2 12 2Z" fill={`url(#${id})`} />
    <ellipse cx="9.3" cy="9" rx="1.6" ry="2.6" fill="#fff" opacity=".55" transform="rotate(-20 9.3 9)" />
  </svg>
  );
};

export const Spade = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 2s-8 6.5-8 11a4 4 0 0 0 6.6 3.1L9.5 21h5l-1.1-4.9A4 4 0 0 0 20 13c0-4.5-8-11-8-11Z" /></svg>
);
export const Heart = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11Z" /></svg>
);
export const Diamond = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 2 20 12 12 22 4 12Z" /></svg>
);
export const Club = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}><circle cx="12" cy="7" r="4" /><circle cx="7" cy="13" r="4" /><circle cx="17" cy="13" r="4" /><path d="M11 13h2l1.5 8h-5Z" /></svg>
);

export const Chip = ({ color = '#E63946', className = 'h-6 w-6' }: { color?: string; className?: string }) => (
  <svg viewBox="0 0 32 32" className={className}>
    <circle cx="16" cy="16" r="15" fill={color} />
    {Array.from({ length: 8 }).map((_, i) => (
      <rect key={i} x="14" y="1" width="4" height="6" rx="1" fill="#F8F6EF" transform={`rotate(${i * 45} 16 16)`} />
    ))}
    <circle cx="16" cy="16" r="9" fill={color} stroke="#F8F6EF" strokeWidth="1.5" strokeDasharray="3 2" />
    <circle cx="16" cy="16" r="5" fill="#0B0B0B" opacity=".25" />
  </svg>
);

/** Stylised top-down/side chicken used in games. */
export const ChickenSprite = ({ body = '#F8F6EF', className = '', dead = false, flip = false }: { body?: string; className?: string; dead?: boolean; flip?: boolean }) => (
  <svg viewBox="0 0 64 64" className={className} style={flip ? { transform: 'scaleX(-1)' } : undefined}>
    <ellipse cx="32" cy="58" rx="16" ry="3.5" fill="#000" opacity=".35" />
    {/* legs */}
    <path d="M27 48v7m0 0-3 2m3-2 3 2M37 48v7m0 0-3 2m3-2 3 2" stroke="#F4C430" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    {/* tail */}
    <path d="M14 30c-6-4-6-12-2-14 1 5 5 6 8 7Z" fill={body} stroke="#0003" strokeWidth="1" />
    {/* body */}
    <ellipse cx="32" cy="36" rx="17" ry="14" fill={body} stroke="#0003" strokeWidth="1" />
    <path d="M22 36c4 6 12 7 17 2" stroke="#0002" strokeWidth="2" fill="none" strokeLinecap="round" />
    {/* head */}
    <circle cx="42" cy="20" r="10" fill={body} stroke="#0003" strokeWidth="1" />
    {/* comb */}
    <path d="M36 12c0-4 3-6 4-3 1-4 5-4 5 0 2-3 6-1 4 3Z" fill="#E63946" />
    {/* beak */}
    <path d="M50 19l8 3-8 3Z" fill="#F4C430" stroke="#b8860b" strokeWidth=".8" />
    {/* wattle */}
    <path d="M49 25c1 4-2 5-3 2Z" fill="#E63946" />
    {dead ? (
      <path d="M41 16l5 5m0-5-5 5" stroke="#0B0B0B" strokeWidth="2.2" strokeLinecap="round" />
    ) : (
      <>
        {/* sunglasses */}
        <rect x="38" y="16" width="12" height="5" rx="2.2" fill="#0B0B0B" />
        <path d="M34 17.5h5" stroke="#0B0B0B" strokeWidth="1.6" />
        <rect x="40" y="17" width="3" height="1.2" rx=".6" fill="#fff" opacity=".6" />
      </>
    )}
  </svg>
);
