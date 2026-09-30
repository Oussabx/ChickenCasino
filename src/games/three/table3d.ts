import * as THREE from 'three';
import { Stage3D } from './stage';
import { MAT, box, glowSprite, makeChip, std } from './models';
import { Card, isRed, rankLabel, SUIT_CHAR } from '../../lib/cards';

/**
 * A 3D casino table used by the card games: curved felt with printed text,
 * gold rail, card shoe, and cards that fly out of the shoe and flip.
 * World units: x = left/right, z = towards the player, y = up.
 */

export const CW = 0.9; // card width
export const CH = 1.3; // card height (depth along z when lying flat)

let backCanvas: HTMLCanvasElement | null = null;
const faceCache = new Map<string, THREE.CanvasTexture>();
let backTex: THREE.CanvasTexture | null = null;
const listeners: (() => void)[] = [];
let headImg: HTMLImageElement | null = null;

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

function loadHead() {
  if (headImg) return;
  headImg = new Image();
  headImg.src = './img/head.webp';
  headImg.onload = () => { drawBack(); listeners.forEach((f) => f()); };
}

function drawBack() {
  if (!backCanvas) { backCanvas = document.createElement('canvas'); backCanvas.width = 256; backCanvas.height = 370; }
  const g = backCanvas.getContext('2d')!;
  g.fillStyle = '#F8F6EF'; roundRect(g, 0, 0, 256, 370, 20); g.fill();
  g.save(); roundRect(g, 10, 10, 236, 350, 14); g.clip();
  g.fillStyle = '#8E1B24'; g.fillRect(0, 0, 256, 370);
  g.strokeStyle = '#E63946'; g.lineWidth = 6;
  for (let i = -400; i < 400; i += 22) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 370, 370); g.stroke(); }
  g.restore();
  g.strokeStyle = '#F4C430'; g.lineWidth = 4; roundRect(g, 18, 18, 220, 334, 10); g.stroke();
  if (headImg?.complete) { g.save(); g.beginPath(); g.arc(128, 185, 62, 0, 7); g.fillStyle = '#F8F6EF'; g.fill(); g.clip(); g.drawImage(headImg, 66, 123, 124, 124); g.restore(); }
  if (backTex) backTex.needsUpdate = true;
}

function backTexture() {
  if (!backTex) {
    loadHead(); drawBack();
    backTex = new THREE.CanvasTexture(backCanvas!);
    backTex.colorSpace = THREE.SRGBColorSpace; backTex.anisotropy = 8;
  }
  return backTex;
}

function faceTexture(c: Card) {
  const key = `${c.r}${c.s}`;
  const hit = faceCache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 370;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const draw = () => {
    const g = cv.getContext('2d')!;
    g.clearRect(0, 0, 256, 370);
    g.fillStyle = '#FBFAF5'; roundRect(g, 0, 0, 256, 370, 20); g.fill();
    g.strokeStyle = '#d9d4c3'; g.lineWidth = 3; roundRect(g, 2, 2, 252, 366, 18); g.stroke();
    const col = isRed(c) ? '#D62839' : '#111111';
    const rl = rankLabel(c.r), sc = SUIT_CHAR[c.s];
    g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 58px Montserrat, system-ui, sans-serif'; g.fillText(rl, 40, 46);
    g.font = '48px system-ui, sans-serif'; g.fillText(sc, 40, 96);
    g.save(); g.translate(216, 324); g.rotate(Math.PI);
    g.font = '900 58px Montserrat, system-ui, sans-serif'; g.fillText(rl, 0, 0);
    g.font = '48px system-ui, sans-serif'; g.fillText(sc, 0, 50);
    g.restore();
    if (c.r >= 11 && c.r <= 13) {
      // court cards: framed letter with a little crown
      g.strokeStyle = col; g.lineWidth = 4; roundRect(g, 64, 92, 128, 186, 12); g.stroke();
      g.fillStyle = isRed(c) ? 'rgba(214,40,57,.08)' : 'rgba(0,0,0,.05)'; roundRect(g, 64, 92, 128, 186, 12); g.fill();
      g.fillStyle = '#F4C430'; g.beginPath(); g.moveTo(98, 150); g.lineTo(108, 124); g.lineTo(128, 142); g.lineTo(148, 124); g.lineTo(158, 150); g.closePath(); g.fill();
      g.fillStyle = col; g.font = '900 96px Montserrat, system-ui, sans-serif'; g.fillText(rl, 128, 210);
    } else {
      g.font = `${c.r === 14 ? 170 : 130}px system-ui, sans-serif`; g.fillText(sc, 128, 196);
    }
    tex.needsUpdate = true;
  };
  draw();
  document.fonts?.ready.then(draw);
  faceCache.set(key, tex);
  return tex;
}

const CARD_GEO = new THREE.BoxGeometry(CW, 0.012, CH);
const EDGE = std(0xf1ede0, { roughness: 0.6 });

export interface Card3D { mesh: THREE.Mesh; card: Card | null; up: boolean }

export interface TableOpts { felt?: number; text?: string[]; sub?: string }

export class TableScene extends Stage3D {
  private cards: Card3D[] = [];
  private anims: { t0: number; dur: number; step: (k: number) => void; done: () => void }[] = [];
  private chips = new Map<string, THREE.Group>();
  private shoePos = new THREE.Vector3(4.2, 0.55, -2.4);
  private feltMat: THREE.MeshStandardMaterial;
  private glowRing: THREE.Mesh;

  constructor(host: HTMLElement, opts: TableOpts = {}) {
    super(host, { fov: 36, bg: 0x0a0708 });
    this.parallax = 0.35;
    this.key.position.set(-3, 12, 7);
    const felt = opts.felt ?? 0x0e5a3a;

    // floor + glow
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), std(0x120a0c, { roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.6; this.scene.add(floor);
    const g = glowSprite('rgba(244,196,48,0.5)', 22, 0.18); g.position.set(0, 3, -4); this.scene.add(g);
    const lamp = new THREE.PointLight(0xffe2b0, 30, 22, 1.4); lamp.position.set(0, 7, 1); this.scene.add(lamp);

    // felt top: rounded "D" shape (flat edge at the dealer side)
    const shape = new THREE.Shape();
    const W = 6.6, D = 3.4;
    shape.moveTo(-W, -D); shape.lineTo(W, -D);
    shape.absarc(0, -D, W, 0, Math.PI, false);
    const top = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3, curveSegments: 64 });
    top.rotateX(Math.PI / 2);
    this.feltMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, map: this.feltTexture(felt, opts) });
    const topMesh = new THREE.Mesh(top, [this.feltMat, std(0x2b160b, { roughness: 0.7 })]);
    topMesh.position.y = 0; topMesh.receiveShadow = true;
    this.scene.add(topMesh);
    // UV-map the felt texture onto the top face by planar projection
    const uv = top.attributes.uv as THREE.BufferAttribute, pos = top.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + W) / (2 * W), 1 - (pos.getZ(i) + D) / (W + 0.0001));
    uv.needsUpdate = true;

    // padded rail along the curved edge
    const railCurve = new THREE.EllipseCurve(0, -D, W + 0.1, W + 0.1, 0, Math.PI, false, 0);
    const pts = railCurve.getPoints(80).map((p) => new THREE.Vector3(p.x, 0.12, p.y));
    const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.28, 12, false), std(0x3a1d0e, { roughness: 0.45 }));
    rail.castShadow = true; this.scene.add(rail);
    const trim = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => p.clone().setY(0.18).multiplyScalar(1))), 120, 0.06, 8, false), MAT.gold);
    trim.position.y = 0.12; this.scene.add(trim);
    // dealer edge
    this.scene.add(box(std(0x2b160b), [2 * W + 0.6, 0.45, 0.4], [0, 0.02, -D - 0.1]));

    // shoe + chip tray
    const shoe = new THREE.Group();
    shoe.add(box(std(0x1b1b1f, { metalness: 0.4, roughness: 0.3 }), [1.1, 0.55, 1.6], [0, 0, 0]));
    shoe.add(box(MAT.gold, [1.12, 0.06, 1.62], [0, 0.29, 0]));
    const back = new THREE.Mesh(new THREE.BoxGeometry(CW * 0.95, 0.4, 0.05), new THREE.MeshStandardMaterial({ map: backTexture() }));
    back.position.set(0, 0.1, 0.8); shoe.add(back);
    shoe.position.set(this.shoePos.x, 0.3, this.shoePos.z - 0.2);
    shoe.rotation.y = -0.35; this.scene.add(shoe);
    const tray = new THREE.Group();
    tray.add(box(std(0x1b1b1f), [3.4, 0.12, 0.8], [0, 0, 0]));
    const cols = [0xe63946, 0xf4c430, 0x1e1e1e, 0x3b82f6, 0x10b981, 0xf8f6ef];
    cols.forEach((c, i) => { for (let k = 0; k < 5; k++) { const ch = makeChip(c, 0.22); ch.rotation.x = Math.PI / 2; ch.position.set(-1.35 + i * 0.54, 0.12 + 0.05, -0.25 + k * 0.1); tray.add(ch); } });
    tray.position.set(0, 0.15, -D + 0.2); this.scene.add(tray);

    // result glow ring (moved under the winning hand)
    this.glowRing = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.6, 48), new THREE.MeshBasicMaterial({ color: 0xf4c430, transparent: true, opacity: 0, side: THREE.DoubleSide }));
    this.glowRing.rotation.x = -Math.PI / 2; this.glowRing.position.y = 0.07; this.glowRing.scale.set(1.6, 1, 1);
    this.scene.add(this.glowRing);

    listeners.push(() => this.cards.forEach((c) => this.applyMats(c)));
    this.onResize();
  }

  private feltTexture(felt: number, opts: TableOpts) {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
    const g = cv.getContext('2d')!;
    const col = new THREE.Color(felt);
    const grd = g.createRadialGradient(512, 200, 40, 512, 260, 620);
    grd.addColorStop(0, `#${col.clone().offsetHSL(0, 0, 0.06).getHexString()}`); grd.addColorStop(1, `#${col.clone().offsetHSL(0, 0, -0.08).getHexString()}`);
    g.fillStyle = grd; g.fillRect(0, 0, 1024, 512);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const draw = () => {
      g.fillStyle = grd; g.fillRect(0, 0, 1024, 512);
      g.strokeStyle = 'rgba(244,196,48,.5)'; g.lineWidth = 3;
      g.beginPath(); g.arc(512, 0, 470, 0.15, Math.PI - 0.15); g.stroke();
      g.fillStyle = 'rgba(244,196,48,.85)'; g.textAlign = 'center'; g.textBaseline = 'middle';
      (opts.text ?? []).forEach((t, i) => { g.font = `800 ${i ? 22 : 30}px Montserrat, system-ui, sans-serif`; g.fillText(t, 512, 175 + i * 34); });
      if (opts.sub) { g.fillStyle = 'rgba(248,246,239,.35)'; g.font = '600 18px Montserrat, system-ui, sans-serif'; g.fillText(opts.sub, 512, 250); }
      tex.needsUpdate = true;
    };
    draw();
    document.fonts?.ready.then(draw);
    return tex;
  }

  protected onResize() {
    if (!this.cards) return;
    const narrow = this.aspect < 1;
    this.frame(new THREE.Vector3(0, 0, narrow ? -0.4 : -0.6), narrow ? 8.6 : 12.5, narrow ? 7.5 : 6.2, new THREE.Vector3(0, 1.55, 1), 1);
  }

  private applyMats(c: Card3D) {
    const face = c.card ? new THREE.MeshStandardMaterial({ map: faceTexture(c.card), roughness: 0.45 }) : new THREE.MeshStandardMaterial({ map: backTexture(), roughness: 0.45 });
    const backM = new THREE.MeshStandardMaterial({ map: backTexture(), roughness: 0.45 });
    c.mesh.material = [EDGE, EDGE, face, backM, EDGE, EDGE];
  }

  /** Remove every card (swept off the table). */
  clear() {
    for (const c of this.cards) this.scene.remove(c.mesh);
    this.cards = [];
    (this.glowRing.material as THREE.MeshBasicMaterial).opacity = 0;
    this.chips.forEach((g) => this.scene.remove(g));
    this.chips.clear();
  }

  /**
   * Deal a card from the shoe to (x, z). `card` null = face down.
   * `rot` spins the card on the table (e.g. for baccarat's third card).
   */
  deal(card: Card | null, x: number, z: number, opts: { delay?: number; rot?: number; up?: boolean } = {}): Promise<Card3D> {
    const mesh = new THREE.Mesh(CARD_GEO, EDGE);
    mesh.castShadow = true;
    const c3: Card3D = { mesh, card, up: false };
    this.applyMats(c3);
    mesh.position.copy(this.shoePos);
    mesh.rotation.set(0, -0.35, Math.PI); // face down leaving the shoe
    mesh.visible = false;
    this.scene.add(mesh);
    this.cards.push(c3);
    const faceUp = opts.up ?? card !== null;
    const dur = this.turbo ? 220 : 420;
    const from = this.shoePos.clone(), to = new THREE.Vector3(x, 0.075 + this.cards.length * 0.0015, z);
    return new Promise((res) => {
      setTimeout(() => {
        mesh.visible = true;
        this.anim(dur, (k) => {
          const e = 1 - Math.pow(1 - k, 3);
          mesh.position.lerpVectors(from, to, e);
          mesh.position.y += Math.sin(Math.PI * k) * 0.9;
          mesh.rotation.y = -0.35 * (1 - e) + (opts.rot ?? 0) * e;
          if (faceUp) mesh.rotation.z = Math.PI * (1 - e);
        }, () => { c3.up = faceUp; res(c3); });
      }, opts.delay ?? 0);
    });
  }

  /** Flip a face-down card to reveal it. `slow` = baccarat-style squeeze. */
  flip(c3: Card3D, card: Card, slow = false) {
    c3.card = card; this.applyMats(c3);
    const dur = slow ? (this.turbo ? 500 : 1300) : this.turbo ? 180 : 360;
    const y0 = c3.mesh.position.y, rz0 = c3.mesh.rotation.z;
    return new Promise<void>((res) => this.anim(dur, (k) => {
      const e = slow ? (k < 0.75 ? k * 0.35 / 0.75 : 0.35 + (k - 0.75) / 0.25 * 0.65) : 1 - Math.pow(1 - k, 2);
      c3.mesh.rotation.z = rz0 * (1 - e);
      c3.mesh.position.y = y0 + Math.sin(Math.PI * e) * 0.45;
    }, () => { c3.up = true; res(); }));
  }

  /** Slide a card to a new spot (e.g. splitting a blackjack hand). */
  move(c3: Card3D, x: number, z: number) {
    const from = c3.mesh.position.clone(), to = new THREE.Vector3(x, from.y, z);
    return new Promise<void>((res) => this.anim(this.turbo ? 150 : 300, (k) => c3.mesh.position.lerpVectors(from, to, 1 - Math.pow(1 - k, 3)), res));
  }

  /** Lift & glow selected cards (e.g. held cards in video poker). */
  lift(c3: Card3D, on: boolean) {
    const target = on ? 0.3 : 0.08;
    const from = c3.mesh.position.y;
    this.anim(140, (k) => { c3.mesh.position.y = from + (target - from) * k; }, () => {});
  }

  /** Throw a card away (video poker discards). */
  discard(c3: Card3D) {
    const from = c3.mesh.position.clone();
    this.anim(this.turbo ? 150 : 280, (k) => { c3.mesh.position.set(from.x, from.y + k * 1.5, from.z - k * 3); c3.mesh.rotation.z = Math.PI * k; }, () => {
      this.scene.remove(c3.mesh); this.cards = this.cards.filter((x) => x !== c3);
    });
  }

  /** Stack of chips representing a bet at (x, z). amount 0 removes it. */
  setChips(key: string, amount: number, x: number, z: number) {
    const old = this.chips.get(key);
    if (old) this.scene.remove(old);
    if (!(amount > 0)) { this.chips.delete(key); return; }
    const g = new THREE.Group();
    const denoms: [number, number][] = [[1000, 0x8b5cf6], [500, 0x1e1e1e], [100, 0xf4c430], [25, 0x10b981], [5, 0xe63946], [1, 0xf8f6ef]];
    let left = amount, n = 0;
    for (const [v, col] of denoms) {
      while (left >= v && n < 12) {
        const ch = makeChip(col, 0.3); ch.position.set(0, 0.1 + n * 0.068, 0); ch.rotation.y = n * 0.7; g.add(ch); left -= v; n++;
      }
    }
    if (n === 0) { const ch = makeChip(0xf8f6ef, 0.3); ch.position.y = 0.1; g.add(ch); }
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.chips.set(key, g);
    g.scale.setScalar(0.01);
    this.anim(260, (k) => g.scale.setScalar(1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2)), () => {});
  }

  /** Highlight a region of the table (winning hand) and spray coins if won. */
  celebrate(x: number, z: number, win: boolean, scaleX = 1.6) {
    this.glowRing.position.set(x, 0.07, z);
    this.glowRing.scale.set(scaleX, 1, 1);
    const m = this.glowRing.material as THREE.MeshBasicMaterial;
    m.color.set(win ? 0xf4c430 : 0xe63946);
    m.opacity = 0.85;
    if (win) {
      for (let i = 0; i < 26; i++) {
        const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 12), MAT.gold);
        coin.position.set(x, 0.4, z);
        const a = Math.random() * Math.PI * 2;
        this.addParticle(coin, new THREE.Vector3(Math.cos(a) * 2.2, 4 + Math.random() * 3, Math.sin(a) * 1.4), 1.4, 12, 0.2);
      }
    } else this.shake = 0.3;
  }

  /** Call `cb` with the card the user clicks/taps on the table. */
  onCardClick(cb: (c: Card3D) => void) {
    const cv = this.renderer.domElement;
    cv.addEventListener('click', (e) => {
      const hit = this.pick(e, this.cards.map((c) => c.mesh));
      const c = hit && this.cards.find((x) => x.mesh === hit.object);
      if (c) cb(c);
    });
    cv.addEventListener('pointermove', (e) => {
      cv.style.cursor = this.pick(e, this.cards.map((c) => c.mesh)) ? 'pointer' : 'default';
    });
  }

  resetGlow() { (this.glowRing.material as THREE.MeshBasicMaterial).opacity = 0; }

  protected anim(dur: number, step: (k: number) => void, done: () => void) {
    this.anims.push({ t0: performance.now(), dur, step, done });
  }

  protected update(_dt: number, t: number) {
    const now = performance.now();
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      const k = Math.min(1, (now - a.t0) / a.dur);
      a.step(k);
      if (k >= 1) { this.anims.splice(i, 1); a.done(); }
    }
    const m = this.glowRing.material as THREE.MeshBasicMaterial;
    if (m.opacity > 0) m.opacity = 0.55 + Math.sin(t * 5) * 0.25;
  }
}
