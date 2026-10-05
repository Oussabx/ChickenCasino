import * as THREE from 'three';
import { Stage3D } from './stage';
import { MAT, box, glowSprite, labelPlane, std, textTexture } from './models';
import { chipStack } from './table3d';
import { roundRect } from './cardArt';
import { eqTable, eqTableId } from '../../lib/equipped';
import type { TableTheme } from '../../lib/cosmetics';

export const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const colorOf = (n: number) => (n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black');

/** Bet keys: n:<0-36>, red, black, odd, even, low, high, d1-d3 (dozens), c1-c3 (columns). */
export const covers = (key: string, n: number) => {
  if (key.startsWith('n:')) return +key.slice(2) === n;
  if (n === 0) return false;
  switch (key) {
    case 'red': return REDS.has(n);
    case 'black': return !REDS.has(n);
    case 'odd': return n % 2 === 1;
    case 'even': return n % 2 === 0;
    case 'low': return n <= 18;
    case 'high': return n >= 19;
    case 'd1': return n <= 12;
    case 'd2': return n > 12 && n <= 24;
    case 'd3': return n > 24;
    case 'c1': return n % 3 === 1;
    case 'c2': return n % 3 === 2;
    case 'c3': return n % 3 === 0;
  }
  return false;
};
/** Total returned (stake included) per unit staked. */
export const returns = (key: string) => (key.startsWith('n:') ? 36 : key[0] === 'd' || key[0] === 'c' ? 3 : 2);

// ---- betting layout, in layout units: u across (0..14), v down (0..BV) ----
const RH = 1.25, DZ_H = 0.9, OUT_H = 0.9;
const BU = 14, BV = RH * 3 + DZ_H + OUT_H;
const BS = 0.8; // world units per layout unit
const OUTSIDE = ['low', 'even', 'red', 'black', 'odd', 'high'];
type Rect = [number, number, number, number]; // u0, v0, u1, v1
function cellRect(key: string): Rect | null {
  if (key === 'n:0') return [0, 0, 1, RH * 3];
  if (key.startsWith('n:')) { const n = +key.slice(2), c = Math.floor((n - 1) / 3), row = 2 - ((n - 1) % 3); return [1 + c, row * RH, 2 + c, (row + 1) * RH]; }
  if (key[0] === 'c') { const row = 3 - +key[1]; return [13, row * RH, 14, (row + 1) * RH]; }
  if (key[0] === 'd') { const d = +key[1] - 1; return [1 + d * 4, RH * 3, 5 + d * 4, RH * 3 + DZ_H]; }
  const i = OUTSIDE.indexOf(key);
  return i < 0 ? null : [1 + i * 2, RH * 3 + DZ_H, 3 + i * 2, BV];
}
function cellAt(u: number, v: number): string | null {
  if (u < 0 || u > BU || v < 0 || v > BV) return null;
  if (v < RH * 3) {
    const row = Math.min(2, Math.floor(v / RH));
    if (u < 1) return 'n:0';
    if (u < 13) return `n:${Math.floor(u - 1) * 3 + (3 - row)}`;
    return `c${3 - row}`;
  }
  if (u < 1 || u >= 13) return null;
  if (v < RH * 3 + DZ_H) return `d${Math.floor((u - 1) / 4) + 1}`;
  return OUTSIDE[Math.min(5, Math.floor((u - 1) / 2))];
}
const ALL_KEYS = [...Array.from({ length: 37 }, (_, n) => `n:${n}`), 'c1', 'c2', 'c3', 'd1', 'd2', 'd3', ...OUTSIDE];

const N = 37;
const SEG = (Math.PI * 2) / N;
const R_POCKET_IN = 1.75, R_POCKET_OUT = 2.45, R_NUM_OUT = 2.95, R_TRACK = 3.45;
const Y_POCKET = 0.12, Y_TRACK = 0.52;

/** Point at local angle a (radians, around +Y) and radius r. */
const polar = (a: number, r: number, y = 0) => new THREE.Vector3(Math.cos(a) * r, y, -Math.sin(a) * r);

export class RouletteScene extends Stage3D {
  private rotor = new THREE.Group();
  private ball: THREE.Mesh;
  private rotorAngle = 0;
  private rotorSpeed = 0.35; // idle drift (rad/s)
  private ballAngle = 0;
  private ballRadius = R_TRACK;
  private ballY = Y_TRACK;
  private landed: number | null = null; // pocket index the ball sits in
  private spinAnim: { t0: number; dur: number; r0: number; dr: number; b0: number; db: number; target: number; resolve: () => void; onBounce: () => void; bounced: number } | null = null;
  private layout: 'side' | 'top' = 'side';
  private marker: THREE.Mesh;
  private pocketMats: THREE.MeshStandardMaterial[][] = [];
  private winIdx: number | null = null;
  private trail: THREE.Sprite[] = [];
  private trailPts: THREE.Vector3[] = [];
  private cine = false;
  private cineTimer = 0;
  private board: THREE.Mesh;
  private boardGrp = new THREE.Group();
  private boardTex: THREE.CanvasTexture;
  private hl = new THREE.Group();
  private stacks = new Map<string, THREE.Group>();
  private dolly: THREE.Group | null = null;
  private anims: { t0: number; dur: number; step: (k: number) => void; done: () => void }[] = [];
  private winGlows: THREE.Mesh[] = [];
  private hoverKey: string | null = null;

  /** A fixed look (each live table has its own); otherwise the player's table skin. */
  private theme: TableTheme | null;

  constructor(host: HTMLElement, opts: { theme?: TableTheme } = {}) {
    super(host, { fov: 34, bg: 0x0a0708 });
    this.theme = opts.theme ?? (eqTableId() === 'tb-classic' ? null : eqTable());
    this.parallax = 0.3;
    this.key.position.set(-4, 14, 6);

    // the table: felt all round (green, or the equipped table skin), the wheel sunk into it
    const felt = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ map: feltTexture(this.theme), roughness: 0.95 }));
    felt.rotation.x = -Math.PI / 2; felt.position.y = -0.02; felt.receiveShadow = true;
    this.scene.add(felt);
    const well = new THREE.Mesh(new THREE.CylinderGeometry(R_TRACK + 1.15, R_TRACK + 1.25, 0.14, 96), std(0x2a1209, { roughness: 0.4 }));
    well.position.y = -0.06; this.scene.add(well);
    const acc = this.theme ? (this.theme.glow ?? this.theme.trim) : 0xf4c430;
    const accRgba = (a: number) => `rgba(${(acc >> 16) & 255},${(acc >> 8) & 255},${acc & 255},${a})`;
    const g = glowSprite(accRgba(0.6), 18, 0.24); g.position.set(0, 2, -3); this.scene.add(g);
    // the table's colour washes in from both sides
    const sideA = new THREE.PointLight(acc, 7, 18, 1.5); sideA.position.set(-9, 3, 2); this.scene.add(sideA);
    const sideB = new THREE.PointLight(acc, 5, 18, 1.5); sideB.position.set(9, 3, -2); this.scene.add(sideB);
    const lamp = new THREE.PointLight(0xffe2b0, 40, 20, 1.4); lamp.position.set(0, 7, 1); this.scene.add(lamp);

    // bowl (static): wooden outer ring + sloped ball track
    const bowlProfile = [
      new THREE.Vector2(R_NUM_OUT + 0.05, 0.05), new THREE.Vector2(R_TRACK - 0.05, Y_TRACK - 0.05), new THREE.Vector2(R_TRACK + 0.2, Y_TRACK + 0.15),
      new THREE.Vector2(R_TRACK + 0.35, Y_TRACK + 0.2), new THREE.Vector2(R_TRACK + 0.85, Y_TRACK + 0.15), new THREE.Vector2(R_TRACK + 0.95, -0.4), new THREE.Vector2(R_NUM_OUT, -0.4),
    ];
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlProfile, 96), new THREE.MeshPhysicalMaterial({ color: 0x4a2412, roughness: 0.32, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.12 }));
    bowl.receiveShadow = true; bowl.castShadow = true;
    this.scene.add(bowl);
    const track = new THREE.Mesh(new THREE.RingGeometry(R_NUM_OUT + 0.05, R_TRACK + 0.2, 96, 1), std(0x1b120c, { roughness: 0.3, metalness: 0.2, side: THREE.DoubleSide }));
    track.rotation.x = -Math.PI / 2; track.position.y = Y_TRACK - 0.12;
    this.scene.add(track);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R_TRACK + 0.9, 0.08, 10, 120), MAT.gold);
    rim.rotation.x = Math.PI / 2; rim.position.y = Y_TRACK + 0.16;
    this.scene.add(rim);
    // diamonds (deflectors) on the track
    for (let i = 0; i < 8; i++) {
      const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), MAT.gold);
      d.position.copy(polar((i / 8) * Math.PI * 2 + 0.2, R_TRACK - 0.18, Y_TRACK - 0.02));
      d.scale.set(1, 0.5, 2.2); d.rotation.y = (i / 8) * Math.PI * 2 + 0.2;
      this.scene.add(d);
    }

    // rotor
    WHEEL_ORDER.forEach((n, i) => {
      const a0 = i * SEG - SEG / 2, a1 = a0 + SEG;
      const col = std(n === 0 ? 0x0e8f4a : REDS.has(n) ? 0xc81d2e : 0x141414, { roughness: 0.28, metalness: 0.05 });
      const col2 = col.clone();
      this.pocketMats.push([col, col2]);
      // pocket floor
      const pocket = new THREE.Mesh(this.sector(R_POCKET_IN, R_POCKET_OUT, a0, a1), col);
      pocket.position.y = Y_POCKET; pocket.receiveShadow = true;
      this.rotor.add(pocket);
      // number ring (slightly raised, sloped look)
      const numSeg = new THREE.Mesh(this.sector(R_POCKET_OUT, R_NUM_OUT, a0, a1), col2);
      numSeg.position.y = Y_POCKET + 0.14;
      this.rotor.add(numSeg);
      // number printed on top of the ring (reads upright from outside the wheel)
      const lbl = labelPlane(textTexture(String(n), { w: 128, h: 128, color: '#F8F6EF', size: 84 }), 0.42, 0.42);
      lbl.rotation.x = -Math.PI / 2;
      lbl.rotation.z = i * SEG - Math.PI / 2;
      lbl.position.copy(polar(i * SEG, (R_POCKET_OUT + R_NUM_OUT) / 2, Y_POCKET + 0.14 + 0.04 + 0.006));
      lbl.renderOrder = 2;
      this.rotor.add(lbl);
      // fret between pockets
      const fret = box(MAT.gold, [R_POCKET_OUT - R_POCKET_IN, 0.16, 0.035], [0, 0, 0]);
      fret.position.copy(polar(a0, (R_POCKET_IN + R_POCKET_OUT) / 2, Y_POCKET + 0.08));
      fret.rotation.y = a0;
      this.rotor.add(fret);
    });
    // cone + turret
    const cone = new THREE.Mesh(new THREE.ConeGeometry(R_POCKET_IN, 0.55, 64, 1, true), new THREE.MeshPhysicalMaterial({ map: coneTexture(), roughness: 0.3, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.2, side: THREE.DoubleSide }));
    cone.position.y = Y_POCKET + 0.27; this.rotor.add(cone);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 0.3, 24), MAT.gold);
    hub.position.y = 0.55; this.rotor.add(hub);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.7, 12), MAT.gold);
    spire.position.y = 0.9; this.rotor.add(spire);
    for (let k = 0; k < 4; k++) {
      const arm = box(MAT.gold, [0.9, 0.06, 0.06], [0, 0, 0]);
      arm.position.set(Math.cos((k * Math.PI) / 2) * 0.45, 0.95, -Math.sin((k * Math.PI) / 2) * 0.45);
      arm.rotation.y = (k * Math.PI) / 2;
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), MAT.gold);
      knob.position.set(Math.cos((k * Math.PI) / 2) * 0.9, 0.95, -Math.sin((k * Math.PI) / 2) * 0.9);
      this.rotor.add(arm, knob);
    }
    this.scene.add(this.rotor);

    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.22, 24), new THREE.MeshBasicMaterial({ color: 0xf4c430, transparent: true, opacity: 0, side: THREE.DoubleSide }));
    this.marker.rotation.x = -Math.PI / 2;
    this.scene.add(this.marker);

    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.08, metalness: 0.1, clearcoat: 1 }));
    this.ball.castShadow = true;
    this.scene.add(this.ball);
    for (let i = 0; i < 16; i++) {
      const s = glowSprite('rgba(255,244,214,1)', 0.34 * (1 - i / 20), 0);
      this.trail.push(s); this.scene.add(s);
    }
    // warm bokeh behind the wheel
    for (let i = 0; i < 16; i++) {
      const s = glowSprite(Math.random() < 0.7 ? 'rgba(255,214,120,1)' : 'rgba(230,57,70,1)', 0.8 + Math.random() * 1.6, 0.14 + Math.random() * 0.16);
      s.position.set((Math.random() - 0.5) * 40, 2 + Math.random() * 7, -14 - Math.random() * 8);
      this.scene.add(s);
    }
    // printed betting layout
    this.boardTex = boardTexture(false, this.theme);
    this.board = new THREE.Mesh(new THREE.PlaneGeometry(BU * BS, BV * BS), new THREE.MeshStandardMaterial({ map: this.boardTex, roughness: 0.9 }));
    this.board.rotation.x = -Math.PI / 2; this.board.receiveShadow = true;
    this.board.add(this.hl);
    this.boardGrp.add(this.board);
    this.scene.add(this.boardGrp);
    this.placeBoard();
    this.onResize();
  }

  // ---------- board geometry ----------
  private placeBoard() {
    const portrait = this.layout === 'top';
    this.boardTex = boardTexture(portrait, this.theme);
    (this.board.material as THREE.MeshStandardMaterial).map = this.boardTex;
    (this.board.material as THREE.MeshStandardMaterial).needsUpdate = true;
    const gap = R_TRACK + 1.55;
    if (portrait) { this.boardGrp.rotation.y = -Math.PI / 2; this.boardGrp.position.set(0, 0.005, gap + (BU * BS) / 2); }
    else { this.boardGrp.rotation.y = 0; this.boardGrp.position.set(gap + (BU * BS) / 2, 0.005, 0); }
    this.boardGrp.updateMatrixWorld(true);
    // move chips/markers to the new spots
    this.stacks.forEach((g, k) => g.position.copy(this.keyWorld(k)));
    if (this.dolly) this.dolly.position.copy(this.keyWorld(this.dolly.userData.key));
  }
  /** Board-plane local position of a layout point. */
  private local(u: number, v: number) { return new THREE.Vector3(u * BS - (BU * BS) / 2, (BV * BS) / 2 - v * BS, 0); }
  private keyWorld(key: string) {
    const r = cellRect(key)!;
    const p = this.local((r[0] + r[2]) / 2, (r[1] + r[3]) / 2);
    this.board.updateMatrixWorld(true);
    return this.board.localToWorld(p).setY(0.01);
  }
  private rectGlow(key: string, color: number, opacity: number) {
    const r = cellRect(key); if (!r) return null;
    const w = (r[2] - r[0]) * BS, h = (r[3] - r[1]) * BS;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: cellGlowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.copy(this.local((r[0] + r[2]) / 2, (r[1] + r[3]) / 2)).setZ(0.004);
    this.hl.add(m);
    return m;
  }
  private boardKey(e: { clientX: number; clientY: number }) {
    const hit = this.pick(e, [this.board]);
    if (!hit) return null;
    const p = this.board.worldToLocal(hit.point.clone());
    return cellAt((p.x + (BU * BS) / 2) / BS, ((BV * BS) / 2 - p.y) / BS);
  }

  /** Taps on the printed layout call `cb(key)`; hovering lights the numbers a bet covers. */
  onBet(cb: (key: string) => void, enabled: () => boolean) {
    const cv = this.renderer.domElement;
    cv.addEventListener('click', (e) => { if (!enabled()) return; const k = this.boardKey(e); if (k) cb(k); });
    cv.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const k = enabled() ? this.boardKey(e) : null;
      cv.style.cursor = k ? 'pointer' : 'default';
      this.setHover(k);
    });
    cv.addEventListener('pointerleave', () => this.setHover(null));
  }
  private setHover(k: string | null) {
    if (k === this.hoverKey) return;
    this.hoverKey = k;
    this.hl.children.filter((c) => c.userData.hover).forEach((c) => this.hl.remove(c));
    if (!k) return;
    const keys = k.startsWith('n:') ? [k] : [k, ...ALL_KEYS.filter((x) => x.startsWith('n:') && covers(k, +x.slice(2)))];
    keys.forEach((x) => { const m = this.rectGlow(x, 0xfff1c0, x === k ? 0.5 : 0.35); if (m) m.userData.hover = true; });
  }

  /** Show the current bets as chip stacks (new chips drop in). */
  setBets(bets: Record<string, number>) {
    this.clearResult();
    for (const [k, g] of this.stacks) if (!bets[k]) { this.scene.remove(g); this.stacks.delete(k); }
    for (const [k, amt] of Object.entries(bets)) {
      const old = this.stacks.get(k);
      if (old?.userData.amount === amt) continue;
      const prevN = old?.userData.n ?? 0;
      if (old) this.scene.remove(old);
      const g = chipStack(amt, 0.3, 2.3);
      g.userData.amount = amt;
      g.position.copy(this.keyWorld(k));
      this.scene.add(g); this.stacks.set(k, g);
      g.children.forEach((ch, i) => {
        if ((ch as THREE.Sprite).isSprite || i < prevN) return;
        const y1 = ch.position.y, y0 = y1 + 1.2, d = (i - prevN) * 40;
        ch.position.y = y0;
        this.anim(240 + d, (k2) => { const t = Math.max(0, (k2 * (240 + d) - d) / 240); ch.position.y = y0 + (y1 - y0) * (1 - Math.pow(1 - t, 3)); }, () => {});
      });
    }
  }

  /** After a spin: mark the number with the dolly, pay winners, sweep losers. */
  showResult(n: number) {
    this.clearResult(false);
    const key = `n:${n}`;
    // pulsing glow on every winning spot
    for (const k of ALL_KEYS) if (covers(k, n)) { const m = this.rectGlow(k, 0xf4c430, k === key ? 0.95 : 0.5); if (m) this.winGlows.push(m); }
    // the dolly drops onto the winning number
    const d = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.5, 24), MAT.gold);
    base.position.y = 0.25; base.castShadow = true;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 12), std(0xf8f6ef, { roughness: 0.2 }));
    cap.position.y = 0.55;
    const glow = glowSprite('rgba(244,196,48,.9)', 1.4, 0.7); glow.position.y = 0.5;
    d.add(base, cap, glow); d.userData.key = key;
    d.position.copy(this.keyWorld(key));
    this.scene.add(d); this.dolly = d;
    const y1 = d.position.y;
    this.anim(520, (k) => { d.position.y = y1 + (1 - easeBounce(k)) * 3; }, () => {});
    // chips: winners get paid next to them, losers slide off to the wheel
    for (const [k, g] of [...this.stacks]) {
      const from = g.position.clone();
      if (covers(k, n)) {
        const amt = g.userData.amount as number;
        const pay = chipStack(amt * (returns(k) - 1), 0.3, 2.3);
        pay.position.set(0, 0.3, 0); this.scene.add(pay);
        const to = from.clone().add(new THREE.Vector3(0.28, 0, -0.18));
        this.anim(700, (t) => { const e = 1 - Math.pow(1 - t, 3); pay.position.lerpVectors(new THREE.Vector3(0, 0.6, 0), to, e); pay.position.y += Math.sin(Math.PI * t) * 1.5; }, () => {});
        pay.userData.ghost = true; this.stacks.set(`${k}#pay`, pay);
      } else {
        this.stacks.delete(k);
        setTimeout(() => this.anim(650, (t) => {
          const e = t * t * (3 - 2 * t);
          g.position.lerpVectors(from, new THREE.Vector3(0, 0.4, 0), e); g.position.y += Math.sin(Math.PI * t) * 0.8;
          g.scale.setScalar(1 - e * 0.7);
        }, () => this.scene.remove(g)), 350);
      }
    }
  }

  /** Remove the dolly, glows and any paid-out chips (before the next round). */
  clearResult(all = true) {
    this.winGlows.forEach((m) => this.hl.remove(m)); this.winGlows = [];
    if (this.dolly) { this.scene.remove(this.dolly); this.dolly = null; }
    if (all) for (const [k, g] of [...this.stacks]) if (k.includes('#') || g.userData.settled) { this.scene.remove(g); this.stacks.delete(k); }
  }
  /** Winning stacks stay on the layout until the next bet; mark them so setBets clears them. */
  markSettled() { this.stacks.forEach((g) => { g.userData.settled = true; }); }

  private anim(dur: number, step: (k: number) => void, done: () => void) { this.anims.push({ t0: performance.now(), dur, step, done }); }

  private sector(r0: number, r1: number, a0: number, a1: number) {
    const s = new THREE.Shape();
    s.absarc(0, 0, r1, a0, a1, false);
    s.absarc(0, 0, r0, a1, a0, true);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false, curveSegments: 4 });
    geo.rotateX(-Math.PI / 2);
    return geo;
  }

  /** 'side' = wheel on the left (board on the right), 'top' = wheel at the top (board below). */
  setLayout(l: 'side' | 'top') { if (l !== this.layout) { this.layout = l; this.placeBoard(); } this.onResize(); }

  protected onResize() {
    if (!this.rotor || !this.board) return;
    const side = this.layout === 'side';
    if (this.cine) this.frame(new THREE.Vector3(0, 0, 0.2), side ? 10.5 : 9.4, side ? 9.6 : 9.4, new THREE.Vector3(0, 2.3, 1), 1);
    else if (side) this.frame(new THREE.Vector3(5.9, 0, 0.35), 21.4, 9.8, new THREE.Vector3(0, 1.9, 1), 1);
    else { const start = 2.4, end = R_TRACK + 1.55 + BU * BS + 0.5; this.frame(new THREE.Vector3(0, 0, (start + end) / 2 + 0.5), BV * BS + 0.8, end - start + 1.2, new THREE.Vector3(0, 3.4, 1), 1); }
  }

  private setCine(on: boolean) { if (this.cine !== on) { this.cine = on; this.onResize(); } }

  /** Spin so the ball lands on `number`. Resolves when it settles. */
  spin(number: number, durMs: number, onBounce: () => void) {
    const target = WHEEL_ORDER.indexOf(number);
    this.landed = null;
    this.winIdx = null;
    clearTimeout(this.cineTimer);
    this.pocketMats.forEach((ms) => ms.forEach((m) => m.emissive.setHex(0x000000)));
    (this.marker.material as THREE.MeshBasicMaterial).opacity = 0;
    const dr = Math.PI * 2 * 2.2; // rotor turns ~2 times
    const rEnd = this.rotorAngle + dr;
    const bEndRaw = rEnd + target * SEG;
    // ball travels the opposite way, ~6 laps
    let db = bEndRaw - this.ballAngle;
    db = ((db % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI * 2 * 6;
    this.rotorSpeed = 0;
    this.ballRadius = R_TRACK; this.ballY = Y_TRACK;
    return new Promise<void>((resolve) => {
      this.spinAnim = { t0: performance.now(), dur: durMs, r0: this.rotorAngle, dr, b0: this.ballAngle, db, target, resolve, onBounce, bounced: 0 };
    });
  }

  protected update(dt: number, t: number) {
    const now = performance.now();
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const an = this.anims[i]; if (!an) continue;
      const k = Math.min(1, (now - an.t0) / an.dur);
      an.step(k);
      if (k >= 1) { this.anims.splice(this.anims.indexOf(an), 1); an.done(); }
    }
    this.winGlows.forEach((m, i) => { (m.material as THREE.MeshBasicMaterial).opacity = (i === 0 ? 0.75 : 0.4) + Math.sin(t * 5) * 0.2; });
    const a = this.spinAnim;
    if (a) {
      const k = Math.min(1, (performance.now() - a.t0) / a.dur);
      this.rotorAngle = a.r0 + a.dr * (1 - Math.pow(1 - k, 2.2));
      this.ballAngle = a.b0 + a.db * (1 - Math.pow(1 - k, 2.6));
      // ball rides the outer track, then spirals down and bounces into the pocket
      if (k > 0.5) this.setCine(true);
      if (k < 0.55) { this.ballRadius = R_TRACK - 0.02; this.ballY = Y_TRACK - 0.02; }
      else if (k < 0.9) {
        const q = (k - 0.55) / 0.35;
        this.ballRadius = R_TRACK - (R_TRACK - (R_POCKET_IN + R_POCKET_OUT) / 2) * Math.min(1, q * 1.2);
        const bounce = Math.abs(Math.sin(q * Math.PI * 4)) * 0.28 * (1 - q);
        this.ballY = Y_TRACK - (Y_TRACK - Y_POCKET - 0.1) * Math.min(1, q * 1.2) + bounce;
        const nb = Math.floor(q * 4);
        if (nb > a.bounced) { a.bounced = nb; a.onBounce(); }
      } else { this.ballRadius = (R_POCKET_IN + R_POCKET_OUT) / 2; this.ballY = Y_POCKET + 0.1; }
      if (k >= 1) {
        this.spinAnim = null;
        this.landed = a.target;
        this.winIdx = a.target;
        this.rotorSpeed = 0.35;
        (this.marker.material as THREE.MeshBasicMaterial).opacity = 1;
        this.cineTimer = window.setTimeout(() => this.setCine(false), 1900);
        a.resolve();
      }
    } else {
      this.rotorAngle += this.rotorSpeed * dt;
      if (this.landed !== null) {
        this.ballAngle = this.rotorAngle + this.landed * SEG;
      } else {
        this.ballAngle -= 0.0;
      }
    }
    this.rotor.rotation.y = this.rotorAngle;
    this.ball.position.copy(polar(this.ballAngle, this.ballRadius, this.ballY));
    // glowing trail while the ball is flying round the track
    const fast = !!this.spinAnim && (performance.now() - this.spinAnim.t0) / this.spinAnim.dur < 0.8;
    this.trailPts.unshift(this.ball.position.clone());
    this.trailPts.length = Math.min(this.trailPts.length, this.trail.length);
    this.trail.forEach((s, i) => {
      const p = this.trailPts[i]; if (p) s.position.copy(p);
      const target = fast ? 0.55 * (1 - i / this.trail.length) : 0;
      s.material.opacity += (target - s.material.opacity) * Math.min(1, dt * 10);
    });
    if (this.winIdx !== null) {
      const pulse = 0.35 + Math.sin(t * 6) * 0.25;
      this.pocketMats[this.winIdx].forEach((m) => m.emissive.setRGB(pulse, pulse * 0.8, pulse * 0.3));
    }
    if (this.landed !== null) {
      this.marker.position.copy(polar(this.ballAngle, R_NUM_OUT + 0.25, Y_TRACK - 0.1));
      (this.marker.material as THREE.MeshBasicMaterial).opacity = 0.6 + Math.sin(t * 6) * 0.35;
    }
  }

  dispose() { clearTimeout(this.cineTimer); super.dispose(); }
}

const easeBounce = (x: number) => {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
};

function feltTexture(th: TableTheme | null) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const g = cv.getContext('2d')!;
  const grd = g.createRadialGradient(256, 256, 20, 256, 256, 360);
  // classic keeps the green baize; any other table skin dyes the felt
  const c = th ? new THREE.Color(th.felt) : null;
  grd.addColorStop(0, c ? `#${c.getHexString()}` : '#11583a'); grd.addColorStop(1, c ? `#${c.clone().lerp(new THREE.Color(th!.edge), 0.5).getHexString()}` : '#0a3a26');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
  const id = g.getImageData(0, 0, 512, 512);
  for (let i = 0; i < id.data.length; i += 4) { const v = (Math.random() - 0.5) * 14; id.data[i] += v; id.data[i + 1] += v; id.data[i + 2] += v; }
  g.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 10);
  return t;
}

function coneTexture() {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 128;
  const g = cv.getContext('2d')!;
  for (let i = 0; i < 16; i++) {
    const grd = g.createLinearGradient(i * 64, 0, i * 64 + 64, 0);
    grd.addColorStop(0, i % 2 ? '#6b3f1d' : '#4a2812'); grd.addColorStop(1, i % 2 ? '#5a3217' : '#3b1f0d');
    g.fillStyle = grd; g.fillRect(i * 64, 0, 64, 128);
    g.fillStyle = '#d9a914'; g.fillRect(i * 64, 0, 3, 128);
  }
  g.fillStyle = 'rgba(244,196,48,.8)'; g.fillRect(0, 118, 1024, 10);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

let cellGlow: THREE.CanvasTexture | null = null;
function cellGlowTexture() {
  if (cellGlow) return cellGlow;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 10, 64, 64, 90);
  grd.addColorStop(0, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,.15)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(4, 4, 120, 120);
  cellGlow = new THREE.CanvasTexture(cv);
  return cellGlow;
}

const boardCache = new Map<string, THREE.CanvasTexture>();
/** The printed betting layout. `portrait` rotates the labels so they read upright on phones. */
function boardTexture(portrait: boolean, th: TableTheme | null) {
  const cacheKey = `${portrait}|${th ? `${th.felt}-${th.trim}-${th.ink}` : 'classic'}`;
  const hit = boardCache.get(cacheKey); if (hit) return hit;
  const P = 110, W = BU * P, H = BV * P;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = Math.round(H);
  const g = cv.getContext('2d')!;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const c0 = th ? `#${new THREE.Color(th.felt).getHexString()}` : '#0f5c3a', c1 = th ? `#${new THREE.Color(th.felt).lerp(new THREE.Color(th.edge), 0.4).getHexString()}` : '#0b4a2f';
  // line + label colours follow the table skin's trim / ink (gold on classic)
  const tc = th ? new THREE.Color(th.trim) : new THREE.Color(0xf4c430);
  const lineA = (a: number) => `#${tc.getHexString()}${Math.round(a * 255).toString(16).padStart(2, '0')}`;
  const inkC = th ? th.ink : '#F4C430';
  const label = (text: string, cx: number, cy: number, size: number, color: string, weight = 900) => {
    g.save(); g.translate(cx, cy); if (portrait) g.rotate(-Math.PI / 2);
    g.fillStyle = color; g.font = `${weight} ${size}px Montserrat, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 4; g.fillText(text, 0, size * 0.04); g.restore();
  };
  const cell = (key: string, fill: string | null) => {
    const r = cellRect(key)!;
    const x = r[0] * P, y = r[1] * P, w = (r[2] - r[0]) * P, h = (r[3] - r[1]) * P;
    if (fill) { g.fillStyle = fill; roundRect(g, x + 6, y + 6, w - 12, h - 12, 12); g.fill(); }
    g.strokeStyle = lineA(.85); g.lineWidth = 3; g.strokeRect(x, y, w, h);
    return { cx: x + w / 2, cy: y + h / 2, w, h };
  };
  const draw = () => {
    g.clearRect(0, 0, W, H);
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, c0); bg.addColorStop(1, c1);
    g.fillStyle = bg; roundRect(g, 0, 0, W, H, 26); g.fill();
    // zero
    { const c = cell('n:0', null); g.fillStyle = '#0e8f4a'; g.beginPath(); g.moveTo(c.cx - c.w / 2 + 10, c.cy); g.lineTo(c.cx + c.w / 2 - 8, 10); g.lineTo(c.cx + c.w / 2 - 8, c.h * 1 - 10); g.closePath(); g.fill(); label('0', c.cx + 8, c.cy, 62, '#fff'); }
    for (let n = 1; n <= 36; n++) {
      const c = cell(`n:${n}`, REDS.has(n) ? '#c21a2a' : '#141414');
      label(String(n), c.cx, c.cy, portrait ? 60 : 66, '#F8F6EF');
    }
    for (const k of ['c1', 'c2', 'c3']) { const c = cell(k, null); label('2 to 1', c.cx, c.cy, 36, inkC, 900); }
    (['d1', 'd2', 'd3'] as const).forEach((k, i) => { const c = cell(k, null); label(['1st 12', '2nd 12', '3rd 12'][i], c.cx, c.cy, 54, inkC); });
    OUTSIDE.forEach((k) => {
      const c = cell(k, null);
      if (k === 'red' || k === 'black') {
        g.save(); g.translate(c.cx, c.cy); g.fillStyle = k === 'red' ? '#d62839' : '#0b0b0b';
        g.beginPath(); g.moveTo(0, -36); g.lineTo(62, 0); g.lineTo(0, 36); g.lineTo(-62, 0); g.closePath(); g.fill();
        g.strokeStyle = lineA(.8); g.lineWidth = 3; g.stroke(); g.restore();
      } else label({ low: '1–18', even: 'EVEN', odd: 'ODD', high: '19–36' }[k]!, c.cx, c.cy, 50, inkC);
    });
    g.strokeStyle = inkC; g.lineWidth = 6; roundRect(g, 3, 3, W - 6, H - 6, 24); g.stroke();
    tex.needsUpdate = true;
  };
  draw();
  document.fonts?.ready.then(draw);
  boardCache.set(cacheKey, tex);
  return tex;
}
