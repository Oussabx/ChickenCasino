import * as THREE from 'three';
import { Card, Suit, isRed, rankLabel } from '../../lib/cards';
import { eqDeck, eqDeckId } from '../../lib/equipped';
import { deckBackUrl } from '../../lib/deckSvg';

/**
 * Canvas artwork for playing cards: vector suits, real pip layouts,
 * illustrated court cards and a branded back. Textures are cached.
 */

export const FACE_W = 512;
export const FACE_H = 728;
const RED = '#C8102E';
const BLACK = '#14110F';

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/** Draw a suit symbol centred at (x, y), `s` = overall height. */
export function drawSuit(g: CanvasRenderingContext2D, suit: Suit, x: number, y: number, s: number, fill: string) {
  g.save();
  g.translate(x, y); g.scale(s / 100, s / 100);
  g.fillStyle = fill;
  g.beginPath();
  if (suit === 'H') {
    g.moveTo(0, 42);
    g.bezierCurveTo(-18, 26, -50, 6, -50, -18);
    g.bezierCurveTo(-50, -40, -30, -50, -18, -50);
    g.bezierCurveTo(-8, -50, 0, -42, 0, -32);
    g.bezierCurveTo(0, -42, 8, -50, 18, -50);
    g.bezierCurveTo(30, -50, 50, -40, 50, -18);
    g.bezierCurveTo(50, 6, 18, 26, 0, 42);
    g.fill();
  } else if (suit === 'D') {
    g.moveTo(0, -50);
    g.quadraticCurveTo(18, -22, 38, 0);
    g.quadraticCurveTo(18, 22, 0, 50);
    g.quadraticCurveTo(-18, 22, -38, 0);
    g.quadraticCurveTo(-18, -22, 0, -50);
    g.fill();
  } else if (suit === 'S') {
    g.moveTo(0, -50);
    g.bezierCurveTo(-14, -30, -50, -10, -50, 12);
    g.bezierCurveTo(-50, 30, -34, 38, -22, 38);
    g.bezierCurveTo(-12, 38, -5, 32, -3, 26);
    g.quadraticCurveTo(-6, 42, -18, 50);
    g.lineTo(18, 50);
    g.quadraticCurveTo(6, 42, 3, 26);
    g.bezierCurveTo(5, 32, 12, 38, 22, 38);
    g.bezierCurveTo(34, 38, 50, 30, 50, 12);
    g.bezierCurveTo(50, -10, 14, -30, 0, -50);
    g.fill();
  } else {
    g.arc(0, -24, 22, 0, Math.PI * 2);
    g.moveTo(-2, 10); g.arc(-24, 10, 22, 0, Math.PI * 2);
    g.moveTo(46, 10); g.arc(24, 10, 22, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(-5, 4); g.quadraticCurveTo(-4, 38, -18, 50); g.lineTo(18, 50); g.quadraticCurveTo(4, 38, 5, 4); g.closePath();
    g.fill();
  }
  g.restore();
}

// [x, y] in a 0..1 pip box; y > .5 pips are drawn upside down
const L = 0, M = 0.5, R = 1;
const PIPS: Record<number, [number, number][]> = {
  2: [[M, 0], [M, 1]],
  3: [[M, 0], [M, 0.5], [M, 1]],
  4: [[L, 0], [R, 0], [L, 1], [R, 1]],
  5: [[L, 0], [R, 0], [M, 0.5], [L, 1], [R, 1]],
  6: [[L, 0], [R, 0], [L, 0.5], [R, 0.5], [L, 1], [R, 1]],
  7: [[L, 0], [R, 0], [M, 0.25], [L, 0.5], [R, 0.5], [L, 1], [R, 1]],
  8: [[L, 0], [R, 0], [M, 0.25], [L, 0.5], [R, 0.5], [M, 0.75], [L, 1], [R, 1]],
  9: [[L, 0], [R, 0], [L, 1 / 3], [R, 1 / 3], [M, 0.5], [L, 2 / 3], [R, 2 / 3], [L, 1], [R, 1]],
  10: [[L, 0], [R, 0], [M, 1 / 6], [L, 1 / 3], [R, 1 / 3], [L, 2 / 3], [R, 2 / 3], [M, 5 / 6], [L, 1], [R, 1]],
};

let headImg: HTMLImageElement | null = null;
const redrawers = new Set<() => void>();
function head() {
  if (!headImg) {
    headImg = new Image();
    headImg.src = './img/head.webp';
    headImg.onload = () => redrawers.forEach((f) => f());
  }
  return headImg.complete && headImg.naturalWidth ? headImg : null;
}

function paper(g: CanvasRenderingContext2D, deckPaper = '#FFFEFA') {
  g.clearRect(0, 0, FACE_W, FACE_H);
  const grd = g.createLinearGradient(0, 0, FACE_W, FACE_H);
  const custom = deckPaper.toUpperCase() !== '#FFFFFF' && deckPaper.toUpperCase() !== '#FFFEFA';
  grd.addColorStop(0, custom ? deckPaper : '#FFFEFA'); grd.addColorStop(1, custom ? shade(deckPaper, -0.05) : '#F3EFE3');
  g.fillStyle = grd; roundRect(g, 0, 0, FACE_W, FACE_H, 34); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = 3; roundRect(g, 1.5, 1.5, FACE_W - 3, FACE_H - 3, 33); g.stroke();
}

function corner(g: CanvasRenderingContext2D, c: Card, col: string) {
  const rl = rankLabel(c.r);
  const draw = () => {
    g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 ${rl === '10' ? 64 : 78}px Montserrat, system-ui, sans-serif`;
    if (rl === '10') { g.save(); g.translate(60, 72); g.scale(0.8, 1); g.fillText(rl, 0, 0); g.restore(); } else g.fillText(rl, 60, 72);
    drawSuit(g, c.s, 60, 140, 52, col);
  };
  draw();
  g.save(); g.translate(FACE_W, FACE_H); g.rotate(Math.PI); draw(); g.restore();
}

function crown(g: CanvasRenderingContext2D, x: number, y: number, w: number, points: number) {
  g.save(); g.translate(x, y);
  const grd = g.createLinearGradient(0, -w * 0.5, 0, w * 0.2);
  grd.addColorStop(0, '#FFE08A'); grd.addColorStop(1, '#C99A12');
  g.fillStyle = grd; g.strokeStyle = '#7a5a00'; g.lineWidth = 3;
  g.beginPath();
  g.moveTo(-w / 2, w * 0.18);
  const step = w / (points - 1);
  for (let i = 0; i < points; i++) {
    const px = -w / 2 + i * step;
    g.lineTo(px, -w * 0.38 * (i % 2 === 0 ? 1 : 0.62));
    if (i < points - 1) g.lineTo(px + step / 2, -w * 0.08);
  }
  g.lineTo(w / 2, w * 0.18); g.closePath(); g.fill(); g.stroke();
  for (let i = 0; i < points; i += 2) { g.beginPath(); g.arc(-w / 2 + i * step, -w * 0.4, w * 0.055, 0, 7); g.fillStyle = '#E63946'; g.fill(); }
  g.restore();
}

function court(g: CanvasRenderingContext2D, c: Card, col: string) {
  const x = 104, y = 96, w = FACE_W - 208, h = FACE_H - 192;
  const red = isRed(c);
  // panel
  g.save(); roundRect(g, x, y, w, h, 22); g.clip();
  const grd = g.createLinearGradient(0, y, 0, y + h);
  grd.addColorStop(0, red ? '#fde7e9' : '#ecebe6'); grd.addColorStop(0.5, red ? '#f7c9ce' : '#d9d6cc'); grd.addColorStop(1, red ? '#fde7e9' : '#ecebe6');
  g.fillStyle = grd; g.fillRect(x, y, w, h);
  g.globalAlpha = 0.08; g.strokeStyle = col; g.lineWidth = 10;
  for (let i = -h; i < w + h; i += 34) { g.beginPath(); g.moveTo(x + i, y); g.lineTo(x + i - h, y + h); g.stroke(); }
  g.globalAlpha = 1;
  g.restore();
  g.strokeStyle = '#C99A12'; g.lineWidth = 6; roundRect(g, x, y, w, h, 22); g.stroke();
  g.strokeStyle = col; g.lineWidth = 2; roundRect(g, x + 10, y + 10, w - 20, h - 20, 16); g.stroke();

  // double-headed figure: top half, then the same rotated
  const half = () => {
    const cx = FACE_W / 2, cy = y + h * 0.27;
    // medallion with the chicken
    g.save(); g.beginPath(); g.arc(cx, cy + 6, 70, 0, 7); g.closePath();
    const m = g.createRadialGradient(cx, cy - 20, 10, cx, cy, 80);
    m.addColorStop(0, '#fffaf0'); m.addColorStop(1, red ? '#f3b6bd' : '#cfcabd');
    g.fillStyle = m; g.fill(); g.clip();
    const img = head();
    if (img) g.drawImage(img, cx - 64, cy - 56, 128, 128);
    g.restore();
    g.strokeStyle = '#C99A12'; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy + 6, 70, 0, 7); g.stroke();
    if (c.r === 13) crown(g, cx, cy - 70, 104, 5);
    else if (c.r === 12) crown(g, cx, cy - 70, 84, 3);
    else { g.fillStyle = col; roundRect(g, cx - 46, cy - 84, 92, 22, 8); g.fill(); g.fillStyle = '#F4C430'; g.beginPath(); g.arc(cx + 30, cy - 90, 12, 0, 7); g.fill(); }
    g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 64px Montserrat, system-ui, sans-serif';
    g.fillText(rankLabel(c.r), cx - 88, cy + 118);
    drawSuit(g, c.s, cx + 84, cy + 116, 58, col);
  };
  half();
  g.save(); g.translate(FACE_W, FACE_H); g.rotate(Math.PI); half(); g.restore();
  g.strokeStyle = 'rgba(201,154,18,.6)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(x + 18, FACE_H / 2); g.lineTo(x + w - 18, FACE_H / 2); g.stroke();
}

function ace(g: CanvasRenderingContext2D, c: Card, col: string) {
  const cx = FACE_W / 2, cy = FACE_H / 2;
  const halo = g.createRadialGradient(cx, cy, 20, cx, cy, 190);
  halo.addColorStop(0, 'rgba(244,196,48,.28)'); halo.addColorStop(1, 'rgba(244,196,48,0)');
  g.fillStyle = halo; g.beginPath(); g.arc(cx, cy, 190, 0, 7); g.fill();
  g.strokeStyle = '#C99A12'; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, 150, 0, 7); g.stroke();
  g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 138, 0, 7); g.stroke();
  drawSuit(g, c.s, cx, cy, c.s === 'S' ? 220 : 190, col);
  if (c.s === 'S') {
    g.fillStyle = '#C99A12'; g.font = '800 26px Montserrat, system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText('CHICKEN CASINO', cx, cy + 205);
  }
}

function pips(g: CanvasRenderingContext2D, c: Card, col: string) {
  const bx = 150, by = 132, bw = FACE_W - 300, bh = FACE_H - 264;
  const size = c.r >= 9 ? 96 : 108;
  for (const [px, py] of PIPS[c.r]) {
    const x = bx + px * bw, y = by + py * bh;
    if (py > 0.5) { g.save(); g.translate(x, y); g.rotate(Math.PI); drawSuit(g, c.s, 0, 0, size, col); g.restore(); }
    else drawSuit(g, c.s, x, y, size, col);
  }
}

const faceCache = new Map<string, THREE.CanvasTexture>();
/** Lighten/darken a hex colour by `dl` lightness. */
function shade(hex: string, dl: number) { return `#${new THREE.Color(hex).offsetHSL(0, 0, dl).getHexString()}`; }

/** Card face in the equipped deck's colours. */
export function faceTexture(c: Card) {
  const deckId = eqDeckId(), d = eqDeck();
  const key = `${c.r}${c.s}|${deckId}`;
  const hit = faceCache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas'); cv.width = FACE_W; cv.height = FACE_H;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const draw = () => {
    const g = cv.getContext('2d')!;
    const col = isRed(c) ? (d.red ?? RED) : (d.black ?? BLACK);
    paper(g, d.paper);
    if (d.frame && deckId !== 'dk-classic') { g.strokeStyle = d.frame; g.lineWidth = 8; roundRect(g, 10, 10, FACE_W - 20, FACE_H - 20, 26); g.stroke(); }
    if (c.r === 14) ace(g, c, col);
    else if (c.r >= 11) court(g, c, col);
    else pips(g, c, col);
    corner(g, c, col);
    tex.needsUpdate = true;
  };
  draw();
  if (c.r >= 11 && c.r <= 13) redrawers.add(draw);
  document.fonts?.ready.then(draw);
  faceCache.set(key, tex);
  return tex;
}

const backCache = new Map<string, THREE.CanvasTexture>();
let backTex: THREE.CanvasTexture | null = null;
/** Card back in the equipped deck's design. */
export function backTexture() {
  const deckId = eqDeckId();
  if (deckId !== 'dk-classic') {
    const hit = backCache.get(deckId); if (hit) return hit;
    const cv = document.createElement('canvas'); cv.width = FACE_W; cv.height = FACE_H;
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const img = new Image();
    img.onload = () => { const g = cv.getContext('2d')!; g.clearRect(0, 0, FACE_W, FACE_H); g.drawImage(img, 0, 0, FACE_W, FACE_H); t.needsUpdate = true; };
    img.src = deckBackUrl(deckId);
    backCache.set(deckId, t);
    return t;
  }
  if (backTex) return backTex;
  const cv = document.createElement('canvas'); cv.width = FACE_W; cv.height = FACE_H;
  backTex = new THREE.CanvasTexture(cv);
  backTex.colorSpace = THREE.SRGBColorSpace; backTex.anisotropy = 8;
  const t = backTex;
  const draw = () => {
    const g = cv.getContext('2d')!;
    g.clearRect(0, 0, FACE_W, FACE_H);
    g.fillStyle = '#FBF8EF'; roundRect(g, 0, 0, FACE_W, FACE_H, 34); g.fill();
    g.save(); roundRect(g, 22, 22, FACE_W - 44, FACE_H - 44, 22); g.clip();
    const bg = g.createRadialGradient(FACE_W / 2, FACE_H / 2, 40, FACE_W / 2, FACE_H / 2, 480);
    bg.addColorStop(0, '#B3202E'); bg.addColorStop(1, '#5E0E17');
    g.fillStyle = bg; g.fillRect(0, 0, FACE_W, FACE_H);
    // diamond lattice
    g.strokeStyle = 'rgba(244,196,48,.28)'; g.lineWidth = 2;
    for (let i = -FACE_H; i < FACE_W + FACE_H; i += 34) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + FACE_H, FACE_H); g.stroke();
      g.beginPath(); g.moveTo(i, FACE_H); g.lineTo(i + FACE_H, 0); g.stroke();
    }
    g.fillStyle = 'rgba(244,196,48,.35)';
    for (let x = 0; x < FACE_W; x += 34) for (let y = 0; y < FACE_H; y += 34) { g.beginPath(); g.arc(x + 17, y + 17, 2.2, 0, 7); g.fill(); }
    g.restore();
    g.strokeStyle = '#F4C430'; g.lineWidth = 5; roundRect(g, 36, 36, FACE_W - 72, FACE_H - 72, 16); g.stroke();
    g.lineWidth = 2; roundRect(g, 48, 48, FACE_W - 96, FACE_H - 96, 12); g.stroke();
    // centre medallion
    const cx = FACE_W / 2, cy = FACE_H / 2;
    g.fillStyle = '#5E0E17'; g.beginPath(); g.arc(cx, cy, 124, 0, 7); g.fill();
    g.strokeStyle = '#F4C430'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, 116, 0, 7); g.stroke();
    g.save(); g.beginPath(); g.arc(cx, cy, 104, 0, 7); g.fillStyle = '#FBF8EF'; g.fill(); g.clip();
    const img = head();
    if (img) g.drawImage(img, cx - 100, cy - 94, 200, 200);
    g.restore();
    t.needsUpdate = true;
  };
  draw();
  redrawers.add(draw);
  return backTex;
}
