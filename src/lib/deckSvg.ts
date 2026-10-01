import { DECKS, DeckTheme } from './cosmetics';

/**
 * Card back artwork as an SVG string (500×700), shared by the DOM cards,
 * the shop previews and the 3D tables, so every deck looks identical everywhere.
 */
export function deckBackSvg(id: string) {
  const d: DeckTheme = DECKS[id] ?? DECKS['dk-classic'];
  const W = 500, H = 700;
  const pat = pattern(d);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="${d.back[0]}"/><stop offset="1" stop-color="${d.back[1]}"/></radialGradient>
    ${pat.defs}
    <clipPath id="inner"><rect x="26" y="26" width="${W - 52}" height="${H - 52}" rx="22"/></clipPath>
    <clipPath id="medal"><circle cx="250" cy="350" r="92"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" rx="34" fill="${d.frame}"/>
  <g clip-path="url(#inner)">
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${pat.body}
  </g>
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="16" fill="none" stroke="${d.frame}" stroke-opacity=".55" stroke-width="3"/>
  <circle cx="250" cy="350" r="104" fill="${d.back[1]}" stroke="${d.frame}" stroke-width="8"/>
  ${emblem(d)}
</svg>`;
}

export const deckBackUrl = (id: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(deckBackSvg(id))}`;

function pattern(d: DeckTheme): { defs: string; body: string } {
  const a = d.accent;
  switch (d.pattern) {
    case 'lattice':
      return { defs: `<pattern id="p" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0H34M0 0V34" stroke="${a}" stroke-width="3"/><circle cx="17" cy="17" r="2.6" fill="${a}"/></pattern>`, body: '<rect width="500" height="700" fill="url(#p)"/>' };
    case 'stripes':
      return { defs: `<pattern id="p" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><rect width="12" height="28" fill="${a}"/></pattern>`, body: '<rect width="500" height="700" fill="url(#p)"/>' };
    case 'pinstripe':
      return { defs: `<pattern id="p" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="2" height="22" fill="${a}"/></pattern>`, body: '<rect width="500" height="700" fill="url(#p)"/>' };
    case 'circuit':
      return {
        defs: `<pattern id="p" width="70" height="70" patternUnits="userSpaceOnUse"><path d="M0 35H22L32 22H52M35 70V48L48 40V0" fill="none" stroke="${a}" stroke-width="3"/><circle cx="52" cy="22" r="4" fill="${a}"/><circle cx="22" cy="35" r="4" fill="${a}"/></pattern>`,
        body: '<rect width="500" height="700" fill="url(#p)"/>',
      };
    case 'damask':
      return {
        defs: `<pattern id="p" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M30 4 L42 30 L30 56 L18 30Z" fill="none" stroke="${a}" stroke-width="3"/><circle cx="30" cy="30" r="5" fill="${a}"/><circle cx="0" cy="0" r="4" fill="${a}"/><circle cx="60" cy="0" r="4" fill="${a}"/><circle cx="0" cy="60" r="4" fill="${a}"/><circle cx="60" cy="60" r="4" fill="${a}"/></pattern>`,
        body: '<rect width="500" height="700" fill="url(#p)"/>',
      };
    case 'chicken':
      return {
        defs: `<pattern id="p" width="62" height="62" patternUnits="userSpaceOnUse"><g fill="${a}"><ellipse cx="20" cy="22" rx="11" ry="13"/><circle cx="28" cy="10" r="6"/><path d="M34 10 L40 12 L34 14Z"/><ellipse cx="50" cy="50" rx="7" ry="9"/></g></pattern>`,
        body: '<rect width="500" height="700" fill="url(#p)"/>',
      };
    case 'emoji':
      return {
        defs: `<pattern id="p" width="58" height="58" patternUnits="userSpaceOnUse"><g fill="none" stroke="${a}" stroke-width="3"><circle cx="29" cy="29" r="16"/><path d="M20 33 Q29 42 38 33"/></g><circle cx="23" cy="25" r="2.5" fill="${a}"/><circle cx="35" cy="25" r="2.5" fill="${a}"/></pattern>`,
        body: '<rect width="500" height="700" fill="url(#p)"/>',
      };
    case 'sunburst': {
      let rays = '';
      for (let i = 0; i < 36; i++) { const a0 = (i / 36) * Math.PI * 2, a1 = a0 + Math.PI / 54; rays += `<path d="M250 350 L${250 + Math.cos(a0) * 700} ${350 + Math.sin(a0) * 700} L${250 + Math.cos(a1) * 700} ${350 + Math.sin(a1) * 700}Z" fill="${a}"/>`; }
      return { defs: '', body: rays };
    }
  }
}

function emblem(d: DeckTheme) {
  const f = d.frame;
  switch (d.emblem) {
    case 'head': // the rooster mascot, drawn (data-URL SVGs can't load images)
      return `<g transform="translate(250 360)"><circle cx="-40" cy="-62" r="17" fill="#E63946"/><circle cx="-10" cy="-74" r="21" fill="#E63946"/><circle cx="22" cy="-64" r="17" fill="#E63946"/>
        <circle r="62" fill="#F8F6EF"/><path d="M52 -6 L92 6 L52 20Z" fill="#F6A623" stroke="#a86b00" stroke-width="3"/><ellipse cx="50" cy="36" rx="10" ry="16" fill="#E63946"/>
        <path d="M-34 -22 H58 Q62 -22 60 -14 L56 4 Q54 12 44 12 H22 Q12 12 10 2 L8 -8 H0 L-2 2 Q-4 12 -14 12 H-30 Q-40 12 -40 2 L-40 -16 Q-40 -22 -34 -22Z" fill="#0B0B0B"/><path d="M-26 -14 H-8" stroke="#fff" stroke-opacity=".7" stroke-width="4" stroke-linecap="round"/></g>`;
    case 'crown':
      return `<path d="M178 400 L170 300 L210 336 L250 286 L290 336 L330 300 L322 400Z" fill="${f}" stroke="#7a4f00" stroke-width="5" stroke-linejoin="round"/><circle cx="250" cy="370" r="12" fill="#E63946"/><circle cx="208" cy="372" r="8" fill="#22D3EE"/><circle cx="292" cy="372" r="8" fill="#22D3EE"/>`;
    case 'fedora':
      return `<ellipse cx="250" cy="388" rx="92" ry="20" fill="#111"/><path d="M188 388 Q192 300 250 300 Q308 300 312 388Z" fill="#1c1c1c"/><path d="M226 300 Q250 330 274 300" fill="none" stroke="#000" stroke-width="6"/><rect x="190" y="360" width="120" height="16" fill="#8E1B24"/>`;
    case 'egg':
      return `<path d="M250 268 C305 268 318 360 318 380 C318 420 288 440 250 440 C212 440 182 420 182 380 C182 360 195 268 250 268Z" fill="${f}" stroke="#7a4f00" stroke-width="5"/><ellipse cx="226" cy="320" rx="12" ry="22" fill="#fff" opacity=".8"/>`;
    case 'bolt':
      return `<path d="M268 270 L200 366 L246 366 L228 434 L302 330 L256 330Z" fill="${f}" stroke="#FF2BD6" stroke-width="6" stroke-linejoin="round"/>`;
    case 'laugh':
      return `<circle cx="250" cy="350" r="78" fill="#FACC15" stroke="#111" stroke-width="5"/><path d="M212 330 q12 -14 24 0 M264 330 q12 -14 24 0" fill="none" stroke="#111" stroke-width="7" stroke-linecap="round"/><path d="M204 362 Q250 420 296 362Z" fill="#111"/><path d="M216 372 Q250 404 284 372Z" fill="#E63946"/>`;
    case 'coin':
      return `<circle cx="250" cy="350" r="80" fill="#F4C430" stroke="#7a4f00" stroke-width="6"/><circle cx="250" cy="350" r="58" fill="none" stroke="#a86b00" stroke-width="5" stroke-dasharray="8 8"/><text x="250" y="378" text-anchor="middle" font-family="Montserrat, Arial" font-weight="900" font-size="84" fill="#7a4f00">C</text>`;
  }
}
