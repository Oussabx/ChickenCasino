import * as THREE from 'three';
import { Stage3D } from './stage';
import { MAT, box, glowSprite, labelPlane, makeChicken, makeChip, makeEgg, std, textTexture } from './models';

interface Ball {
  id: number;
  path: number[];
  rows: number;
  start: number;
  mesh: THREE.Mesh;
  glow: THREE.Sprite;
  hits: Set<number>;
  done: boolean;
  onPeg: (row: number) => void;
  onLand: () => void;
}

const S = 1; // horizontal peg spacing
const VS = 0.95; // vertical spacing
const PEG_R = 0.1;
const BALL_R = 0.3;

export const bucketHex = (i: number, n: number) => {
  const d = Math.abs(i - (n - 1) / 2) / ((n - 1) / 2);
  return new THREE.Color().setHSL((48 - d * 48) / 360, 0.88, 0.52 - d * 0.04);
};

export class PlinkoScene extends Stage3D {
  private board = new THREE.Group();
  private pegs: THREE.Mesh[][] = [];
  private pegGlow: number[][] = [];
  private buckets: { mesh: THREE.Group; hit: number }[] = [];
  private balls: Ball[] = [];
  private rows = 12;
  private ballColor = new THREE.Color(0xf4c430);
  private pegGeo = new THREE.CylinderGeometry(PEG_R, PEG_R, 0.3, 16);
  private capGeo = new THREE.SphereGeometry(PEG_R * 1.25, 16, 12);
  /** The hen that lays each egg at the top of the board. */
  private hen = makeChicken('#F8F6EF');
  private lay = 0;
  private auto = false;
  private grow = 1; // board pop-in progress after a difficulty change

  constructor(host: HTMLElement) {
    super(host, { fov: 34, bg: 0x0d0a08 });
    this.parallax = 0.5;
    // light mostly from the front so pegs don't streak long shadows across the board
    this.key.position.set(-2, 5, 16);
    this.scene.add(this.board);
    // backdrop glow + decor
    const glow = glowSprite('rgba(244,196,48,0.55)', 30, 0.35);
    glow.position.set(0, -4, -3);
    this.scene.add(glow);
    const red = glowSprite('rgba(230,57,70,0.6)', 26, 0.25);
    red.position.set(0, -12, -3);
    this.scene.add(red);
    // the dropper hen, facing the camera
    this.hen.root.rotation.y = -Math.PI / 2;
    this.hen.root.scale.setScalar(0.75);
    this.scene.add(this.hen.root);
  }

  setAuto(on: boolean) { this.auto = on; }

  setBallColor(hex: string) { this.ballColor.set(hex); }

  setBoard(rows: number, mults: number[]) {
    const changed = rows !== this.rows;
    this.rows = rows;
    if (changed) this.grow = 0;
    this.board.clear();
    this.pegs = []; this.pegGlow = []; this.buckets = [];
    const n = rows;
    const W = (n + 2) * S;
    const bottomY = -n * VS - 0.2;
    const H = -bottomY + 2;

    // backboard with gold frame
    const felt = new THREE.Mesh(new THREE.BoxGeometry(W + 1.4, H + 1.2, 0.3), std(0x16110d, { roughness: 0.95 }));
    felt.position.set(0, bottomY / 2 + 0.6, -0.45);
    felt.receiveShadow = true;
    this.board.add(felt);
    const fw = W + 1.4, fh = H + 1.2, cy = bottomY / 2 + 0.6;
    for (const [s, p] of [
      [[fw + 0.3, 0.18, 0.4], [0, cy + fh / 2, -0.3]], [[fw + 0.3, 0.18, 0.4], [0, cy - fh / 2, -0.3]],
      [[0.18, fh, 0.4], [-fw / 2, cy, -0.3]], [[0.18, fh, 0.4], [fw / 2, cy, -0.3]],
    ] as number[][][]) this.board.add(box(MAT.gold, s, p));

    // pegs
    const baseMat = std(0xf1e7c8, { metalness: 0.7, roughness: 0.22 });
    for (let r = 0; r < n; r++) {
      const row: THREE.Mesh[] = [];
      for (let i = 0; i < r + 3; i++) {
        const mat = baseMat.clone();
        const peg = new THREE.Mesh(this.pegGeo, mat);
        peg.rotation.x = Math.PI / 2;
        peg.position.set((i - (r + 2) / 2) * S, -r * VS, -0.1);
        peg.castShadow = true;
        const cap = new THREE.Mesh(this.capGeo, mat);
        cap.position.set(0, 0.15, 0);
        peg.add(cap);
        this.board.add(peg);
        row.push(peg);
      }
      this.pegs.push(row);
      this.pegGlow.push(new Array(r + 3).fill(0));
    }

    // buckets
    for (let i = 0; i <= n; i++) {
      const g = new THREE.Group();
      const col = bucketHex(i, n + 1);
      const b = box(std(col.getHex(), { roughness: 0.35, metalness: 0.2, emissive: col.getHex(), emissiveIntensity: 0.15 }), [S * 0.88, 0.62, 0.6], [0, 0, 0]);
      g.add(b);
      const m = mults[i];
      const tex = textTexture(m >= 100 ? `${m}` : `${m}×`, { w: 192, h: 96, color: '#0B0B0B' });
      const lbl = labelPlane(tex, S * 0.86, S * 0.43);
      lbl.position.set(0, 0, 0.31);
      g.add(lbl);
      g.position.set((i - n / 2) * S, bottomY - 0.5, 0);
      this.board.add(g);
      this.buckets.push({ mesh: g, hit: 0 });
    }

    // chip stacks either side
    for (const side of [-1, 1]) {
      for (let k = 0; k < 5; k++) {
        const chip = makeChip(k % 2 ? 0xe63946 : 0x1e1e1e, 0.45);
        chip.position.set(side * (W / 2 + 1.5), bottomY - 0.7 + k * 0.11, 0.6);
        chip.rotation.y = k * 0.4;
        this.board.add(chip);
      }
    }
    this.onResize();
  }

  protected onResize() {
    if (!this.pegs) return; // called from the base constructor before fields exist
    // Frame for the biggest (16-row) board so smaller difficulties look physically
    // smaller, but centre on the current board.
    const n = this.rows, N = 16;
    const bottomY = -n * VS - 0.2;
    const cy = bottomY / 2 + 1.1;
    const fw = (N + 2) * S + 1.4, fh = N * VS + 2.2 + 2.2;
    const w = this.aspect > 1 ? fw + 3.6 : fw + 0.4;
    this.frame(new THREE.Vector3(0, cy, 0), w, fh + 0.4, new THREE.Vector3(this.aspect > 1 ? 0.28 : 0.12, 0.16, 1), this.aspect > 1 ? 1.06 : 1.02);
  }

  drop(id: number, path: number[], cb: { onPeg: (row: number) => void; onLand: () => void }) {
    const mesh = makeEgg(this.ballColor.getHex(), true);
    (mesh.material as THREE.MeshStandardMaterial).emissive = this.ballColor.clone().multiplyScalar(0.25);
    mesh.scale.multiplyScalar(BALL_R * 2 * 0.9);
    const glow = glowSprite(`#${this.ballColor.getHexString()}`, 1.4, 0.55);
    mesh.add(glow);
    glow.scale.set(1.4 / mesh.scale.x, 1.4 / mesh.scale.y, 1);
    this.scene.add(mesh);
    this.balls.push({ id, path, rows: this.rows, start: performance.now(), mesh, glow, hits: new Set(), done: false, onPeg: cb.onPeg, onLand: cb.onLand });
    this.lay = 1;
  }

  private contact(b: Ball, r: number) {
    let k = 0;
    for (let j = 0; j < r; j++) k += b.path[j];
    if (r >= b.rows) return new THREE.Vector3((k - b.rows / 2) * S, -b.rows * VS - 0.45, 0.1);
    return new THREE.Vector3((k - r / 2) * S, -r * VS + PEG_R + BALL_R, 0.1);
  }

  protected update(dt: number, t: number) {
    // hen: sits above the first peg, bobs (faster in auto mode) and squats to lay
    const top = PEG_R + BALL_R + 1.35;
    this.lay = Math.max(0, this.lay - dt * 5);
    const bob = Math.abs(Math.sin(t * (this.auto ? 9 : 3))) * (this.auto ? 0.12 : 0.06);
    this.hen.root.position.set(0, top + 0.1 + bob - this.lay * 0.18, 0.1);
    this.hen.body.scale.set(1 + this.lay * 0.2, 1 - this.lay * 0.25, 1 + this.lay * 0.2);
    this.hen.body.rotation.y = this.auto ? Math.sin(t * 6) * 0.25 : Math.sin(t * 1.2) * 0.15;

    // board pops in after a difficulty change
    if (this.grow < 1) {
      this.grow = Math.min(1, this.grow + dt * 2.2);
      const g = this.grow, e = 1 + 2.70158 * Math.pow(g - 1, 3) + 1.70158 * Math.pow(g - 1, 2);
      this.board.scale.setScalar(0.6 + 0.4 * e);
    }

    const seg = this.turbo ? 0.06 : 0.11;
    const now = performance.now();
    for (const b of this.balls) {
      const s = (now - b.start) / 1000 / seg;
      const pos = new THREE.Vector3();
      if (s < 1) {
        const p0 = this.contact(b, 0);
        pos.set(p0.x, p0.y + 1.35 * (1 - s * s), 0.1);
      } else if (s < b.rows + 1) {
        const r = Math.floor(s) - 1, k = s - Math.floor(s);
        if (!b.hits.has(r)) {
          b.hits.add(r);
          let kk = 0; for (let j = 0; j < r; j++) kk += b.path[j];
          if (this.pegGlow[r]) this.pegGlow[r][kk + 1] = 1;
          b.onPeg(r);
        }
        const a = this.contact(b, r), c = this.contact(b, r + 1);
        const e = 1 - (1 - k) * (1 - k);
        pos.set(a.x + (c.x - a.x) * e, a.y + (c.y - a.y) * k * k + Math.sin(Math.PI * k) * VS * 0.3, 0.1);
      } else {
        pos.copy(this.contact(b, b.rows));
        if (!b.done) {
          b.done = true;
          const bi = b.path.reduce((x, y) => x + y, 0);
          if (this.buckets[bi]) this.buckets[bi].hit = 1;
          b.onLand();
          // coin sparks from the bucket
          for (let i = 0; i < 6; i++) {
            const sp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), MAT.flame);
            sp.position.copy(pos);
            this.addParticle(sp, new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 2, Math.random()), 0.6, 9);
          }
        }
      }
      b.mesh.position.copy(pos);
      b.mesh.rotation.z = -s * 1.6;
    }
    // remove landed balls a moment after landing
    this.balls = this.balls.filter((b) => {
      if (b.done && (now - b.start) / 1000 / seg > b.rows + 3) { this.scene.remove(b.mesh); return false; }
      return true;
    });

    // peg glow decay
    for (let r = 0; r < this.pegs.length; r++) for (let i = 0; i < this.pegs[r].length; i++) {
      const g = this.pegGlow[r][i];
      if (g > 0) {
        this.pegGlow[r][i] = Math.max(0, g - dt * 3);
        const m = this.pegs[r][i].material as THREE.MeshStandardMaterial;
        m.emissive.setRGB(0.95 * g, 0.75 * g, 0.2 * g);
        this.pegs[r][i].scale.setScalar(1 + g * 0.35);
      }
    }
    // bucket bounce
    for (const bk of this.buckets) {
      if (bk.hit > 0) {
        bk.hit = Math.max(0, bk.hit - dt * 3);
        bk.mesh.position.z = Math.sin(bk.hit * Math.PI) * 0.35;
        bk.mesh.scale.setScalar(1 + Math.sin(bk.hit * Math.PI) * 0.12);
      }
    }
    void t;
  }
}
