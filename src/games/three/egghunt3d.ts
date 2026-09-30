import * as THREE from 'three';
import { Stage3D } from './stage';
import { MAT, box, glowSprite, makeEgg, makeFox, std } from './models';

const GAP = 1.7;

interface Nest {
  group: THREE.Group;
  ring: THREE.Mesh;
  hit: THREE.Mesh;
  content: THREE.Object3D | null;
  anim: number; // 0..1 reveal progress
  kind: 'egg' | 'fox' | null;
  ghost: boolean;
  hover: number;
}

const outBack = (t: number) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);

export class EggHuntScene extends Stage3D {
  private nests: Nest[] = [];
  private playable = false;
  private hovered = -1;
  private onPick: (i: number) => void = () => {};
  private lantern: THREE.PointLight;

  constructor(host: HTMLElement) {
    super(host, { fov: 36, bg: 0x0e0906, fog: [22, 44] });
    this.parallax = 0.5;
    this.key.position.set(-5, 14, 8);

    // plank floor
    const woods = [std(0x4a2f18, { roughness: 1 }), std(0x553620, { roughness: 1 }), std(0x3f2814, { roughness: 1 })];
    for (let i = -8; i <= 8; i++) {
      const plank = box(woods[(i + 8) % 3], [1.2, 0.2, 26], [i * 1.22, -0.12, 0], false);
      plank.receiveShadow = true;
      this.scene.add(plank);
    }
    // hay bales + lantern
    const hay = std(0xc9953f, { roughness: 1 }), band = std(0x7a5424);
    for (const [x, z, r] of [[-6.4, -4.6, 0.3], [6.4, -4.8, -0.2], [-6.6, 4.4, -0.4], [6.7, 4.2, 0.5]]) {
      const g = new THREE.Group();
      g.add(box(hay, [1.8, 1.1, 1.1], [0, 0.55, 0]));
      g.add(box(band, [0.08, 1.12, 1.12], [-0.45, 0.55, 0], false), box(band, [0.08, 1.12, 1.12], [0.45, 0.55, 0], false));
      g.position.set(x, 0, z); g.rotation.y = r;
      this.scene.add(g);
    }
    this.lantern = new THREE.PointLight(0xffb45a, 14, 18, 1.6);
    this.lantern.position.set(0, 5, 2);
    this.scene.add(this.lantern);
    const glow = glowSprite('rgba(255,180,90,0.7)', 16, 0.18);
    glow.position.set(0, 3, -6);
    this.scene.add(glow);

    const strawGeo = new THREE.TorusGeometry(0.55, 0.2, 8, 22);
    const holeGeo = new THREE.CylinderGeometry(0.46, 0.4, 0.12, 20);
    for (let i = 0; i < 25; i++) {
      const g = new THREE.Group();
      const straw = new THREE.Mesh(strawGeo, MAT.straw);
      straw.rotation.x = Math.PI / 2; straw.position.y = 0.12; straw.castShadow = true; straw.receiveShadow = true;
      const hole = new THREE.Mesh(holeGeo, MAT.strawDark);
      hole.position.y = 0.06;
      g.add(straw, hole);
      for (let k = 0; k < 7; k++) {
        const stick = box(MAT.straw, [0.5, 0.04, 0.05], [0, 0.25, 0], false);
        const a = (k / 7) * Math.PI * 2 + i;
        stick.position.set(Math.cos(a) * 0.55, 0.26, Math.sin(a) * 0.55);
        stick.rotation.set(0.3, a + 0.8, 0.2);
        g.add(stick);
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.05, 6, 36), new THREE.MeshBasicMaterial({ color: 0xf4c430, transparent: true, opacity: 0 }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.02;
      g.add(ring);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(GAP * 0.95, 1.2, GAP * 0.95), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 0.4; hit.userData.index = i;
      g.add(hit);
      g.position.set(((i % 5) - 2) * GAP, 0, (Math.floor(i / 5) - 2) * GAP);
      this.scene.add(g);
      this.nests.push({ group: g, ring, hit, content: null, anim: 0, kind: null, ghost: false, hover: 0 });
    }

    const cv = this.renderer.domElement;
    cv.addEventListener('pointermove', (e) => {
      const h = this.playable ? this.pick(e, this.nests.map((n) => n.hit)) : undefined;
      this.hovered = h ? (h.object.userData.index as number) : -1;
      cv.style.cursor = this.hovered >= 0 && !this.nests[this.hovered].kind ? 'pointer' : 'default';
    });
    cv.addEventListener('pointerleave', () => { this.hovered = -1; });
    cv.addEventListener('click', (e) => {
      if (!this.playable) return;
      const h = this.pick(e, this.nests.map((n) => n.hit));
      if (h) this.onPick(h.object.userData.index as number);
    });
    this.onResize();
  }

  setOnPick(fn: (i: number) => void) { this.onPick = fn; }
  setPlayable(p: boolean) { this.playable = p; if (!p) this.hovered = -1; }

  protected onResize() {
    if (!this.nests) return;
    const narrow = this.aspect < 1;
    this.frame(new THREE.Vector3(0, 0.2, 0.2), GAP * 5 + (narrow ? 0.6 : 5), GAP * 5 * 0.7 + 2, new THREE.Vector3(0, 1.25, 1), narrow ? 1.04 : 1.08);
  }

  reset() {
    for (const n of this.nests) {
      if (n.content) this.scene.remove(n.content);
      n.content = null; n.kind = null; n.anim = 0; n.ghost = false;
      (n.ring.material as THREE.MeshBasicMaterial).opacity = 0;
    }
    this.clearParticles();
  }

  /** Reveal a nest. ghost = shown at the end of a round, not picked by the player. */
  reveal(i: number, kind: 'egg' | 'fox', ghost = false) {
    const n = this.nests[i];
    if (!n || n.kind) return;
    n.kind = kind; n.ghost = ghost; n.anim = ghost ? 0.6 : 0;
    const p = n.group.position;
    let obj: THREE.Object3D;
    if (kind === 'egg') {
      obj = makeEgg(ghost ? 0xe9dcae : 0xf4c430, !ghost);
      obj.scale.multiplyScalar(ghost ? 0.55 : 0.75);
      if (!ghost) {
        const glow = glowSprite('rgba(244,196,48,0.9)', 2.4, 0.55);
        obj.add(glow);
        for (let k = 0; k < 14; k++) {
          const sp = box(MAT.goldBright, [0.07, 0.07, 0.07], [p.x, 0.6, p.z], false);
          const a = Math.random() * Math.PI * 2;
          this.addParticle(sp, new THREE.Vector3(Math.cos(a) * 2, 3 + Math.random() * 3, Math.sin(a) * 2), 0.9, 9, 0.05);
        }
      }
    } else {
      obj = makeFox();
      obj.scale.setScalar(ghost ? 0.5 : 0.72);
      if (!ghost) {
        this.shake = 0.9;
        const flash = new THREE.PointLight(0xff3322, 40, 8, 1.5);
        flash.position.set(p.x, 1.5, p.z + 0.5);
        this.scene.add(flash);
        const fade = () => { flash.intensity *= 0.9; if (flash.intensity > 0.5) requestAnimationFrame(fade); else this.scene.remove(flash); };
        requestAnimationFrame(fade);
        for (let k = 0; k < 18; k++) {
          const sp = box(k % 2 ? MAT.straw : MAT.fox, [0.12, 0.04, 0.08], [p.x, 0.4, p.z], false);
          const a = Math.random() * Math.PI * 2;
          this.addParticle(sp, new THREE.Vector3(Math.cos(a) * 3, 3 + Math.random() * 4, Math.sin(a) * 3), 1.2, 9, 0.05);
        }
      }
    }
    obj.position.set(p.x, -0.6, p.z);
    this.scene.add(obj);
    n.content = obj;
    (n.ring.material as THREE.MeshBasicMaterial).color.set(kind === 'fox' ? 0xe63946 : 0xf4c430);
    (n.ring.material as THREE.MeshBasicMaterial).opacity = ghost ? 0.15 : 0.9;
  }

  protected update(dt: number, t: number) {
    this.lantern.intensity = 13 + Math.sin(t * 7) * 1.2 + Math.sin(t * 13) * 0.8;
    this.nests.forEach((n, i) => {
      const target = this.playable && i === this.hovered && !n.kind ? 1 : 0;
      n.hover += (target - n.hover) * Math.min(1, dt * 10);
      n.group.position.y = n.hover * 0.18;
      if (!n.kind) (n.ring.material as THREE.MeshBasicMaterial).opacity = n.hover * 0.8;
      if (n.content) {
        n.anim = Math.min(1, n.anim + dt * (n.ghost ? 3 : 2.2));
        const e = outBack(n.anim);
        const base = n.group.position;
        if (n.kind === 'egg') {
          n.content.position.set(base.x, 0.1 + e * (n.ghost ? 0.35 : 0.75) + (n.anim >= 1 && !n.ghost ? Math.sin(t * 2.5 + i) * 0.06 : 0), base.z);
          n.content.rotation.y += dt * (n.ghost ? 0.4 : 1.6);
        } else {
          n.content.position.set(base.x, -0.9 + e * 0.95, base.z);
          if (!n.ghost && n.anim >= 1) n.content.rotation.z = Math.sin(t * 9) * 0.06;
        }
      }
    });
  }
}
