import * as THREE from 'three';

/**
 * Shared scaffolding for the 3D game scenes: renderer, lights, resize,
 * render loop, particles, camera shake and a gentle pointer parallax.
 * Subclasses override `update(dt, t)` and position `this.camera` via `baseCam`.
 */

export interface Particle { mesh: THREE.Object3D; v: THREE.Vector3; spin: THREE.Vector3; life: number; max: number; gravity: number; floor: number }

export abstract class Stage3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  protected host: HTMLElement;
  protected disposed = false;
  protected particles: Particle[] = [];
  protected shake = 0;
  protected turbo = false;
  /** Where the camera sits before shake/parallax, and what it looks at. */
  protected baseCam = { pos: new THREE.Vector3(0, 0, 10), look: new THREE.Vector3() };
  /** Where the camera is easing towards; `frame()` sets it. */
  private camGoal = { pos: new THREE.Vector3(0, 0, 10), look: new THREE.Vector3() };
  private camReady = false;
  protected parallax = 0.35;
  protected key: THREE.DirectionalLight;
  private ro: ResizeObserver;
  private raf = 0;
  private last = performance.now();
  private pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  private onPointer = (e: PointerEvent) => {
    const r = this.host.getBoundingClientRect();
    this.pointer.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.pointer.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
  };
  private onLeave = () => { this.pointer.tx = 0; this.pointer.ty = 0; };

  constructor(host: HTMLElement, opts: { fov?: number; bg?: number; fog?: [number, number] } = {}) {
    this.host = host;
    this.camera = new THREE.PerspectiveCamera(opts.fov ?? 38, 1, 0.1, 500);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    const cv = this.renderer.domElement;
    cv.style.display = 'block';
    cv.style.touchAction = 'manipulation';
    host.appendChild(cv);

    const bg = opts.bg ?? 0x0c0a0f;
    this.scene.background = new THREE.Color(bg);
    if (opts.fog) this.scene.fog = new THREE.Fog(bg, opts.fog[0], opts.fog[1]);

    this.scene.add(new THREE.HemisphereLight(0xc8ccff, 0x2a1408, 0.85));
    this.key = new THREE.DirectionalLight(0xffe2b8, 2.3);
    this.key.position.set(-6, 12, 10);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    const sc = this.key.shadow.camera;
    sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 60;
    this.key.shadow.bias = -0.0006;
    this.scene.add(this.key, this.key.target);
    const rim = new THREE.DirectionalLight(0xe63946, 0.7);
    rim.position.set(8, 4, -8);
    this.scene.add(rim);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    host.addEventListener('pointermove', this.onPointer);
    host.addEventListener('pointerleave', this.onLeave);
    this.resize();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  setTurbo(t: boolean) { this.turbo = t; }

  get aspect() { return this.camera.aspect; }

  private snapNext = false;
  protected resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.snapNext = true;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.onResize();
  }
  protected onResize() {}

  /** Per-frame hook for subclasses. */
  protected abstract update(dt: number, t: number): void;

  private loop(now: number) {
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.update(dt, now / 1000);
    this.stepParticles(dt);

    // camera: base + pointer parallax + shake
    const p = this.pointer;
    p.x += (p.tx - p.x) * Math.min(1, dt * 3);
    p.y += (p.ty - p.y) * Math.min(1, dt * 3);
    let sx = 0, sy = 0;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.8);
      sx = (Math.random() - 0.5) * this.shake;
      sy = (Math.random() - 0.5) * this.shake;
    }
    const ease = 1 - Math.exp(-dt * 5);
    this.baseCam.pos.lerp(this.camGoal.pos, ease);
    this.baseCam.look.lerp(this.camGoal.look, ease);
    const { pos, look } = this.baseCam;
    this.camera.position.set(pos.x + p.x * this.parallax * 2 + sx, pos.y - p.y * this.parallax + sy, pos.z);
    this.camera.lookAt(look);

    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  }

  addParticle(mesh: THREE.Object3D, v: THREE.Vector3, life: number, gravity = 9, floor = -Infinity) {
    this.scene.add(mesh);
    this.particles.push({ mesh, v, spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8), life, max: life, gravity, floor });
  }

  private stepParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.v.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.v, dt);
      if (p.mesh.position.y < p.floor) { p.mesh.position.y = p.floor; p.v.multiplyScalar(0.45); p.v.y = Math.abs(p.v.y) * 0.35; }
      p.mesh.rotation.x += p.spin.x * dt; p.mesh.rotation.y += p.spin.y * dt; p.mesh.rotation.z += p.spin.z * dt;
      if (p.life < p.max * 0.35) {
        if (!p.mesh.userData.s0) p.mesh.userData.s0 = p.mesh.scale.clone();
        p.mesh.scale.copy(p.mesh.userData.s0).multiplyScalar(Math.max(0.001, p.life / (p.max * 0.35)));
      }
      if (p.life <= 0) { this.scene.remove(p.mesh); this.particles.splice(i, 1); }
    }
  }

  clearParticles() {
    for (const p of this.particles) this.scene.remove(p.mesh);
    this.particles = [];
  }

  /** Raycast from a DOM pointer event against `objects`. */
  pick(e: { clientX: number; clientY: number }, objects: THREE.Object3D[]) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    return ray.intersectObjects(objects, true)[0];
  }

  /** Fit a box of the given world size into view at distance along `dir` from `center`. */
  protected frame(center: THREE.Vector3, width: number, height: number, dir: THREE.Vector3, margin = 1.12) {
    const vFov = (this.camera.fov * Math.PI) / 180;
    const distH = (height * margin) / 2 / Math.tan(vFov / 2);
    const distW = (width * margin) / 2 / Math.tan(vFov / 2) / this.camera.aspect;
    const d = Math.max(distH, distW);
    this.camGoal.pos.copy(center).addScaledVector(dir.clone().normalize(), d);
    this.camGoal.look.copy(center);
    // first framing (and resizes) snap; later re-framing glides
    if (!this.camReady || this.snapNext) {
      this.baseCam.pos.copy(this.camGoal.pos);
      this.baseCam.look.copy(this.camGoal.look);
      this.camReady = true;
      this.snapNext = false;
    }
  }

  /** Point the camera at a region (used for posed screenshots). */
  setView(center: [number, number, number], width: number, height: number, dir: [number, number, number], margin = 1.05) {
    this.frame(new THREE.Vector3(...center), width, height, new THREE.Vector3(...dir), margin);
    this.onResize = () => this.frame(new THREE.Vector3(...center), width, height, new THREE.Vector3(...dir), margin);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.host.removeEventListener('pointermove', this.onPointer);
    this.host.removeEventListener('pointerleave', this.onLeave);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mt) => { (mt as THREE.MeshStandardMaterial).map?.dispose(); mt.dispose(); });
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
