import { useId, useMemo } from 'react';
import { CHICKENS, CHIPSETS, ChickenStyle, DECKS, EGGS, HATS, HatKind, TABLES } from '../lib/cosmetics';
import { deckBackUrl } from '../lib/deckSvg';
import { ShopItem, itemById } from '../lib/data';
import { useStore } from '../store';
import { NAME_CLASS } from './Avatar';

/** Thumbnail colours for each win show. */
const FX_THUMB: Record<string, { bg: string; ray: string; text: string; glow: string }> = {
  'fx-classic': { bg: 'radial-gradient(circle,#7a4f00,#1a1205)', ray: 'rgba(244,196,48,.35)', text: 'linear-gradient(180deg,#fff1a8,#f4c430,#c98a00)', glow: 'rgba(244,196,48,.25)' },
  'fx-royal': { bg: 'radial-gradient(circle,#7c3aed,#1e0b3a)', ray: 'rgba(244,196,48,.3)', text: 'linear-gradient(180deg,#fff1a8,#f4c430)', glow: 'rgba(192,132,252,.45)' },
  'fx-inferno': { bg: 'radial-gradient(circle,#ff5a1f,#3a0703 70%)', ray: 'rgba(255,214,90,.4)', text: 'linear-gradient(180deg,#fff7c2,#ffb347,#ff3d00)', glow: 'rgba(255,90,31,.6)' },
  'fx-galaxy': { bg: 'radial-gradient(circle,#6d28d9,#05031a 70%)', ray: 'rgba(56,189,248,.3)', text: 'linear-gradient(180deg,#ffffff,#c4b5fd,#f472b6)', glow: 'rgba(167,139,250,.55)' },
  'fx-diamond': { bg: 'radial-gradient(circle,#0e7490,#041821 70%)', ray: 'rgba(224,242,254,.35)', text: 'linear-gradient(180deg,#ffffff,#a5f3fc,#38bdf8)', glow: 'rgba(125,211,252,.55)' },
};

/**
 * Vector art for every collectible. Crisp at any size, animated with CSS
 * (idle bob, tail wag, twinkles). Used by the shop, the locker and previews.
 */

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

// ======================= CHICKEN =======================
export function ChickenArt({ skin = 'ch-classic', hat = 'hat-none', size = 160, animate = true, className = '' }: { skin?: string; hat?: string; size?: number; animate?: boolean; className?: string }) {
  const st: ChickenStyle = CHICKENS[skin] ?? CHICKENS['ch-classic'];
  const h: HatKind = HATS[hat] ?? 'none';
  const uid = useId().replace(/:/g, '');
  const g = (n: string) => `${n}${uid}`;
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={`overflow-visible ${className}`}
      style={st.glow ? { filter: `drop-shadow(0 0 ${size * 0.06}px ${st.glow})` } : undefined} aria-hidden="true">
      <defs>
        {st.skin === 'holo' ? (
          <linearGradient id={g('body')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a5f3fc" /><stop offset=".3" stopColor="#c7d2fe" /><stop offset=".55" stopColor="#f0abfc" /><stop offset=".8" stopColor="#fde68a" /><stop offset="1" stopColor="#bbf7d0" /></linearGradient>
        ) : st.skin === 'chrome' ? (
          <linearGradient id={g('body')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff6c8" /><stop offset=".28" stopColor="#ffd84d" /><stop offset=".5" stopColor="#8a5a00" /><stop offset=".6" stopColor="#ffe9a0" /><stop offset=".85" stopColor="#b8860b" /><stop offset="1" stopColor="#5c3b00" /></linearGradient>
        ) : (
          <radialGradient id={g('body')} cx="38%" cy="30%" r="80%"><stop offset="0" stopColor={st.body[0]} /><stop offset="1" stopColor={st.body[1]} /></radialGradient>
        )}
        {st.outfit === 'phoenix' && <linearGradient id={g('fire')} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#d61f00" /><stop offset=".45" stopColor="#ff7a1a" /><stop offset="1" stopColor="#ffe07a" /></linearGradient>}
        <clipPath id={g('clip')}><ellipse cx="100" cy="128" rx="56" ry="46" /><circle cx="126" cy="74" r="32" /><ellipse cx="118" cy="100" rx="26" ry="22" /></clipPath>
        <clipPath id={g('torso')}><ellipse cx="100" cy="128" rx="56" ry="46" /></clipPath>
        <filter id={g('glow')} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <ellipse cx="100" cy="188" rx="46" ry="7" fill="rgba(0,0,0,.35)" />
      <g className={animate ? 'cos-bob' : ''}>
        {/* legs */}
        <g stroke={st.legs} strokeWidth="5" strokeLinecap="round" fill="none">
          <path d="M88 164 V182 M80 186 L88 182 L96 186 M88 182 V188" />
          <path d="M114 164 V182 M106 186 L114 182 L122 186 M114 182 V188" />
        </g>
        {st.outfit === 'phoenix' && <PhoenixFlames fire={`url(#${g('fire')})`} animate={animate} />}
        {/* tail */}
        <g className={animate ? 'cos-wag' : ''} style={{ transformOrigin: '62px 122px' }}>
          <path d="M66 118 Q30 96 40 66 Q58 84 74 106Z" fill={st.wing} />
          <path d="M60 124 Q20 116 22 86 Q44 98 70 116Z" fill={st.body[1]} />
          <path d="M70 110 Q52 76 66 50 Q78 76 80 104Z" fill={st.body[0]} opacity=".9" />
        </g>
        {/* body, neck, head */}
        <ellipse cx="100" cy="128" rx="56" ry="46" fill={`url(#${g('body')})`} />
        <ellipse cx="118" cy="100" rx="26" ry="22" fill={`url(#${g('body')})`} />
        <ellipse cx="114" cy="142" rx="34" ry="26" fill={st.belly} opacity=".85" />
        <Outfit st={st} g={g} part="body" />
        {/* wing */}
        <path d="M60 118 Q84 98 110 116 Q104 152 74 148 Q56 140 60 118Z" fill={st.outfit === 'phoenix' ? `url(#${g('fire')})` : st.wing} stroke="rgba(0,0,0,.12)" strokeWidth="1.5" />
        <path d="M70 128 Q84 124 96 130 M72 138 Q84 134 94 140" stroke="rgba(0,0,0,.14)" strokeWidth="2" fill="none" strokeLinecap="round" />
        {h === 'chain' && <Hat h={h} />}
        {/* comb (under most hats) */}
        <g fill={st.comb}><circle cx="113" cy="46" r="9" /><circle cx="126" cy="40" r="11" /><circle cx="139" cy="46" r="9" /></g>
        <circle cx="126" cy="74" r="32" fill={`url(#${g('body')})`} />
        {st.facets && <Facets clip={g('clip')} />}
        {st.skin && <SkinFinish skin={st.skin} clip={g('clip')} animate={animate} />}
        <Outfit st={st} g={g} part="head" />
        {/* beak + wattle */}
        <path d="M154 70 L177 78 L154 87Z" fill={st.beak} stroke="rgba(0,0,0,.25)" strokeWidth="1.5" strokeLinejoin="round" />
        <ellipse cx="153" cy="93" rx="6" ry="9" fill={st.comb} />
        <EyesArt st={st} g={g} animate={animate} />
        {h !== 'chain' && h !== 'none' && <Hat h={h} />}
        <Outfit st={st} g={g} part="top" />
      </g>
      {st.sparkle && animate && <Sparkles color={st.sparkle} />}
    </svg>
  );
}

function Facets({ clip }: { clip: string }) {
  return (
    <g clipPath={`url(#${clip})`} stroke="rgba(255,255,255,.55)" strokeWidth="1.3" fill="none">
      <path d="M44 120 L80 90 L120 112 L156 96 M60 160 L92 132 L132 150 L156 128 M92 132 L80 90 M120 112 L132 150 M100 44 L126 74 L152 52 M98 92 L126 74 L156 98" />
      <path d="M80 90 L92 132 L120 112Z" fill="rgba(255,255,255,.18)" />
      <path d="M126 74 L152 52 L156 98Z" fill="rgba(255,255,255,.14)" />
    </g>
  );
}

function EyesArt({ st, g, animate }: { st: ChickenStyle; g: (n: string) => string; animate: boolean }) {
  switch (st.eyes) {
    case 'shades':
      return (
        <g>
          <path d="M114 60 H162 Q165 60 164 64 L161 76 Q160 82 153 82 H143 Q137 82 136 76 L135 70 H130 L129 76 Q128 82 121 82 H113 Q107 82 107 76 L107 66 Q107 60 114 60Z" fill="#0b0b0b" />
          <path d="M114 65 H125" stroke="#fff" strokeOpacity=".7" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
    case 'eye':
      return (
        <g className={animate ? 'cos-blink' : ''} style={{ transformOrigin: '140px 70px' }}>
          <circle cx="140" cy="70" r="8" fill="#fff" stroke="rgba(0,0,0,.2)" />
          <circle cx="142" cy="70" r="4.5" fill="#111" /><circle cx="143.5" cy="68.5" r="1.6" fill="#fff" />
        </g>
      );
    case 'visor':
      return <rect x="112" y="60" width="52" height="16" rx="8" fill={st.accent ?? '#22d3ee'} filter={`url(#${g('glow')})`} opacity=".95" />;
    case 'skull':
      return <g><ellipse cx="140" cy="70" rx="9" ry="10" fill="#050505" /><circle cx="141" cy="70" r="2.5" fill="#f1ede1" /></g>;
    case 'patch':
      return (
        <g>
          <path d="M98 56 L160 86" stroke="#111" strokeWidth="3" />
          <ellipse cx="141" cy="71" rx="10" ry="9" fill="#111" />
        </g>
      );
    case 'mask':
      return (
        <g>
          <rect x="96" y="60" width="66" height="18" rx="6" fill={st.accent ?? '#e63946'} />
          <path d="M132 69 Q140 64 150 69" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        </g>
      );
    case 'glow': {
      const c = st.accent && st.outfit !== 'phoenix' ? st.accent : st.outfit === 'phoenix' ? '#fff1a8' : '#ff1f3d';
      return (
        <g filter={`url(#${g('glow')})`} fill={c}>
          <path d="M126 64 L146 68 L144 75 L127 72Z" />
          <path d="M150 66 L164 64 L163 72 L150 74Z" opacity=".9" />
        </g>
      );
    }
    case 'stars':
      return (
        <g fill="#f472b6" stroke="#831843" strokeWidth="1.5" strokeLinejoin="round">
          <path d="M122 58 L126 66 L135 67 L128 73 L130 82 L122 77 L114 82 L116 73 L109 67 L118 66Z" />
          <path d="M149 58 L153 66 L162 67 L155 73 L157 82 L149 77 L141 82 L143 73 L136 67 L145 66Z" />
          <path d="M131 70 H140" stroke="#831843" strokeWidth="2.5" />
        </g>
      );
  }
}

/** Outfits are drawn in three layers: over the body, over the head, and on top of everything. */
function Outfit({ st, g, part }: { st: ChickenStyle; g: (n: string) => string; part: 'body' | 'head' | 'top' }) {
  const a = st.accent ?? '#b3192a';
  const torso = `url(#${g('torso')})`;
  switch (st.outfit) {
    case 'suit':
    case 'tux': {
      if (part !== 'body') return null;
      const jacket = st.outfit === 'tux' ? '#111' : st.body[1] === '#d99a00' ? '#141414' : '#26262b';
      return (
        <g>
          <g clipPath={torso}>
            <rect x="40" y="102" width="130" height="80" fill={jacket} />
            {st.outfit === 'suit' && <g stroke="rgba(255,255,255,.12)" strokeWidth="1.5">{Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${48 + i * 10} 100 V180`} />)}</g>}
            <path d="M104 100 L118 150 L134 100Z" fill="#f8f6ef" />
            <path d="M100 100 L118 150 L108 158 L94 104Z M136 100 L118 150 L128 158 L142 104Z" fill={st.outfit === 'tux' ? '#2a2a2a' : '#1a1a1e'} />
          </g>
          {st.outfit === 'suit'
            ? <path d="M114 104 L122 104 L124 112 L118 140 L112 112Z" fill={a} />
            : <g fill={a}><path d="M106 104 L118 110 L106 116Z" /><path d="M130 104 L118 110 L130 116Z" /><circle cx="118" cy="110" r="3.5" /></g>}
          <circle cx="118" cy="126" r="2" fill="#f8f6ef" opacity=".8" /><circle cx="118" cy="136" r="2" fill="#f8f6ef" opacity=".8" />
        </g>
      );
    }
    case 'cowboy':
      if (part !== 'body') return null;
      return (
        <g>
          <g clipPath={torso}><path d="M40 110 H96 L104 180 H40Z M140 110 H170 V180 H130Z" fill="#7a4a22" /><path d="M40 110 H96 L104 180" stroke="#5a3415" strokeWidth="3" fill="none" /></g>
          <path d="M98 98 Q118 112 142 98 L124 128Z" fill={a} /><g fill="#fff"><circle cx="112" cy="106" r="1.8" /><circle cx="122" cy="112" r="1.8" /><circle cx="130" cy="104" r="1.8" /></g>
        </g>
      );
    case 'space':
      if (part === 'body') return (
        <g>
          <g clipPath={torso}><rect x="40" y="100" width="130" height="80" fill="#eef0f4" /><path d="M40 150 H170" stroke="#cbd5e1" strokeWidth="3" /></g>
          <rect x="104" y="118" width="26" height="18" rx="3" fill={a} /><circle cx="111" cy="127" r="3" fill="#22d3ee" /><circle cx="122" cy="127" r="3" fill="#f87171" />
          <path d="M100 102 Q120 110 142 102" stroke="#cbd5e1" strokeWidth="6" fill="none" strokeLinecap="round" />
        </g>
      );
      if (part === 'top') return (
        <g>
          <circle cx="128" cy="68" r="46" fill="rgba(186,230,253,.18)" stroke="rgba(255,255,255,.85)" strokeWidth="3" />
          <path d="M98 44 Q110 30 128 28" stroke="#fff" strokeOpacity=".8" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M150 24 L158 8" stroke="#94a3b8" strokeWidth="3" /><circle cx="158" cy="8" r="4" fill="#f87171" />
        </g>
      );
      return null;
    case 'robe':
      if (part === 'body') return (
        <g>
          <g clipPath={torso}><path d="M40 100 H84 Q76 150 96 180 H40Z M150 100 H170 V180 H140 Q156 150 150 100Z" fill={a} /></g>
          <path d="M92 104 Q120 122 148 104 Q148 96 140 94 Q120 104 100 94 Q92 96 92 104Z" fill="#f8f6ef" />
          <g fill="#111">{[98, 108, 120, 132, 142].map((x, i) => <circle key={x} cx={x} cy={100 + (i % 2) * 4} r="1.6" />)}</g>
          <circle cx="120" cy="112" r="4" fill="#f4c430" stroke="#a86b00" />
        </g>
      );
      return null;
    case 'armor':
      if (part === 'body') return (
        <g>
          <g clipPath={torso}>
            {[112, 128, 144, 160].map((y) => <g key={y}><rect x="40" y={y} width="130" height="13" fill={a} /><rect x="40" y={y + 11} width="130" height="2.5" fill="#5a0b12" /></g>)}
            {[60, 90, 120, 150].map((x) => [118, 134, 150].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.8" fill="#f4c430" />))}
          </g>
          <path d="M56 112 Q80 100 104 112 L100 126 Q80 118 60 126Z" fill="#7a0f18" stroke="#f4c430" strokeWidth="1.5" />
        </g>
      );
      if (part === 'head') return <path d="M96 56 Q126 46 158 58" stroke="#f8f6ef" strokeWidth="6" fill="none" strokeLinecap="round" />;
      return null;
    case 'cyber':
      if (part === 'body') return (
        <g filter={`url(#${g('glow')})`} stroke={a} strokeWidth="2" fill="none" strokeLinecap="round">
          <path d="M56 130 H80 L88 120 H104 M70 150 H96 L104 160 H128 M120 120 L130 132 H150" />
          <circle cx="104" cy="120" r="2.5" fill={a} /><circle cx="128" cy="160" r="2.5" fill={a} /><circle cx="150" cy="132" r="2.5" fill={a} />
        </g>
      );
      if (part === 'head') return <path d="M104 92 L116 84 H134" stroke={a} strokeWidth="2" fill="none" filter={`url(#${g('glow')})`} />;
      return null;
    case 'bones':
      if (part === 'body') return (
        <g stroke={a} strokeWidth="4" fill="none" strokeLinecap="round" opacity=".9">
          <path d="M100 104 V164" />
          {[116, 128, 140, 152].map((y, i) => <path key={y} d={`M${100 - 26 + i * 2} ${y} Q100 ${y - 8} ${126 - i * 2} ${y}`} />)}
        </g>
      );
      if (part === 'head') return <path d="M118 88 h4 M126 88 h4 M134 88 h4" stroke={a} strokeWidth="3" strokeLinecap="round" />;
      return null;
    case 'pirate':
      if (part === 'body') return <g clipPath={torso}>{[118, 134, 150, 166].map((y) => <rect key={y} x="40" y={y} width="130" height="8" fill={a} opacity=".85" />)}</g>;
      if (part === 'top') return (
        <g>
          <path d="M96 52 Q126 30 158 52 Q128 46 96 52Z" fill={a} />
          <path d="M98 52 Q90 58 86 70 M98 52 Q88 54 80 60" stroke={a} strokeWidth="5" strokeLinecap="round" fill="none" />
          <g fill="#fff"><circle cx="116" cy="44" r="2" /><circle cx="130" cy="40" r="2" /><circle cx="144" cy="45" r="2" /></g>
        </g>
      );
      return null;
    case 'zombie':
      if (part === 'body') return (
        <g stroke={a} strokeWidth="2.5" strokeLinecap="round">
          <path d="M70 120 L96 136 M76 118 l-4 6 M84 124 l-4 6 M92 129 l-4 6" />
          <path d="M118 150 L146 140 M126 152 l-2 -7 M134 149 l-2 -7 M142 146 l-2 -7" />
          <path d="M60 156 Q70 148 80 160 Q72 166 60 156Z" fill="#3e6131" stroke="none" />
        </g>
      );
      if (part === 'head') return <path d="M110 92 L124 86 M114 86 l2 6 M120 84 l2 6" stroke={a} strokeWidth="2.5" strokeLinecap="round" />;
      return null;
    case 'lava':
      if (part === 'body' || part === 'head') return (
        <g stroke={a} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${g('glow')})`} className="cos-pulse">
          {part === 'body' ? <path d="M60 120 L76 132 L70 146 L88 156 M104 108 L112 126 L130 132 L126 150 L142 160 M146 118 L136 128" /> : <path d="M106 66 L116 78 L112 92 M140 92 L132 98" />}
        </g>
      );
      return null;
    case 'frost':
      if (part === 'body') return (
        <g>
          <g fill="#e0f2fe" stroke="#7dd3fc" strokeWidth="1"><path d="M70 170 L74 184 L78 170Z" /><path d="M96 173 L99 186 L102 173Z" /><path d="M124 171 L127 182 L130 171Z" /></g>
          <g stroke="#ffffff" strokeWidth="2" strokeLinecap="round">{[[78, 130], [124, 150], [140, 122]].map(([x, y]) => <path key={x} d={`M${x - 6} ${y} H${x + 6} M${x} ${y - 6} V${y + 6} M${x - 4} ${y - 4} L${x + 4} ${y + 4} M${x + 4} ${y - 4} L${x - 4} ${y + 4}`} />)}</g>
        </g>
      );
      return null;
    case 'ninja':
      if (part === 'top') return <path d="M98 66 Q84 64 70 74 M98 70 Q86 74 76 86" stroke={a} strokeWidth="5" strokeLinecap="round" fill="none" />;
      return null;
    case 'disco':
      if (part === 'body') return (
        <g clipPath={torso} opacity=".55">
          {Array.from({ length: 9 }, (_, r) => Array.from({ length: 14 }, (_, c) => (
            <rect key={`${r}-${c}`} x={42 + c * 9} y={84 + r * 10} width="8" height="9" fill={(r + c) % 3 === 0 ? '#ffffff' : (r + c) % 3 === 1 ? '#f0abfc' : '#c084fc'} className={(r * 7 + c) % 5 === 0 ? 'cos-twinkle' : ''} style={{ animationDelay: `${((r * 3 + c) % 7) * 0.2}s` }} />
          )))}
        </g>
      );
      return null;
    default:
      return null;
  }
}

function Hat({ h }: { h: HatKind }) {
  const cg = `crownG${useId().replace(/:/g, '')}`; // unique per drawing (duplicate ids break gradients)
  switch (h) {
    case 'halo':
      return (
        <g style={{ filter: 'drop-shadow(0 0 6px rgba(255,226,122,.95))' }}>
          <ellipse cx="126" cy="20" rx="30" ry="8" fill="none" stroke="#fff1a8" strokeWidth="6" />
          <ellipse cx="126" cy="20" rx="30" ry="8" fill="none" stroke="#f4c430" strokeWidth="2.5" />
        </g>
      );
    case 'horns':
      return (
        <g stroke="#4c0519" strokeWidth="2" strokeLinejoin="round">
          <path d="M102 48 Q86 30 96 6 Q102 26 116 40Z" fill="#dc2626" />
          <path d="M150 48 Q166 30 156 6 Q150 26 136 40Z" fill="#dc2626" />
          <path d="M98 30 Q96 18 98 12 M154 30 Q156 18 154 12" stroke="#fca5a5" strokeWidth="2.5" fill="none" />
        </g>
      );
    case 'diamondcrown':
      return (
        <g stroke="#1e3a8a" strokeWidth="2" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 5px rgba(125,211,252,.9))' }}>
          <path d="M98 50 L94 12 L112 30 L126 2 L140 30 L158 12 L154 50Z" fill="#e0f2fe" />
          <path d="M94 12 L112 30 L126 50 M126 2 L126 50 M158 12 L140 30 L126 50" stroke="#7dd3fc" strokeWidth="1.5" fill="none" />
          <rect x="97" y="42" width="58" height="9" rx="2" fill="#bae6fd" />
          <path d="M120 40 L126 32 L132 40 L126 50Z" fill="#a855f7" /><circle cx="108" cy="46" r="3" fill="#f472b6" stroke="none" /><circle cx="144" cy="46" r="3" fill="#f472b6" stroke="none" />
          <circle cx="94" cy="12" r="3" fill="#fff" /><circle cx="126" cy="2" r="3.5" fill="#fff" /><circle cx="158" cy="12" r="3" fill="#fff" />
        </g>
      );
    case 'wizard':
      return (
        <g>
          <ellipse cx="126" cy="46" rx="36" ry="8" fill="#3b0764" />
          <path d="M100 46 Q118 30 120 2 Q130 -4 158 18 Q140 14 138 22 Q148 34 152 46Z" fill="#6d28d9" />
          <path d="M100 44 Q126 52 152 44 L152 38 Q126 46 100 38Z" fill="#f4c430" />
          {[[118, 22, 3], [134, 30, 2.4], [126, 12, 2]].map(([x, y, r], i) => <path key={i} d={`M${x} ${y - r * 2} L${x + r * 0.6} ${y - r * 0.6} L${x + r * 2} ${y} L${x + r * 0.6} ${y + r * 0.6} L${x} ${y + r * 2} L${x - r * 0.6} ${y + r * 0.6} L${x - r * 2} ${y} L${x - r * 0.6} ${y - r * 0.6}Z`} fill="#fde68a" />)}
        </g>
      );
    case 'pharaoh':
      return (
        <g stroke="#3a2600" strokeWidth="1.5" strokeLinejoin="round">
          <path d="M94 76 L98 30 Q126 12 154 30 L158 76 L150 96 L146 58 Q126 50 106 58 L102 96Z" fill="#f4c430" />
          {[38, 48, 58, 68, 80].map((y) => <path key={y} d={`M${97 + (y - 30) * 0.05} ${y} Q126 ${y - 14} ${155 - (y - 30) * 0.05} ${y}`} stroke="#1d4ed8" strokeWidth="4" fill="none" />)}
          <path d="M120 30 Q126 18 132 30 L130 40 L122 40Z" fill="#16a34a" />
        </g>
      );
    case 'tophat':
      return (
        <g>
          <ellipse cx="126" cy="46" rx="30" ry="7" fill="#111" />
          <path d="M108 46 V12 Q108 6 114 6 H138 Q144 6 144 12 V46Z" fill="#161616" />
          <rect x="108" y="34" width="36" height="8" fill="#b3192a" />
          <path d="M114 12 V34" stroke="rgba(255,255,255,.18)" strokeWidth="4" />
        </g>
      );
    case 'crown':
      return (
        <g stroke="#7a4f00" strokeWidth="2" strokeLinejoin="round">
          <path d="M100 50 L96 16 L112 32 L126 8 L140 32 L156 16 L152 50Z" fill={`url(#${cg})`} />
          <defs><linearGradient id={cg} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff1a8" /><stop offset=".5" stopColor="#f4c430" /><stop offset="1" stopColor="#c98a00" /></linearGradient></defs>
          <rect x="99" y="42" width="54" height="9" rx="2" fill="#d99a00" />
          <circle cx="126" cy="46" r="3.5" fill="#e63946" stroke="none" /><circle cx="110" cy="46" r="2.8" fill="#22d3ee" stroke="none" /><circle cx="142" cy="46" r="2.8" fill="#22d3ee" stroke="none" />
          <circle cx="96" cy="16" r="3" fill="#fff8d6" /><circle cx="126" cy="8" r="3.5" fill="#fff8d6" /><circle cx="156" cy="16" r="3" fill="#fff8d6" />
        </g>
      );
    case 'cowboy':
      return (
        <g>
          <path d="M84 48 Q126 60 170 46 Q166 40 158 42 Q126 50 92 42 Q86 42 84 48Z" fill="#7a4a22" />
          <path d="M102 44 Q100 14 126 14 Q152 14 150 44 Q126 50 102 44Z" fill="#8b5a2b" />
          <path d="M126 16 Q122 28 126 40" stroke="#5a3415" strokeWidth="3" fill="none" />
          <path d="M102 38 Q126 44 150 38 L150 44 Q126 50 102 44Z" fill="#3a2414" />
        </g>
      );
    case 'chef':
      return (
        <g stroke="rgba(0,0,0,.12)" strokeWidth="1.5">
          <rect x="108" y="28" width="38" height="22" rx="3" fill="#fbfbf8" />
          <circle cx="112" cy="22" r="13" fill="#ffffff" /><circle cx="128" cy="14" r="15" fill="#ffffff" /><circle cx="144" cy="22" r="13" fill="#ffffff" />
          <path d="M116 32 V48 M126 32 V48 M136 32 V48" stroke="rgba(0,0,0,.08)" />
        </g>
      );
    case 'viking':
      return (
        <g>
          <path d="M92 40 Q76 30 80 6 Q88 24 102 30Z" fill="#f1ede1" stroke="#a8a29e" strokeWidth="1.5" />
          <path d="M160 40 Q176 30 172 6 Q164 24 150 30Z" fill="#f1ede1" stroke="#a8a29e" strokeWidth="1.5" />
          <path d="M96 50 Q96 16 126 16 Q156 16 156 50Z" fill="#9ca3af" />
          <path d="M96 50 Q96 16 126 16" stroke="rgba(255,255,255,.4)" strokeWidth="3" fill="none" />
          <rect x="94" y="42" width="64" height="9" rx="2" fill="#c98a00" /><path d="M126 18 V42" stroke="#c98a00" strokeWidth="5" />
          {[104, 116, 136, 148].map((x) => <circle key={x} cx={x} cy="46.5" r="1.8" fill="#7a4f00" />)}
        </g>
      );
    case 'santa':
      return (
        <g>
          <path d="M98 46 Q104 6 140 10 Q160 14 166 34 Q150 22 140 28 Q150 36 152 46Z" fill="#d62839" />
          <rect x="94" y="40" width="62" height="12" rx="6" fill="#ffffff" />
          <circle cx="166" cy="36" r="8" fill="#ffffff" />
        </g>
      );
    case 'headphones':
      return (
        <g>
          <path d="M98 76 Q94 30 128 28 Q162 30 158 70" stroke="#111" strokeWidth="7" fill="none" strokeLinecap="round" />
          <path d="M98 76 Q94 30 128 28" stroke="#ff2bd6" strokeWidth="2" fill="none" />
          <rect x="88" y="66" width="20" height="28" rx="8" fill="#111" /><rect x="91" y="70" width="14" height="20" rx="6" fill="#ff2bd6" />
        </g>
      );
    case 'sombrero':
      return (
        <g>
          <ellipse cx="126" cy="48" rx="56" ry="11" fill="#e8c47a" stroke="#a87b2a" strokeWidth="2" />
          <path d="M106 46 Q106 12 126 12 Q146 12 146 46Z" fill="#f2d48f" stroke="#a87b2a" strokeWidth="2" />
          <path d="M106 38 Q126 44 146 38" stroke="#e63946" strokeWidth="5" fill="none" />
          <path d="M76 50 l6 -4 l6 4 l6 -4 l6 4 M152 50 l6 -4 l6 4 l6 -4" stroke="#10b981" strokeWidth="2.5" fill="none" />
        </g>
      );
    case 'gradcap':
      return (
        <g>
          <path d="M106 36 Q106 50 126 50 Q146 50 146 36Z" fill="#111" />
          <path d="M92 32 L126 18 L160 32 L126 46Z" fill="#1c1c1c" stroke="#000" strokeWidth="1.5" />
          <circle cx="126" cy="32" r="3" fill="#f4c430" />
          <path d="M126 32 Q150 34 154 52" stroke="#f4c430" strokeWidth="2.5" fill="none" /><path d="M150 52 h8 l-2 12 h-4z" fill="#f4c430" />
        </g>
      );
    case 'chain':
      return (
        <g>
          <path d="M100 100 Q122 128 148 102" stroke="#c98a00" strokeWidth="7" fill="none" strokeLinecap="round" />
          <path d="M100 100 Q122 128 148 102" stroke="#ffe27a" strokeWidth="3" fill="none" strokeDasharray="4 3" strokeLinecap="round" />
          <circle cx="123" cy="122" r="10" fill="#f4c430" stroke="#7a4f00" strokeWidth="2" />
          <text x="123" y="126.5" textAnchor="middle" fontSize="12" fontWeight="900" fill="#7a4f00" fontFamily="Montserrat, Arial">$</text>
        </g>
      );
    default:
      return null;
  }
}

/** Mythic body finishes, clipped to the silhouette. */
function SkinFinish({ skin, clip, animate }: { skin: 'galaxy' | 'holo' | 'chrome'; clip: string; animate: boolean }) {
  if (skin === 'galaxy') {
    return (
      <g clipPath={`url(#${clip})`}>
        <ellipse cx="82" cy="118" rx="40" ry="24" fill="#f472b6" opacity=".28" />
        <ellipse cx="128" cy="150" rx="36" ry="18" fill="#38bdf8" opacity=".25" />
        <ellipse cx="132" cy="70" rx="22" ry="14" fill="#c084fc" opacity=".3" />
        {GALAXY_STARS.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={0.55 + (i % 4) * 0.12} />)}
      </g>
    );
  }
  if (skin === 'holo') {
    return (
      <g clipPath={`url(#${clip})`}>
        <path d="M40 60 L60 60 L170 190 L150 190Z M90 40 L100 40 L200 160 L190 160Z" fill="#fff" opacity=".35" />
        <rect className={animate ? 'cos-sheen' : ''} x="-40" y="20" width="34" height="200" fill="#fff" opacity=".55" transform="skewX(-20)" />
      </g>
    );
  }
  return (
    <g clipPath={`url(#${clip})`} fill="none" stroke="#fffbe6" strokeLinecap="round">
      <path d="M62 110 Q90 92 128 102" strokeWidth="5" opacity=".75" />
      <path d="M70 150 Q100 166 138 156" strokeWidth="3" opacity=".45" />
      <path d="M108 56 Q122 46 140 50" strokeWidth="4" opacity=".8" />
      <rect className={animate ? 'cos-sheen' : ''} x="-40" y="20" width="22" height="200" fill="#fff" stroke="none" opacity=".5" transform="skewX(-20)" />
    </g>
  );
}
const GALAXY_STARS: [number, number, number][] = (() => {
  let s = 5; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 34 }, () => [40 + r() * 130, 40 + r() * 135, 0.6 + r() * 1.6] as [number, number, number]);
})();

/** Phoenix fire: plumes behind the body that flicker on live stages. */
function PhoenixFlames({ fire, animate }: { fire: string; animate: boolean }) {
  return (
    <g className={animate ? 'cos-flicker' : ''} style={{ transformOrigin: '80px 150px' }}>
      <path d="M78 140 Q20 120 14 60 Q34 84 44 80 Q30 40 48 10 Q58 52 70 58 Q66 30 84 12 Q86 60 96 96Z" fill={fire} opacity=".95" />
      <path d="M70 150 Q24 150 6 118 Q30 126 40 120 Q26 104 28 86 Q48 112 74 122Z" fill={fire} opacity=".85" />
      <path d="M80 124 Q54 96 60 64 Q70 84 80 88 Q78 66 90 52 Q92 86 98 104Z" fill="#fff1a8" opacity=".7" />
    </g>
  );
}

function Sparkles({ color }: { color: string }) {
  const pts = [[40, 40, 7], [170, 34, 5], [178, 128, 6], [28, 140, 5], [150, 172, 4]];
  return (
    <g fill={color}>
      {pts.map(([x, y, r], i) => (
        <path key={i} className="cos-twinkle" style={{ animationDelay: `${i * 0.35}s`, transformOrigin: `${x}px ${y}px` }}
          d={`M${x} ${y - r * 2} L${x + r * 0.5} ${y - r * 0.5} L${x + r * 2} ${y} L${x + r * 0.5} ${y + r * 0.5} L${x} ${y + r * 2} L${x - r * 0.5} ${y + r * 0.5} L${x - r * 2} ${y} L${x - r * 0.5} ${y - r * 0.5}Z`} />
      ))}
    </g>
  );
}

// ======================= CHIPS =======================
export function ChipArt({ set = 'cp-classic', denom = 3, size = 60, label, className = '' }: { set?: string; denom?: number; size?: number; label?: string; className?: string }) {
  const t = CHIPSETS[set] ?? CHIPSETS['cp-classic'];
  const col = t.colors[Math.max(0, Math.min(5, denom))];
  const uid = useId().replace(/:/g, '');
  const text = label ?? ['1', '5', '25', '100', '500', '1K'][denom];
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden="true"
      style={t.glow ? { filter: `drop-shadow(0 0 ${size * 0.12}px ${col})` } : undefined}>
      <defs>
        <radialGradient id={`c${uid}`} cx="40%" cy="35%" r="75%"><stop offset="0" stopColor="#fff" stopOpacity=".35" /><stop offset=".45" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".25" /></radialGradient>
        {t.rainbow && <linearGradient id={`r${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f87171" /><stop offset=".25" stopColor="#facc15" /><stop offset=".5" stopColor="#4ade80" /><stop offset=".75" stopColor="#38bdf8" /><stop offset="1" stopColor="#a78bfa" /></linearGradient>}
      </defs>
      <circle cx="50" cy="50" r="48" fill={t.rainbow ? `url(#r${uid})` : col} />
      {Array.from({ length: 8 }, (_, i) => <rect key={i} x="45" y="2" width="10" height="16" rx="2" fill={t.stripe} transform={`rotate(${i * 45} 50 50)`} />)}
      <circle cx="50" cy="50" r="31" fill={t.rainbow ? `url(#r${uid})` : col} stroke={t.stripe} strokeWidth="2.5" strokeDasharray="5 4" />
      <circle cx="50" cy="50" r="48" fill={`url(#c${uid})`} />
      <text x="50" y="57" textAnchor="middle" fontFamily="Montserrat, Arial" fontWeight="900" fontSize={text.length > 2 ? 18 : 22} fill={t.text}>{text}</text>
    </svg>
  );
}

/** A small fanned row + stack — how a chip set reads at a glance. */
export function ChipSetArt({ set, size = 150 }: { set: string; size?: number }) {
  const c = size * 0.36;
  return (
    <div className="relative" style={{ width: size, height: size * 0.8 }}>
      {[0, 1, 2, 3, 4, 5].map((d, i) => (
        <div key={d} className="absolute cos-chip-pop" style={{ left: size * 0.06 + i * size * 0.11, top: size * 0.08 + Math.abs(i - 2.5) * size * 0.04, transform: `rotate(${(i - 2.5) * 8}deg)`, animationDelay: `${i * 60}ms`, zIndex: i }}>
          <ChipArt set={set} denom={d} size={c} />
        </div>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <div key={`s${i}`} className="absolute" style={{ left: size * 0.36, top: size * 0.46 - i * size * 0.045, zIndex: 10 + i }}>
          <ChipArt set={set} denom={3} size={c} className="drop-shadow-lg" />
        </div>
      ))}
    </div>
  );
}

// ======================= CARDS =======================
export function CardBack({ deck = 'dk-classic', width = 60, className = '' }: { deck?: string; width?: number; className?: string }) {
  const url = useMemo(() => deckBackUrl(deck), [deck]);
  return <img src={url} alt="" draggable={false} className={`block rounded-[8%] shadow-[0_6px_16px_-4px_rgba(0,0,0,.7)] ${className}`} style={{ width, height: width * 1.4 }} />;
}

/** A face card in a deck's style (ace of spades + ace of hearts). */
export function CardFace({ deck = 'dk-classic', width = 60, suit = 'S' }: { deck?: string; width?: number; suit?: 'S' | 'H' }) {
  const d = DECKS[deck] ?? DECKS['dk-classic'];
  const col = suit === 'H' ? d.red : d.black;
  return (
    <svg viewBox="0 0 100 140" width={width} height={width * 1.4} className="block drop-shadow-[0_6px_10px_rgba(0,0,0,.6)]" aria-hidden="true">
      <rect x="1" y="1" width="98" height="138" rx="8" fill={d.paper} stroke={d.frame} strokeWidth="2" />
      <text x="10" y="24" fontFamily="Montserrat, Arial" fontWeight="900" fontSize="20" fill={col}>A</text>
      {suit === 'S'
        ? <path d="M50 38 C40 52 24 62 24 76 C24 86 32 92 40 92 C45 92 48 89 49 86 C48 94 44 98 40 100 H60 C56 98 52 94 51 86 C52 89 55 92 60 92 C68 92 76 86 76 76 C76 62 60 52 50 38Z" fill={col} />
        : <path d="M50 100 C38 90 22 80 22 64 C22 52 31 46 40 46 C45 46 49 50 50 55 C51 50 55 46 60 46 C69 46 78 52 78 64 C78 80 62 90 50 100Z" fill={col} />}
    </svg>
  );
}

export function DeckArt({ deck, size = 150 }: { deck: string; size?: number }) {
  const w = size * 0.42;
  return (
    <div className="relative" style={{ width: size, height: size * 0.8 }}>
      <div className="absolute cos-card-l" style={{ left: size * 0.12, top: size * 0.06 }}><CardBack deck={deck} width={w} /></div>
      <div className="absolute cos-card-r" style={{ left: size * 0.44, top: size * 0.1 }}><CardFace deck={deck} width={w} suit="H" /></div>
    </div>
  );
}

// ======================= TABLES =======================
export function TableArt({ table = 'tb-classic', chips, deck, size = 170 }: { table?: string; chips?: string; deck?: string; size?: number }) {
  const t = TABLES[table] ?? TABLES['tb-classic'];
  const uid = useId().replace(/:/g, '');
  const felt = hex(t.felt), edge = hex(t.edge), rail = hex(t.rail), trim = hex(t.trim);
  const W = size, H = size * 0.72;
  return (
    <div className="relative" style={{ width: W, height: H }}>
      <svg viewBox="0 0 200 144" width={W} height={H} className="absolute inset-0" aria-hidden="true"
        style={t.glow ? { filter: `drop-shadow(0 0 ${size * 0.05}px ${hex(t.glow)})` } : undefined}>
        <defs>
          <radialGradient id={`f${uid}`} cx="50%" cy="40%" r="70%"><stop offset="0" stopColor={felt} /><stop offset="1" stopColor={edge} /></radialGradient>
          <linearGradient id={`r${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".25" /><stop offset=".5" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".35" /></linearGradient>
          <clipPath id={`k${uid}`}><path d="M18 22 H182 V74 A82 62 0 0 1 18 74Z" /></clipPath>
          {t.pattern === 'grid' && <pattern id={`p${uid}`} width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0 H0 V12" fill="none" stroke={t.ink} strokeOpacity=".22" strokeWidth=".8" /></pattern>}
          {t.pattern === 'damask' && <pattern id={`p${uid}`} width="16" height="16" patternUnits="userSpaceOnUse"><path d="M8 1 L13 8 L8 15 L3 8Z" fill="none" stroke={t.ink} strokeOpacity=".22" strokeWidth=".9" /></pattern>}
          {t.pattern === 'chicken' && <pattern id={`p${uid}`} width="22" height="22" patternUnits="userSpaceOnUse"><g fill={t.ink} fillOpacity=".16"><ellipse cx="8" cy="10" rx="4.5" ry="5" /><circle cx="11.5" cy="5" r="2.6" /></g></pattern>}
          {(t.pattern === 'sparkle' || t.pattern === 'stars') && <pattern id={`p${uid}`} width="20" height="20" patternUnits="userSpaceOnUse"><path d="M10 6 L11 9 L14 10 L11 11 L10 14 L9 11 L6 10 L9 9Z" fill={t.ink} fillOpacity=".3" /></pattern>}
        </defs>
        {/* rail */}
        <path d="M8 16 H192 V74 A92 70 0 0 1 8 74Z" fill={rail} />
        <path d="M8 16 H192 V74 A92 70 0 0 1 8 74Z" fill={`url(#r${uid})`} />
        {/* felt */}
        <path d="M18 22 H182 V74 A82 62 0 0 1 18 74Z" fill={`url(#f${uid})`} />
        {t.pattern && <rect x="0" y="0" width="200" height="144" fill={`url(#p${uid})`} clipPath={`url(#k${uid})`} />}
        <path d="M24 26 H176 V74 A76 56 0 0 1 24 74Z" fill="none" stroke={trim} strokeWidth="1.6" strokeOpacity=".9" />
        <path id={`a${uid}`} d="M48 70 A56 40 0 0 0 152 70" fill="none" />
        <text fontFamily="Montserrat, Arial" fontWeight="900" fontSize="9" letterSpacing="1.5" fill={t.ink} fillOpacity=".85"><textPath href={`#a${uid}`} startOffset="50%" textAnchor="middle">CHICKEN CASINO</textPath></text>
        <ellipse cx="100" cy="104" rx="11" ry="7" fill="none" stroke={t.ink} strokeOpacity=".5" strokeWidth="1.3" />
      </svg>
      {deck && <div className="absolute" style={{ left: W * 0.36, top: H * 0.16 }}><CardBack deck={deck} width={W * 0.13} /></div>}
      {deck && <div className="absolute" style={{ left: W * 0.5, top: H * 0.16 }}><CardFace deck={deck} width={W * 0.13} /></div>}
      {chips && [0, 1, 2].map((i) => <div key={i} className="absolute" style={{ left: W * 0.44, top: H * 0.66 - i * W * 0.018 }}><ChipArt set={chips} denom={3} size={W * 0.12} /></div>)}
    </div>
  );
}

// ======================= EGGS =======================
export function EggArt({ egg, size = 110, cracked = 0, className = '' }: { egg: string; size?: number; cracked?: number; className?: string }) {
  const e = EGGS.find((x) => x.id === egg) ?? EGGS[0];
  const uid = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 100 124" width={size} height={size * 1.24} className={`overflow-visible ${className}`} aria-hidden="true"
      style={{ filter: `drop-shadow(0 0 ${size * 0.1}px ${e.id === 'egg-basic' ? 'rgba(255,255,255,.15)' : e.shell[0]}88)` }}>
      <defs>
        <radialGradient id={`e${uid}`} cx="36%" cy="28%" r="80%"><stop offset="0" stopColor={e.shell[0]} /><stop offset="1" stopColor={e.shell[1]} /></radialGradient>
      </defs>
      <path d="M50 4 C78 4 92 52 92 76 C92 104 72 120 50 120 C28 120 8 104 8 76 C8 52 22 4 50 4Z" fill={`url(#e${uid})`} />
      <g fill={e.spots} opacity=".7"><circle cx="34" cy="60" r="5" /><circle cx="62" cy="40" r="4" /><circle cx="66" cy="84" r="6" /><circle cx="40" cy="96" r="3.5" /></g>
      {e.id === 'egg-royal' && <path d="M30 34 L28 20 L38 28 L50 16 L62 28 L72 20 L70 34Z" fill="#F4C430" stroke="#7a4f00" strokeWidth="1.5" />}
      {e.id === 'egg-diamond' && <path d="M24 56 L50 36 L76 56 L50 100Z M24 56 H76 M50 36 L42 56 L50 100 L58 56Z" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="1.5" />}
      <ellipse cx="34" cy="30" rx="7" ry="13" fill="#fff" opacity=".55" transform="rotate(-20 34 30)" />
      {cracked > 0 && <path d="M14 70 L28 62 L36 74 L50 60 L60 74 L72 62 L86 70" fill="none" stroke="#3a2600" strokeWidth={2 + cracked} strokeLinejoin="round" opacity={Math.min(1, cracked)} />}
      {cracked > 1 && <path d="M28 62 L22 48 M60 74 L66 90 M50 60 L48 46" fill="none" stroke="#3a2600" strokeWidth="2" />}
    </svg>
  );
}

// ======================= dispatcher =======================
/** The artwork for any shop item. `tryOn` dresses previews with what you're wearing. */
export function ItemArt({ it, size = 140, tryOn = true }: { it: ShopItem; size?: number; tryOn?: boolean }) {
  const eq = useStore((s) => s.equipped);
  switch (it.kind) {
    case 'chicken': return <ChickenArt skin={it.id} hat={tryOn ? eq.hat : 'hat-none'} size={size} />;
    case 'hat': return <ChickenArt skin={tryOn ? eq.chicken : 'ch-classic'} hat={it.id} size={size} />;
    case 'table': return <TableArt table={it.id} chips={tryOn ? eq.chips : undefined} deck={tryOn ? eq.deck : undefined} size={size * 1.15} />;
    case 'chips': return <ChipSetArt set={it.id} size={size} />;
    case 'deck': return <DeckArt deck={it.id} size={size} />;
    case 'set': return <SetArt it={it} size={size} />;
    case 'avatar': return <img src={`./img/${it.img}`} alt="" className="rounded-full object-cover ring-2 ring-white/10" style={{ width: size * 0.7, height: size * 0.7 }} />;
    case 'frame': return <div className={`rounded-full ring-4 ${it.color}`} style={{ width: size * 0.62, height: size * 0.62 }}><img src="./img/head.webp" alt="" className="h-full w-full rounded-full object-cover" /></div>;
    case 'ball': return <div className="rounded-[50%]" style={{ width: size * 0.42, height: size * 0.52, background: `radial-gradient(circle at 35% 30%, #fff, ${it.color} 40%, #000a)`, boxShadow: `0 0 30px ${it.color}` }} />;
    case 'title': return <div className="max-w-full rounded-lg border border-gold/40 bg-gold/5 px-1.5 py-1 text-center font-display font-black uppercase leading-tight tracking-wide text-gold" style={{ width: size * 0.95, fontSize: Math.max(8, size * 0.11) }}>{it.name}</div>;
    case 'fx': {
      const th = FX_THUMB[it.id] ?? FX_THUMB['fx-classic'];
      return (
        <div className="relative grid place-items-center overflow-hidden rounded-xl font-display font-black leading-none" style={{ background: th.bg, width: size * 0.95, height: size * 0.65, boxShadow: `0 0 ${size * 0.12}px ${th.glow}` }}>
          <div className="absolute inset-0 opacity-60" style={{ background: `repeating-conic-gradient(from 0deg at 50% 60%, ${th.ray} 0deg 8deg, transparent 8deg 20deg)` }} />
          <span className="relative text-center" style={{ fontSize: Math.max(9, size * 0.16), backgroundImage: th.text, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>BIG<br />WIN</span>
        </div>
      );
    }
    case 'name': return <div className={`text-center font-display font-black leading-none ${NAME_CLASS[it.id] ?? 'text-cream'}`} style={{ fontSize: Math.max(9, size * 0.15) }}>Your<br />Name</div>;
    case 'bundle': {
      // coin pack: a pile that grows with the pack size
      const n = it.price >= 300 ? 4 : it.price >= 60 ? 3 : it.price >= 20 ? 2 : 1;
      return (
        <div className="flex flex-col-reverse items-center">
          {Array.from({ length: n }, (_, row) => (
            <div key={row} className="flex -space-x-3" style={{ marginBottom: row ? -size * 0.16 : 0 }}>
              {Array.from({ length: Math.max(1, n - row + (n > 2 ? 0 : 1)) }, (_, i) => <ChipArt key={i} set="cp-gold" denom={3} size={size * 0.3} label="$" />)}
            </div>
          ))}
        </div>
      );
    }
    default: return null;
  }
}

/** Bundle art: its items overlapping on a podium. */
export function SetArt({ it, size = 140 }: { it: ShopItem; size?: number }) {
  const parts = (it.contains ?? []).map((id) => itemById(id)!).filter(Boolean);
  const ch = parts.find((p) => p.kind === 'chicken');
  const hat = parts.find((p) => p.kind === 'hat');
  const table = parts.find((p) => p.kind === 'table');
  const chips = parts.find((p) => p.kind === 'chips');
  const deck = parts.find((p) => p.kind === 'deck');
  return (
    <div className="relative" style={{ width: size * 1.25, height: size * 1.05 }}>
      {table && <div className="absolute bottom-0 left-1/2 -translate-x-1/2"><TableArt table={table.id} chips={chips?.id} deck={deck?.id} size={size * 1.15} /></div>}
      {ch && <div className="absolute left-[2%] top-0"><ChickenArt skin={ch.id} hat={hat?.id ?? 'hat-none'} size={size * 0.6} /></div>}
      {table && chips && <div className="absolute right-[2%] top-[6%]"><ChipSetArt set={chips.id} size={size * 0.5} /></div>}
      {table && deck && !chips && <div className="absolute right-[2%] top-[6%]"><DeckArt deck={deck.id} size={size * 0.5} /></div>}
      {!table && chips && <div className="absolute bottom-0 left-0"><ChipSetArt set={chips.id} size={size * 0.6} /></div>}
      {!table && deck && <div className="absolute bottom-0 right-0"><DeckArt deck={deck.id} size={size * 0.6} /></div>}
    </div>
  );
}
