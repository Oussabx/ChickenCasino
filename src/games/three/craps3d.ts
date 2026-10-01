import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Stage3D } from './stage';
import { MAT, box, glowSprite, makeChicken, std } from './models';
import { chipStack } from './table3d';
import { roundRect } from './cardArt';
import { eqTable, eqTableId } from '../../lib/equipped';

/**
 * A 3D craps table: printed layout you tap to bet, padded rails, the
 * diamond-studded back wall the dice must hit, a rooster boxman, the ON/OFF
 * puck, and a pair of red casino dice that tumble to the rolled numbers.
 */

// ---- layout, in layout units (u across 0..LU, v down from the far side 0..LV) ----
const LU = 28, LV = 15, S = 0.5; // world units per layout unit
type Rect = [number, number, number, number];
export const SPOTS: Record<string, Rect> = {
  dc: [0, 0, 3, 3.6],
  place4: [3, 0, 6, 3.6], place5: [6, 0, 9, 3.6], place6: [9, 0, 12, 3.6], place8: [12, 0, 15, 3.6], place9: [15, 0, 18, 3.6], place10: [18, 0, 21, 3.6],
  come: [0, 3.6, 21, 6.6],
  field: [0, 6.6, 21, 9.6],
  dp: [0, 9.6, 16, 11.8], dpOdds: [16, 9.6, 21, 11.8],
  pass: [0, 11.8, 16, 15], passOdds: [16, 11.8, 21, 15],
  any7: [21.4, 0, 28, 1.8],
  hard6: [21.4, 1.8, 24.7, 4.6], hard10: [24.7, 1.8, 28, 4.6], hard8: [21.4, 4.6, 24.7, 7.4], hard4: [24.7, 4.6, 28, 7.4],
  aces: [21.4, 7.4, 24.7, 9.8], boxcars: [24.7, 7.4, 28, 9.8], aceDeuce: [21.4, 9.8, 24.7, 12.2], yo: [24.7, 9.8, 28, 12.2],
  anyCraps: [21.4, 12.2, 28, 15],
};
const NUMS = [4, 5, 6, 8, 9, 10];

/** Where chips for a key sit, in layout units (come points live inside the number boxes). */
function chipAt(key: string): [number, number] {
  const m = key.match(/^(come|comeOdds|dc|dcOdds):(\d+)$/);
  if (m) {
    const r = SPOTS[`place${m[2]}`];
    const cx = (r[0] + r[2]) / 2;
    return m[1] === 'come' ? [cx - 0.75, 2.85] : m[1] === 'comeOdds' ? [cx + 0.75, 2.85] : m[1] === 'dc' ? [cx - 0.75, 0.75] : [cx + 0.75, 0.75];
  }
  const r = SPOTS[key];
  if (key.startsWith('place')) return [(r[0] + r[2]) / 2, 1.85];
  return [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2];
}
function spotAt(u: number, v: number): string | null {
  for (const [k, r] of Object.entries(SPOTS)) if (u >= r[0] && u <= r[2] && v >= r[1] && v <= r[3]) return k;
  return null;
}

const LAYOUT_Z = 0.9; // layout centre (towards the player)
const toWorld = (u: number, v: number, y = 0.012) => new THREE.Vector3((u - LU / 2) * S, y, LAYOUT_Z + (v - LV / 2) * S);

// die faces: +x 2, -x 5, +y 1, -y 6, +z 3, -z 4 (opposite faces add to 7)
const FACE_ORDER = [2, 5, 1, 6, 3, 4];
const UP: Record<number, THREE.Quaternion> = {
  1: new THREE.Quaternion(),
  6: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI),
  2: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2),
  5: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2),
  3: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2),
  4: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2),
};
const DIE = 0.42;

export class CrapsScene extends Stage3D {
  private layout: THREE.Mesh;
  private stacks = new Map<string, THREE.Group>();
  private glows = new THREE.Group();
  private hover: THREE.Mesh | null = null;
  private dice: THREE.Mesh[] = [];
  private puck = new THREE.Group();
  private puckTex: { on: THREE.CanvasTexture; off: THREE.CanvasTexture };
  private puckFace: THREE.Mesh;
  private chicken: THREE.Group;
  private anims: { t0: number; dur: number; step: (k: number) => void; done?: () => void }[] = [];
  private bounceCb: (() => void) | null = null;

  constructor(host: HTMLElement) {
    super(host, { fov: 34, bg: 0x0a0809 });
    this.parallax = 0.3;
    this.key.position.set(-5, 14, 8);

    // room
    for (let i = 0; i < 18; i++) {
      const s = glowSprite(Math.random() < 0.7 ? 'rgba(255,205,110,1)' : 'rgba(230,57,70,1)', 1 + Math.random() * 2.2, 0.12 + Math.random() * 0.15);
      s.position.set((Math.random() - 0.5) * 50, 3 + Math.random() * 9, -12 - Math.random() * 10);
      this.scene.add(s);
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), std(0x1a0b0e, { roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -2.4; this.scene.add(floor);

    // table body + felt
    const TW = LU * S + 2.2, TD = LV * S + 3.4, TZ = LAYOUT_Z - 1.0;
    const body = new THREE.Mesh(new THREE.BoxGeometry(TW + 1, 2.2, TD + 1), std(0x2a160c, { roughness: 0.7 }));
    body.position.set(0, -1.2, TZ); this.scene.add(body);
    const felt = new THREE.Mesh(new THREE.PlaneGeometry(TW, TD), std(feltColors().main, { roughness: 1 }));
    felt.rotation.x = -Math.PI / 2; felt.position.set(0, -0.005, TZ); felt.receiveShadow = true; this.scene.add(felt);
    // printed layout
    this.layout = new THREE.Mesh(new THREE.PlaneGeometry(LU * S, LV * S), new THREE.MeshStandardMaterial({ map: layoutTexture(), roughness: 0.95 }));
    this.layout.rotation.x = -Math.PI / 2; this.layout.position.set(0, 0.002, LAYOUT_Z); this.layout.receiveShadow = true;
    this.scene.add(this.layout);
    this.glows.position.y = 0.006; this.scene.add(this.glows);

    // padded rails (leather + wood) on three sides, the back wall is the 4th
    const leather = std(eqTableId() === 'tb-classic' ? 0x2a0d10 : eqTable().rail, { roughness: 0.45, metalness: 0.1 });
    const wood = std(0x6b4423, { roughness: 0.55 });
    const railH = 0.7;
    const front = TZ + TD / 2, back = TZ - TD / 2;
    for (const [w, d, x, z] of [[TW + 1, 0.8, 0, front + 0.1], [0.8, TD + 1, -TW / 2 - 0.1, TZ], [0.8, TD + 1, TW / 2 + 0.1, TZ]] as number[][]) {
      const r = new THREE.Mesh(new RoundedBoxGeometry(w, railH, d, 3, 0.25), leather); r.position.set(x, railH / 2 - 0.05, z); r.castShadow = true; this.scene.add(r);
      const t = new THREE.Mesh(new RoundedBoxGeometry(w * (w > 2 ? 1 : 0.5), 0.16, d * (d > 2 ? 1 : 0.5), 2, 0.06), wood); t.position.set(x, railH + 0.02, z); this.scene.add(t);
    }
    // back wall with pyramid rubber
    const wall = new THREE.Mesh(new THREE.BoxGeometry(TW + 1, 1.5, 0.4), new THREE.MeshStandardMaterial({ map: diamondTexture(), roughness: 0.6, bumpMap: diamondTexture(), bumpScale: 3 }));
    wall.position.set(0, 0.7, back - 0.2); this.scene.add(wall);
    const cap = new THREE.Mesh(new RoundedBoxGeometry(TW + 1.2, 0.22, 0.7, 2, 0.08), wood); cap.position.set(0, 1.5, back - 0.25); this.scene.add(cap);
    // chip rack along the back rail
    for (let i = 0; i < 14; i++) {
      const g = chipStack([500, 100, 25, 5][i % 4] * 6, 0.24); g.children.filter((c) => (c as THREE.Sprite).isSprite).forEach((c) => g.remove(c));
      g.rotation.z = Math.PI / 2; g.position.set(-3.4 + i * 0.5, 1.75, back - 0.25); this.scene.add(g);
    }

    // rooster boxman standing in the far corner, watching the dice
    const ch = makeChicken('#F8F6EF');
    ch.root.scale.setScalar(1.05); ch.root.rotation.y = -Math.PI / 2 - 0.45; ch.root.position.set(5.7, 0, back + 0.8);
    this.chicken = ch.root;
    const bow = new THREE.Group();
    bow.add(box(MAT.black, [0.06, 0.12, 0.1], [0, 0, 0]), box(MAT.black, [0.06, 0.16, 0.14], [0, 0, 0.12]), box(MAT.black, [0.06, 0.16, 0.14], [0, 0, -0.12]));
    bow.position.set(0.48, 1.0, 0); ch.body.add(bow);
    const visor = box(std(0x10b981, { transparent: true, opacity: 0.8 }), [0.5, 0.04, 0.7], [0.45, 1.78, 0]); ch.body.add(visor);
    this.scene.add(ch.root);
    // puck
    this.puckTex = { on: puckTexture(true), off: puckTexture(false) };
    const puckBody = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.13, 40), [std(0x0b0b0b), new THREE.MeshStandardMaterial({ map: this.puckTex.off }), std(0x0b0b0b)]);
    this.puckFace = puckBody; puckBody.castShadow = true;
    puckBody.rotation.y = Math.PI / 2; // text reads upright from the player's side
    this.puck.add(puckBody); this.puck.position.copy(toWorld(1.5, 1.8, 0.08)); this.scene.add(this.puck);

    // dice
    const mats = FACE_ORDER.map((n) => new THREE.MeshPhysicalMaterial({ map: dieFace(n), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, transmission: 0, sheen: 0 }));
    for (let i = 0; i < 2; i++) {
      const d = new THREE.Mesh(new RoundedBoxGeometry(DIE, DIE, DIE, 3, 0.05), mats);
      d.castShadow = true; d.position.copy(toWorld(9 + i * 1.6, 12.6, DIE / 2)); d.rotation.y = 0.3 + i;
      this.scene.add(d); this.dice.push(d);
    }
    this.onResize();
  }

  // ---------- picking ----------
  private spotKey(e: { clientX: number; clientY: number }) {
    const hit = this.pick(e, [this.layout]);
    if (!hit) return null;
    const p = hit.point;
    return spotAt(p.x / S + LU / 2, (p.z - LAYOUT_Z) / S + LV / 2);
  }
  onSpot(cb: (key: string) => void, enabled: () => boolean) {
    const cv = this.renderer.domElement;
    cv.addEventListener('click', (e) => { if (!enabled()) return; const k = this.spotKey(e); if (k) cb(k); });
    cv.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const k = enabled() ? this.spotKey(e) : null;
      cv.style.cursor = k ? 'pointer' : 'default';
      if (this.hover) { this.glows.remove(this.hover); this.hover = null; }
      if (k) { this.hover = this.rectGlow(k, 0xfff1c0, 0.45); }
    });
    cv.addEventListener('pointerleave', () => { if (this.hover) { this.glows.remove(this.hover); this.hover = null; } });
  }
  private rectGlow(key: string, color: number, opacity: number) {
    const r = SPOTS[key]; if (!r) return null;
    const w = (r[2] - r[0]) * S, h = (r[3] - r[1]) * S;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: glowTex(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.copy(toWorld((r[0] + r[2]) / 2, (r[1] + r[3]) / 2, 0));
    this.glows.add(m);
    return m;
  }

  /** Glow a set of spots (winners gold, losers red) for a moment. */
  flash(wins: string[], losses: string[]) {
    const ms: THREE.Mesh[] = [];
    for (const k of wins) { const m = this.rectGlow(k, 0xf4c430, 0.9); if (m) ms.push(m); }
    for (const k of losses) { const m = this.rectGlow(k, 0xe63946, 0.55); if (m) ms.push(m); }
    this.anim(1800, (k) => ms.forEach((m) => { (m.material as THREE.MeshBasicMaterial).opacity = (1 - k) * (0.5 + Math.abs(Math.sin(k * 14)) * 0.5); }), () => ms.forEach((m) => this.glows.remove(m)));
  }

  // ---------- chips ----------
  /** Show chip stacks for every bet on the layout. `from` lets a stack glide from another spot (come bets travelling). */
  setBets(bets: Record<string, number>, moves: Record<string, string> = {}) {
    for (const [k, g] of [...this.stacks]) if (!bets[k]) {
      this.stacks.delete(k);
      if (Object.values(moves).includes(k)) { this.scene.remove(g); continue; }
      this.anim(450, (t) => { g.scale.setScalar(Math.max(0.01, 1 - t)); g.position.y += 0.02; }, () => this.scene.remove(g));
    }
    for (const [k, amt] of Object.entries(bets)) {
      const old = this.stacks.get(k);
      if (old?.userData.amount === amt) continue;
      if (old) this.scene.remove(old);
      const g = chipStack(amt, 0.26);
      g.userData.amount = amt;
      const [u, v] = chipAt(k);
      const to = toWorld(u, v, 0.012);
      this.scene.add(g); this.stacks.set(k, g);
      const src = moves[k];
      if (src) {
        const [su, sv] = chipAt(src); const from = toWorld(su, sv, 0.012);
        g.position.copy(from);
        this.anim(650, (t) => { const e = 1 - Math.pow(1 - t, 3); g.position.lerpVectors(from, to, e); g.position.y += Math.sin(Math.PI * t) * 0.6; });
      } else {
        g.position.copy(to);
        if (!old) { g.position.y += 1; this.anim(260, (t) => { g.position.y = to.y + (1 - t * t) * 1; }); }
      }
    }
  }

  /** Winnings: a payout stack lands beside the bet, then slides to the player. */
  payout(key: string, amount: number) {
    if (amount <= 0) return;
    const [u, v] = chipAt(key);
    const at = toWorld(u + 0.9, v, 0.012);
    const g = chipStack(+amount.toFixed(2), 0.26);
    g.position.set(-2, 2.4, LAYOUT_Z - 4);
    this.scene.add(g);
    const from = g.position.clone();
    this.anim(600, (t) => { const e = 1 - Math.pow(1 - t, 3); g.position.lerpVectors(from, at, e); g.position.y += Math.sin(Math.PI * t) * 1.2; }, () => {
      setTimeout(() => {
        const a = g.position.clone(), b = new THREE.Vector3(at.x * 0.3, 0.4, LAYOUT_Z + LV * S / 2 + 2.4);
        this.anim(520, (t) => { g.position.lerpVectors(a, b, t * t); g.scale.setScalar(1 - t * 0.5); }, () => this.scene.remove(g));
      }, 900);
    });
  }

  // ---------- puck ----------
  setPoint(n: number | null) {
    const mat = (this.puckFace.material as THREE.Material[])[1] as THREE.MeshStandardMaterial;
    const target = n ? (() => { const r = SPOTS[`place${n}`]; return toWorld((r[0] + r[2]) / 2, 0.45, 0.08); })() : toWorld(1.5, 1.8, 0.08);
    const from = this.puck.position.clone();
    this.anim(520, (t) => {
      this.puck.position.lerpVectors(from, target, t * t * (3 - 2 * t)); this.puck.position.y = 0.08 + Math.sin(Math.PI * t) * 0.9;
      this.puck.rotation.x = t < 0.5 ? t * Math.PI * 2 : Math.PI + (t - 0.5) * Math.PI * 2;
      if (t > 0.5 && mat.map !== (n ? this.puckTex.on : this.puckTex.off)) { mat.map = n ? this.puckTex.on : this.puckTex.off; mat.needsUpdate = true; }
    }, () => { this.puck.rotation.x = 0; });
  }

  // ---------- dice ----------
  /** Throw both dice from the player's end; they bounce off the back wall and settle on d1, d2. */
  throwDice(d1: number, d2: number, durMs: number, onBounce?: () => void) {
    this.bounceCb = onBounce ?? null;
    const back = toWorld(0, 0).z - 0.25;
    const results = [d1, d2];
    return Promise.all(this.dice.map((d, i) => new Promise<void>((res) => {
      const start = new THREE.Vector3(-0.6 + i * 0.7 + (Math.random() - 0.5) * 0.4, 1.4, toWorld(0, LV).z + 1.2);
      const wallHit = new THREE.Vector3(-1.5 + i * 1.8 + (Math.random() - 0.5) * 1.6, 0.35, back);
      const end = new THREE.Vector3(-2.2 + i * 1.9 + (Math.random() - 0.5) * 1.6, DIE / 2, toWorld(0, 3.4 + Math.random() * 3.4).z);
      const qEnd = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2).multiply(UP[results[i]]);
      const spin = new THREE.Vector3(8 + Math.random() * 8, 6 + Math.random() * 6, 7 + Math.random() * 8).multiplyScalar(Math.random() < 0.5 ? 1 : -1);
      const q = new THREE.Quaternion();
      const dur = durMs * (1 + i * 0.06);
      let bounced = 0;
      const t0 = performance.now();
      const step = () => {
        if (this.disposed) return res();
        const k = Math.min(1, (performance.now() - t0) / dur);
        if (k < 0.42) {
          // flight to the back wall
          const t = k / 0.42;
          d.position.lerpVectors(start, wallHit, t); d.position.y = start.y + (wallHit.y - start.y) * t + Math.sin(Math.PI * t) * 1.6;
        } else {
          // rebound: hops with decaying height, rolling to the resting spot
          const t = (k - 0.42) / 0.58;
          const e = 1 - Math.pow(1 - t, 2.2);
          d.position.lerpVectors(wallHit, end, e);
          const hops = 3, ph = t * hops;
          const h = Math.abs(Math.sin(Math.PI * ph)) * 0.75 * Math.pow(1 - t, 1.6);
          d.position.y = DIE / 2 + h;
          const b = Math.floor(ph);
          if (b !== bounced && b < hops) { bounced = b; if (i === 0) this.bounceCb?.(); }
          if (k > 0.42 && bounced === 0 && t < 0.02 && i === 0) this.bounceCb?.();
        }
        // tumble, then ease into the result orientation
        const dt = 1 / 60;
        if (k < 0.72) { q.setFromEuler(new THREE.Euler(spin.x * dt * (1 - k), spin.y * dt * (1 - k), spin.z * dt * (1 - k))); d.quaternion.multiply(q); }
        else { const t = (k - 0.72) / 0.28; d.quaternion.slerp(qEnd, Math.min(1, 0.08 + t * t * 0.6)); }
        if (k < 1) requestAnimationFrame(step);
        else { d.quaternion.copy(qEnd); d.position.copy(end); res(); }
      };
      requestAnimationFrame(step);
    })));
  }

  /** A happy hop from the boxman (point made / naturals). */
  cheer() {
    const y0 = this.chicken.position.y;
    this.anim(700, (t) => { this.chicken.position.y = y0 + Math.abs(Math.sin(t * Math.PI * 2)) * 0.5; }, () => { this.chicken.position.y = y0; });
  }

  private anim(dur: number, step: (k: number) => void, done?: () => void) { this.anims.push({ t0: performance.now(), dur, step, done }); }

  protected onResize() {
    if (!this.layout) return;
    const narrow = this.aspect < 1.25;
    // frame the layout (and a bit of the wall); narrower screens get a steeper view
    if (narrow) this.frame(new THREE.Vector3(0, 0.3, LAYOUT_Z - 0.75), LU * S + 0.4, LV * S + 3.3, new THREE.Vector3(0, 1.8, 1), 1);
    else this.frame(new THREE.Vector3(0, 0.4, LAYOUT_Z - 0.85), LU * S + 0.8, LV * S + 3.6, new THREE.Vector3(0, 1.5, 1), 1);
  }

  protected update(_dt: number, t: number) {
    const now = performance.now();
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      const k = Math.min(1, (now - a.t0) / a.dur);
      a.step(k);
      if (k >= 1) { this.anims.splice(i, 1); a.done?.(); }
    }
    this.chicken.rotation.y = -Math.PI / 2 - 0.45 + Math.sin(t * 0.8) * 0.12;
  }
}

// ---------- textures ----------
function layoutTexture() {
  const P = 72, W = LU * P, H = LV * P;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const draw = () => {
    const g = cv.getContext('2d')!;
    g.clearRect(0, 0, W, H);
    const fc = feltColors(); const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, fc.css); bg.addColorStop(1, fc.css2);
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const txt = (t: string, x: number, y: number, size: number, color = '#F8F6EF', weight = 900, font = 'Montserrat') => {
      g.fillStyle = color; g.font = `${weight} ${size}px ${font}, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(t, x, y);
    };
    const box = (k: string, fill?: string) => {
      const [u0, v0, u1, v1] = SPOTS[k];
      const x = u0 * P, y = v0 * P, w = (u1 - u0) * P, h = (v1 - v0) * P;
      if (fill) { g.fillStyle = fill; g.fillRect(x, y, w, h); }
      g.strokeStyle = '#F8F6EF'; g.lineWidth = 4; g.strokeRect(x + 2, y + 2, w - 4, h - 4);
      return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
    };
    // number boxes
    const b0 = box('dc');
    txt('DON’T', b0.cx, b0.cy - 46, 30); txt('COME', b0.cx, b0.cy - 10, 30); txt('BAR', b0.cx, b0.cy + 30, 22, '#F4C430'); drawDice(g, b0.cx - 34, b0.cy + 64, 6, 6, 26);
    for (const n of NUMS) {
      const b = box(`place${n}`);
      const word = n === 6 ? 'SIX' : n === 9 ? 'NINE' : String(n);
      txt(word, b.cx, b.cy + 6, n === 6 || n === 9 ? 64 : 86, '#F8F6EF');
      txt(n === 4 || n === 10 ? 'PAYS 9 TO 5' : n === 5 || n === 9 ? 'PAYS 7 TO 5' : 'PAYS 7 TO 6', b.cx, b.y + b.h - 22, 18, '#F4C430', 800);
    }
    // come
    const c = box('come');
    txt('COME', c.cx, c.cy, 112, '#E63946', 900, 'Kaushan Script');
    // field
    const f = box('field');
    txt('FIELD', f.x + 150, f.cy, 70, '#F4C430', 900, 'Kaushan Script');
    const fieldNums = [2, 3, 4, 9, 10, 11, 12];
    fieldNums.forEach((n, i) => {
      const x = f.x + 330 + i * ((f.w - 380) / 6), y = f.cy;
      if (n === 2 || n === 12) { g.strokeStyle = '#F4C430'; g.lineWidth = 5; g.beginPath(); g.arc(x, y, 48, 0, Math.PI * 2); g.stroke(); }
      txt(String(n), x, y + 2, 64, '#F8F6EF');
      if (n === 2) txt('PAYS DOUBLE', x, y + 74, 16, '#F4C430', 800);
      if (n === 12) txt('PAYS TRIPLE', x, y + 74, 16, '#F4C430', 800);
    });
    // don't pass
    const d = box('dp');
    txt('DON’T PASS BAR', d.cx - 60, d.cy, 54, '#F8F6EF'); drawDice(g, d.cx + 260, d.cy - 26, 6, 6, 50);
    const lo = box('dpOdds', 'rgba(0,0,0,.18)'); txt('LAY ODDS', lo.cx, lo.cy - 16, 32, '#F4C430'); txt('true odds', lo.cx, lo.cy + 24, 20, '#cfe9dc', 700);
    // pass line
    const p = box('pass');
    txt('PASS LINE', p.cx, p.cy, 104, '#F8F6EF', 900, 'Kaushan Script');
    const po = box('passOdds', 'rgba(0,0,0,.18)'); txt('PASS ODDS', po.cx, po.cy - 16, 34, '#F4C430'); txt('3-4-5× · true odds', po.cx, po.cy + 26, 20, '#cfe9dc', 700);
    // proposition centre
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(21.4 * P, 0, 6.6 * P, H);
    const a7 = box('any7'); txt('SEVEN · 4 TO 1', a7.cx, a7.cy + 2, 40, '#E63946');
    const hw = (k: string, a: number, b: number, pays: string) => { const r = box(k); drawDice(g, r.cx - 58, r.cy - 40, a, b, 52); txt(pays, r.cx, r.y + r.h - 34, 30, '#F4C430'); };
    hw('hard6', 3, 3, '9 TO 1'); hw('hard10', 5, 5, '7 TO 1'); hw('hard8', 4, 4, '9 TO 1'); hw('hard4', 2, 2, '7 TO 1');
    hw('aces', 1, 1, '30 TO 1'); hw('boxcars', 6, 6, '30 TO 1'); hw('aceDeuce', 1, 2, '15 TO 1'); hw('yo', 5, 6, '15 TO 1');
    const ac = box('anyCraps'); txt('ANY CRAPS', ac.cx, ac.cy - 26, 50, '#E63946'); txt('7 TO 1 · 2, 3 or 12', ac.cx, ac.cy + 34, 26, '#F4C430', 800);
    g.strokeStyle = '#F4C430'; g.lineWidth = 8; g.strokeRect(4, 4, 21 * P - 8, H - 8); g.strokeRect(21.4 * P + 4, 4, 6.6 * P - 8, H - 8);
    tex.needsUpdate = true;
  };
  draw(); document.fonts?.ready.then(draw);
  return tex;
}

function drawDice(g: CanvasRenderingContext2D, x: number, y: number, a: number, b: number, s: number) {
  for (const [i, n] of [a, b].entries()) {
    const dx = x + i * (s + s * 0.2);
    g.fillStyle = '#c21a2a'; roundRect(g, dx, y, s, s, s * 0.18); g.fill();
    g.fillStyle = '#fff';
    for (const [px, py] of PIPS[n]) { g.beginPath(); g.arc(dx + px * s, y + py * s, s * 0.09, 0, Math.PI * 2); g.fill(); }
  }
}
const PIPS: Record<number, number[][]> = {
  1: [[0.5, 0.5]], 2: [[0.27, 0.27], [0.73, 0.73]], 3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]], 5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.27, 0.22], [0.73, 0.22], [0.27, 0.5], [0.73, 0.5], [0.27, 0.78], [0.73, 0.78]],
};

function dieFace(n: number) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  const bg = g.createRadialGradient(54, 50, 6, 64, 64, 90); bg.addColorStop(0, '#f04555'); bg.addColorStop(1, '#a5101f');
  g.fillStyle = bg; g.fillRect(0, 0, 128, 128);
  for (const [px, py] of PIPS[n]) {
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(px * 128, py * 128, 11, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.arc(px * 128 + 1.5, py * 128 + 2, 11, 0, Math.PI); g.fill();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function puckTexture(on: boolean) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const draw = () => {
    const g = cv.getContext('2d')!;
    g.fillStyle = on ? '#F8F6EF' : '#0b0b0b'; g.beginPath(); g.arc(128, 128, 128, 0, Math.PI * 2); g.fill();
    g.strokeStyle = on ? '#E63946' : '#F8F6EF'; g.lineWidth = 12; g.beginPath(); g.arc(128, 128, 112, 0, Math.PI * 2); g.stroke();
    g.fillStyle = on ? '#0b0b0b' : '#F8F6EF'; g.font = '900 92px Montserrat, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(on ? 'ON' : 'OFF', 128, 134);
    tex.needsUpdate = true;
  };
  draw(); document.fonts?.ready.then(draw);
  return tex;
}

let diamond: THREE.CanvasTexture | null = null;
function diamondTexture() {
  if (diamond) return diamond;
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#16100c'; g.fillRect(0, 0, 512, 64);
  for (let x = 0; x < 512; x += 32) for (let y = 0; y < 64; y += 32) {
    const gr = g.createLinearGradient(x, y, x + 32, y + 32); gr.addColorStop(0, '#5a4a3a'); gr.addColorStop(1, '#0e0a07');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x + 16, y + 2); g.lineTo(x + 30, y + 16); g.lineTo(x + 16, y + 30); g.lineTo(x + 2, y + 16); g.closePath(); g.fill();
  }
  diamond = new THREE.CanvasTexture(cv); diamond.wrapS = diamond.wrapT = THREE.RepeatWrapping; diamond.repeat.set(4, 1);
  return diamond;
}

let glow: THREE.CanvasTexture | null = null;
function glowTex() {
  if (glow) return glow;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#fff'; g.lineWidth = 10; g.shadowColor = '#fff'; g.shadowBlur = 14; g.strokeRect(6, 6, 116, 116);
  glow = new THREE.CanvasTexture(cv);
  return glow;
}

/** Felt colours: the equipped table skin, or classic craps green. */
function feltColors() {
  if (eqTableId() === 'tb-classic') return { main: 0x0f5c3a, css: '#0f5c3a', css2: '#0c4d31' };
  const t = eqTable(), c = new THREE.Color(t.felt);
  return { main: t.felt, css: `#${c.getHexString()}`, css2: `#${c.clone().lerp(new THREE.Color(t.edge), 0.4).getHexString()}` };
}
