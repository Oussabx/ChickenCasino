import * as THREE from 'three';
import { Stage3D } from './stage';
import { MAT, box, glowSprite, labelPlane, makeChip, makeEgg, std, textTexture } from './models';

const L = 18; // track length for 0..100
const toX = (v: number) => -L / 2 + (v / 100) * L;

function diceFace(n: number) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#F8F6EF'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = n === 1 ? '#E63946' : '#0B0B0B';
  const P: Record<number, number[][]> = { 1: [[64, 64]], 2: [[34, 34], [94, 94]], 3: [[30, 30], [64, 64], [98, 98]], 4: [[34, 34], [94, 34], [34, 94], [94, 94]], 5: [[30, 30], [98, 30], [64, 64], [30, 98], [98, 98]], 6: [[34, 28], [94, 28], [34, 64], [94, 64], [34, 100], [94, 100]] };
  for (const [x, y] of P[n]) { g.beginPath(); g.arc(x, y, n === 1 ? 16 : 11, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.35 });
}
function makeDie(s = 1) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), [1, 6, 2, 5, 3, 4].map(diceFace));
  m.castShadow = true;
  return m;
}

export class DiceScene extends Stage3D {
  private lowSeg: THREE.Mesh;
  private highSeg: THREE.Mesh;
  private gate = new THREE.Group();
  private egg: THREE.Mesh;
  private eggGlow: THREE.Sprite;
  private resultTag: THREE.Mesh | null = null;
  private target = 50;
  private over = true;
  private rollAnim: { from: number; to: number; t0: number; dur: number; resolve: () => void; win: boolean; result: number } | null = null;
  private dice: THREE.Mesh[] = [];
  private red = std(0xe63946, { roughness: 0.4, emissive: 0x3a0508 });
  private green = std(0x10b981, { roughness: 0.4, emissive: 0x053a26 });

  constructor(host: HTMLElement) {
    super(host, { fov: 34, bg: 0x0b0a0c });
    this.parallax = 0.6;
    this.key.position.set(-4, 12, 9);

    // felt table
    const felt = new THREE.Mesh(new THREE.BoxGeometry(34, 0.4, 16), std(0x3a0b10, { roughness: 1 }));
    felt.position.y = -0.45; felt.receiveShadow = true;
    this.scene.add(felt);
    const rim = box(MAT.gold, [34.4, 0.25, 0.3], [0, -0.2, -8], false);
    this.scene.add(rim);
    const g1 = glowSprite('rgba(244,196,48,0.6)', 26, 0.18); g1.position.set(0, 3, -6); this.scene.add(g1);

    // track base + two coloured segments
    const base = box(std(0x1c1c20, { metalness: 0.4, roughness: 0.4 }), [L + 1, 0.3, 1.6], [0, -0.1, 0]);
    base.receiveShadow = true;
    this.scene.add(base);
    this.lowSeg = box(this.red, [1, 0.12, 1.1], [0, 0.1, 0]);
    this.highSeg = box(this.green, [1, 0.12, 1.1], [0, 0.1, 0]);
    this.lowSeg.receiveShadow = this.highSeg.receiveShadow = true;
    this.scene.add(this.lowSeg, this.highSeg);

    // ticks + labels
    for (const v of [0, 25, 50, 75, 100]) {
      this.scene.add(box(MAT.cream, [0.06, 0.05, 0.4], [toX(v), 0.18, 0.95], false));
      const lbl = labelPlane(textTexture(String(v), { w: 128, h: 64, color: '#A0A0A0' }), 0.9, 0.45);
      lbl.rotation.x = -Math.PI / 2.6;
      lbl.position.set(toX(v), 0.2, 1.55);
      this.scene.add(lbl);
    }

    // target gate
    const post = std(0xf4c430, { metalness: 0.7, roughness: 0.3, emissive: 0x3a2800 });
    this.gate.add(box(post, [0.1, 1.5, 0.1], [0, 0.75, -0.75]), box(post, [0.1, 1.5, 0.1], [0, 0.75, 0.75]), box(post, [0.1, 0.1, 1.6], [0, 1.5, 0]));
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.45), new THREE.MeshBasicMaterial({ color: 0xf4c430, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
    beam.rotation.y = Math.PI / 2; beam.position.y = 0.75;
    this.gate.add(beam);
    this.scene.add(this.gate);

    // egg
    this.egg = makeEgg(0xf4c430, true);
    this.egg.scale.multiplyScalar(1);
    this.eggGlow = glowSprite('rgba(244,196,48,0.9)', 2.6, 0.45);
    this.egg.add(this.eggGlow);
    this.egg.position.set(toX(50), 0.72, 0);
    this.scene.add(this.egg);

    // decor: dice + chip stacks
    for (const [x, z, s, ry] of [[-8.5, -3.2, 1.2, 0.4], [-6.8, -4.2, 1, 1.1], [8, -3.6, 1.1, -0.6]]) {
      const d = makeDie(s); d.position.set(x, s / 2 - 0.25, z); d.rotation.set(0, ry, 0); this.scene.add(d); this.dice.push(d);
    }
    for (const [x, z, n, col] of [[6.2, -3.8, 6, 0xe63946], [9.6, -2.6, 4, 0x1e1e1e], [-10, -2.4, 5, 0xf4c430]] as number[][]) {
      for (let k = 0; k < n; k++) { const c = makeChip(col, 0.55); c.position.set(x, -0.2 + k * 0.13, z); c.rotation.y = k; this.scene.add(c); }
    }
    this.setTarget(50, true);
    this.onResize();
  }

  protected onResize() {
    if (!this.lowSeg) return;
    const narrow = this.aspect < 1;
    // the track sits in the band between the big number (top) and the controls (bottom)
    this.frame(new THREE.Vector3(0, narrow ? 0.1 : -0.25, narrow ? -0.2 : 0.1), L + (narrow ? 1 : 2.5), narrow ? 7 : 10, new THREE.Vector3(0, 1.7, 1.2), 1);
  }

  setTarget(target: number, over: boolean) {
    this.target = target; this.over = over;
    const x = toX(target);
    const lowLen = Math.max(0.01, x - -L / 2), highLen = Math.max(0.01, L / 2 - x);
    this.lowSeg.scale.x = lowLen; this.lowSeg.position.x = -L / 2 + lowLen / 2;
    this.highSeg.scale.x = highLen; this.highSeg.position.x = x + highLen / 2;
    this.lowSeg.material = over ? this.red : this.green;
    this.highSeg.material = over ? this.green : this.red;
    this.gate.position.x = x;
  }

  roll(result: number, win: boolean, durMs: number) {
    if (this.resultTag) { this.scene.remove(this.resultTag); this.resultTag = null; }
    return new Promise<void>((resolve) => {
      this.rollAnim = { from: this.egg.position.x, to: toX(result), t0: performance.now(), dur: durMs, resolve, win, result };
      // the dice on the table jump when you roll
      this.dice.forEach((d, i) => this.addBounce(d, i));
    });
  }

  private addBounce(d: THREE.Mesh, i: number) {
    const y0 = d.position.y, t0 = performance.now() + i * 60;
    const step = () => {
      const k = (performance.now() - t0) / 500;
      if (k < 0) return requestAnimationFrame(step);
      if (k >= 1) { d.position.y = y0; return; }
      d.position.y = y0 + Math.sin(Math.PI * k) * 0.8;
      d.rotation.x += 0.2; d.rotation.z += 0.12;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  private land(x: number, win: boolean, result: number) {
    const col = win ? MAT.goldBright : MAT.flameRed;
    for (let i = 0; i < (win ? 26 : 12); i++) {
      const sp = box(col, [0.1, 0.1, 0.1], [x, 0.6, 0], false);
      const a = Math.random() * Math.PI * 2;
      this.addParticle(sp, new THREE.Vector3(Math.cos(a) * 3, 3 + Math.random() * 4, Math.sin(a) * 2), 1, 10, 0.2);
    }
    if (!win) this.shake = 0.35;
    const tag = labelPlane(textTexture(result.toFixed(2), { w: 256, h: 112, bg: win ? '#34d399' : '#E63946', color: win ? '#0B0B0B' : '#FFFFFF', radius: 28 }), 1.9, 0.83);
    tag.position.set(x, 2.1, 0);
    this.resultTag = tag;
    this.scene.add(tag);
  }

  protected update(_dt: number, t: number) {
    const a = this.rollAnim;
    if (a) {
      const k = Math.min(1, (performance.now() - a.t0) / a.dur);
      const ease = 1 - Math.pow(1 - k, 3);
      const x = a.from + (a.to - a.from) * ease;
      // bounces with decaying height
      const bounces = 3;
      const ph = k * bounces;
      const h = Math.abs(Math.sin(Math.PI * ph)) * 2.2 * Math.pow(1 - k, 1.4);
      this.egg.position.set(x, 0.72 + h, 0);
      this.egg.rotation.z = -(x - a.from) * 1.3;
      if (k >= 1) {
        this.rollAnim = null;
        this.egg.rotation.z = 0;
        this.land(a.to, a.win, a.result);
        a.resolve();
      }
    } else {
      this.egg.position.y = 0.72 + Math.sin(t * 2.4) * 0.05;
    }
    if (this.resultTag) this.resultTag.lookAt(this.camera.position);
    (this.gate.children[3] as THREE.Mesh).material && ((this.gate.children[3] as THREE.Mesh).material as THREE.MeshBasicMaterial).setValues({ opacity: 0.1 + Math.sin(t * 4) * 0.05 });
    void this.target; void this.over;
  }
}
