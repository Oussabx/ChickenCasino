import * as THREE from 'three';
import { Stage3D } from './stage';
import { MAT, box, glowSprite, labelPlane, makeChicken, makeRocket, starField, std, textTexture } from './models';

const GW = 16; // graph width in world units
const GH = 8.5; // graph height
const GROWTH = 0.00007;
const multAt = (ms: number) => Math.exp(GROWTH * ms);
const msFor = (m: number) => Math.log(m) / GROWTH;

type Phase = 'waiting' | 'running' | 'crashed';

export class CrashScene extends Stage3D {
  private phase: Phase = 'waiting';
  private mult = 1;
  private rocket = new THREE.Group();
  private flame!: THREE.Mesh;
  private flameLight!: THREE.PointLight;
  private tube: THREE.Mesh | null = null;
  private fill: THREE.Mesh | null = null;
  private grid = new THREE.Group();
  private gridKey = '';
  private stars1: THREE.Points;
  private stars2: THREE.Points;
  private pad: THREE.Group;
  private flash: THREE.PointLight;
  private tubeMat = new THREE.MeshStandardMaterial({ color: 0xf4c430, emissive: 0xf4c430, emissiveIntensity: 1.4, roughness: 0.3 });
  private fillMat = new THREE.MeshBasicMaterial({ color: 0xf4c430, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
  private tipGlow: THREE.Sprite;
  private smokeT = 0;
  private skin = '#F8F6EF';
  private chickenSkin!: THREE.MeshStandardMaterial;

  constructor(host: HTMLElement) {
    super(host, { fov: 36, bg: 0x07060d });
    this.parallax = 0.6;
    this.key.position.set(-4, 8, 14);

    this.stars1 = starField(700, 140, 0.16);
    this.stars2 = starField(250, 90, 0.32);
    this.scene.add(this.stars1, this.stars2);
    const neb1 = glowSprite('rgba(230,57,70,0.8)', 40, 0.22); neb1.position.set(10, 6, -30);
    const neb2 = glowSprite('rgba(244,196,48,0.7)', 30, 0.14); neb2.position.set(-14, -4, -26);
    const neb3 = glowSprite('rgba(120,70,255,0.7)', 36, 0.12); neb3.position.set(-4, 10, -34);
    this.scene.add(neb1, neb2, neb3);
    const planet = new THREE.Mesh(new THREE.SphereGeometry(4, 40, 30), std(0x8e1b24, { roughness: 0.9, emissive: 0x2a0508 }));
    planet.position.set(15, 9, -28);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.18, 8, 80), std(0xf4c430, { emissive: 0x3a2800 }));
    ring.rotation.x = Math.PI / 2.4;
    planet.add(ring);
    this.scene.add(planet);

    this.scene.add(this.grid);

    // launch pad
    this.pad = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.35, 32), std(0x2a2a30, { metalness: 0.6, roughness: 0.4 }));
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.05, 6, 40), new THREE.MeshBasicMaterial({ color: 0xf4c430 }));
    stripe.rotation.x = Math.PI / 2; stripe.position.y = 0.18;
    this.pad.add(base, stripe);
    this.pad.position.set(-GW / 2, -GH / 2 - 0.55, 0);
    this.scene.add(this.pad);

    // rocket + rider
    const rk = makeRocket();
    this.rocket.add(rk);
    const { root, skin } = makeChicken(this.skin);
    this.chickenSkin = skin;
    root.scale.setScalar(0.62);
    root.position.set(-0.1, 0.32, 0);
    this.rocket.add(root);
    this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.4, 16), MAT.flame);
    this.flame.rotation.z = Math.PI / 2;
    this.flame.position.x = -1.95;
    this.rocket.add(this.flame);
    this.flameLight = new THREE.PointLight(0xffa640, 8, 7, 1.5);
    this.flameLight.position.x = -2;
    this.rocket.add(this.flameLight);
    this.tipGlow = glowSprite('rgba(244,196,48,0.9)', 5, 0.5);
    this.rocket.add(this.tipGlow);
    this.rocket.scale.setScalar(0.95);
    this.scene.add(this.rocket);

    this.flash = new THREE.PointLight(0xff5533, 0, 30, 1.4);
    this.scene.add(this.flash);
    this.resetRound();
    this.onResize();
  }

  setSkin(color: string) { this.skin = color; this.chickenSkin?.color.set(color); }

  protected onResize() {
    if (!this.grid) return;
    const narrow = this.aspect < 1;
    this.frame(new THREE.Vector3(-0.3, 0.4, 0), GW + (narrow ? 2.4 : 4), GH + 3, new THREE.Vector3(-0.22, 0.08, 1), narrow ? 1.02 : 1.04);
  }

  resetRound() {
    this.phase = 'waiting';
    this.mult = 1;
    this.rocket.visible = true;
    this.pad.visible = true;
    this.rocket.position.set(-GW / 2, -GH / 2 + 0.2, 0);
    this.rocket.rotation.set(0, 0, Math.PI / 2 - 0.0001);
    this.tubeMat.color.set(0xf4c430); this.tubeMat.emissive.set(0xf4c430);
    this.fillMat.color.set(0xf4c430);
    if (this.tube) { this.scene.remove(this.tube); this.tube.geometry.dispose(); this.tube = null; }
    if (this.fill) { this.scene.remove(this.fill); this.fill.geometry.dispose(); this.fill = null; }
    this.buildGrid(2);
  }

  setState(phase: Phase, mult: number) {
    if (phase === 'running' && this.phase === 'waiting') this.pad.visible = false;
    this.phase = phase;
    this.mult = mult;
  }

  explode() {
    this.phase = 'crashed';
    this.rocket.visible = false;
    this.tubeMat.color.set(0xe63946); this.tubeMat.emissive.set(0xe63946);
    this.fillMat.color.set(0xe63946);
    this.shake = 1.1;
    this.flash.position.copy(this.rocket.position);
    this.flash.intensity = 60;
    const p = this.rocket.position;
    const colors = [MAT.flame, MAT.flameRed, MAT.gold, MAT.cream];
    for (let i = 0; i < 70; i++) {
      const m = box(colors[i % 4], i % 4 === 3 ? [0.3, 0.05, 0.14] : [0.16, 0.16, 0.16], [p.x, p.y, p.z], false);
      const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI - Math.PI / 2, s = 3 + Math.random() * 9;
      this.addParticle(m, new THREE.Vector3(Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 3, Math.sin(a) * Math.cos(e) * s), 1.6 + Math.random(), 7);
    }
    // the rider goes flying
    const { root } = makeChicken(this.skin);
    root.scale.setScalar(0.4);
    root.position.copy(p);
    this.addParticle(root, new THREE.Vector3(-2, 8, 2), 2.2, 9);
  }

  private toWorld(ms: number, m: number, scaleM: number, tScale: number) {
    return new THREE.Vector3(-GW / 2 + (ms / tScale) * GW, -GH / 2 + ((m - 1) / (scaleM - 1)) * GH, 0);
  }

  private buildGrid(scaleM: number) {
    const steps = niceSteps(scaleM);
    const key = steps.join(',');
    if (key === this.gridKey) return;
    this.gridKey = key;
    this.grid.clear();
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07 });
    const axisMat = new THREE.MeshBasicMaterial({ color: 0xf4c430, transparent: true, opacity: 0.5 });
    for (const v of steps) {
      const y = -GH / 2 + ((v - 1) / (scaleM - 1)) * GH;
      this.grid.add(box(v === 1 ? axisMat : lineMat, [GW, 0.03, 0.03], [0, y, -0.2], false));
      const lbl = labelPlane(textTexture(`${v}×`, { w: 160, h: 64, color: '#A0A0A0' }), 1.2, 0.48);
      lbl.position.set(-GW / 2 - 0.9, y, -0.2);
      this.grid.add(lbl);
    }
    this.grid.add(box(axisMat, [0.03, GH, 0.03], [-GW / 2, 0, -0.2], false));
  }

  protected update(dt: number, t: number) {
    this.stars1.position.x -= dt * (this.phase === 'running' ? 2.2 : 0.2);
    this.stars2.position.x -= dt * (this.phase === 'running' ? 4 : 0.35);
    if (this.stars1.position.x < -40) this.stars1.position.x += 40;
    if (this.stars2.position.x < -30) this.stars2.position.x += 30;
    if (this.flash.intensity > 0) this.flash.intensity = Math.max(0, this.flash.intensity - dt * 90);

    // flame flicker
    const f = 1 + Math.sin(t * 40) * 0.15 + Math.random() * 0.1;
    this.flame.scale.set(1, (this.phase === 'running' ? 1.4 : 0.5) * f, 1);
    this.flameLight.intensity = (this.phase === 'running' ? 10 : 3) * f;

    if (this.phase === 'waiting') {
      this.rocket.position.y = -GH / 2 + 0.25 + Math.sin(t * 3) * 0.05;
      this.smokeT += dt;
      if (this.smokeT > 0.12) {
        this.smokeT = 0;
        const puff = box(std(0x555560, { roughness: 1 }), [0.25, 0.25, 0.25], [this.rocket.position.x + (Math.random() - 0.5) * 0.6, -GH / 2 - 0.3, 0.3], false);
        this.addParticle(puff, new THREE.Vector3((Math.random() - 0.5) * 2, 0.6, (Math.random() - 0.5)), 1, -0.5);
      }
      return;
    }
    if (this.phase === 'crashed' && !this.tube) return;

    const m = this.mult;
    const scaleM = Math.max(2, m * 1.15);
    const tScale = Math.max(msFor(scaleM), 8000);
    this.buildGrid(scaleM);
    const tMax = msFor(m);
    const N = 70;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= N; i++) {
      const ms = (tMax * i) / N;
      pts.push(this.toWorld(ms, multAt(ms), scaleM, tScale));
    }
    if (pts[N].distanceTo(pts[0]) < 0.02) pts[N].x += 0.02;

    if (this.phase === 'running' || !this.tube) {
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, 90, 0.09, 8, false);
      if (this.tube) { this.tube.geometry.dispose(); this.tube.geometry = geo; }
      else { this.tube = new THREE.Mesh(geo, this.tubeMat); this.scene.add(this.tube); }
      // translucent area under the curve
      const shape = new THREE.Shape();
      shape.moveTo(pts[0].x, -GH / 2);
      pts.forEach((p) => shape.lineTo(p.x, p.y));
      shape.lineTo(pts[N].x, -GH / 2);
      const fg = new THREE.ShapeGeometry(shape);
      if (this.fill) { this.fill.geometry.dispose(); this.fill.geometry = fg; }
      else { this.fill = new THREE.Mesh(fg, this.fillMat); this.fill.position.z = -0.1; this.scene.add(this.fill); }
    }

    if (this.phase === 'running') {
      const tip = pts[N], prev = pts[N - 4];
      this.rocket.position.copy(tip);
      this.rocket.rotation.set(0, 0, Math.atan2(tip.y - prev.y, tip.x - prev.x));
      this.rocket.position.y += Math.sin(t * 20) * 0.02;
      // exhaust trail
      this.smokeT += dt;
      if (this.smokeT > 0.03) {
        this.smokeT = 0;
        const back = new THREE.Vector3(-1.3, 0, 0).applyEuler(this.rocket.rotation).multiplyScalar(0.95).add(tip);
        const s = 0.1 + Math.random() * 0.12;
        const puff = box(Math.random() > 0.5 ? MAT.flame : MAT.flameRed, [s, s, s], [back.x, back.y, back.z], false);
        this.addParticle(puff, new THREE.Vector3(-2 - Math.random() * 2, (Math.random() - 0.5), (Math.random() - 0.5)), 0.5, 0);
      }
    }
  }
}

function niceSteps(max: number) {
  const span = max - 1;
  const raw = span / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = 1; v <= max + 1e-9; v += step) out.push(+v.toFixed(2));
  return out;
}
