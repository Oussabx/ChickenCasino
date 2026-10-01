import * as THREE from 'three';
import { RenderBudget } from '../lib/perf';
import { buildChickenLook, chickenBodyColor, chickenGlow } from './three/models';

/**
 * Voxel-style 3D scene for Chicken Cross.
 * The chicken walks along +X across lanes; traffic drives along ±Z.
 * Lane i (0-based) is centred at x = (i + 1) * LW. x = 0 is the start sidewalk.
 */

const LW = 2.4; // lane width
const ROAD_LEN = 90; // lane length along Z
const HALF = ROAD_LEN / 2;
const CAR_COLORS = [0xe63946, 0xf4c430, 0xf8f6ef, 0x3b82f6, 0x10b981, 0x8b5cf6, 0xf97316, 0x22d3ee];

const ease = {
  outBack: (t: number) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
  outBounce: (t: number) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
  inOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};

type LaneState = 'upcoming' | 'next' | 'current' | 'passed';

interface Car {
  group: THREE.Group;
  len: number;
  speed: number;
  z: number;
}

interface Lane {
  x: number;
  dir: 1 | -1; // traffic direction along Z
  cars: Car[];
  blocked: boolean;
  barrier: THREE.Group;
  barrierAnim: number; // 0..1, progress of drop
  label: THREE.Mesh;
  labelCanvas: HTMLCanvasElement;
  labelTex: THREE.CanvasTexture;
  ring: THREE.Mesh;
  disc: THREE.Mesh;
  mult: number;
  state: LaneState;
}

interface Particle { mesh: THREE.Mesh; v: THREE.Vector3; spin: THREE.Vector3; life: number; max: number; gravity: number }

export class CrossScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
  private world = new THREE.Group();
  private lanes: Lane[] = [];
  private chicken!: THREE.Group;
  private chickenBody!: THREE.Group;
  private skinMats: THREE.MeshStandardMaterial[] = [];
  private chickenX = 0;
  private step = 0;
  private hopping = false;
  private dead = false;
  private particles: Particle[] = [];
  private shake = 0;
  private camX = 0;
  private raf = 0;
  private last = performance.now();
  private ro: ResizeObserver;
  private budget: RenderBudget;
  private disposed = false;
  private finishX = 0;
  private egg!: THREE.Group;
  private killer: Car | null = null;
  private turbo = false;
  private celebrateT = -1;
  private flash = 0;
  private flashEl: HTMLDivElement;
  private mats = {
    asphalt: new THREE.MeshStandardMaterial({ color: 0x232327, roughness: 0.95 }),
    asphalt2: new THREE.MeshStandardMaterial({ color: 0x1d1d21, roughness: 0.95 }),
    line: new THREE.MeshStandardMaterial({ color: 0xd9d4c3, roughness: 0.8 }),
    side: new THREE.MeshStandardMaterial({ color: 0x55555c, roughness: 0.9 }),
    curb: new THREE.MeshStandardMaterial({ color: 0x77777f, roughness: 0.8 }),
    grass: new THREE.MeshStandardMaterial({ color: 0x1f3a24, roughness: 1 }),
    grass2: new THREE.MeshStandardMaterial({ color: 0x264a2c, roughness: 1 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x3a3a40, metalness: 0.6, roughness: 0.4 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xf4c430, metalness: 0.7, roughness: 0.3, emissive: 0x3a2800 }),
    black: new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.6 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x1a2233, metalness: 0.5, roughness: 0.15 }),
    head: new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffe08a, emissiveIntensity: 1.2 }),
    tail: new THREE.MeshStandardMaterial({ color: 0xff3344, emissive: 0xe63946, emissiveIntensity: 1 }),
    red: new THREE.MeshStandardMaterial({ color: 0xe63946, roughness: 0.6 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xf6a623, roughness: 0.6 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 1 }),
    leaf2: new THREE.MeshStandardMaterial({ color: 0x3f8a4a, roughness: 1 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffd36b, emissiveIntensity: 2 }),
    feather: new THREE.MeshStandardMaterial({ color: 0xf8f6ef, roughness: 0.8 }),
    stripe: (() => {
      const c = document.createElement('canvas'); c.width = 128; c.height = 16;
      const g = c.getContext('2d')!;
      for (let i = -1; i < 10; i++) { g.fillStyle = i % 2 ? '#0b0b0b' : '#f4c430'; g.beginPath(); g.moveTo(i * 16, 16); g.lineTo(i * 16 + 8, 0); g.lineTo(i * 16 + 24, 0); g.lineTo(i * 16 + 16, 16); g.fill(); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 });
    })(),
  };
  private box = new THREE.BoxGeometry(1, 1, 1);

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.budget = new RenderBudget(this.renderer, () => this.resize());
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = RenderBudget.softShadows() ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'manipulation';

    this.flashEl = document.createElement('div');
    Object.assign(this.flashEl.style, { position: 'absolute', inset: '0', pointerEvents: 'none', background: 'radial-gradient(circle, rgba(230,57,70,.0), rgba(230,57,70,.55))', opacity: '0' });
    host.appendChild(this.flashEl);

    this.scene.background = new THREE.Color(0x0c0a0f);
    this.scene.fog = new THREE.Fog(0x0c0a0f, 26, 60);
    this.scene.add(this.world);

    const hemi = new THREE.HemisphereLight(0xbfc8ff, 0x2a1a10, 0.9);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe2b8, 2.2);
    sun.position.set(-8, 18, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(RenderBudget.shadowSize(), RenderBudget.shadowSize());
    const sc = sun.shadow.camera;
    sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 60;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun, sun.target);
    (this as any).sun = sun;
    const rim = new THREE.DirectionalLight(0xe63946, 0.35);
    rim.position.set(10, 6, -12);
    this.scene.add(rim);

    this.chicken = this.makeChicken();
    this.world.add(this.chicken);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.budget.watch(host);
    this.resize();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  /* ======================= building ======================= */

  build(mults: number[]) {
    // clear old world except chicken
    for (const child of [...this.world.children]) if (child !== this.chicken) { this.world.remove(child); disposeTree(child); }
    this.lanes = [];
    const n = mults.length;
    this.finishX = (n + 1) * LW;

    // ground (grass) + sidewalks
    const ground = this.mesh(this.mats.grass, [n * LW + 60, 0.4, ROAD_LEN], [this.finishX / 2, -0.35, 0]);
    ground.receiveShadow = true;
    this.world.add(ground);
    this.world.add(this.sidewalk(0), this.sidewalk(this.finishX));

    // decor: trees & lamps on both ends
    for (const [x0, sgn] of [[-LW * 0.5 - 1.2, -1], [this.finishX + LW * 0.5 + 1.2, 1]] as const) {
      for (let k = 0; k < 9; k++) {
        const z = -18 + k * 4.5 + (k % 2) * 1.3;
        if (Math.abs(z) < 2.5) continue;
        const tree = this.makeTree(0.8 + ((k * 37) % 5) / 10);
        tree.position.set(x0 + sgn * ((k * 13) % 3) * 1.1, 0, z);
        this.world.add(tree);
      }
    }
    for (const x of [0, this.finishX]) for (const z of [-7, 7]) this.world.add(this.makeLamp(x - 0.9, z));

    // lanes
    for (let i = 0; i < n; i++) {
      const x = (i + 1) * LW;
      const road = this.mesh(i % 2 ? this.mats.asphalt : this.mats.asphalt2, [LW, 0.2, ROAD_LEN], [x, -0.1, 0]);
      road.receiveShadow = true;
      this.world.add(road);
      // dashed divider on the right edge
      if (i < n - 1) {
        for (let z = -HALF + 1; z < HALF; z += 3) this.world.add(this.mesh(this.mats.line, [0.09, 0.02, 1.4], [x + LW / 2, 0.01, z]));
      }
      const dir: 1 | -1 = i % 2 ? -1 : 1;

      // manhole disc + ring + label
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.06, 32), this.mats.metal.clone());
      disc.position.set(x, 0.03, 0);
      disc.receiveShadow = true;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.07, 8, 40), new THREE.MeshStandardMaterial({ color: 0x555555, emissive: 0x000000 }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.07, 0);
      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 256; labelCanvas.height = 256;
      const labelTex = new THREE.CanvasTexture(labelCanvas);
      labelTex.colorSpace = THREE.SRGBColorSpace;
      labelTex.anisotropy = 4;
      const label = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, depthWrite: false }));
      label.rotation.x = -Math.PI / 2;
      label.position.set(x, 0.075, 0);
      this.world.add(disc, ring, label);

      // barrier (starts hidden above)
      const barrier = this.makeBarrier();
      barrier.position.set(x, 6, -dir * 2.6);
      barrier.visible = false;
      this.world.add(barrier);

      // traffic
      const cars: Car[] = [];
      const count = 2;
      const speed = 7 + ((i * 7919) % 9);
      for (let c = 0; c < count; c++) {
        const car = this.makeCar(CAR_COLORS[(i * 3 + c * 5) % CAR_COLORS.length], (i + c) % 5 === 0);
        car.speed = speed;
        car.z = -HALF + ((c / count) + ((i * 0.37) % 1)) * ROAD_LEN;
        car.z = ((car.z + HALF) % ROAD_LEN) - HALF;
        car.group.position.set(x, 0, car.z);
        car.group.rotation.y = dir === 1 ? 0 : Math.PI;
        this.world.add(car.group);
        cars.push(car);
      }

      const lane: Lane = { x, dir, cars, blocked: false, barrier, barrierAnim: 0, label, labelCanvas, labelTex, ring, disc, mult: mults[i], state: 'upcoming' };
      this.lanes.push(lane);
      this.drawLabel(lane);
    }

    // golden egg on the finish sidewalk
    this.egg = this.makeEgg();
    this.egg.position.set(this.finishX, 0.2, 0);
    this.world.add(this.egg);

    this.reset();
    if (document.fonts) document.fonts.ready.then(() => this.lanes.forEach((l) => this.drawLabel(l)));
  }

  reset() {
    this.step = 0;
    this.dead = false;
    this.hopping = false;
    this.celebrateT = -1;
    this.chickenX = 0;
    this.chicken.position.set(0, 0.2, 0);
    this.chicken.rotation.set(0, 0, 0);
    this.chickenBody.scale.set(1, 1, 1);
    this.chickenBody.rotation.set(0, 0, 0);
    this.chicken.visible = true;
    if (this.killer) { this.world.remove(this.killer.group); this.killer = null; }
    for (const p of this.particles) this.world.remove(p.mesh);
    this.particles = [];
    this.lanes.forEach((l, i) => {
      l.blocked = false;
      l.barrier.visible = false;
      l.barrierAnim = 0;
      l.barrier.position.y = 6;
      this.setLaneState(i, i === 0 ? 'next' : 'upcoming');
    });
    this.camX = 0;
  }

  private look: THREE.Group | null = null;
  /** Wear an equipped skin + hat. */
  setLook(skinId: string, hatId: string) {
    const c = chickenBodyColor(skinId), e = chickenGlow(skinId);
    this.skinMats.forEach((m) => { m.color.copy(c); m.emissive.copy(e); });
    if (this.look) this.chickenBody.remove(this.look);
    this.look = buildChickenLook(skinId, hatId);
    this.chickenBody.add(this.look);
  }

  setTurbo(t: boolean) { this.turbo = t; }

  /* ======================= actions ======================= */

  /** Hop into lane `step` (1-based). If `safe` is false the chicken gets hit. */
  hop(step: number, safe: boolean): Promise<void> {
    return new Promise((resolve) => {
      if (this.hopping || this.dead) return resolve();
      const lane = this.lanes[step - 1];
      if (!lane) return resolve();
      this.hopping = true;
      const dur = this.turbo ? 0.2 : 0.36;
      const fromX = this.chickenX, toX = lane.x;
      if (safe) this.blockLane(lane);
      else this.spawnKiller(lane, dur);
      this.setLaneState(step - 1, 'current');
      if (step - 2 >= 0) this.setLaneState(step - 2, 'passed');

      const t0 = performance.now();
      const anim = () => {
        if (this.disposed) return;
        const t = Math.min(1, (performance.now() - t0) / (dur * 1000));
        // anticipation squash for the first 15%
        const x = fromX + (toX - fromX) * ease.inOut(t);
        const y = 0.2 + Math.sin(Math.PI * t) * 1.3;
        this.chicken.position.set(x, y, 0);
        this.chickenX = x;
        const stretch = t < 0.12 ? 1 - t * 2 : t > 0.88 ? 1 - (1 - t) * 2 : 1.15;
        this.chickenBody.scale.set(2 - stretch, stretch, 2 - stretch);
        this.chickenBody.rotation.z = -Math.sin(Math.PI * t) * 0.25;
        if (t < 1) requestAnimationFrame(anim);
        else {
          this.chickenBody.scale.set(1.25, 0.75, 1.25);
          setTimeout(() => { if (!this.dead) this.chickenBody.scale.set(1, 1, 1); }, 90);
          this.dust(toX);
          this.step = step;
          this.hopping = false;
          if (safe) {
            if (step < this.lanes.length) this.setLaneState(step, 'next');
            resolve();
          } else {
            // the killer car arrives right as we land
            setTimeout(() => { this.die(); resolve(); }, this.turbo ? 40 : 80);
          }
        }
      };
      requestAnimationFrame(anim);
    });
  }

  /** Hop onto the finish sidewalk & celebrate. */
  finish(): Promise<void> {
    return new Promise((resolve) => {
      const fromX = this.chickenX, toX = this.finishX;
      const lane = this.lanes[this.step - 1];
      if (lane) this.setLaneState(this.step - 1, 'passed');
      const t0 = performance.now();
      const dur = 0.45;
      const anim = () => {
        const t = Math.min(1, (performance.now() - t0) / (dur * 1000));
        const x = fromX + (toX - fromX) * ease.inOut(t);
        this.chicken.position.set(x, 0.35 + Math.sin(Math.PI * t) * 1.6, 0);
        this.chickenX = x;
        if (t < 1) requestAnimationFrame(anim);
        else { this.celebrate(); resolve(); }
      };
      requestAnimationFrame(anim);
    });
  }

  celebrate() {
    this.celebrateT = 0;
    const p = this.chicken.position;
    for (let i = 0; i < 46; i++) {
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 14), this.mats.gold);
      coin.position.set(p.x, p.y + 1, p.z);
      coin.castShadow = true;
      const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 4;
      this.addParticle(coin, new THREE.Vector3(Math.cos(a) * s * 0.5, 7 + Math.random() * 5, Math.sin(a) * s * 0.5), 1.8, 18);
    }
  }

  onClickNext(cb: () => void) {
    this.renderer.domElement.addEventListener('click', cb);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.budget.dispose();
    disposeTree(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.flashEl.remove();
  }

  /* ======================= internals ======================= */

  private die() {
    this.dead = true;
    this.shake = 0.9;
    this.flash = 1;
    // flatten
    this.chickenBody.scale.set(1.5, 0.12, 1.5);
    this.chicken.position.y = 0.12;
    // feathers
    const p = this.chicken.position;
    for (let i = 0; i < 40; i++) {
      const f = new THREE.Mesh(this.box, i % 5 === 0 ? this.mats.red : this.skinMats[0]);
      f.scale.set(0.28, 0.04, 0.12);
      f.position.set(p.x, 0.6, p.z);
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 5;
      this.addParticle(f, new THREE.Vector3(Math.cos(a) * s, 4 + Math.random() * 6, Math.sin(a) * s), 2.4, 5);
    }
  }

  private spawnKiller(lane: Lane, hopDur: number) {
    const car = this.makeCar(0xe63946, false);
    car.speed = 55;
    const travel = car.speed * (hopDur + (this.turbo ? 0.04 : 0.08));
    car.z = -lane.dir * (travel + 0.4);
    car.group.position.set(lane.x, 0, car.z);
    car.group.rotation.y = lane.dir === 1 ? 0 : Math.PI;
    this.world.add(car.group);
    this.killer = car;
    (car as any).dir = lane.dir;
    // keep regular traffic out of the way so the killer is the star
    for (const c of lane.cars) if (Math.abs(c.z) < 12) c.z = lane.dir * 30;
  }

  private blockLane(lane: Lane) {
    lane.blocked = true;
    lane.barrier.visible = true;
    lane.barrierAnim = 0.0001;
    // Near miss: the lead car races in and brakes hard right behind the barrier.
    // Anything else close to the chicken gets pushed back into the queue.
    const [lead, ...rest] = lane.cars;
    lead.speed = Math.max(lead.speed, 17);
    lead.z = -lane.dir * (13 + Math.random() * 3);
    lead.group.position.z = lead.z;
    rest.forEach((c, k) => {
      const rel = c.z * lane.dir; // negative = upstream (approaching)
      if (rel > -22 && rel < 3) c.z = -lane.dir * (20 + k * 6);
      c.group.position.z = c.z;
    });
  }

  private setLaneState(i: number, s: LaneState) {
    const l = this.lanes[i];
    if (!l || l.state === s) return;
    l.state = s;
    const ringMat = l.ring.material as THREE.MeshStandardMaterial;
    const discMat = l.disc.material as THREE.MeshStandardMaterial;
    if (s === 'passed') { ringMat.color.set(0xf4c430); ringMat.emissive.set(0x2a1e00); discMat.color.set(0x8a6d12); }
    else if (s === 'current') { ringMat.color.set(0xf4c430); ringMat.emissive.set(0x6b4f00); discMat.color.set(0x3a3a40); }
    else if (s === 'next') { ringMat.color.set(0xf4c430); ringMat.emissive.set(0x4a3600); discMat.color.set(0x3a3a40); }
    else { ringMat.color.set(0x555555); ringMat.emissive.set(0x000000); discMat.color.set(0x3a3a40); }
    this.drawLabel(l);
  }

  private drawLabel(l: Lane) {
    const g = l.labelCanvas.getContext('2d')!;
    g.clearRect(0, 0, 256, 256);
    const txt = `${l.mult >= 100 ? Math.round(l.mult) : l.mult.toFixed(2)}×`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const size = txt.length > 6 ? 54 : 66;
    g.font = `900 ${size}px Montserrat, system-ui, sans-serif`;
    g.lineWidth = 10;
    g.strokeStyle = 'rgba(0,0,0,.55)';
    g.strokeText(txt, 128, 132);
    g.fillStyle = l.state === 'passed' ? '#0b0b0b' : l.state === 'upcoming' ? '#e9e5d8' : '#FFD84D';
    if (l.state === 'passed') { g.lineWidth = 0; }
    g.fillText(txt, 128, 132);
    l.labelTex.needsUpdate = true;
  }

  private sidewalk(x: number) {
    const g = new THREE.Group();
    const slab = this.mesh(this.mats.side, [LW, 0.3, ROAD_LEN], [0, 0.05, 0]);
    slab.receiveShadow = true;
    g.add(slab);
    for (const dx of [-LW / 2, LW / 2]) g.add(this.mesh(this.mats.curb, [0.18, 0.34, ROAD_LEN], [dx, 0.07, 0]));
    // paving joints
    for (let z = -HALF; z < HALF; z += 1.6) g.add(this.mesh(this.mats.asphalt2, [LW * 0.96, 0.01, 0.05], [0, 0.205, z]));
    g.position.x = x;
    return g;
  }

  private makeTree(s: number) {
    const g = new THREE.Group();
    const trunk = this.mesh(this.mats.trunk, [0.35, 0.8, 0.35], [0, 0.4, 0]);
    const l1 = this.mesh(this.mats.leaf, [1.3, 1.1, 1.3], [0, 1.35, 0]);
    const l2 = this.mesh(this.mats.leaf2, [0.9, 0.7, 0.9], [0, 2.2, 0]);
    [trunk, l1, l2].forEach((m) => (m.castShadow = true));
    g.add(trunk, l1, l2);
    g.scale.setScalar(s);
    return g;
  }

  private makeLamp(x: number, z: number) {
    const g = new THREE.Group();
    g.add(this.mesh(this.mats.black, [0.12, 3.2, 0.12], [0, 1.6, 0]));
    g.add(this.mesh(this.mats.black, [0.6, 0.1, 0.12], [0.25, 3.2, 0]));
    g.add(this.mesh(this.mats.lamp, [0.3, 0.12, 0.2], [0.5, 3.12, 0]));
    const light = new THREE.PointLight(0xffc56b, 6, 7, 1.6);
    light.position.set(0.5, 2.9, 0);
    g.add(light);
    g.position.set(x, 0.2, z);
    g.children.forEach((c) => (c.castShadow = true));
    return g;
  }

  private makeBarrier() {
    const g = new THREE.Group();
    const bar = this.mesh(this.mats.stripe, [LW * 0.86, 0.26, 0.14], [0, 0.75, 0]);
    const p1 = this.mesh(this.mats.black, [0.12, 0.8, 0.12], [-LW * 0.36, 0.4, 0]);
    const p2 = this.mesh(this.mats.black, [0.12, 0.8, 0.12], [LW * 0.36, 0.4, 0]);
    const l1 = this.mesh(this.mats.tail, [0.1, 0.1, 0.1], [-LW * 0.36, 0.86, 0]);
    const l2 = this.mesh(this.mats.tail, [0.1, 0.1, 0.1], [LW * 0.36, 0.86, 0]);
    [bar, p1, p2].forEach((m) => (m.castShadow = true));
    g.add(bar, p1, p2, l1, l2);
    return g;
  }

  private makeEgg() {
    const g = new THREE.Group();
    const egg = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 18), new THREE.MeshStandardMaterial({ color: 0xf4c430, metalness: 0.85, roughness: 0.18, emissive: 0x5a3f00, emissiveIntensity: 0.6 }));
    egg.scale.set(1, 1.3, 1);
    egg.position.y = 0.75;
    egg.castShadow = true;
    const glow = new THREE.PointLight(0xf4c430, 10, 6, 1.5);
    glow.position.y = 1.2;
    const nest = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.2, 8, 20), this.mats.trunk);
    nest.rotation.x = -Math.PI / 2;
    nest.position.y = 0.15;
    g.add(egg, glow, nest);
    return g;
  }

  private makeCar(color: number, truck: boolean): Car {
    const g = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.35 });
    const len = truck ? 4.4 : 2.7;
    const w = 1.45;
    if (truck) {
      g.add(this.mesh(body, [w, 1.0, 1.3], [0, 0.85, len / 2 - 0.65]));
      g.add(this.mesh(this.mats.glass, [w * 0.9, 0.45, 0.1], [0, 1.1, len / 2 - 0.02]));
      g.add(this.mesh(new THREE.MeshStandardMaterial({ color: 0xe9e5d8, roughness: 0.7 }), [w * 1.02, 1.5, len - 1.45], [0, 1.1, -0.72]));
    } else {
      g.add(this.mesh(body, [w, 0.55, len], [0, 0.55, 0]));
      g.add(this.mesh(body, [w * 0.86, 0.5, len * 0.5], [0, 1.05, -0.12]));
      g.add(this.mesh(this.mats.glass, [w * 0.88, 0.4, 0.06], [0, 1.03, len * 0.13 + 0.02]));
      g.add(this.mesh(this.mats.glass, [w * 0.88, 0.4, 0.06], [0, 1.03, -len * 0.37]));
      if (color === 0xf4c430) g.add(this.mesh(this.mats.black, [0.45, 0.16, 0.25], [0, 1.38, -0.1])); // taxi sign
    }
    // lights
    for (const sx of [-w / 2 + 0.22, w / 2 - 0.22]) {
      g.add(this.mesh(this.mats.head, [0.26, 0.14, 0.05], [sx, 0.62, len / 2 + 0.01]));
      g.add(this.mesh(this.mats.tail, [0.26, 0.12, 0.05], [sx, 0.62, -len / 2 - 0.01]));
    }
    // wheels
    const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.22, 14);
    for (const sx of [-w / 2, w / 2]) for (const sz of [len / 2 - 0.55, -len / 2 + 0.55]) {
      const wh = new THREE.Mesh(wheelGeo, this.mats.tire);
      wh.rotation.z = Math.PI / 2;
      wh.position.set(sx, 0.3, sz);
      g.add(wh);
    }
    // headlight beam
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 3.2), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.08, depthWrite: false }));
    beam.rotation.x = -Math.PI / 2;
    beam.position.set(0, 0.02, len / 2 + 1.6);
    g.add(beam);
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== beam) (o as THREE.Mesh).castShadow = true; });
    return { group: g, len, speed: 8, z: 0 };
  }

  private makeChicken() {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    this.chickenBody = body;
    const skin = new THREE.MeshStandardMaterial({ color: 0xf8f6ef, roughness: 0.75 });
    const skin2 = new THREE.MeshStandardMaterial({ color: 0xf8f6ef, roughness: 0.75 });
    this.skinMats = [skin, skin2];
    const parts: [THREE.Material, number[], number[]][] = [
      [skin, [0.9, 0.75, 0.8], [0, 0.72, 0]], // torso
      [skin2, [0.62, 0.62, 0.62], [0.28, 1.35, 0]], // head
      [skin, [0.2, 0.45, 0.6], [-0.52, 0.95, 0]], // tail
      [skin2, [0.5, 0.35, 0.12], [-0.05, 0.75, 0.45]], // wing L
      [skin2, [0.5, 0.35, 0.12], [-0.05, 0.75, -0.45]], // wing R
      [this.mats.red, [0.34, 0.22, 0.14], [0.25, 1.76, 0]], // comb
      [this.mats.red, [0.18, 0.16, 0.14], [0.05, 1.72, 0]], // comb back
      [this.mats.orange, [0.26, 0.14, 0.24], [0.7, 1.28, 0]], // beak
      [this.mats.red, [0.1, 0.2, 0.12], [0.62, 1.1, 0]], // wattle
      [this.mats.black, [0.12, 0.16, 0.7], [0.6, 1.44, 0]], // sunglasses band
      [this.mats.black, [0.05, 0.2, 0.26], [0.63, 1.43, 0.19]], // lens L
      [this.mats.black, [0.05, 0.2, 0.26], [0.63, 1.43, -0.19]], // lens R
      [this.mats.orange, [0.09, 0.4, 0.09], [0.05, 0.2, 0.18]], // leg
      [this.mats.orange, [0.09, 0.4, 0.09], [0.05, 0.2, -0.18]],
      [this.mats.orange, [0.3, 0.05, 0.16], [0.14, 0.02, 0.18]], // feet
      [this.mats.orange, [0.3, 0.05, 0.16], [0.14, 0.02, -0.18]],
    ];
    for (const [m, s, p] of parts) {
      const mesh = this.mesh(m, s, p);
      mesh.castShadow = true;
      body.add(mesh);
    }
    // glint on the shades
    const glint = this.mesh(new THREE.MeshBasicMaterial({ color: 0xffffff }), [0.02, 0.05, 0.1], [0.66, 1.48, 0.23]);
    body.add(glint);
    root.position.set(0, 0.2, 0);
    return root;
  }

  private dust(x: number) {
    for (let i = 0; i < 10; i++) {
      const puff = new THREE.Mesh(this.box, this.mats.curb);
      const s = 0.12 + Math.random() * 0.12;
      puff.scale.set(s, s, s);
      puff.position.set(x + (Math.random() - 0.5) * 0.4, 0.15, (Math.random() - 0.5) * 0.4);
      const a = Math.random() * Math.PI * 2;
      this.addParticle(puff, new THREE.Vector3(Math.cos(a) * 2, 0.8 + Math.random(), Math.sin(a) * 2), 0.45, 2);
    }
  }

  private addParticle(mesh: THREE.Mesh, v: THREE.Vector3, life: number, gravity: number) {
    this.world.add(mesh);
    this.particles.push({ mesh, v, spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8), life, max: life, gravity });
  }

  private mesh(mat: THREE.Material, s: number[], p: number[]) {
    const m = new THREE.Mesh(this.box, mat);
    m.scale.set(s[0], s[1], s[2]);
    m.position.set(p[0], p[1], p[2]);
    return m;
  }

  private resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /* ======================= loop ======================= */

  private loop(now: number) {
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const t = now / 1000;

    // traffic
    for (const lane of this.lanes) {
      // barrier drop
      if (lane.barrierAnim > 0 && lane.barrierAnim < 1) {
        lane.barrierAnim = Math.min(1, lane.barrierAnim + dt / 0.5);
        lane.barrier.position.y = 6 * (1 - ease.outBounce(lane.barrierAnim));
      }
      const stopRel = -3.4; // barrier sits at rel -2.6; cars stop just behind it
      const queue = lane.blocked ? lane.cars.filter((c) => c.z * lane.dir < 0).sort((a, b) => b.z * lane.dir - a.z * lane.dir) : [];
      for (const car of lane.cars) {
        let z = car.z + lane.dir * car.speed * dt;
        if (lane.blocked) {
          const qi = queue.indexOf(car);
          if (qi >= 0) {
            let limit = stopRel - car.len / 2;
            for (let k = 0; k < qi; k++) limit -= queue[k].len + 0.6;
            // brake smoothly as the car approaches its stop point
            const remaining = limit - car.z * lane.dir;
            if (remaining < 5) z = car.z + lane.dir * Math.min(car.speed * dt, Math.max(0, remaining) * Math.min(1, dt * 7));
            if (z * lane.dir > limit) z = lane.dir * limit;
          }
        }
        if (z * lane.dir > HALF + 4) z = -lane.dir * (HALF + 4);
        car.z = z;
        car.group.position.z = z;
      }
    }
    if (this.killer) {
      const k = this.killer, dir = (k as any).dir as number;
      k.z += dir * k.speed * dt;
      k.group.position.z = k.z;
      if (k.z * dir > HALF + 6) { this.world.remove(k.group); this.killer = null; }
    }

    // chicken idle
    if (!this.hopping && !this.dead && this.celebrateT < 0) {
      this.chickenBody.position.y = Math.abs(Math.sin(t * 3)) * 0.05;
      this.chickenBody.rotation.y = Math.sin(t * 1.3) * 0.18;
    }
    if (this.celebrateT >= 0) {
      this.celebrateT += dt;
      const ct = this.celebrateT;
      this.chickenBody.rotation.y = ct * 10;
      this.chickenBody.position.y = Math.abs(Math.sin(ct * 7)) * 0.6 * Math.max(0, 1 - ct / 2.2);
      if (ct > 2.2) { this.celebrateT = -1; this.chickenBody.rotation.y = 0; }
    }

    // egg spin
    if (this.egg) { this.egg.rotation.y += dt * 1.4; this.egg.position.y = 0.2 + Math.sin(t * 2) * 0.12; }

    // next-lane pulse
    for (const l of this.lanes) {
      if (l.state === 'next') { const s = 1 + Math.sin(t * 5) * 0.06; l.ring.scale.set(s, s, 1); }
      else l.ring.scale.set(1, 1, 1);
    }

    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.v.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.v, dt);
      if (p.mesh.position.y < 0.05) { p.mesh.position.y = 0.05; p.v.multiplyScalar(0.4); p.v.y = Math.abs(p.v.y) * 0.3; }
      p.mesh.rotation.x += p.spin.x * dt; p.mesh.rotation.y += p.spin.y * dt; p.mesh.rotation.z += p.spin.z * dt;
      if (p.life < p.max * 0.35) {
        // shrink out (materials are shared, so no opacity fades)
        if (!p.mesh.userData.s0) p.mesh.userData.s0 = p.mesh.scale.clone();
        p.mesh.scale.copy(p.mesh.userData.s0).multiplyScalar(Math.max(0.001, p.life / (p.max * 0.35)));
      }
      if (p.life <= 0) { this.world.remove(p.mesh); this.particles.splice(i, 1); }
    }

    // camera follow (aspect-aware distance)
    const aspect = this.camera.aspect;
    const dist = aspect < 0.8 ? 1.9 : aspect < 1.2 ? 1.45 : 1.18;
    const lead = aspect < 0.8 ? 1.2 : 3.4; // keep upcoming lanes in view
    this.camX += (this.chickenX + lead - this.camX) * Math.min(1, dt * 4);
    const cx = this.camX;
    let sx = 0, sy = 0;
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 1.6); sx = (Math.random() - 0.5) * this.shake; sy = (Math.random() - 0.5) * this.shake; }
    this.camera.position.set(cx - 2.6 * dist + sx, 14 * dist + sy, 12 * dist);
    this.camera.lookAt(cx, 0, -0.8);
    const sun = (this as any).sun as THREE.DirectionalLight;
    sun.position.set(cx - 8, 18, 10);
    sun.target.position.set(cx, 0, 0);

    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 1.8); this.flashEl.style.opacity = String(this.flash); }

    this.budget.tick(dt);
    if (this.budget.visible) this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  }
}

function disposeTree(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      if (m.geometry && m.geometry.type !== 'BoxGeometry') m.geometry.dispose();
      const mat = m.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
      if (mat && (mat as any).map && (mat as any).map.isCanvasTexture) (mat as any).map.dispose();
    }
  });
}

export const LANE_WIDTH = LW;
