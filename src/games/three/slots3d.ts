import * as THREE from 'three';
import { Stage3D } from './stage';
import { MAT, box, glowSprite, labelPlane, makeChicken, makeCoin, std, textTexture } from './models';
import { roundRect } from './cardArt';
import { drawSymbol, loadSlotArt } from './slotArt';
import { LINE_COLORS, PAYLINES, REELS, STRIPS, SYMBOLS, Sym } from '../../lib/slots';

/**
 * The Golden Coop slot cabinet: five real spinning drums behind a gold bezel,
 * chasing marquee bulbs, a pull lever and payline markers on both sides.
 */
const FACES = 10;
const TH = (Math.PI * 2) / FACES;
const SYM_H = 1.42;
const R = SYM_H / (2 * Math.sin(TH / 2));
const FACE_W = 1.5;
const RW = 1.62;
const HALF_H = R * Math.sin(TH * 1.5); // window half height (3 rows)
const HALF_W = (REELS * RW) / 2;
const reelX = (r: number) => (r - (REELS - 1) / 2) * RW;
const mod = (a: number, n: number) => ((a % n) + n) % n;
const easeOutBack = (k: number, c = 1.1) => 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);

interface Reel {
  pivots: THREE.Object3D[];
  faces: THREE.Mesh[];
  p: number;
  shift: number;
  vel: number;
  phase: 'idle' | 'windup' | 'spin' | 'stop';
  t0: number;
  from: number;
  to: number;
  dur: number;
  stopAt: number;
  target: number;
  done?: () => void;
}

export class SlotsScene extends Stage3D {
  private reels: Reel[] = [];
  private mats = new Map<string, THREE.MeshStandardMaterial>();
  private bulbs: THREE.Mesh[] = [];
  private bulbOn = std(0xffe08a, { emissive: 0xffc23d, emissiveIntensity: 1.6, roughness: 0.3 });
  private bulbOff = std(0x5a3a10, { emissive: 0x2a1500, roughness: 0.4 });
  private bulbFree = std(0xff8a8a, { emissive: 0xe63946, emissiveIntensity: 1.8, roughness: 0.3 });
  private winGroup = new THREE.Group();
  private dims: THREE.Mesh[][] = [];
  private tabs: THREE.Mesh[] = [];
  private lever = new THREE.Group();
  private leverAnim = 0;
  private tease: THREE.Sprite[] = [];
  private signGlow: THREE.Sprite;
  private sign: THREE.Mesh;
  private free = false;
  private speed = 18;
  private pulseT = 0;
  private coinRain = 0;
  private leds: THREE.Texture[] = [];
  private ledMats: THREE.MeshBasicMaterial[] = [];
  private rays: THREE.Mesh;
  private topper: ReturnType<typeof makeChicken>;
  private flashes: { s: THREE.Sprite; t0: number }[] = [];
  private popCells = new Set<string>();
  private winMode = 0; // >0 while a win is on show (drives sparkles + LED colour)
  private dust: THREE.Points;

  constructor(host: HTMLElement) {
    super(host, { fov: 30, bg: 0x0b0709 });
    this.parallax = 0.25;
    this.key.position.set(-3, 9, 12);
    this.key.intensity = 2;

    loadSlotArt().then(() => document.fonts?.ready).then(() => this.refreshArt());

    // ---- room ----
    // glossy casino floor with a patterned carpet runner
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshStandardMaterial({ color: 0x1a0c10, roughness: 0.22, metalness: 0.55 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -6.2; floor.receiveShadow = true;
    this.scene.add(floor);
    // neighbouring machines down the row, out of focus
    for (const side of [-1, 1]) for (let k = 0; k < 2; k++) {
      const x = side * (13.5 + k * 9), z = -5 - k * 4;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(8, 12, 4), std(k ? 0x2a0710 : 0x3a0912, { roughness: 0.4, metalness: 0.3 }));
      cab.position.set(x, -0.2, z - 2); this.scene.add(cab);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.4), new THREE.MeshBasicMaterial({ color: [0xffb347, 0x7c3aed, 0x22d3ee, 0xe63946][(k * 2 + (side > 0 ? 1 : 0)) % 4], transparent: true, opacity: 0.35 }));
      screen.position.set(x, 0.6, z + 0.01); this.scene.add(screen);
      const g = glowSprite('rgba(255,190,90,1)', 9, 0.18); g.position.set(x, 5.2, z + 0.5); this.scene.add(g);
    }
    // light beams from the ceiling
    for (const [x, c] of [[-7, 0xffd27a], [7, 0xff6b6b], [0, 0xfff1c0]] as [number, number][]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(3.2, 16, 32, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.05, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      cone.position.set(x, 4, -3.5); this.scene.add(cone);
    }
    // drifting gold dust
    const n = 260, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 30; pos[i * 3 + 1] = -5 + Math.random() * 14; pos[i * 3 + 2] = -6 + Math.random() * 9; }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xffd27a, size: 0.06, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.scene.add(this.dust);
    for (let i = 0; i < 22; i++) {
      const s = glowSprite(Math.random() < 0.65 ? 'rgba(255,200,90,1)' : 'rgba(230,57,70,1)', 1 + Math.random() * 2.5, 0.12 + Math.random() * 0.18);
      s.position.set((Math.random() - 0.5) * 46, -3 + Math.random() * 14, -10 - Math.random() * 10);
      this.scene.add(s);
    }
    const halo = glowSprite('rgba(244,196,48,1)', 22, 0.12); halo.position.set(0, 0.5, -4); this.scene.add(halo);

    // ---- cabinet body with a window cut out ----
    const lacquer = std(0x6b0d16, { metalness: 0.35, roughness: 0.32 });
    const OW = 11.2, OT = 4.6, OB = -3.9;
    const shape = new THREE.Shape();
    rr(shape, -OW / 2, OB, OW, OT - OB, 0.6);
    const hole = new THREE.Path();
    rr(hole, -HALF_W - 0.06, -HALF_H - 0.04, HALF_W * 2 + 0.12, HALF_H * 2 + 0.08, 0.18);
    shape.holes.push(hole);
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 3 }), lacquer);
    body.position.z = 0.02; body.castShadow = true; body.receiveShadow = true;
    this.scene.add(body);
    // cabinet sides/back so it reads as a solid machine
    // (only the outer walls — a solid block would cover the reels)
    const wall = std(0x3a070d, { roughness: 0.5 }), D = 5.2, H = OT - OB - 0.2;
    for (const [w, h, x, y] of [[0.3, H, -OW / 2 + 0.25, (OT + OB) / 2], [0.3, H, OW / 2 - 0.25, (OT + OB) / 2], [OW - 0.2, 0.3, 0, OT - 0.25], [OW - 0.2, 0.3, 0, OB + 0.25]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, D), wall); m.position.set(x, y, -D / 2); this.scene.add(m);
    }
    // gold bezel ring around the reels
    const bz = new THREE.Shape(); rr(bz, -HALF_W - 0.34, -HALF_H - 0.32, HALF_W * 2 + 0.68, HALF_H * 2 + 0.64, 0.32);
    const bh = new THREE.Path(); rr(bh, -HALF_W - 0.06, -HALF_H - 0.04, HALF_W * 2 + 0.12, HALF_H * 2 + 0.08, 0.18); bz.holes.push(bh);
    const bezel = new THREE.Mesh(new THREE.ExtrudeGeometry(bz, { depth: 0.2, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 3 }), MAT.gold);
    bezel.position.z = 0.6; this.scene.add(bezel);
    // reel well behind the drums
    const well = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2 + 0.4, HALF_H * 2 + 0.4), new THREE.MeshBasicMaterial({ color: 0x050304 }));
    well.position.z = -R * 1.2; this.scene.add(well);

    // ---- the drums ----
    for (let r = 0; r < REELS; r++) {
      const reel: Reel = { pivots: [], faces: [], p: Math.floor(Math.random() * STRIPS[r].length), shift: 0, vel: 0, phase: 'idle', t0: 0, from: 0, to: 0, dur: 0, stopAt: 0, target: 0 };
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.04, R - 0.04, FACE_W, 48, 1), std(0x140b0d, { roughness: 0.8 }));
      drum.rotation.z = Math.PI / 2; drum.position.set(reelX(r), 0, -R);
      this.scene.add(drum);
      for (let j = 0; j < FACES; j++) {
        const pivot = new THREE.Object3D(); pivot.position.set(reelX(r), 0, -R);
        const face = new THREE.Mesh(bentPlane(), this.mat(STRIPS[r][0], false));
        face.position.z = R;
        pivot.add(face); this.scene.add(pivot);
        reel.pivots.push(pivot); reel.faces.push(face);
      }
      this.reels.push(reel);
      this.layoutReel(r);
      // drum end rims
      for (const s of [-1, 1]) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(R - 0.02, 0.03, 6, 64), MAT.gold);
        rim.rotation.y = Math.PI / 2; rim.position.set(reelX(r) + s * (FACE_W / 2 + 0.01), 0, -R);
        this.scene.add(rim);
      }
      // per-cell dimmers for win presentation
      this.dims.push([0, 1, 2].map((row) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(FACE_W, SYM_H * 0.99), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
        placeOnCell(m, r, row, 0.02); this.scene.add(m); return m;
      }));
      const t = glowSprite('rgba(244,196,48,1)', 3.4, 0); t.scale.set(2.2, 5.2, 1); t.position.set(reelX(r), 0, 0.2); this.scene.add(t); this.tease.push(t);
    }
    // separators between reels
    for (let r = 1; r < REELS; r++) {
      const sep = new THREE.Mesh(new THREE.BoxGeometry(0.07, HALF_H * 2 + 0.1, 0.1), MAT.gold);
      sep.position.set(reelX(r) - RW / 2, 0, 0.12); this.scene.add(sep);
    }
    // glass: shading top and bottom, a soft reflection streak
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2 + 0.12, HALF_H * 2 + 0.1), new THREE.MeshBasicMaterial({ map: glassTexture(), transparent: true, depthWrite: false }));
    glass.position.z = 0.3; glass.renderOrder = 2; this.scene.add(glass);
    this.winGroup.renderOrder = 3; this.scene.add(this.winGroup);

    // ---- payline tabs (1-10 left, 11-20 right) ----
    for (let i = 0; i < 20; i++) {
      const left = i < 10, k = i % 10;
      const tab = labelPlane(textTexture(String(i + 1), { w: 96, h: 72, size: 40, color: '#0b0b0b', bg: LINE_COLORS[i], radius: 18 }), 0.42, 0.31);
      tab.position.set((left ? -1 : 1) * (HALF_W + 0.72), HALF_H - 0.2 - k * ((HALF_H * 2 - 0.4) / 9), 0.76);
      (tab.material as THREE.MeshBasicMaterial).opacity = 0.55;
      this.scene.add(tab); this.tabs.push(tab);
    }

    // ---- sign ----
    this.sign = labelPlane(signTexture(), 8.2, 1.64);
    this.sign.position.set(0, 3.55, 0.75); this.scene.add(this.sign);
    this.signGlow = glowSprite('rgba(244,196,48,1)', 9, 0.32); this.signGlow.scale.set(11, 3.4, 1); this.signGlow.position.set(0, 3.55, 0.5); this.scene.add(this.signGlow);
    // win display panel (DOM text is anchored on top)
    const lcd = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.9, 0.1), std(0x050505, { roughness: 0.2, metalness: 0.5 }));
    lcd.position.set(0, -3.05, 0.66); this.scene.add(lcd);
    const lcdRim = new THREE.Mesh(new THREE.BoxGeometry(5.36, 1.06, 0.06), MAT.gold); lcdRim.position.set(0, -3.05, 0.62); this.scene.add(lcdRim);

    // ---- marquee bulbs around the cabinet ----
    const path = new THREE.CurvePath<THREE.Vector3>();
    const c = [[-OW / 2 + 0.3, OB + 0.3], [OW / 2 - 0.3, OB + 0.3], [OW / 2 - 0.3, OT - 0.3], [-OW / 2 + 0.3, OT - 0.3], [-OW / 2 + 0.3, OB + 0.3]];
    for (let i = 0; i < 4; i++) path.add(new THREE.LineCurve3(new THREE.Vector3(c[i][0], c[i][1], 0.72), new THREE.Vector3(c[i + 1][0], c[i + 1][1], 0.72)));
    const bulbGeo = new THREE.SphereGeometry(0.075, 12, 8);
    for (let i = 0; i < 56; i++) { const b = new THREE.Mesh(bulbGeo, this.bulbOff); b.position.copy(path.getPointAt(i / 56)); this.scene.add(b); this.bulbs.push(b); }

    // ---- lever ----
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.5, 24), std(0xb8bcc8, { metalness: 0.9, roughness: 0.25 }));
    base.rotation.z = Math.PI / 2; base.position.set(OW / 2 + 0.2, -0.6, -0.4); this.scene.add(base);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 12), std(0xdfe3ea, { metalness: 0.95, roughness: 0.15 }));
    rod.position.y = 1.3;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), std(0xe63946, { roughness: 0.25, metalness: 0.1 }));
    knob.position.y = 2.65; knob.castShadow = true;
    this.lever.add(rod, knob); this.lever.position.set(OW / 2 + 0.5, -0.6, -0.4); this.lever.rotation.x = -0.15;
    this.scene.add(this.lever);

    // ---- topper: a golden rooster crowing on the roof, light rays behind ----
    this.rays = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: raysTexture(), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.rays.position.set(0, OT + 0.9, -0.6); this.scene.add(this.rays);
    this.topper = makeChicken('#F4C430');
    this.topper.skin.metalness = 0.75; this.topper.skin.roughness = 0.25; this.topper.skin.emissive.set(0x3a2600);
    this.topper.root.scale.setScalar(0.85); this.topper.root.rotation.y = -Math.PI / 2; this.topper.root.position.set(0, OT + 0.05, 0.1);
    const crown = new THREE.Group();
    for (let i = -1; i <= 1; i++) crown.add(box(MAT.goldBright, [0.1, 0.22 + (i === 0 ? 0.1 : 0), 0.1], [0, 0.1, i * 0.16]));
    crown.add(box(MAT.goldBright, [0.36, 0.08, 0.46], [0, -0.02, 0]));
    crown.position.set(0.25, 1.98, 0); this.topper.body.add(crown);
    this.scene.add(this.topper.root);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.25, 32), MAT.gold); plinth.position.set(0, OT + 0.02, 0.1); this.scene.add(plinth);

    // ---- LED light strips (bezel ring + cabinet sides), colour-cycling ----
    const ring = new THREE.CurvePath<THREE.Vector3>();
    const bw = HALF_W + 0.46, bhh = HALF_H + 0.44, zr = 0.9;
    const pts = [[-bw, -bhh], [bw, -bhh], [bw, bhh], [-bw, bhh], [-bw, -bhh]];
    for (let i = 0; i < 4; i++) ring.add(new THREE.LineCurve3(new THREE.Vector3(pts[i][0], pts[i][1], zr), new THREE.Vector3(pts[i + 1][0], pts[i + 1][1], zr)));
    const sideL = new THREE.LineCurve3(new THREE.Vector3(-OW / 2 - 0.12, OB + 0.4, 0.4), new THREE.Vector3(-OW / 2 - 0.12, OT - 0.4, 0.4));
    const sideR = new THREE.LineCurve3(new THREE.Vector3(OW / 2 + 0.12, OB + 0.4, 0.4), new THREE.Vector3(OW / 2 + 0.12, OT - 0.4, 0.4));
    for (const [curve, rep, r] of [[ring, 6, 0.045], [sideL, 2, 0.07], [sideR, 2, 0.07]] as [THREE.Curve<THREE.Vector3>, number, number][]) {
      const tex = ledTexture(); tex.repeat.set(rep, 1); this.leds.push(tex);
      const core = new THREE.MeshBasicMaterial({ map: tex });
      const glow = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending });
      this.ledMats.push(core, glow);
      this.scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 120, r, 8), core), new THREE.Mesh(new THREE.TubeGeometry(curve, 120, r * 3.2, 8), glow));
    }

    const spot = new THREE.SpotLight(0xffe2b0, 40, 30, 0.5, 0.6); spot.position.set(0, 8, 9); spot.target.position.set(0, 0, 0);
    this.scene.add(spot, spot.target);
    this.onResize();
  }

  // ---------- art ----------
  private mat(s: Sym, blur: boolean) {
    const k = `${s}${blur ? '~' : ''}`;
    let m = this.mats.get(k);
    if (!m) {
      const cv = document.createElement('canvas'); drawSymbol(cv, s, { blur });
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      m = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.42, roughness: 0.55 });
      m.userData.cv = cv; m.userData.sym = s; m.userData.blur = blur;
      this.mats.set(k, m);
    }
    return m;
  }
  private refreshArt() {
    if (this.disposed) return;
    this.mats.forEach((m) => { drawSymbol(m.userData.cv, m.userData.sym, { blur: m.userData.blur }); m.map!.needsUpdate = true; });
  }

  /** Position the faces of reel r for its current scroll position. */
  private layoutReel(r: number) {
    const reel = this.reels[r], L = STRIPS[r].length;
    const blur = Math.abs(reel.vel) > 7;
    for (let j = 0; j < FACES; j++) {
      const v = j + FACES * Math.round((reel.p - j) / FACES);
      const a = (v - reel.p) * TH;
      reel.pivots[j].rotation.x = -a;
      reel.pivots[j].visible = Math.abs(a) < Math.PI * 0.62;
      const sym = STRIPS[r][mod(v + reel.shift, L)];
      const m = this.mat(sym, blur);
      if (reel.faces[j].material !== m) reel.faces[j].material = m;
    }
  }

  // ---------- spinning ----------
  /** Spin to `stops`. `tease[r]` holds that reel back with a glow (scatter anticipation). */
  spin(stops: number[], o: { turbo?: boolean; tease?: boolean[]; onStop?: (r: number) => void } = {}) {
    this.clearWins();
    this.leverAnim = performance.now();
    this.speed = o.turbo ? 26 : 19;
    const now = performance.now();
    let extra = 0;
    return Promise.all(this.reels.map((reel, r) => new Promise<void>((res) => {
      if (o.tease?.[r]) extra += o.turbo ? 500 : 1100;
      reel.phase = 'windup'; reel.t0 = now + r * (o.turbo ? 20 : 55); reel.from = reel.p;
      reel.stopAt = now + (o.turbo ? 330 + r * 110 : 820 + r * 300) + extra;
      reel.target = stops[r];
      reel.done = () => { o.onStop?.(r); res(); };
    })));
  }

  /** Light the reels that are teasing a bonus. */
  setTease(r: number, on: boolean) { this.tease[r].material.opacity = on ? 0.55 : 0; }

  // ---------- wins ----------
  clearWins() {
    this.winGroup.clear();
    this.dims.flat().forEach((d) => { (d.material as THREE.MeshBasicMaterial).opacity = 0; });
    this.tabs.forEach((t) => { (t.material as THREE.MeshBasicMaterial).opacity = 0.55; t.scale.setScalar(1); });
    this.tease.forEach((t) => { t.material.opacity = 0; });
    this.popCells.clear(); this.winMode = 0;
    this.reels.forEach((rl) => rl.faces.forEach((f) => f.scale.set(1, 1, 1)));
  }

  /** Highlight winning cells (frames), dim the rest, and draw the given paylines. */
  showWins(lines: number[], cells: [number, number][], scatterCells: [number, number][] = []) {
    this.winGroup.clear();
    this.tabs.forEach((t) => { (t.material as THREE.MeshBasicMaterial).opacity = 0.55; t.scale.setScalar(1); });
    const win = new Set([...cells, ...scatterCells].map(([r, row]) => `${r}:${row}`));
    this.dims.forEach((col, r) => col.forEach((d, row) => { (d.material as THREE.MeshBasicMaterial).opacity = win.has(`${r}:${row}`) ? 0 : 0.58; }));
    for (const key of win) {
      const [r, row] = key.split(':').map(Number);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(FACE_W * 1.08, SYM_H * 1.06), new THREE.MeshBasicMaterial({ map: frameTexture(), color: scatterCells.some(([a, b]) => a === r && b === row) ? 0xff5a67 : 0xffd84d, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      placeOnCell(f, r, row, 0.05); f.userData.pulse = true; this.winGroup.add(f);
    }
    this.popCells = win; this.winMode = performance.now();
    this.reels.forEach((rl) => rl.faces.forEach((f) => f.scale.set(1, 1, 1)));
    lines.forEach((li) => {
      const col = new THREE.Color(LINE_COLORS[li]);
      const pts = PAYLINES[li].map((row, r) => cellPoint(r, row, 0.12));
      pts.unshift(pts[0].clone().setX(-HALF_W - 0.4)); pts.push(pts[pts.length - 1].clone().setX(HALF_W + 0.4));
      const path = new THREE.CurvePath<THREE.Vector3>();
      for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
      const core = new THREE.Mesh(new THREE.TubeGeometry(path, 80, 0.045, 8), new THREE.MeshBasicMaterial({ color: col }));
      const glow = new THREE.Mesh(new THREE.TubeGeometry(path, 80, 0.13, 8), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.winGroup.add(core, glow);
      const tab = this.tabs[li]; (tab.material as THREE.MeshBasicMaterial).opacity = 1; tab.scale.setScalar(1.25);
    });
  }

  /** Coins burst out of the machine. */
  celebrate(level: 1 | 2 | 3) {
    this.coinRain = performance.now() + level * 1100;
    this.shake = level >= 2 ? 0.25 : 0;
  }

  setFreeMode(on: boolean) {
    this.free = on;
    (this.signGlow.material as THREE.SpriteMaterial).color.set(on ? 0xff6b6b : 0xffffff);
  }

  protected onResize() {
    if (!this.reels?.length) return;
    const narrow = this.aspect < 1.05;
    this.frame(new THREE.Vector3(0.3, 1.25, 0), narrow ? 12.4 : 12.6, narrow ? 10.9 : 11.3, new THREE.Vector3(0, 0.04, 1), 1);
  }

  protected update(dt: number, t: number) {
    const now = performance.now();
    for (let r = 0; r < this.reels.length; r++) {
      const reel = this.reels[r];
      if (reel.phase === 'idle') continue;
      if (now < reel.t0) continue;
      const L = STRIPS[r].length;
      if (reel.phase === 'windup') {
        const k = Math.min(1, (now - reel.t0) / 160);
        reel.p = reel.from - Math.sin(k * Math.PI) * 0.28;
        reel.vel = 0;
        if (k >= 1) { reel.phase = 'spin'; reel.vel = 4; }
      } else if (reel.phase === 'spin') {
        reel.vel = Math.min(this.speed, reel.vel + dt * 70);
        reel.p += reel.vel * dt;
        if (now >= reel.stopAt) {
          // re-map the strip (invisible at full blur) so the stop lands a natural distance ahead
          const dur = 0.42, c = 1.1;
          const T = Math.ceil(reel.p + Math.max(1.6, (reel.vel * dur) / (c + 3)));
          reel.shift = mod(reel.target - T, L);
          reel.phase = 'stop'; reel.from = reel.p; reel.to = T; reel.t0 = now; reel.dur = dur * 1000;
        }
      } else if (reel.phase === 'stop') {
        const k = Math.min(1, (now - reel.t0) / reel.dur);
        const prev = reel.p;
        reel.p = reel.from + (reel.to - reel.from) * easeOutBack(k);
        reel.vel = (reel.p - prev) / Math.max(dt, 1e-3);
        if (k >= 1) {
          reel.p = reel.to; reel.vel = 0; reel.phase = 'idle';
          // keep numbers small
          const base = Math.floor(reel.p / L) * L; reel.p -= base; reel.shift = mod(reel.shift + base, L);
          const d = reel.done; reel.done = undefined; d?.();
          // a quick light flash down the reel as it locks in
          const fl = glowSprite('rgba(255,236,170,1)', 1, 0.9); fl.scale.set(2.4, 5.2, 1); fl.position.set(reelX(r), 0, 0.35);
          this.scene.add(fl); this.flashes.push({ s: fl, t0: now });
        }
      }
      this.layoutReel(r);
    }

    // bulbs chase (faster while spinning, red during free spins)
    const spinning = this.reels.some((r) => r.phase !== 'idle');
    const step = Math.floor(t * (spinning ? 14 : 4));
    this.bulbs.forEach((b, i) => { const on = (i + step) % 4 < 2; b.material = on ? (this.free ? this.bulbFree : this.bulbOn) : this.bulbOff; });

    // lever pull
    if (this.leverAnim) {
      const k = (now - this.leverAnim) / 520;
      this.lever.rotation.x = -0.15 + (k < 0.35 ? (k / 0.35) * 1.5 : k < 1 ? 1.5 * (1 - easeOutBack((k - 0.35) / 0.65, 1.6)) : 0);
      if (k >= 1) { this.lever.rotation.x = -0.15; this.leverAnim = 0; }
    }

    // pulsing win frames
    this.pulseT += dt;
    this.winGroup.children.forEach((m) => { if (m.userData.pulse) { const s = 1 + Math.sin(this.pulseT * 7) * 0.025; m.scale.set(s, s, 1); ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.75 + Math.sin(this.pulseT * 7) * 0.25; } });
    this.tease.forEach((s) => { if (s.material.opacity > 0) s.material.opacity = 0.4 + Math.sin(t * 10) * 0.15; });
    (this.signGlow.material as THREE.SpriteMaterial).opacity = 0.28 + Math.sin(t * 2.2) * 0.06 + (this.free ? 0.15 : 0);

    // flashes fade out
    this.flashes = this.flashes.filter((f) => { const k = (now - f.t0) / 260; if (k >= 1) { this.scene.remove(f.s); return false; } f.s.material.opacity = 0.9 * (1 - k); return true; });
    // LEDs: slow colour chase idle, fast while spinning, gold/red on wins and free spins
    const speed = spinning ? 1.6 : this.winMode ? 1.1 : 0.18;
    this.leds.forEach((tx) => { tx.offset.x = (tx.offset.x - dt * speed) % 1; });
    const tint = this.free ? 0xff4d5e : this.winMode ? (Math.floor(t * 8) % 2 ? 0xffd84d : 0xffffff) : 0xffffff;
    this.ledMats.forEach((m) => m.color.setHex(tint));
    // topper: crows (bobs) and the rays turn
    this.rays.rotation.z -= dt * (this.winMode || spinning ? 0.6 : 0.15);
    (this.rays.material as THREE.MeshBasicMaterial).opacity = this.winMode ? 0.8 : 0.45;
    this.topper.root.position.y = 4.65 + Math.abs(Math.sin(t * (this.winMode ? 6 : 1.2))) * (this.winMode ? 0.25 : 0.05);
    this.topper.root.rotation.y = -Math.PI / 2 + Math.sin(t * 0.7) * 0.25;
    // winning symbols pop + sparkle
    if (this.popCells.size) {
      const s = 1 + Math.abs(Math.sin(this.pulseT * 5)) * 0.1;
      this.reels.forEach((rl, r) => rl.pivots.forEach((pv, j) => {
        const row = Math.round(1 + pv.rotation.x / TH);
        rl.faces[j].scale.set(this.popCells.has(`${r}:${row}`) && Math.abs(pv.rotation.x + (1 - row) * TH) < 0.05 ? s : 1, this.popCells.has(`${r}:${row}`) && Math.abs(pv.rotation.x + (1 - row) * TH) < 0.05 ? s : 1, 1);
      }));
      if (Math.random() < 0.35) {
        const key = [...this.popCells][Math.floor(Math.random() * this.popCells.size)];
        const [r, row] = key.split(':').map(Number);
        const sp = glowSprite('rgba(255,244,200,1)', 0.35, 1);
        sp.position.copy(cellPoint(r, row, 0.3)).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.1, 0));
        this.addParticle(sp, new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.8 + Math.random(), 0.3), 0.8, 0.5);
      }
    }
    // dust drifts upward
    const dp = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < dp.count; i++) { let y = dp.getY(i) + dt * 0.25; if (y > 9) y = -5; dp.setY(i, y); }
    dp.needsUpdate = true;

    // coin fountain
    if (now < this.coinRain && Math.random() < 0.9) {
      for (let i = 0; i < 2; i++) {
        const c = makeCoin(0.2);
        c.position.set((Math.random() - 0.5) * 4, -2.6, 1.2);
        this.addParticle(c, new THREE.Vector3((Math.random() - 0.5) * 7, 7 + Math.random() * 5, 2 + Math.random() * 2.5), 2.2, 11, -6);
      }
    }
  }
}

// ---------- helpers ----------
function rr(s: THREE.Shape | THREE.Path, x: number, y: number, w: number, h: number, r: number) {
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
}

/** A plane bent around the drum (its centre sits at z=0, edges curve back). */
function bentPlane() {
  const h = R * TH * 0.985;
  const g = new THREE.PlaneGeometry(FACE_W, h, 1, 8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const a = p.getY(i) / R; p.setY(i, R * Math.sin(a)); p.setZ(i, R * Math.cos(a) - R); }
  g.computeVertexNormals();
  return g;
}

function cellPoint(r: number, row: number, lift = 0) {
  const a = (1 - row) * TH;
  return new THREE.Vector3(reelX(r), R * Math.sin(a), -R + (R + lift) * Math.cos(a));
}
function placeOnCell(m: THREE.Object3D, r: number, row: number, lift: number) {
  m.position.copy(cellPoint(r, row, lift));
  m.rotation.x = -(1 - row) * TH;
}

let frameTex: THREE.CanvasTexture | null = null;
function frameTexture() {
  if (frameTex) return frameTex;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 240;
  const g = cv.getContext('2d')!;
  g.shadowColor = '#fff'; g.shadowBlur = 18; g.strokeStyle = '#fff'; g.lineWidth = 10;
  roundRect(g, 14, 14, 228, 212, 26); g.stroke();
  g.shadowBlur = 0; g.lineWidth = 4; roundRect(g, 14, 14, 228, 212, 26); g.stroke();
  frameTex = new THREE.CanvasTexture(cv);
  return frameTex;
}

function glassTexture() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256;
  const g = cv.getContext('2d')!;
  const v = g.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, 'rgba(0,0,0,.78)'); v.addColorStop(0.16, 'rgba(0,0,0,.18)'); v.addColorStop(0.5, 'rgba(0,0,0,0)'); v.addColorStop(0.84, 'rgba(0,0,0,.18)'); v.addColorStop(1, 'rgba(0,0,0,.8)');
  g.fillStyle = v; g.fillRect(0, 0, 64, 256);
  g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, 40, 64, 18);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function signTexture() {
  const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 256;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const draw = () => {
    const g = cv.getContext('2d')!;
    g.clearRect(0, 0, 1280, 256);
    g.fillStyle = '#120608'; roundRect(g, 8, 8, 1264, 240, 60); g.fill();
    g.strokeStyle = '#F4C430'; g.lineWidth = 10; roundRect(g, 8, 8, 1264, 240, 60); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 116px Montserrat, system-ui, sans-serif';
    g.shadowColor = 'rgba(244,196,48,.9)'; g.shadowBlur = 30;
    const grd = g.createLinearGradient(0, 50, 0, 210); grd.addColorStop(0, '#fff3b0'); grd.addColorStop(0.5, '#F4C430'); grd.addColorStop(1, '#b07800');
    g.fillStyle = grd; g.fillText('GOLDEN COOP', 640, 136);
    g.shadowBlur = 0;
    // little eggs either side
    for (const x of [96, 1184]) { g.fillStyle = '#F4C430'; g.beginPath(); g.ellipse(x, 128, 30, 40, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(x - 9, 112, 7, 12, -0.4, 0, Math.PI * 2); g.fill(); }
    tex.needsUpdate = true;
  };
  draw(); document.fonts?.ready.then(draw);
  return tex;
}

export { SYMBOLS };

function raysTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const g = cv.getContext('2d')!;
  g.translate(256, 256);
  for (let i = 0; i < 18; i++) {
    g.rotate((Math.PI * 2) / 18);
    const gr = g.createLinearGradient(0, 0, 0, -256); gr.addColorStop(0, 'rgba(255,220,120,.9)'); gr.addColorStop(1, 'rgba(255,220,120,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.lineTo(-22, -256); g.lineTo(22, -256); g.closePath(); g.fill();
  }
  const r = g.createRadialGradient(0, 0, 0, 0, 0, 256); r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(0.7, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = r; g.fillRect(-256, -256, 512, 512);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function ledTexture() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 4;
  const g = cv.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 256, 0);
  ['#F4C430', '#ff7a1a', '#E63946', '#ff4fb0', '#F4C430'].forEach((c, i, a) => gr.addColorStop(i / (a.length - 1), c));
  g.fillStyle = gr; g.fillRect(0, 0, 256, 4);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
  return t;
}
