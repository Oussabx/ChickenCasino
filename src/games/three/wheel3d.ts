import * as THREE from 'three';
import { Stage3D } from './stage';
import { MAT, box, glowSprite, labelPlane, std, textTexture } from './models';

const R = 4;
const COLORS: Record<string, number> = { '0': 0x1f1f1f, '1.2': 0xf8f6ef, '1.5': 0xf4c430, '1.6': 0xfb923c, '1.8': 0xe63946, '2': 0xe63946, '3': 0xa855f7, '29.7': 0xf4c430 };

export class WheelScene extends Stage3D {
  private wheel = new THREE.Group();
  private segGroup = new THREE.Group();
  private segMats: THREE.MeshStandardMaterial[] = [];
  private bulbs: THREE.Mesh[] = [];
  private bulbOn = std(0xffe08a, { emissive: 0xffd36b, emissiveIntensity: 2.2 });
  private bulbOff = std(0x8e1b24, { emissive: 0xe63946, emissiveIntensity: 0.5 });
  private flap = new THREE.Group();
  private pointerKick = 0;
  private n = 30;
  private spinAnim: { from: number; to: number; t0: number; dur: number; resolve: () => void; onTick: () => void; lastSeg: number } | null = null;
  private rotDeg = 0;
  private hit: number | null = null;
  private spinning = false;

  constructor(host: HTMLElement) {
    super(host, { fov: 34, bg: 0x0d080d });
    this.parallax = 0.7;
    this.key.position.set(-6, 10, 14);

    // floor + glow
    const floor = new THREE.Mesh(new THREE.CircleGeometry(20, 48), std(0x150c10, { roughness: 0.6, metalness: 0.2 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -R - 1.35; floor.receiveShadow = true;
    this.scene.add(floor);
    const g1 = glowSprite('rgba(244,196,48,0.8)', 16, 0.3); g1.position.set(0, 0, -2); this.scene.add(g1);
    const g2 = glowSprite('rgba(168,85,247,0.7)', 22, 0.15); g2.position.set(3, -2, -5); this.scene.add(g2);

    // stand
    const wood = std(0x3a2414, { roughness: 0.8 });
    const legL = box(wood, [0.35, R + 1.4, 0.35], [-1.3, -R / 2 - 0.6, -0.8]); legL.rotation.z = -0.28;
    const legR = box(wood, [0.35, R + 1.4, 0.35], [1.3, -R / 2 - 0.6, -0.8]); legR.rotation.z = 0.28;
    this.scene.add(legL, legR, box(MAT.gold, [4.4, 0.3, 1.4], [0, -R - 1.2, -0.8]));

    this.wheel.add(this.segGroup);
    // rim + back disc
    const back = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.35, R + 0.35, 0.3, 64), std(0x140a02, { roughness: 0.5 }));
    back.rotation.x = Math.PI / 2; back.position.z = -0.22; back.castShadow = true;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.3, 0.16, 12, 96), MAT.gold);
    rim.position.z = 0.1;
    this.wheel.add(back, rim);
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), this.bulbOff);
      bulb.position.set(Math.cos(a) * (R + 0.3), Math.sin(a) * (R + 0.3), 0.24);
      this.wheel.add(bulb);
      this.bulbs.push(bulb);
    }
    this.scene.add(this.wheel);

    // hub with the rooster
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.5, 48), std(0x0b0b0b, { metalness: 0.5, roughness: 0.3 }));
    hub.rotation.x = Math.PI / 2; hub.position.z = 0.2;
    const hubRim = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.08, 8, 48), MAT.gold);
    hubRim.position.z = 0.46;
    const face = new THREE.Mesh(new THREE.CircleGeometry(1.12, 48), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    face.position.z = 0.47;
    new THREE.TextureLoader().load('./img/head.webp', (tex) => { tex.colorSpace = THREE.SRGBColorSpace; (face.material as THREE.MeshBasicMaterial).map = tex; (face.material as THREE.MeshBasicMaterial).needsUpdate = true; });
    this.scene.add(hub, hubRim, face);

    // pointer at the top, hinged at its base
    const wedge = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 4), MAT.gold);
    wedge.rotation.z = Math.PI; wedge.position.y = -0.4;
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), MAT.red);
    this.flap.add(wedge, pin);
    this.flap.position.set(0, R + 0.75, 0.55);
    wedge.castShadow = true;
    this.scene.add(this.flap);
    this.onResize();
  }

  protected onResize() {
    if (!this.wheel) return;
    this.frame(new THREE.Vector3(0, -0.25, 0), 2 * R + 2.2, 2 * R + 3.4, new THREE.Vector3(this.aspect > 1 ? 0.3 : 0.12, 0.12, 1), 1.02);
  }

  setSegments(segs: number[]) {
    this.n = segs.length;
    this.segGroup.clear();
    this.segMats = [];
    const seg = (Math.PI * 2) / this.n;
    segs.forEach((m, i) => {
      // clockwise from the top
      const a0 = Math.PI / 2 - i * seg, a1 = Math.PI / 2 - (i + 1) * seg;
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.absarc(0, 0, R, a0, a1, true);
      shape.lineTo(0, 0);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 2 });
      const col = COLORS[String(m)] ?? 0x333333;
      const mat = std(col, { roughness: 0.35, metalness: m === 29.7 ? 0.8 : 0.15, emissive: col, emissiveIntensity: 0.05 });
      this.segMats.push(mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      this.segGroup.add(mesh);
      // divider
      const div = box(MAT.black, [0.04, R, 0.3], [0, 0, 0.12], false);
      div.position.set(Math.cos(a0) * R / 2, Math.sin(a0) * R / 2, 0.12);
      div.rotation.z = a0 - Math.PI / 2;
      this.segGroup.add(div);
      if (m > 0) {
        const mid = (a0 + a1) / 2;
        const lbl = labelPlane(textTexture(String(m), { w: 160, h: 80, color: '#0B0B0B' }), 0.95, 0.48);
        lbl.position.set(Math.cos(mid) * R * 0.74, Math.sin(mid) * R * 0.74, 0.3);
        lbl.rotation.z = mid - Math.PI / 2;
        this.segGroup.add(lbl);
      }
    });
    this.highlight(null);
  }

  highlight(idx: number | null) {
    this.hit = idx;
    this.segMats.forEach((m, i) => {
      m.emissiveIntensity = idx === null ? 0.05 : i === idx ? 0.6 : 0;
    });
    this.segGroup.children.forEach((c) => {
      const mat = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (mat && 'transparent' in mat && this.segMats.includes(mat)) {
        mat.transparent = idx !== null;
        mat.opacity = idx === null || this.segMats.indexOf(mat) === idx ? 1 : 0.4;
      }
    });
  }

  /** Spin to an absolute clockwise rotation in degrees. */
  spin(toDeg: number, durMs: number, onTick: () => void) {
    this.highlight(null);
    this.spinning = true;
    return new Promise<void>((resolve) => {
      this.spinAnim = { from: this.rotDeg, to: toDeg, t0: performance.now(), dur: durMs, resolve, onTick, lastSeg: Math.floor(this.rotDeg / (360 / this.n)) };
    });
  }

  protected update(dt: number, t: number) {
    const a = this.spinAnim;
    if (a) {
      const k = Math.min(1, (performance.now() - a.t0) / a.dur);
      const e = 1 - Math.pow(1 - k, 4);
      this.rotDeg = a.from + (a.to - a.from) * e;
      const segIdx = Math.floor(this.rotDeg / (360 / this.n));
      if (segIdx !== a.lastSeg) { a.lastSeg = segIdx; this.pointerKick = 1; a.onTick(); }
      if (k >= 1) { this.spinAnim = null; this.spinning = false; a.resolve(); }
    }
    this.wheel.rotation.z = -(this.rotDeg * Math.PI) / 180;

    // pointer flick
    this.pointerKick = Math.max(0, this.pointerKick - dt * 6);
    this.flap.rotation.z = -this.pointerKick * 0.45;

    // bulbs: chase while spinning, slow alternate when idle, flash on a win
    const phase = this.spinning ? Math.floor(t * 14) : Math.floor(t * 2);
    this.bulbs.forEach((b, i) => { b.material = (i + phase) % 3 === 0 ? this.bulbOn : this.bulbOff; });
    if (this.hit !== null && !this.spinning) {
      const m = this.segMats[this.hit];
      if (m) m.emissiveIntensity = 0.35 + Math.sin(t * 8) * 0.25;
    }
  }
}
