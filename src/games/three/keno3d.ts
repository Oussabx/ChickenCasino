import * as THREE from 'three';
import { Stage3D } from './stage';
import { MAT, box, glowSprite, makeChicken, std } from './models';

/**
 * Coop Keno's draw machine: a hen on a straw nest lays each numbered egg,
 * which hops into the basket in front of her. Caught numbers lay golden eggs.
 */
export class KenoScene extends Stage3D {
  private hen: ReturnType<typeof makeChicken>;
  private eggs: THREE.Group[] = [];
  private anims: { t0: number; dur: number; step: (k: number) => void; done?: () => void }[] = [];
  private basketAt = new THREE.Vector3(0.2, 0, 1.9);
  private plain = new THREE.MeshStandardMaterial({ color: 0xf6efe0, roughness: 0.45 });
  private golden = new THREE.MeshStandardMaterial({ color: 0xf4c430, metalness: 0.75, roughness: 0.22, emissive: 0x5a3f00, emissiveIntensity: 0.7 });
  private spot: THREE.Sprite;

  constructor(host: HTMLElement) {
    super(host, { fov: 32, bg: 0x0b0a0c });
    this.parallax = 0.35;
    this.key.position.set(-4, 10, 8);

    for (let i = 0; i < 14; i++) {
      const s = glowSprite(Math.random() < 0.7 ? 'rgba(255,205,110,1)' : 'rgba(230,57,70,1)', 0.8 + Math.random() * 1.6, 0.12 + Math.random() * 0.14);
      s.position.set((Math.random() - 0.5) * 22, 1 + Math.random() * 6, -7 - Math.random() * 6);
      this.scene.add(s);
    }
    // barn floor + back boards
    const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 48), std(0x3a2414, { roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.scene.add(floor);
    for (let i = -5; i <= 5; i++) {
      const b = box(std(i % 2 ? 0x5b3a1e : 0x4e3118, { roughness: 1 }), [0.95, 5, 0.2], [i, 2.5, -3.2]);
      b.receiveShadow = true; this.scene.add(b);
    }
    // straw bits
    for (let i = 0; i < 70; i++) {
      const s = box(Math.random() < 0.5 ? MAT.straw : MAT.strawDark, [0.5, 0.03, 0.05], [(Math.random() - 0.5) * 9, 0.02, (Math.random() - 0.4) * 5], false);
      s.rotation.y = Math.random() * Math.PI; this.scene.add(s);
    }
    // nest
    const nest = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.38, 10, 28), MAT.straw);
    nest.rotation.x = -Math.PI / 2; nest.position.set(0, 0.28, -0.6); nest.scale.z = 0.8; nest.castShadow = true; nest.receiveShadow = true;
    this.scene.add(nest);
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.9 + Math.random() * 0.45;
      const s = box(i % 3 ? MAT.straw : MAT.strawDark, [0.7, 0.05, 0.06], [Math.cos(a) * r, 0.35 + Math.random() * 0.3, -0.6 + Math.sin(a) * r * 0.8], false);
      s.rotation.set(Math.random() * 0.6, a + Math.PI / 2 + (Math.random() - 0.5) * 0.6, Math.random() * 0.4);
      this.scene.add(s);
    }
    // the hen, facing the player, sitting in the nest
    this.hen = makeChicken('#F8F6EF');
    this.hen.root.rotation.y = -Math.PI / 2;
    this.hen.root.position.set(0, 0.2, -0.6);
    this.hen.root.scale.setScalar(1.25);
    this.scene.add(this.hen.root);
    // basket
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.0, 0.7, 28, 1, true), std(0x8a5a2b, { roughness: 0.9, side: THREE.DoubleSide }));
    basket.position.copy(this.basketAt).setY(0.35); basket.castShadow = true; this.scene.add(basket);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.08, 8, 32), std(0x6b4423, { roughness: 0.8 }));
    rim.rotation.x = Math.PI / 2; rim.position.copy(this.basketAt).setY(0.7); this.scene.add(rim);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(1.0, 28), std(0x6b4423)); bottom.rotation.x = -Math.PI / 2; bottom.position.copy(this.basketAt).setY(0.04); this.scene.add(bottom);
    this.spot = glowSprite('rgba(244,196,48,1)', 4, 0); this.spot.position.copy(this.basketAt).setY(1.2); this.scene.add(this.spot);
    this.onResize();
  }

  protected onResize() {
    if (!this.hen) return;
    const tall = this.aspect < 0.85;
    this.frame(new THREE.Vector3(0, 1.0, 0.7), tall ? 4.6 : 5.6, tall ? 5.4 : 4.4, new THREE.Vector3(0, 0.55, 1), 1);
  }

  /** Empty the basket before a new draw. */
  clear() {
    const old = this.eggs; this.eggs = [];
    old.forEach((e, i) => {
      const from = e.position.clone();
      this.anim(380, (k) => { e.position.set(from.x, from.y - k * 0.6, from.z); e.scale.setScalar(Math.max(0.01, 1 - k)); }, () => this.scene.remove(e));
      void i;
    });
  }

  /** The hen lays egg number `n`; it hops into the basket. */
  lay(n: number, hit: boolean, durMs: number) {
    const g = new THREE.Group();
    const egg = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), hit ? this.golden : this.plain);
    egg.scale.set(1, 1.28, 1); egg.castShadow = true;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: numberTexture(n, hit), depthTest: true, transparent: true }));
    label.scale.set(0.42, 0.42, 1); label.position.set(0, 0.02, 0.31);
    g.add(egg, label);
    const i = this.eggs.length;
    const ring = i < 9 ? 0 : 1, a = (i % 9) / 9 * Math.PI * 2 + ring * 0.35;
    const rest = this.basketAt.clone().add(new THREE.Vector3(Math.cos(a) * (ring ? 0.45 : 0.78), 0.42 + ring * 0.32, Math.sin(a) * (ring ? 0.35 : 0.6)));
    if (i >= 18) rest.copy(this.basketAt).add(new THREE.Vector3((i - 18.5) * 0.4, 1.05, 0.1));
    const from = new THREE.Vector3(0, 0.5, -0.4);
    g.position.copy(from); g.scale.setScalar(0.2);
    this.scene.add(g); this.eggs.push(g);
    const body = this.hen.body;
    // squat-and-pop, then the egg arcs into the basket
    this.anim(durMs, (k) => {
      body.scale.y = 1 - Math.sin(Math.min(1, k * 2.5) * Math.PI) * 0.16;
      body.position.y = -Math.sin(Math.min(1, k * 2.5) * Math.PI) * 0.08;
      const t = Math.max(0, (k - 0.25) / 0.75);
      g.scale.setScalar(0.2 + Math.min(1, k * 3) * 0.8);
      g.position.lerpVectors(from, rest, t * t * (3 - 2 * t));
      g.position.y += Math.sin(Math.PI * t) * 1.4;
      egg.rotation.z = t * 6;
    }, () => { body.scale.y = 1; body.position.y = 0; egg.rotation.z = 0.3; });
    if (hit) {
      this.anim(700, (k) => { this.spot.material.opacity = Math.sin(Math.PI * k) * 0.6; });
    }
  }

  /** End of the draw: a happy flap for a winning ticket. */
  cheer(big: boolean) {
    const r = this.hen.root, y0 = r.position.y;
    this.anim(big ? 1400 : 800, (k) => { r.position.y = y0 + Math.abs(Math.sin(k * Math.PI * (big ? 4 : 2))) * 0.35; }, () => { r.position.y = y0; });
  }

  private anim(dur: number, step: (k: number) => void, done?: () => void) { this.anims.push({ t0: performance.now(), dur, step, done }); }

  protected update(_dt: number, t: number) {
    const now = performance.now();
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      const k = Math.min(1, (now - a.t0) / a.dur);
      a.step(k);
      if (k >= 1) { this.anims.splice(i, 1); a.done?.(); }
    }
    this.hen.root.rotation.y = -Math.PI / 2 + Math.sin(t * 0.9) * 0.15;
  }
}

const numCache = new Map<string, THREE.CanvasTexture>();
function numberTexture(n: number, hit: boolean) {
  const k = `${n}${hit}`;
  const hitTex = numCache.get(k); if (hitTex) return hitTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const draw = () => {
    const g = cv.getContext('2d')!;
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = hit ? '#0b0b0b' : '#E63946'; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
    g.fillStyle = hit ? '#F4C430' : '#ffffff'; g.font = '900 64px Montserrat, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(n), 64, 68);
    tex.needsUpdate = true;
  };
  draw(); document.fonts?.ready.then(draw);
  numCache.set(k, tex);
  return tex;
}
