import * as THREE from 'three';
import { Stage3D } from './stage';
import { MAT, box, glowSprite, labelPlane, std, textTexture } from './models';

export const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const colorOf = (n: number) => (n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black');

const N = 37;
const SEG = (Math.PI * 2) / N;
const R_POCKET_IN = 1.75, R_POCKET_OUT = 2.45, R_NUM_OUT = 2.95, R_TRACK = 3.45;
const Y_POCKET = 0.12, Y_TRACK = 0.52;

/** Point at local angle a (radians, around +Y) and radius r. */
const polar = (a: number, r: number, y = 0) => new THREE.Vector3(Math.cos(a) * r, y, -Math.sin(a) * r);

export class RouletteScene extends Stage3D {
  private rotor = new THREE.Group();
  private ball: THREE.Mesh;
  private rotorAngle = 0;
  private rotorSpeed = 0.35; // idle drift (rad/s)
  private ballAngle = 0;
  private ballRadius = R_TRACK;
  private ballY = Y_TRACK;
  private landed: number | null = null; // pocket index the ball sits in
  private spinAnim: { t0: number; dur: number; r0: number; dr: number; b0: number; db: number; target: number; resolve: () => void; onBounce: () => void; bounced: number } | null = null;
  private layout: 'side' | 'top' = 'side';
  private marker: THREE.Mesh;

  constructor(host: HTMLElement) {
    super(host, { fov: 34, bg: 0x0a0708 });
    this.parallax = 0.3;
    this.key.position.set(-4, 14, 6);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), std(0x0d3b27, { roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.7; floor.receiveShadow = true;
    this.scene.add(floor);
    const g = glowSprite('rgba(244,196,48,0.55)', 16, 0.22); g.position.set(0, 2, -3); this.scene.add(g);
    const lamp = new THREE.PointLight(0xffe2b0, 40, 20, 1.4); lamp.position.set(0, 7, 1); this.scene.add(lamp);

    // bowl (static): wooden outer ring + sloped ball track
    const bowlProfile = [
      new THREE.Vector2(R_NUM_OUT + 0.05, 0.05), new THREE.Vector2(R_TRACK - 0.05, Y_TRACK - 0.05), new THREE.Vector2(R_TRACK + 0.2, Y_TRACK + 0.15),
      new THREE.Vector2(R_TRACK + 0.35, Y_TRACK + 0.2), new THREE.Vector2(R_TRACK + 0.85, Y_TRACK + 0.15), new THREE.Vector2(R_TRACK + 0.95, -0.4), new THREE.Vector2(R_NUM_OUT, -0.4),
    ];
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlProfile, 96), [std(0x3a1d0e, { roughness: 0.4, metalness: 0.1 })][0]);
    bowl.receiveShadow = true; bowl.castShadow = true;
    this.scene.add(bowl);
    const track = new THREE.Mesh(new THREE.RingGeometry(R_NUM_OUT + 0.05, R_TRACK + 0.2, 96, 1), std(0x1b120c, { roughness: 0.3, metalness: 0.2, side: THREE.DoubleSide }));
    track.rotation.x = -Math.PI / 2; track.position.y = Y_TRACK - 0.12;
    this.scene.add(track);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R_TRACK + 0.9, 0.08, 10, 120), MAT.gold);
    rim.rotation.x = Math.PI / 2; rim.position.y = Y_TRACK + 0.16;
    this.scene.add(rim);
    // diamonds (deflectors) on the track
    for (let i = 0; i < 8; i++) {
      const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), MAT.gold);
      d.position.copy(polar((i / 8) * Math.PI * 2 + 0.2, R_TRACK - 0.18, Y_TRACK - 0.02));
      d.scale.set(1, 0.5, 2.2); d.rotation.y = (i / 8) * Math.PI * 2 + 0.2;
      this.scene.add(d);
    }

    // rotor
    const red = std(0xc81d2e, { roughness: 0.35 }), black = std(0x141414, { roughness: 0.35 }), green = std(0x0e8f4a, { roughness: 0.35 });
    WHEEL_ORDER.forEach((n, i) => {
      const a0 = i * SEG - SEG / 2, a1 = a0 + SEG;
      const col = n === 0 ? green : REDS.has(n) ? red : black;
      // pocket floor
      const pocket = new THREE.Mesh(this.sector(R_POCKET_IN, R_POCKET_OUT, a0, a1), col);
      pocket.position.y = Y_POCKET; pocket.receiveShadow = true;
      this.rotor.add(pocket);
      // number ring (slightly raised, sloped look)
      const numSeg = new THREE.Mesh(this.sector(R_POCKET_OUT, R_NUM_OUT, a0, a1), col);
      numSeg.position.y = Y_POCKET + 0.14;
      this.rotor.add(numSeg);
      const lbl = labelPlane(textTexture(String(n), { w: 96, h: 96, color: '#F8F6EF', size: 56 }), 0.34, 0.34);
      lbl.rotation.x = -Math.PI / 2;
      lbl.rotation.z = i * SEG - Math.PI / 2;
      lbl.position.copy(polar(i * SEG, (R_POCKET_OUT + R_NUM_OUT) / 2, Y_POCKET + 0.16));
      this.rotor.add(lbl);
      // fret between pockets
      const fret = box(MAT.gold, [R_POCKET_OUT - R_POCKET_IN, 0.16, 0.035], [0, 0, 0]);
      fret.position.copy(polar(a0, (R_POCKET_IN + R_POCKET_OUT) / 2, Y_POCKET + 0.08));
      fret.rotation.y = a0;
      this.rotor.add(fret);
    });
    // cone + turret
    const cone = new THREE.Mesh(new THREE.ConeGeometry(R_POCKET_IN, 0.55, 64, 1, true), std(0x5b3a1e, { roughness: 0.35, metalness: 0.2, side: THREE.DoubleSide }));
    cone.position.y = Y_POCKET + 0.27; this.rotor.add(cone);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 0.3, 24), MAT.gold);
    hub.position.y = 0.55; this.rotor.add(hub);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.7, 12), MAT.gold);
    spire.position.y = 0.9; this.rotor.add(spire);
    for (let k = 0; k < 4; k++) {
      const arm = box(MAT.gold, [0.9, 0.06, 0.06], [0, 0, 0]);
      arm.position.set(Math.cos((k * Math.PI) / 2) * 0.45, 0.95, -Math.sin((k * Math.PI) / 2) * 0.45);
      arm.rotation.y = (k * Math.PI) / 2;
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), MAT.gold);
      knob.position.set(Math.cos((k * Math.PI) / 2) * 0.9, 0.95, -Math.sin((k * Math.PI) / 2) * 0.9);
      this.rotor.add(arm, knob);
    }
    this.scene.add(this.rotor);

    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.22, 24), new THREE.MeshBasicMaterial({ color: 0xf4c430, transparent: true, opacity: 0, side: THREE.DoubleSide }));
    this.marker.rotation.x = -Math.PI / 2;
    this.scene.add(this.marker);

    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), std(0xffffff, { roughness: 0.15, metalness: 0.2 }));
    this.ball.castShadow = true;
    this.scene.add(this.ball);
    this.onResize();
  }

  private sector(r0: number, r1: number, a0: number, a1: number) {
    const s = new THREE.Shape();
    s.absarc(0, 0, r1, a0, a1, false);
    s.absarc(0, 0, r0, a1, a0, true);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false, curveSegments: 4 });
    geo.rotateX(-Math.PI / 2);
    return geo;
  }

  /** 'side' = wheel on the left (board on the right), 'top' = wheel at the top (board below). */
  setLayout(l: 'side' | 'top') { this.layout = l; this.onResize(); }

  protected onResize() {
    if (!this.rotor) return;
    if (this.layout === 'side') this.frame(new THREE.Vector3(4.9, 0, 0.5), 19.5, 10, new THREE.Vector3(0, 1.7, 1), 1);
    else this.frame(new THREE.Vector3(0, 0, 3.9), 9.5, 17, new THREE.Vector3(0, 1.9, 1), 1);
  }

  /** Spin so the ball lands on `number`. Resolves when it settles. */
  spin(number: number, durMs: number, onBounce: () => void) {
    const target = WHEEL_ORDER.indexOf(number);
    this.landed = null;
    (this.marker.material as THREE.MeshBasicMaterial).opacity = 0;
    const dr = Math.PI * 2 * 2.2; // rotor turns ~2 times
    const rEnd = this.rotorAngle + dr;
    const bEndRaw = rEnd + target * SEG;
    // ball travels the opposite way, ~6 laps
    let db = bEndRaw - this.ballAngle;
    db = ((db % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI * 2 * 6;
    this.rotorSpeed = 0;
    this.ballRadius = R_TRACK; this.ballY = Y_TRACK;
    return new Promise<void>((resolve) => {
      this.spinAnim = { t0: performance.now(), dur: durMs, r0: this.rotorAngle, dr, b0: this.ballAngle, db, target, resolve, onBounce, bounced: 0 };
    });
  }

  protected update(dt: number, t: number) {
    const a = this.spinAnim;
    if (a) {
      const k = Math.min(1, (performance.now() - a.t0) / a.dur);
      this.rotorAngle = a.r0 + a.dr * (1 - Math.pow(1 - k, 2.2));
      this.ballAngle = a.b0 + a.db * (1 - Math.pow(1 - k, 2.6));
      // ball rides the outer track, then spirals down and bounces into the pocket
      if (k < 0.55) { this.ballRadius = R_TRACK - 0.02; this.ballY = Y_TRACK - 0.02; }
      else if (k < 0.9) {
        const q = (k - 0.55) / 0.35;
        this.ballRadius = R_TRACK - (R_TRACK - (R_POCKET_IN + R_POCKET_OUT) / 2) * Math.min(1, q * 1.2);
        const bounce = Math.abs(Math.sin(q * Math.PI * 4)) * 0.28 * (1 - q);
        this.ballY = Y_TRACK - (Y_TRACK - Y_POCKET - 0.1) * Math.min(1, q * 1.2) + bounce;
        const nb = Math.floor(q * 4);
        if (nb > a.bounced) { a.bounced = nb; a.onBounce(); }
      } else { this.ballRadius = (R_POCKET_IN + R_POCKET_OUT) / 2; this.ballY = Y_POCKET + 0.1; }
      if (k >= 1) {
        this.spinAnim = null;
        this.landed = a.target;
        this.rotorSpeed = 0.35;
        (this.marker.material as THREE.MeshBasicMaterial).opacity = 1;
        a.resolve();
      }
    } else {
      this.rotorAngle += this.rotorSpeed * dt;
      if (this.landed !== null) {
        this.ballAngle = this.rotorAngle + this.landed * SEG;
      } else {
        this.ballAngle -= 0.0;
      }
    }
    this.rotor.rotation.y = this.rotorAngle;
    this.ball.position.copy(polar(this.ballAngle, this.ballRadius, this.ballY));
    if (this.landed !== null) {
      this.marker.position.copy(polar(this.ballAngle, R_NUM_OUT + 0.25, Y_TRACK - 0.1));
      (this.marker.material as THREE.MeshBasicMaterial).opacity = 0.6 + Math.sin(t * 6) * 0.35;
    }
  }
}
