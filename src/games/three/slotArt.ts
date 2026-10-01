import type { Sym } from '../../lib/slots';
import { roundRect } from './cardArt';

/**
 * Vector symbol art for the Golden Coop slot, drawn on canvas (no emoji, no
 * text glyphs for shapes) so it stays crisp on every device.
 */
export const ART = 256;

type G = CanvasRenderingContext2D;

const head = typeof Image !== 'undefined' ? new Image() : null;
let headReady: Promise<void> | null = null;
export function loadSlotArt() {
  if (!headReady && head) headReady = new Promise((res) => { head.onload = () => res(); head.onerror = () => res(); head.src = './img/head.webp'; });
  return headReady ?? Promise.resolve();
}

function shine(g: G, cx: number, cy: number, r: number, a = 0.55) {
  const s = g.createRadialGradient(cx - r * 0.35, cy - r * 0.45, 0, cx - r * 0.35, cy - r * 0.45, r * 0.7);
  s.addColorStop(0, `rgba(255,255,255,${a})`); s.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = s; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
}

function eggPath(g: G, cx: number, cy: number, w: number, h: number) {
  g.beginPath();
  g.moveTo(cx, cy - h / 2);
  g.bezierCurveTo(cx + w * 0.62, cy - h / 2, cx + w / 2, cy + h * 0.5, cx, cy + h / 2);
  g.bezierCurveTo(cx - w / 2, cy + h * 0.5, cx - w * 0.62, cy - h / 2, cx, cy - h / 2);
  g.closePath();
}

function banner(g: G, text: string, y: number, bg: string, fg: string, w = 176) {
  g.save();
  g.fillStyle = bg; g.strokeStyle = '#F4C430'; g.lineWidth = 5;
  roundRect(g, 128 - w / 2, y - 22, w, 44, 14); g.fill(); g.stroke();
  g.fillStyle = fg; g.font = '900 32px Montserrat, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, y + 2);
  g.restore();
}

const DRAW: Record<Sym, (g: G) => void> = {
  corn(g) {
    g.save(); g.translate(128, 132); g.rotate(-0.5);
    // husk
    g.fillStyle = '#4d9a2c';
    g.beginPath(); g.moveTo(0, 96); g.quadraticCurveTo(-78, 40, -40, -40); g.quadraticCurveTo(-30, 30, 0, 70); g.fill();
    g.beginPath(); g.moveTo(0, 96); g.quadraticCurveTo(78, 40, 40, -40); g.quadraticCurveTo(30, 30, 0, 70); g.fill();
    // cob
    const cob = g.createLinearGradient(-40, 0, 40, 0); cob.addColorStop(0, '#d98e04'); cob.addColorStop(0.5, '#ffd84d'); cob.addColorStop(1, '#c97c00');
    g.fillStyle = cob; eggPath(g, 0, -8, 76, 176); g.fill();
    g.save(); eggPath(g, 0, -8, 76, 176); g.clip();
    g.fillStyle = 'rgba(120,70,0,.35)';
    for (let y = -96; y < 90; y += 15) for (let x = -36; x < 40; x += 14) { roundRect(g, x + ((y / 15) % 2 ? 7 : 0) - 1, y, 3, 13, 1.5); g.fill(); }
    g.restore();
    g.fillStyle = '#3f8a22';
    g.beginPath(); g.moveTo(0, 100); g.quadraticCurveTo(-34, 40, -6, 0); g.quadraticCurveTo(-6, 50, 10, 100); g.fill();
    g.restore();
  },
  feather(g) {
    g.save(); g.translate(128, 128); g.rotate(0.6);
    const vane = g.createLinearGradient(-40, 0, 40, 0); vane.addColorStop(0, '#b91c1c'); vane.addColorStop(0.5, '#fb923c'); vane.addColorStop(1, '#dc2626');
    g.fillStyle = vane;
    g.beginPath(); g.moveTo(0, -108); g.bezierCurveTo(62, -70, 52, 40, 4, 92); g.bezierCurveTo(-52, 40, -60, -70, 0, -108); g.fill();
    g.strokeStyle = 'rgba(80,10,10,.45)'; g.lineWidth = 3;
    for (let y = -80; y < 70; y += 14) { g.beginPath(); g.moveTo(0, y); g.lineTo(36 - Math.abs(y) * 0.12, y - 18); g.moveTo(0, y); g.lineTo(-36 + Math.abs(y) * 0.12, y - 18); g.stroke(); }
    g.strokeStyle = '#fff4d6'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, -100); g.quadraticCurveTo(4, 20, 2, 112); g.stroke();
    g.restore();
  },
  egg(g) {
    const grd = g.createRadialGradient(108, 96, 10, 128, 132, 110); grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.6, '#f3ead6'); grd.addColorStop(1, '#c9b48d');
    g.fillStyle = grd; eggPath(g, 128, 132, 150, 196); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 3; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.ellipse(100, 92, 14, 26, -0.4, 0, Math.PI * 2); g.fill();
  },
  horseshoe(g) {
    // opening upwards — the lucky way, it holds the luck in
    g.save(); g.translate(128, 120); g.scale(1, -1);
    const metal = g.createLinearGradient(-90, -90, 90, 90); metal.addColorStop(0, '#f6f7fb'); metal.addColorStop(0.5, '#9aa3b5'); metal.addColorStop(1, '#4b5262');
    g.strokeStyle = metal; g.lineWidth = 44; g.lineCap = 'butt';
    g.beginPath(); g.arc(0, -10, 72, Math.PI * 0.86, Math.PI * 2.14, false); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3;
    g.beginPath(); g.arc(0, -10, 94, Math.PI * 0.86, Math.PI * 2.14, false); g.stroke();
    g.beginPath(); g.arc(0, -10, 50, Math.PI * 0.86, Math.PI * 2.14, false); g.stroke();
    // tips
    g.fillStyle = '#7b8496';
    for (const s of [-1, 1]) { g.fillRect(s * 72 - 24, 40, 48, 26); }
    g.fillStyle = '#20232b';
    for (let i = 0; i < 7; i++) { const a = Math.PI * (0.95 + i * 0.183); g.beginPath(); g.arc(Math.cos(a) * 72, -10 + Math.sin(a) * 72, 5.5, 0, Math.PI * 2); g.fill(); }
    g.restore();
  },
  chick(g) {
    // body
    const body = g.createRadialGradient(110, 120, 10, 128, 150, 100); body.addColorStop(0, '#fff3a0'); body.addColorStop(1, '#f2b705');
    g.fillStyle = body; g.beginPath(); g.ellipse(128, 160, 82, 70, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(128, 92, 58, 0, Math.PI * 2); g.fill();
    // tuft
    g.fillStyle = '#f2b705'; for (const a of [-0.4, 0, 0.4]) { g.beginPath(); g.ellipse(128 + a * 40, 34, 8, 20, a, 0, Math.PI * 2); g.fill(); }
    // wing
    g.fillStyle = '#e8a400'; g.beginPath(); g.ellipse(186, 160, 26, 40, -0.5, 0, Math.PI * 2); g.fill();
    // eyes
    for (const x of [106, 150]) { g.fillStyle = '#111'; g.beginPath(); g.arc(x, 88, 10, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 3, 84, 3.5, 0, Math.PI * 2); g.fill(); }
    // cheeks
    g.fillStyle = 'rgba(255,120,120,.55)'; for (const x of [92, 164]) { g.beginPath(); g.ellipse(x, 106, 11, 7, 0, 0, Math.PI * 2); g.fill(); }
    // beak
    g.fillStyle = '#f97316'; g.beginPath(); g.moveTo(114, 104); g.lineTo(142, 104); g.lineTo(128, 124); g.closePath(); g.fill();
    // feet
    g.strokeStyle = '#f97316'; g.lineWidth = 7; g.lineCap = 'round';
    for (const x of [104, 152]) { g.beginPath(); g.moveTo(x, 222); g.lineTo(x, 236); g.moveTo(x, 236); g.lineTo(x - 12, 244); g.moveTo(x, 236); g.lineTo(x + 12, 244); g.stroke(); }
  },
  bell(g) {
    g.save(); g.translate(128, 128);
    const gold = g.createLinearGradient(-80, 0, 80, 0); gold.addColorStop(0, '#a86b00'); gold.addColorStop(0.45, '#ffe27a'); gold.addColorStop(1, '#a86b00');
    g.fillStyle = gold;
    g.beginPath(); g.moveTo(-82, 58); g.quadraticCurveTo(-70, 40, -62, 0); g.bezierCurveTo(-58, -80, 58, -80, 62, 0); g.quadraticCurveTo(70, 40, 82, 58); g.closePath(); g.fill();
    g.fillStyle = '#c98a00'; roundRect(g, -90, 52, 180, 20, 10); g.fill();
    g.fillStyle = '#7a4a00'; g.beginPath(); g.arc(0, 86, 16, 0, Math.PI * 2); g.fill();
    // bow
    g.fillStyle = '#E63946';
    g.beginPath(); g.moveTo(0, -78); g.lineTo(-40, -102); g.lineTo(-40, -58); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(0, -78); g.lineTo(40, -102); g.lineTo(40, -58); g.closePath(); g.fill();
    g.beginPath(); g.arc(0, -78, 12, 0, Math.PI * 2); g.fill();
    g.restore();
    shine(g, 128, 118, 60, 0.4);
  },
  seven(g) {
    g.save();
    g.font = '900 228px Montserrat, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 22; g.strokeStyle = '#3a0508'; g.strokeText('7', 132, 140);
    g.lineWidth = 12; g.strokeStyle = '#F4C430'; g.strokeText('7', 132, 140);
    const red = g.createLinearGradient(0, 40, 0, 230); red.addColorStop(0, '#ff5a67'); red.addColorStop(1, '#a30f1e');
    g.fillStyle = red; g.fillText('7', 132, 140);
    g.restore();
  },
  golden(g) {
    const grd = g.createRadialGradient(104, 92, 8, 128, 132, 118); grd.addColorStop(0, '#fff6c2'); grd.addColorStop(0.35, '#ffd84d'); grd.addColorStop(0.8, '#d18f00'); grd.addColorStop(1, '#7a4f00');
    g.fillStyle = grd; eggPath(g, 128, 134, 156, 200); g.fill();
    g.strokeStyle = '#7a4f00'; g.lineWidth = 4; g.stroke();
    star(g, 196, 62, 22, '#fff8d6'); star(g, 58, 190, 14, '#fff8d6'); star(g, 200, 196, 10, '#fff8d6');
    g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(100, 92, 14, 28, -0.4, 0, Math.PI * 2); g.fill();
  },
  wild(g) {
    g.save();
    g.fillStyle = '#0b0b0b'; g.beginPath(); g.arc(128, 108, 92, 0, Math.PI * 2); g.fill();
    if (head?.complete && head.naturalWidth) {
      g.save(); g.beginPath(); g.arc(128, 108, 88, 0, Math.PI * 2); g.clip();
      g.drawImage(head, 128 - 100, 108 - 96, 200, 194);
      g.restore();
    }
    const ring = g.createLinearGradient(0, 16, 0, 200); ring.addColorStop(0, '#fff1a8'); ring.addColorStop(0.5, '#F4C430'); ring.addColorStop(1, '#9c6a00');
    g.strokeStyle = ring; g.lineWidth = 12; g.beginPath(); g.arc(128, 108, 92, 0, Math.PI * 2); g.stroke();
    g.restore();
    banner(g, 'WILD', 214, '#E63946', '#ffffff', 170);
  },
  coop(g) {
    g.save(); g.translate(128, 120);
    // barn
    g.fillStyle = '#b3192a'; g.beginPath(); g.moveTo(-86, 70); g.lineTo(-86, -10); g.lineTo(0, -82); g.lineTo(86, -10); g.lineTo(86, 70); g.closePath(); g.fill();
    g.fillStyle = '#3a0b10'; g.beginPath(); g.moveTo(-100, -4); g.lineTo(0, -96); g.lineTo(100, -4); g.lineTo(88, 6); g.lineTo(0, -74); g.lineTo(-88, 6); g.closePath(); g.fill();
    // door with X
    g.fillStyle = '#f8f6ef'; g.fillRect(-36, 4, 72, 66);
    g.strokeStyle = '#b3192a'; g.lineWidth = 8; g.strokeRect(-30, 10, 60, 54);
    g.beginPath(); g.moveTo(-30, 10); g.lineTo(30, 64); g.moveTo(30, 10); g.lineTo(-30, 64); g.stroke();
    // hay loft
    g.fillStyle = '#F4C430'; g.beginPath(); g.arc(0, -30, 16, 0, Math.PI * 2); g.fill();
    g.restore();
    banner(g, 'BONUS', 214, '#0b0b0b', '#F4C430', 172);
  },
};

function star(g: G, x: number, y: number, r: number, c: string) {
  g.fillStyle = c; g.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.3 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}

const TIER_GLOW: Partial<Record<Sym, string>> = { seven: 'rgba(230,57,70,.35)', golden: 'rgba(244,196,48,.4)', wild: 'rgba(244,196,48,.5)', coop: 'rgba(230,57,70,.4)', bell: 'rgba(244,196,48,.22)' };

/** Draw one symbol tile. `blur` smears it vertically (for spinning reels); `scale` renders at higher resolution. */
export function drawSymbol(cv: HTMLCanvasElement, s: Sym, opts: { bg?: boolean; blur?: boolean; scale?: number } = {}) {
  const k = opts.scale ?? 1;
  cv.width = ART * k; cv.height = Math.round(ART * 0.94 * k);
  const g = cv.getContext('2d')!;
  g.setTransform(k, 0, 0, k, 0, 0);
  const H = ART * 0.94;
  g.clearRect(0, 0, ART, H);
  if (opts.bg !== false) {
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1d1013'); bg.addColorStop(0.5, '#2a1418'); bg.addColorStop(1, '#1d1013');
    g.fillStyle = bg; g.fillRect(0, 0, ART, H);
  }
  const glow = TIER_GLOW[s];
  if (glow && opts.bg !== false) { const r = g.createRadialGradient(128, H / 2, 10, 128, H / 2, 128); r.addColorStop(0, glow); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, ART, H); }
  const tile = document.createElement('canvas'); tile.width = tile.height = ART * k;
  const tg = tile.getContext('2d')!;
  tg.setTransform(k, 0, 0, k, 0, 0);
  tg.shadowColor = 'rgba(0,0,0,.55)'; tg.shadowBlur = 10 * k; tg.shadowOffsetY = 5 * k;
  DRAW[s](tg);
  const y0 = (H - ART * 0.9) / 2;
  if (opts.blur) {
    g.globalAlpha = 0.2;
    for (let i = -4; i <= 4; i++) g.drawImage(tile, 13, y0 + i * 6, ART * 0.9, ART * 0.9);
    g.globalAlpha = 1;
  } else g.drawImage(tile, 13, y0, ART * 0.9, ART * 0.9);
}

/** Data URL of a symbol (for the paytable). */
export function symbolUrl(s: Sym, o: { blur?: boolean; scale?: number } = {}) {
  const cv = document.createElement('canvas');
  drawSymbol(cv, s, { bg: false, blur: o.blur, scale: o.scale });
  return cv.toDataURL('image/png');
}
