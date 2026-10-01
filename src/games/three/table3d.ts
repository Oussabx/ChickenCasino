import * as THREE from 'three';
import { Stage3D } from './stage';
import { MAT, box, glowSprite, makeChicken, makeChip, std, textTexture } from './models';
import { Card } from '../../lib/cards';
import { backTexture, faceTexture, roundRect } from './cardArt';
import { chipColor, eqTable, eqTableId } from '../../lib/equipped';
import type { TableTheme } from '../../lib/cosmetics';

/**
 * A 3D casino table used by the card games: a printed felt layout (card boxes,
 * bet spots, curved text), padded rail, card shoe, discard holder and chip tray.
 * Cards fly out of the shoe, flip, lift and get swept; chips drop, get paid or
 * collected. World units: x = left/right, z = towards the player, y = up.
 */

export const CW = 1.0; // card width
export const CH = 1.42; // card height (depth along z when lying flat)
const CT = 0.014; // card thickness
const FELT_Y = 0.06;
const W = 6.6, D = 3.4; // table half-width, dealer edge offset
const PX = 2048 / (2 * W); // felt texture px per world unit

function cardShape() {
  const s = new THREE.Shape(), w = CW / 2, h = CH / 2, r = 0.075;
  s.moveTo(-w + r, -h); s.lineTo(w - r, -h); s.quadraticCurveTo(w, -h, w, -h + r);
  s.lineTo(w, h - r); s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(-w + r, h); s.quadraticCurveTo(-w, h, -w, h - r);
  s.lineTo(-w, -h + r); s.quadraticCurveTo(-w, -h, -w + r, -h);
  return s;
}
const SHAPE = cardShape();
const BODY_GEO = (() => { const g = new THREE.ExtrudeGeometry(SHAPE, { depth: CT, bevelEnabled: false, curveSegments: 5 }); g.rotateX(-Math.PI / 2); g.translate(0, -CT / 2, 0); return g; })();
function capGeo(top: boolean) {
  const g = new THREE.ShapeGeometry(SHAPE, 5);
  g.rotateX(top ? -Math.PI / 2 : Math.PI / 2);
  g.translate(0, top ? CT / 2 + 0.0008 : -CT / 2 - 0.0008, 0);
  const pos = g.attributes.position as THREE.BufferAttribute, uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + CW / 2) / CW, top ? (CH / 2 - pos.getZ(i)) / CH : (CH / 2 + pos.getZ(i)) / CH);
  return g;
}
const FACE_GEO = capGeo(true);
const BACK_GEO = capGeo(false);
const EDGE = std(0xf4f0e4, { roughness: 0.55 });

export interface Card3D { mesh: THREE.Group; card: Card | null; up: boolean; glow?: THREE.Mesh }

/** A printed area on the felt. `r` makes it a circle; `id` makes it a clickable bet spot. */
export interface Zone { id?: string; x: number; z: number; w?: number; h?: number; r?: number; label?: string; sub?: string; color?: string; fill?: string; labelAt?: 'in' | 'below' | 'above'; dashed?: boolean }
/** Text printed on the felt. `arc` bends it around the table's curve. */
export interface FeltText { text: string; z: number; x?: number; size?: number; color?: string; arc?: boolean; weight?: number; spacing?: number }
export interface TableOpts {
  felt?: number;
  zones?: Zone[];
  texts?: FeltText[];
  /** Where the faint logo watermark sits (z), or null for none. */
  logoZ?: number | null;
  /** Oval poker table (long axis vertical when `portrait`) instead of the D-shaped table. */
  oval?: { portrait: boolean };
  /** Chicken croupier behind the D table (on by default). */
  dealer?: boolean;
  /** Camera framing: [centre z, width, height] for wide and narrow viewports. */
  view?: { wide?: [number, number, number]; narrow?: [number, number, number] };
}

const DENOMS: [number, number][] = [[1000, 0x7c3aed], [500, 0x1e1e1e], [100, 0xf4c430], [25, 0x10b981], [5, 0xe63946], [1, 0xf8f6ef]];

type Anim = { t0: number; dur: number; step: (k: number) => void; done: () => void };
interface Glow { mesh: THREE.Mesh; base: number; pulse: boolean; fade?: number }

export class TableScene extends Stage3D {
  private theme!: TableTheme;
  private railMat!: THREE.MeshStandardMaterial;
  private trimMat!: THREE.MeshStandardMaterial;
  private cards: Card3D[] = [];
  private anims: Anim[] = [];
  private chips = new Map<string, THREE.Group>();
  private shoePos = new THREE.Vector3(4.05, 0.62, -2.35);
  private discardPos = new THREE.Vector3(-4.1, 0.45, -2.45);
  private trayPos = new THREE.Vector3(0, 0.3, -3.05);
  private zones: Zone[];
  private glows: Glow[] = [];
  private hoverGlow: THREE.Mesh | null = null;
  private hoverId: string | null = null;
  private lamp: THREE.PointLight;
  private lampBase = 17;
  private flash = 0;
  private dust: THREE.Points;
  private bokeh: THREE.Sprite[] = [];
  private opts: TableOpts;

  constructor(host: HTMLElement, opts: TableOpts = {}) {
    super(host, { fov: 34, bg: 0x0a0607 });
    this.opts = opts;
    this.zones = opts.zones ?? [];
    this.parallax = 0.3;
    this.key.position.set(-3, 13, 6);
    this.key.intensity = 1.9;
    // the player's equipped table skin (Classic Green keeps each game's own felt colour)
    this.theme = eqTable();
    const felt = eqTableId() === 'tb-classic' ? (opts.felt ?? this.theme.felt) : this.theme.felt;
    this.railMat = std(this.theme.rail, { roughness: 0.36 });
    this.trimMat = new THREE.MeshStandardMaterial({ color: this.theme.trim, metalness: 0.75, roughness: 0.28, emissive: this.theme.glow ?? 0x3a2800, emissiveIntensity: this.theme.glow ? 0.9 : 0.25 });

    // room: dark floor, warm back glow, bokeh lights for depth
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), std(0x100809, { roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.6; floor.receiveShadow = true; this.scene.add(floor);
    const back = glowSprite('rgba(244,196,48,0.55)', 26, 0.16); back.position.set(0, 2.5, -9); this.scene.add(back);
    const redGlow = glowSprite('rgba(230,57,70,0.6)', 18, 0.12); redGlow.position.set(-9, 3, -8); this.scene.add(redGlow);
    for (let i = 0; i < 22; i++) {
      const warm = Math.random() < 0.7;
      const s = glowSprite(warm ? 'rgba(255,214,120,1)' : 'rgba(230,57,70,1)', 0.6 + Math.random() * 1.4, 0.18 + Math.random() * 0.2);
      s.position.set((Math.random() - 0.5) * 34, 1 + Math.random() * 6, -10 - Math.random() * 8);
      s.userData.ph = Math.random() * 6; s.userData.o = s.material.opacity;
      this.bokeh.push(s); this.scene.add(s);
    }
    this.lamp = new THREE.PointLight(0xffe0b0, this.lampBase, 20, 1.3); this.lamp.position.set(0, 6.5, 0.5); this.scene.add(this.lamp);
    const pool = glowSprite('rgba(255,236,190,0.9)', 13, 0.045); pool.position.set(0, 0.3, 0); this.scene.add(pool);

    if (opts.oval) this.buildOval(felt, opts.oval.portrait);
    else this.buildD(felt);

    // floating dust in the lamp light
    const n = 160, dp = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { dp[i * 3] = (Math.random() - 0.5) * 12; dp[i * 3 + 1] = 0.3 + Math.random() * 4.5; dp[i * 3 + 2] = -3 + Math.random() * 6; }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xffe2a8, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.scene.add(this.dust);

    this.onResize();
  }

  private buildD(felt: number) {
    // felt top: rounded "D" shape (flat edge at the dealer side)
    const shape = new THREE.Shape();
    shape.moveTo(-W, -D); shape.lineTo(W, -D);
    shape.absarc(0, -D, W, 0, Math.PI, false);
    const top = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3, curveSegments: 96 });
    top.rotateX(Math.PI / 2);
    const feltMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, map: this.feltTexture(felt) });
    const topMesh = new THREE.Mesh(top, [feltMat, std(0x2b160b, { roughness: 0.7 })]);
    topMesh.receiveShadow = true;
    this.scene.add(topMesh);
    const uv = top.attributes.uv as THREE.BufferAttribute, pos = top.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + W) / (2 * W), 1 - (pos.getZ(i) + D) / W);
    uv.needsUpdate = true;

    // padded leather rail + brass trim + wooden apron
    const railCurve = new THREE.EllipseCurve(0, -D, W + 0.12, W + 0.12, 0, Math.PI, false, 0);
    const pts = railCurve.getPoints(90).map((p) => new THREE.Vector3(p.x, 0.14, p.y));
    const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.3, 16, false), this.railMat);
    rail.castShadow = true; rail.receiveShadow = true; this.scene.add(rail);
    const inner = new THREE.EllipseCurve(0, -D, W - 0.16, W - 0.16, 0, Math.PI, false, 0).getPoints(90).map((p) => new THREE.Vector3(p.x, FELT_Y + 0.02, p.y));
    this.scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(inner), 160, 0.035, 8, false), this.trimMat));
    if (this.theme.glow) this.scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(inner), 160, 0.1, 8, false), new THREE.MeshBasicMaterial({ color: this.theme.glow, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })));
    const apron = new THREE.Mesh(new THREE.CylinderGeometry(W + 0.35, W + 0.2, 1.1, 96, 1, true, Math.PI / 2, Math.PI), std(0x1c0c06, { roughness: 0.5, side: THREE.DoubleSide }));
    apron.position.set(0, -0.5, -D); this.scene.add(apron);
    this.scene.add(box(std(0x2b160b), [2 * W + 0.7, 0.45, 0.4], [0, 0.02, -D - 0.12]));

    // card shoe: smoked acrylic box with a stack of backs and a brass plate
    const shoe = new THREE.Group();
    const acrylic = std(0x121214, { metalness: 0.45, roughness: 0.2 });
    shoe.add(box(acrylic, [1.25, 0.62, 1.8], [0, 0, 0]));
    shoe.add(box(MAT.gold, [1.27, 0.06, 0.06], [0, 0.31, 0.9]), box(MAT.gold, [1.27, 0.06, 0.06], [0, 0.31, -0.9]));
    shoe.add(box(MAT.gold, [0.06, 0.06, 1.82], [0.63, 0.31, 0]), box(MAT.gold, [0.06, 0.06, 1.82], [-0.63, 0.31, 0]));
    const stack = new THREE.Mesh(new THREE.BoxGeometry(CW * 0.98, 0.46, 1.2), [EDGE, EDGE, EDGE, EDGE, new THREE.MeshStandardMaterial({ map: backTexture(), roughness: 0.5 }), EDGE]);
    stack.position.set(0, 0.06, 0.34); shoe.add(stack);
    const lip = box(std(0x121214, { metalness: 0.5, roughness: 0.2 }), [1.25, 0.18, 0.3], [0, -0.22, 1.02]);
    lip.rotation.x = -0.5; shoe.add(lip);
    shoe.position.set(this.shoePos.x, 0.34, this.shoePos.z - 0.25);
    shoe.rotation.y = -0.4; this.scene.add(shoe);
    // discard holder
    const holder = new THREE.Group();
    holder.add(box(std(0x121214, { metalness: 0.45, roughness: 0.22 }), [1.2, 0.36, 1.62], [0, 0, 0]));
    holder.add(box(MAT.gold, [1.22, 0.05, 0.05], [0, 0.19, 0.81]), box(MAT.gold, [1.22, 0.05, 0.05], [0, 0.19, -0.81]));
    const discards = new THREE.Mesh(new THREE.BoxGeometry(CW * 0.95, 0.12, CH * 0.95), [EDGE, EDGE, new THREE.MeshStandardMaterial({ map: backTexture(), roughness: 0.5 }), EDGE, EDGE, EDGE]);
    discards.position.y = 0.2; holder.add(discards);
    holder.position.set(this.discardPos.x, 0.24, this.discardPos.z); holder.rotation.y = 0.35; this.scene.add(holder);

    // dealer's chip tray with brass edge
    const tray = new THREE.Group();
    tray.add(box(std(0x151517, { roughness: 0.35, metalness: 0.3 }), [3.8, 0.16, 0.86], [0, 0, 0]));
    tray.add(box(MAT.gold, [3.84, 0.04, 0.05], [0, 0.09, 0.43]));
    [1, 5, 25, 100, 500, 1000].forEach((v, i) => { for (let k = 0; k < 6; k++) { const c = chipColor(v, k); const ch = makeChip(c.color, 0.23, c.stripe, c.glow); ch.rotation.x = Math.PI / 2; ch.position.set(-1.55 + i * 0.62, 0.2, -0.28 + k * 0.1); tray.add(ch); } });
    tray.position.set(0, 0.16, this.trayPos.z); this.scene.add(tray);

    // the chicken croupier, behind the tray
    if (this.opts.dealer !== false) this.addDealer(new THREE.Vector3(0, -0.42, -D - 0.95), 1.4);
  }

  /** A chicken croupier: vest, collar, bow tie, green visor and a dealing wing. */
  private addDealer(at: THREE.Vector3, scale: number, lean = 0.12) {
    const ch = makeChicken('#F8F6EF');
    ch.root.scale.setScalar(scale);
    ch.root.position.copy(at);
    ch.root.rotation.y = -Math.PI / 2; // face the players (the model faces +x)
    const vest = std(0x141416, { roughness: 0.55 });
    ch.body.add(
      box(vest, [0.97, 0.56, 0.87], [0.005, 0.62, 0]),           // waistcoat
      box(std(0xf8f6ef, { roughness: 0.6 }), [0.04, 0.4, 0.26], [0.5, 0.74, 0]), // shirt front
      box(MAT.gold, [0.03, 0.05, 0.05], [0.52, 0.7, 0]), box(MAT.gold, [0.03, 0.05, 0.05], [0.52, 0.58, 0]), // buttons
      box(MAT.red, [0.1, 0.14, 0.36], [0.5, 1.02, 0]),           // bow tie
      box(MAT.red, [0.12, 0.08, 0.08], [0.52, 1.02, 0]),
      box(std(0x0e3b2a, { roughness: 0.6 }), [0.04, 0.12, 0.12], [0.5, 0.82, 0.3]), // name badge
      box(MAT.gold, [0.045, 0.04, 0.1], [0.51, 0.84, 0.3]),
    );
    // dealing wing (the one on the shoe side) — swings out on every card
    const arm = new THREE.Group();
    arm.position.set(-0.05, 0.95, -0.45);
    arm.add(box(std(0xf8f6ef, { roughness: 0.75 }), [0.5, 0.35, 0.12], [0, -0.2, 0]));
    arm.add(box(vest, [0.3, 0.12, 0.14], [0.05, -0.02, 0]));
    ch.body.add(arm);
    this.dealerArm = arm;
    ch.body.rotation.z = lean; // lean back a touch so the face reads from the overhead camera
    this.scene.add(ch.root);
    this.chicken = ch;
  }

  // ---------- oval poker table ----------
  private ov = { L: 3.7, R: 3.7, portrait: false };
  private chicken: ReturnType<typeof makeChicken> | null = null;
  private chickenLook = -Math.PI / 2;
  private chickenHop = 0;
  private dealerArm: THREE.Group | null = null;
  private armSwing = 0;

  /** Point on the table edge at arc-length fraction f (0 = bottom centre, then clockwise on screen), pushed `out` along the outward normal. */
  edge(f: number, out = 0) {
    const { L, R, portrait } = this.ov;
    const straight = 2 * L, arc = Math.PI * R, P = 2 * straight + 2 * arc;
    let d = (((f % 1) + 1) % 1) * P;
    let x: number, z: number, nx: number, nz: number;
    const cap = (cx: number, cz: number, th: number) => { x = cx + R * Math.cos(th); z = cz + R * Math.sin(th); nx = Math.cos(th); nz = Math.sin(th); };
    if (!portrait) {
      if (d < L) { x = -d; z = R; nx = 0; nz = 1; }
      else if ((d -= L) < arc) cap(-L, 0, Math.PI / 2 + d / R);
      else if ((d -= arc) < straight) { x = -L + d; z = -R; nx = 0; nz = -1; }
      else if ((d -= straight) < arc) cap(L, 0, -Math.PI / 2 + d / R);
      else { d -= arc; x = L - d; z = R; nx = 0; nz = 1; }
    } else {
      if (d < arc / 2) cap(0, L, Math.PI / 2 + d / R);
      else if ((d -= arc / 2) < straight) { x = -R; z = L - d; nx = -1; nz = 0; }
      else if ((d -= straight) < arc) cap(0, -L, Math.PI + d / R);
      else if ((d -= arc) < straight) { x = R; z = -L + d; nx = 1; nz = 0; }
      else { d -= straight; cap(0, L, d / R); }
    }
    return { p: new THREE.Vector3(x! + nx! * out, 0, z! + nz! * out), n: new THREE.Vector3(nx!, 0, nz!) };
  }

  private buildOval(felt: number, portrait: boolean) {
    this.ov.portrait = portrait;
    const { L, R } = this.ov;
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i < 200; i++) { const e = this.edge(i / 200); pts.push(new THREE.Vector2(e.p.x, e.p.z)); }
    const shape = new THREE.Shape(pts);
    const top = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3 });
    top.rotateX(Math.PI / 2);
    const X = portrait ? R : L + R, Z = portrait ? L + R : R;
    const uv = top.attributes.uv as THREE.BufferAttribute, pos = top.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + X) / (2 * X), 1 - (pos.getZ(i) + Z) / (2 * Z));
    top.computeVertexNormals();
    const feltMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, map: this.ovalFelt(felt, X, Z) });
    const topMesh = new THREE.Mesh(top, [feltMat, std(0x2b160b, { roughness: 0.7 })]);
    topMesh.receiveShadow = true;
    this.scene.add(topMesh);
    // rail, brass trim and a dark wood skirt
    const railPts = Array.from({ length: 240 }, (_, i) => this.edge(i / 240, 0.14).p.setY(0.14));
    const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts, true), 360, 0.32, 16, true), this.railMat);
    rail.castShadow = true; rail.receiveShadow = true; this.scene.add(rail);
    const trimPts = Array.from({ length: 240 }, (_, i) => this.edge(i / 240, -0.22).p.setY(FELT_Y + 0.02));
    this.scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trimPts, true), 360, 0.035, 8, true), this.trimMat));
    if (this.theme.glow) this.scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trimPts, true), 360, 0.1, 8, true), new THREE.MeshBasicMaterial({ color: this.theme.glow, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })));
    const skirt = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(Array.from({ length: 200 }, (_, i) => { const e = this.edge(i / 200, 0.3); return new THREE.Vector2(e.p.x, -e.p.z); })), { depth: 1.2, bevelEnabled: false }), std(0x1c0c06, { roughness: 0.5 }));
    skirt.rotateX(-Math.PI / 2); skirt.position.y = -1.35; this.scene.add(skirt);

    // the chicken dealer stands behind the top of the table
    const top5 = this.edge(0.5, 0.75);
    if (this.opts.dealer !== false) this.addDealer(top5.p.clone().setY(-0.55), 1.35, 0.42);

    // shoe + discard next to the dealer
    const inward = top5.n.clone().negate();
    const side = new THREE.Vector3(-inward.z, 0, inward.x);
    this.shoePos.copy(this.edge(0.5, -1.0).p).addScaledVector(side, 1.9).setY(0.62);
    this.discardPos.copy(this.edge(0.5, -1.0).p).addScaledVector(side, -1.9).setY(0.45);
    this.trayPos.copy(this.edge(0.5, -1.0).p).setY(0.3);
    const shoe = new THREE.Group();
    shoe.add(box(std(0x121214, { metalness: 0.45, roughness: 0.2 }), [1.0, 0.5, 1.4], [0, 0, 0]));
    shoe.add(box(MAT.gold, [1.02, 0.05, 0.05], [0, 0.26, 0.7]));
    const stack = new THREE.Mesh(new THREE.BoxGeometry(CW * 0.9, 0.36, 0.9), [EDGE, EDGE, EDGE, EDGE, new THREE.MeshStandardMaterial({ map: backTexture(), roughness: 0.5 }), EDGE]);
    stack.position.set(0, 0.06, 0.25); shoe.add(stack);
    shoe.position.copy(this.shoePos).setY(0.32); shoe.rotation.y = Math.atan2(-this.shoePos.x, -this.shoePos.z); this.scene.add(shoe);
    const holder = new THREE.Group();
    holder.add(box(std(0x121214, { metalness: 0.45, roughness: 0.22 }), [1.1, 0.3, 1.5], [0, 0, 0]));
    holder.add(box(MAT.gold, [1.12, 0.05, 0.05], [0, 0.16, 0.75]));
    holder.position.copy(this.discardPos).setY(0.2); holder.rotation.y = Math.atan2(-this.discardPos.x, -this.discardPos.z); this.scene.add(holder);
  }

  private ovalFelt(felt: number, X: number, Z: number) {
    const S = 1024 / Math.max(X, Z);
    const cv = document.createElement('canvas'); cv.width = Math.round(2 * X * S); cv.height = Math.round(2 * Z * S);
    const g = cv.getContext('2d')!;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const col = new THREE.Color(felt);
    const hex = (dl: number) => `#${col.clone().offsetHSL(0, 0, dl).getHexString()}`;
    const logo = new Image(); logo.src = './img/head.webp';
    const toC = (x: number, z: number) => [(x + X) * S, (z + Z) * S] as const;
    const draw = () => {
      const W2 = cv.width, H2 = cv.height;
      const grd = g.createRadialGradient(W2 / 2, H2 / 2, 40, W2 / 2, H2 / 2, Math.max(W2, H2) * 0.6);
      grd.addColorStop(0, hex(0.05)); grd.addColorStop(0.6, hex(0)); grd.addColorStop(1, hex(-0.1));
      g.fillStyle = grd; g.fillRect(0, 0, W2, H2);
      const id = g.getImageData(0, 0, W2, H2);
      for (let i = 0; i < id.data.length; i += 4) { const v = (Math.random() - 0.5) * 10; id.data[i] += v; id.data[i + 1] += v; id.data[i + 2] += v; }
      g.putImageData(id, 0, 0);
      feltPattern(g, this.theme, W2, H2);
      // double pinstripe following the table edge
      for (const [inset, w] of [[0.55, 4], [0.7, 1.5]] as const) {
        g.strokeStyle = inkA(this.theme, 0.6); g.lineWidth = w; g.beginPath();
        for (let i = 0; i <= 200; i++) { const p = this.edge(i / 200, -inset).p; const [cx, cy] = toC(p.x, p.z); if (i) g.lineTo(cx, cy); else g.moveTo(cx, cy); }
        g.stroke();
      }
      // betting line inside which bets are placed
      g.setLineDash([16, 12]); g.strokeStyle = 'rgba(248,246,239,.18)'; g.lineWidth = 3; g.beginPath();
      for (let i = 0; i <= 200; i++) { const p = this.edge(i / 200, -2.9).p; const [cx, cy] = toC(p.x, p.z); if (i) g.lineTo(cx, cy); else g.moveTo(cx, cy); }
      g.stroke(); g.setLineDash([]);
      const [cx, cy] = toC(0, 0);
      // title printed above the board, logo faintly under the pot
      if (logo.complete && logo.naturalWidth) { g.save(); g.globalAlpha = 0.07; g.filter = 'grayscale(1) brightness(2)'; g.drawImage(logo, cx - 110, cy - 1.45 * S - 110, 220, 220); g.restore(); }
      g.fillStyle = inkA(this.theme, 0.8); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `900 ${0.26 * S}px Montserrat, system-ui, sans-serif`; g.fillText('TEXAS HOLD\'EM · NO LIMIT', cx, cy - 0.98 * S);
      tex.needsUpdate = true;
    };
    draw(); logo.onload = draw; document.fonts?.ready.then(draw);
    return tex;
  }

  /** Turn the chicken dealer towards a point and give a little hop (dealing, pushing the pot). */
  dealerGesture(x: number, z: number) {
    if (!this.chicken) return;
    const p = this.chicken.root.position;
    this.chickenLook = Math.atan2(-(z - p.z), x - p.x);
    this.chickenHop = 1;
    this.armSwing = 1;
  }

  // ---------- felt artwork ----------
  private feltTexture(felt: number) {
    const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 1024;
    const g = cv.getContext('2d')!;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const col = new THREE.Color(felt);
    const hex = (dl: number) => `#${col.clone().offsetHSL(0, 0, dl).getHexString()}`;
    // fabric grain generated once
    const grain = document.createElement('canvas'); grain.width = grain.height = 256;
    const gg = grain.getContext('2d')!, id = gg.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 14; }
    gg.putImageData(id, 0, 0);
    const logo = new Image(); logo.src = './img/head.webp';
    const draw = () => {
      const grd = g.createRadialGradient(1024, 380, 60, 1024, 420, 1200);
      grd.addColorStop(0, hex(0.035)); grd.addColorStop(0.55, hex(-0.01)); grd.addColorStop(1, hex(-0.1));
      g.fillStyle = grd; g.fillRect(0, 0, 2048, 1024);
      g.fillStyle = g.createPattern(grain, 'repeat')!; g.fillRect(0, 0, 2048, 1024);
      // faint logo watermark
      if (logo.complete && logo.naturalWidth && this.opts.logoZ !== null) {
        g.save(); g.globalAlpha = 0.07; g.filter = 'grayscale(1) brightness(2)';
        const s = 300, lz = this.opts.logoZ ?? 0.6;
        g.drawImage(logo, 1024 - s / 2, (lz + D) * PX - s / 2, s, s); g.restore();
      }
      feltPattern(g, this.theme, 2048, 1024);
      // pinstripe inside the rail (in the table skin's ink colour)
      g.strokeStyle = inkA(this.theme, 0.55); g.lineWidth = 4;
      g.beginPath(); g.arc(1024, 0, (W - 0.5) * PX, 0.02, Math.PI - 0.02); g.stroke();
      g.lineWidth = 1.5; g.beginPath(); g.arc(1024, 0, (W - 0.62) * PX, 0.02, Math.PI - 0.02); g.stroke();
      for (const z of this.zones) this.drawZone(g, z);
      for (const t of this.opts.texts ?? []) this.drawText(g, t);
      tex.needsUpdate = true;
    };
    draw();
    logo.onload = draw;
    document.fonts?.ready.then(draw);
    return tex;
  }

  private drawZone(g: CanvasRenderingContext2D, z: Zone) {
    const cx = (z.x + W) * PX, cy = (z.z + D) * PX;
    const color = z.color ?? 'rgba(244,196,48,.8)';
    g.save();
    g.strokeStyle = color; g.lineWidth = 5;
    if (z.dashed) g.setLineDash([18, 12]);
    if (z.r) {
      const r = z.r * PX;
      g.fillStyle = z.fill ?? 'rgba(0,0,0,.14)'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.stroke();
      g.setLineDash([]); g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, r - 12, 0, 7); g.stroke();
    } else {
      const w = (z.w ?? 2) * PX, h = (z.h ?? 1.5) * PX;
      g.fillStyle = z.fill ?? 'rgba(0,0,0,.12)'; roundRect(g, cx - w / 2, cy - h / 2, w, h, 26); g.fill(); g.stroke();
    }
    g.restore();
    if (z.label) {
      const hh = z.r ? z.r * PX : ((z.h ?? 1.5) * PX) / 2;
      const at = z.labelAt ?? 'in';
      const ly = at === 'below' ? cy + hh + 34 : at === 'above' ? cy - hh - 34 : cy - (z.sub ? 16 : 0);
      g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
      const size = z.r ? Math.min(40, z.r * PX * 0.34) : 50;
      g.font = `900 ${size}px Montserrat, system-ui, sans-serif`;
      this.spaced(g, z.label, cx, ly, 4);
      if (z.sub) { g.globalAlpha = 0.75; g.font = `700 ${size * 0.55}px Montserrat, system-ui, sans-serif`; g.fillText(z.sub, cx, ly + size * 0.85); g.globalAlpha = 1; }
    }
  }

  private spaced(g: CanvasRenderingContext2D, s: string, x: number, y: number, sp: number) {
    const chars = [...s];
    const widths = chars.map((c) => g.measureText(c).width + sp);
    let cur = x - (widths.reduce((a, b) => a + b, 0) - sp) / 2;
    g.save(); g.textAlign = 'left';
    chars.forEach((c, i) => { g.fillText(c, cur, y); cur += widths[i]; });
    g.restore();
  }

  private drawText(g: CanvasRenderingContext2D, t: FeltText) {
    const size = (t.size ?? 0.3) * PX, sp = t.spacing ?? size * 0.12;
    g.fillStyle = t.color ?? 'rgba(244,196,48,.9)'; g.textBaseline = 'middle';
    g.font = `${t.weight ?? 900} ${size}px Montserrat, system-ui, sans-serif`;
    if (!t.arc) { g.textAlign = 'center'; this.spaced(g, t.text, (( t.x ?? 0) + W) * PX, (t.z + D) * PX, sp); return; }
    const r = (t.z + D) * PX;
    const chars = [...t.text];
    const widths = chars.map((c) => g.measureText(c).width + sp);
    const total = widths.reduce((a, b) => a + b, 0) - sp;
    let a = Math.PI / 2 + total / r / 2;
    g.textAlign = 'center';
    chars.forEach((c, i) => {
      const w = widths[i];
      const mid = a - (w - sp) / 2 / r;
      g.save(); g.translate(1024 + Math.cos(mid) * r, Math.sin(mid) * r); g.rotate(mid - Math.PI / 2); g.fillText(c, 0, 0); g.restore();
      a -= w / r;
    });
  }

  protected onResize() {
    if (!this.cards) return;
    if (this.opts.oval) {
      const { L, R, portrait } = this.ov;
      // tight framing: the rail just fits, so the cards are as big as possible
      if (portrait) this.frame(new THREE.Vector3(0, 0, -0.15), 2 * R + 0.9, 2 * (L + R) + 1.9, new THREE.Vector3(0, 3.6, 1), 1);
      else {
        // squarer views look down more steeply so the table fills the height too
        const tilt = THREE.MathUtils.clamp(2.3 + (1.6 - this.aspect) * 5, 2.3, 5);
        this.frame(new THREE.Vector3(0, 0, -0.25), 2 * (L + R) + 1.9, 2 * R + 2.6, new THREE.Vector3(0, tilt, 1), 1);
      }
      return;
    }
    const narrow = this.aspect < 1;
    const v0 = narrow ? this.opts.view?.narrow ?? [-0.1, 8.4, 7.6] : this.opts.view?.wide ?? [-0.35, 11, 5.8];
    // headroom so the croupier's head and visor are in shot
    const v = this.chicken ? [v0[0] - 1.2, v0[1], v0[2] + 2.4] : v0;
    this.frame(new THREE.Vector3(0, 0, v[0]), v[1], v[2], narrow ? new THREE.Vector3(0, 2.5, 1) : new THREE.Vector3(0, 1.45, 1), 1);
  }

  // ---------- cards ----------
  private makeCard(c3: Card3D) {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(BODY_GEO, EDGE);
    const face = new THREE.Mesh(FACE_GEO, this.faceMat(c3.card));
    const back = new THREE.Mesh(BACK_GEO, new THREE.MeshStandardMaterial({ map: backTexture(), roughness: 0.4 }));
    for (const m of [body, face, back]) { m.castShadow = true; m.userData.card3d = c3; grp.add(m); }
    grp.userData.card3d = c3;
    c3.mesh = grp;
    return grp;
  }
  private faceMat(card: Card | null) {
    return new THREE.MeshStandardMaterial({ map: card ? faceTexture(card) : backTexture(), roughness: 0.38, metalness: 0 });
  }

  /** Sweep every card into the discard holder and (unless `keepChips`) remove the bet chips. */
  clear(keepChips = false) {
    const old = this.cards;
    this.cards = [];
    old.forEach((c, i) => {
      if (c.glow) this.scene.remove(c.glow);
      const from = c.mesh.position.clone(), rz = c.mesh.rotation.z, ry = c.mesh.rotation.y;
      const to = this.discardPos.clone().add(new THREE.Vector3(0, i * 0.01, 0));
      setTimeout(() => this.anim(this.turbo ? 200 : 380, (k) => {
        const e = k * k * (3 - 2 * k);
        c.mesh.position.lerpVectors(from, to, e); c.mesh.position.y += Math.sin(Math.PI * k) * 0.5;
        c.mesh.rotation.z = rz + (Math.PI - (rz % (Math.PI * 2))) * e; c.mesh.rotation.y = ry + (0.35 - ry) * e;
      }, () => this.scene.remove(c.mesh)), i * (this.turbo ? 15 : 35));
    });
    this.glows.forEach((g) => { g.fade = g.fade ?? 1; g.pulse = false; });
    if (keepChips) return;
    this.chips.forEach((g) => this.scene.remove(g));
    this.chips.clear();
  }

  /** Deal a card from the shoe to (x, z). `card` null = face down. `rot` turns it on the table. */
  deal(card: Card | null, x: number, z: number, opts: { delay?: number; rot?: number; up?: boolean; scale?: number } = {}): Promise<Card3D> {
    const c3 = { card, up: false } as Card3D;
    const mesh = this.makeCard(c3);
    mesh.position.copy(this.shoePos);
    mesh.rotation.set(0, -0.4, Math.PI);
    mesh.visible = false;
    if (opts.scale) mesh.scale.setScalar(opts.scale);
    if (this.chicken) this.dealerGesture(x, z);
    this.scene.add(mesh);
    this.cards.push(c3);
    const faceUp = opts.up ?? card !== null;
    const dur = this.turbo ? 220 : 400;
    const jitter = (Math.random() - 0.5) * 0.05;
    const from = this.shoePos.clone(), to = new THREE.Vector3(x, FELT_Y + CT / 2 + 0.002 + this.cards.length * 0.0012, z);
    return new Promise((res) => {
      setTimeout(() => {
        mesh.visible = true;
        this.anim(dur, (k) => {
          const e = 1 - Math.pow(1 - k, 3);
          mesh.position.lerpVectors(from, to, e);
          mesh.position.y += Math.sin(Math.PI * k) * 0.85;
          mesh.rotation.y = -0.4 * (1 - e) + ((opts.rot ?? 0) + jitter) * e + Math.sin(Math.PI * k) * 0.5;
          mesh.rotation.x = Math.sin(Math.PI * k) * -0.25;
          if (faceUp) mesh.rotation.z = Math.PI * (1 - e);
        }, () => {
          c3.up = faceUp;
          // tiny settle bounce
          this.anim(90, (k) => { mesh.position.y = to.y + Math.sin(Math.PI * k) * 0.03; }, () => res(c3));
        });
      }, opts.delay ?? 0);
    });
  }

  /** Flip a face-down card. `slow` = baccarat squeeze (peel, pause, snap). */
  flip(c3: Card3D, card: Card, slow = false) {
    c3.card = card;
    (c3.mesh.children[1] as THREE.Mesh).material = this.faceMat(card);
    const dur = slow ? (this.turbo ? 320 : 620) : this.turbo ? 200 : 380;
    const y0 = c3.mesh.position.y, rz0 = c3.mesh.rotation.z, rx0 = c3.mesh.rotation.x;
    return new Promise<void>((res) => this.anim(dur, (k) => {
      let e: number;
      if (slow) e = k < 0.7 ? Math.sin((k / 0.7) * Math.PI / 2) * 0.32 : 0.32 + (1 - Math.pow(1 - (k - 0.7) / 0.3, 3)) * 0.68;
      else e = 1 - Math.pow(1 - k, 2);
      c3.mesh.rotation.z = rz0 * (1 - e);
      c3.mesh.rotation.x = rx0 + (slow && k < 0.7 ? Math.sin((k / 0.7) * Math.PI) * 0.18 : 0);
      c3.mesh.position.y = y0 + Math.sin(Math.PI * e) * (slow ? 0.3 : 0.5);
    }, () => { c3.up = true; c3.mesh.rotation.x = rx0; res(); }));
  }

  /** Slide a card to a new spot (e.g. splitting a blackjack hand). */
  move(c3: Card3D, x: number, z: number) {
    const from = c3.mesh.position.clone(), to = new THREE.Vector3(x, from.y, z);
    return new Promise<void>((res) => this.anim(this.turbo ? 160 : 320, (k) => {
      c3.mesh.position.lerpVectors(from, to, 1 - Math.pow(1 - k, 3));
      c3.mesh.position.y = from.y + Math.sin(Math.PI * k) * 0.25;
    }, res));
  }

  /** Lift a card with a gold glow underneath (held cards / winning hand). */
  lift(c3: Card3D, on: boolean) {
    const target = on ? 0.32 : FELT_Y + CT / 2 + 0.004;
    const from = c3.mesh.position.y;
    if (on && !c3.glow) {
      const gm = new THREE.Mesh(new THREE.PlaneGeometry(CW + 0.8, CH + 0.8), new THREE.MeshBasicMaterial({ map: glowRectTexture(CW + 0.1, CH + 0.1), color: 0xf4c430, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      gm.rotation.x = -Math.PI / 2; gm.rotation.z = c3.mesh.rotation.y;
      gm.position.set(c3.mesh.position.x, FELT_Y + 0.004, c3.mesh.position.z);
      this.scene.add(gm); c3.glow = gm;
    }
    const gm = c3.glow;
    this.anim(this.turbo ? 110 : 180, (k) => {
      const e = 1 - Math.pow(1 - k, 3);
      c3.mesh.position.y = from + (target - from) * e;
      c3.mesh.rotation.x = on ? -0.12 * e : c3.mesh.rotation.x * (1 - e);
      if (gm) (gm.material as THREE.MeshBasicMaterial).opacity = on ? e * 0.9 : (1 - e) * 0.9;
    }, () => { if (!on && gm) { this.scene.remove(gm); c3.glow = undefined; } });
  }

  /** Throw a card away (video poker discards). */
  discard(c3: Card3D) {
    if (c3.glow) { this.scene.remove(c3.glow); c3.glow = undefined; }
    const from = c3.mesh.position.clone(), to = this.discardPos.clone();
    const rz0 = c3.mesh.rotation.z;
    this.anim(this.turbo ? 170 : 320, (k) => {
      const e = k * k * (3 - 2 * k);
      c3.mesh.position.lerpVectors(from, to, e); c3.mesh.position.y += Math.sin(Math.PI * k) * 1.2;
      c3.mesh.rotation.z = rz0 + Math.PI * e; c3.mesh.rotation.y = 0.35 * e;
    }, () => { this.scene.remove(c3.mesh); this.cards = this.cards.filter((x) => x !== c3); });
  }

  // ---------- chips ----------
  private buildStack(amount: number) { return chipStack(amount); }

  /** Stack of chips representing a bet at (x, z). amount 0 removes it. */
  setChips(key: string, amount: number, x: number, z: number) {
    const old = this.chips.get(key);
    const prevN = old?.userData.n ?? 0;
    if (old) this.scene.remove(old);
    if (!(amount > 0)) { this.chips.delete(key); return; }
    const g = this.buildStack(amount);
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.chips.set(key, g);
    // new chips drop onto the stack from above
    const kids = g.children.filter((c) => !(c as THREE.Sprite).isSprite);
    kids.forEach((ch, i) => {
      if (i < prevN) return;
      const y1 = ch.position.y, y0 = y1 + 1.4;
      ch.position.y = y0;
      const d = (i - prevN) * (this.turbo ? 25 : 45);
      this.anim(260 + d, (k) => { const t = Math.max(0, (k * (260 + d) - d) / 260); ch.position.y = y0 + (y1 - y0) * easeOutBounce(t); }, () => {});
    });
  }

  /** Resolve a bet stack: lost chips go to the tray; wins get `payout` (the profit) paid alongside, then both slide to the player. */
  settleChips(key: string, outcome: 'win' | 'lose' | 'push', payout = 0) {
    const g = this.chips.get(key);
    if (!g) return Promise.resolve();
    this.chips.delete(key);
    const from = g.position.clone();
    const slow = this.turbo ? 0.5 : 1;
    const toPlayer = (grp: THREE.Group, delay: number) => new Promise<void>((res) => setTimeout(() => {
      const p0 = grp.position.clone(), p1 = p0.clone().add(new THREE.Vector3(0, 0, 4));
      this.anim(520 * slow, (k) => { const e = k * k; grp.position.lerpVectors(p0, p1, e); grp.scale.setScalar(1 - e * 0.4); }, () => { this.scene.remove(grp); res(); });
    }, delay));
    if (outcome === 'lose') {
      return new Promise<void>((res) => this.anim(560 * slow, (k) => {
        const e = k * k * (3 - 2 * k);
        g.position.lerpVectors(from, this.trayPos, e); g.position.y += Math.sin(Math.PI * k) * 0.8;
        g.scale.setScalar(1 - e * 0.6);
      }, () => { this.scene.remove(g); res(); }));
    }
    if (outcome === 'push') return toPlayer(g, 900 * slow);
    // win: dealer's chips arrive next to the bet
    const pay = this.buildStack(payout);
    pay.position.copy(this.trayPos); this.scene.add(pay);
    const dest = from.clone().add(new THREE.Vector3(0.62, 0, 0));
    return new Promise<void>((res) => this.anim(600 * slow, (k) => {
      const e = 1 - Math.pow(1 - k, 3);
      pay.position.lerpVectors(this.trayPos, dest, e); pay.position.y += Math.sin(Math.PI * k) * 1.1;
    }, () => { Promise.all([toPlayer(g, 700 * slow), toPlayer(pay, 760 * slow)]).then(() => res()); }));
  }

  /** Slide bet stacks into the pot at (x, z), then show one pot stack of `total`. */
  gatherChips(keys: string[], x: number, z: number, total: number) {
    const to = new THREE.Vector3(x, 0, z);
    const moving = keys.map((k) => this.chips.get(k)).filter(Boolean) as THREE.Group[];
    keys.forEach((k) => this.chips.delete(k));
    return new Promise<void>((res) => {
      if (!moving.length) { if (total > 0) this.setChips('pot', total, x, z); res(); return; }
      const froms = moving.map((g) => g.position.clone());
      this.anim(this.turbo ? 220 : 420, (k) => {
        const e = k * k * (3 - 2 * k);
        moving.forEach((g, i) => { g.position.lerpVectors(froms[i], to, e); g.position.y = Math.sin(Math.PI * k) * 0.4; });
      }, () => { moving.forEach((g) => this.scene.remove(g)); this.setChips('pot', total, x, z); res(); });
    });
  }

  /** Push a stack (e.g. the pot) to (x, z) and remove it. */
  pushChips(key: string, x: number, z: number) {
    const g = this.chips.get(key);
    if (!g) return Promise.resolve();
    this.chips.delete(key);
    const from = g.position.clone(), to = new THREE.Vector3(x, 0, z);
    if (this.chicken) this.dealerGesture(x, z);
    return new Promise<void>((res) => this.anim(this.turbo ? 300 : 650, (k) => {
      const e = 1 - Math.pow(1 - k, 3);
      g.position.lerpVectors(from, to, e); g.position.y = Math.sin(Math.PI * k) * 0.6;
    }, () => { setTimeout(() => { this.scene.remove(g); res(); }, this.turbo ? 150 : 450); }));
  }

  /** Run a custom animation on the scene clock (k: 0 → 1). */
  tween(dur: number, step: (k: number) => void) { return new Promise<void>((res) => this.anim(this.turbo ? dur * 0.5 : dur, step, res)); }

  /** The dealer button puck (created on first use), slid to (x, z). */
  private puck: THREE.Group | null = null;
  moveButton(x: number, z: number) {
    if (!this.puck) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 32), [std(0xf8f6ef, { roughness: 0.4 }), new THREE.MeshStandardMaterial({ map: textTexture('D', { w: 128, h: 128, size: 88, color: '#0B0B0B', bg: '#F8F6EF', radius: 64 }) }), std(0xf8f6ef)]);
      body.castShadow = true; body.position.y = 0.11; g.add(body);
      g.position.set(x, 0, z); this.scene.add(g); this.puck = g;
      return Promise.resolve();
    }
    const from = this.puck.position.clone(), to = new THREE.Vector3(x, 0, z), p = this.puck;
    return this.tween(520, (k) => { const e = k * k * (3 - 2 * k); p.position.lerpVectors(from, to, e); p.position.y = Math.sin(Math.PI * k) * 0.35; });
  }

  /** Show/hide a card mesh (the poker table swaps landed cards for crisp HTML cards). */
  setCardVisible(c3: Card3D, v: boolean) { c3.mesh.visible = v; }

  /** Turn a face-down card up in place (showdown). */
  reveal(c3: Card3D, card: Card) { return this.flip(c3, card); }

  // ---------- highlights & effects ----------
  private addGlow(x: number, z: number, w: number, h: number, color: number, pulse: boolean, circle = false) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.7, h + 0.7), new THREE.MeshBasicMaterial({ map: circle ? glowCircleTexture() : glowRectTexture(w, h), color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, FELT_Y + 0.003, z);
    this.scene.add(m);
    const gl: Glow = { mesh: m, base: 0.95, pulse };
    this.glows.push(gl);
    return gl;
  }

  /** Pulsing gold outline around a region, no particles. */
  highlight(x: number, z: number, w: number, h: number) { this.addGlow(x, z, w, h, 0xf4c430, true); }

  /** Light up a region of the table (winning hand); wins also burst coins and confetti. */
  celebrate(x: number, z: number, win: boolean, w = 2.6, h = 1.9) {
    if (!win) return;
    this.addGlow(x, z, w, h, 0xf4c430, true);
    if (win) {
      this.flash = 1;
      this.burst(x, z, 26);
    }
  }

  /** Fountain of coins and confetti at (x, z). */
  burst(x: number, z: number, count = 24) {
    for (let i = 0; i < count; i++) {
      const coin = new THREE.Mesh(COIN_GEO, MAT.gold);
      coin.position.set(x + (Math.random() - 0.5) * 0.6, 0.35, z + (Math.random() - 0.5) * 0.4);
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 1.8;
      this.addParticle(coin, new THREE.Vector3(Math.cos(a) * sp, 4.2 + Math.random() * 2.8, Math.sin(a) * sp * 0.7), 1.5, 11, FELT_Y + 0.02);
    }
    const cols = [0xf4c430, 0xe63946, 0xf8f6ef, 0xffe08a];
    for (let i = 0; i < count * 1.4; i++) {
      const bit = new THREE.Mesh(CONFETTI_GEO, new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide }));
      bit.position.set(x, 0.5, z);
      const a = Math.random() * Math.PI * 2, sp = 0.8 + Math.random() * 2.6;
      this.addParticle(bit, new THREE.Vector3(Math.cos(a) * sp, 3.5 + Math.random() * 3.5, Math.sin(a) * sp * 0.8), 2.2, 4.5, FELT_Y + 0.01);
    }
  }

  resetGlow() { this.glows.forEach((g) => { g.fade = g.fade ?? 1; g.pulse = false; }); }

  /** Soft outline shown while hovering a clickable bet spot. */
  private setHover(id: string | null) {
    if (id === this.hoverId) return;
    this.hoverId = id;
    if (this.hoverGlow) { this.scene.remove(this.hoverGlow); this.hoverGlow = null; }
    const z = id ? this.zones.find((q) => q.id === id) : null;
    if (!z) return;
    const w = z.r ? z.r * 2 : z.w ?? 2, h = z.r ? z.r * 2 : z.h ?? 1.5;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.7, h + 0.7), new THREE.MeshBasicMaterial({ map: z.r ? glowCircleTexture() : glowRectTexture(w, h), color: 0xfff1c0, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.set(z.x, FELT_Y + 0.002, z.z);
    this.scene.add(m); this.hoverGlow = m;
  }

  /** Flash a bet spot briefly (chip placed). */
  pulseZone(id: string) {
    const z = this.zones.find((q) => q.id === id); if (!z) return;
    const w = z.r ? z.r * 2 : z.w ?? 2, h = z.r ? z.r * 2 : z.h ?? 1.5;
    const gl = this.addGlow(z.x, z.z, w, h, 0xfff1c0, false, !!z.r);
    gl.base = 0.8; gl.fade = 1;
  }

  /** Light a bet spot as won/lost. */
  markZone(id: string, win: boolean) {
    const z = this.zones.find((q) => q.id === id); if (!z) return;
    const w = z.r ? z.r * 2 : z.w ?? 2, h = z.r ? z.r * 2 : z.h ?? 1.5;
    this.addGlow(z.x, z.z, w, h, win ? 0xf4c430 : 0x3a0b10, win, !!z.r);
  }

  private feltPoint(e: { clientX: number; clientY: number }) {
    const ndc = this.toNdc(e);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -FELT_Y), new THREE.Vector3());
  }
  private zoneAt(p: THREE.Vector3 | null) {
    if (!p) return null;
    return this.zones.find((z) => z.id && (z.r ? Math.hypot(p.x - z.x, p.z - z.z) <= z.r + 0.1 : Math.abs(p.x - z.x) <= (z.w ?? 2) / 2 + 0.05 && Math.abs(p.z - z.z) <= (z.h ?? 1.5) / 2 + 0.05)) ?? null;
  }

  /** Clicking a printed bet spot calls `cb(id)`. `enabled()` gates hover + clicks. */
  onZoneClick(cb: (id: string) => void, enabled: () => boolean = () => true) {
    const cv = this.renderer.domElement;
    cv.addEventListener('click', (e) => { if (!enabled()) return; const z = this.zoneAt(this.feltPoint(e)); if (z?.id) cb(z.id); });
    cv.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const z = enabled() ? this.zoneAt(this.feltPoint(e)) : null;
      this.setHover(z?.id ?? null);
      cv.style.cursor = z ? 'pointer' : 'default';
    });
    cv.addEventListener('pointerleave', () => this.setHover(null));
  }

  /** Call `cb` with the card the user clicks/taps on the table. */
  onCardClick(cb: (c: Card3D) => void) {
    const cv = this.renderer.domElement;
    const hitCard = (e: PointerEvent | MouseEvent) => {
      const hit = this.pick(e, this.cards.map((c) => c.mesh));
      return (hit?.object.userData.card3d as Card3D | undefined) ?? null;
    };
    cv.addEventListener('click', (e) => { const c = hitCard(e); if (c) cb(c); });
    cv.addEventListener('pointermove', (e) => { cv.style.cursor = hitCard(e) ? 'pointer' : 'default'; });
  }

  protected anim(dur: number, step: (k: number) => void, done: () => void) {
    this.anims.push({ t0: performance.now(), dur, step, done });
  }

  protected update(dt: number, t: number) {
    const now = performance.now();
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      if (!a) continue;
      const k = Math.min(1, (now - a.t0) / a.dur);
      a.step(k);
      if (k >= 1) { this.anims.splice(this.anims.indexOf(a), 1); a.done(); }
    }
    for (let i = this.glows.length - 1; i >= 0; i--) {
      const g = this.glows[i], m = g.mesh.material as THREE.MeshBasicMaterial;
      if (g.fade !== undefined) {
        g.fade -= dt * 2.2;
        m.opacity = Math.max(0, g.fade) * g.base;
        if (g.fade <= 0) { this.scene.remove(g.mesh); this.glows.splice(i, 1); }
      } else {
        const target = g.pulse ? g.base * (0.7 + Math.sin(t * 5) * 0.3) : g.base;
        m.opacity += (target - m.opacity) * Math.min(1, dt * 8);
      }
    }
    if (this.chicken) {
      const r = this.chicken.root;
      // turn part-way towards whoever is being dealt to, then settle back to face the room
      const base = -Math.PI / 2;
      r.rotation.y += (base + (this.chickenLook - base) * 0.7 - r.rotation.y) * Math.min(1, dt * 6);
      this.chickenHop = Math.max(0, this.chickenHop - dt * 3);
      this.chicken.body.position.y = Math.sin(t * 2.2) * 0.03 + Math.sin(this.chickenHop * Math.PI) * 0.18;
      this.chicken.body.rotation.x = Math.sin(t * 1.3) * 0.03;
      if (this.chickenHop === 0) this.chickenLook += (base - this.chickenLook) * Math.min(1, dt * 1.5);
      if (this.dealerArm) {
        this.armSwing = Math.max(0, this.armSwing - dt * 2.6);
        const s = Math.sin(this.armSwing * Math.PI);
        this.dealerArm.rotation.x = -s * 1.1;             // wing lifts out
        this.dealerArm.rotation.z = s * 0.5 + Math.sin(t * 1.6) * 0.04;
      }
    }
    // lamp flash on wins, gentle flicker otherwise
    this.flash = Math.max(0, this.flash - dt * 1.4);
    this.lamp.intensity = this.lampBase * (1 + Math.sin(t * 1.7) * 0.03) + this.flash * 40;
    this.bokeh.forEach((s) => { s.material.opacity = s.userData.o * (0.65 + Math.sin(t * 0.8 + s.userData.ph) * 0.35); });
    const dp = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < dp.count; i++) {
      let y = dp.getY(i) + dt * 0.06;
      if (y > 5) y = 0.3;
      dp.setY(i, y);
      dp.setX(i, dp.getX(i) + Math.sin(t * 0.4 + i) * dt * 0.03);
    }
    dp.needsUpdate = true;
  }
}

/** A stack of casino chips worth `amount`, with a floating amount label. `userData.n` = chip count. */
export function chipStack(amount: number, r = 0.3) {
  const g = new THREE.Group();
  const h = r * 0.227;
  let left = amount, n = 0;
  for (const [v] of DENOMS) {
    while (left >= v - 1e-9 && n < 14) { const c = chipColor(v, n); const ch = makeChip(c.color, r, c.stripe, c.glow); ch.position.set((Math.random() - 0.5) * 0.02, r / 3 + n * h, (Math.random() - 0.5) * 0.02); ch.rotation.y = n * 0.7; g.add(ch); left -= v; n++; }
  }
  if (n === 0) { const c = chipColor(1); const ch = makeChip(c.color, r, c.stripe, c.glow); ch.position.y = r / 3; g.add(ch); n = 1; }
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(fmtChip(amount), { w: 192, h: 80, size: 46, color: '#F4C430', bg: 'rgba(11,11,11,.82)', radius: 40 }), depthTest: false, transparent: true }));
  label.scale.set(r * 1.83, r * 0.77, 1); label.position.y = r * 0.67 + n * h + r * 1.5; label.renderOrder = 10;
  g.add(label);
  g.userData.n = n;
  return g;
}

const COIN_GEO = new THREE.CylinderGeometry(0.12, 0.12, 0.03, 16);
const CONFETTI_GEO = new THREE.PlaneGeometry(0.1, 0.05);

const easeOutBounce = (x: number) => {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
};

const fmtChip = (v: number) => (v >= 10000 ? `${Math.round(v / 1000)}k` : v >= 1000 ? `${Math.round(v / 100) / 10}k` : Number.isInteger(v) ? String(v) : v.toFixed(2));

const glowCache = new Map<string, THREE.CanvasTexture>();
/** Soft glowing rounded-rect outline, sized for a w×h (world) area plus 0.35 margin each side. */
function glowRectTexture(w: number, h: number) {
  const key = `${w.toFixed(2)}x${h.toFixed(2)}`;
  const hit = glowCache.get(key); if (hit) return hit;
  const s = 90, cw = Math.round((w + 0.7) * s), ch = Math.round((h + 0.7) * s);
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const g = cv.getContext('2d')!;
  g.shadowColor = '#fff'; g.shadowBlur = 22; g.strokeStyle = '#fff'; g.lineWidth = 7;
  roundRect(g, 0.35 * s, 0.35 * s, w * s, h * s, 22); g.stroke(); g.stroke();
  g.shadowBlur = 0; g.globalAlpha = 0.14; g.fillStyle = '#fff'; roundRect(g, 0.35 * s, 0.35 * s, w * s, h * s, 22); g.fill();
  const tex = new THREE.CanvasTexture(cv); glowCache.set(key, tex);
  return tex;
}
let circleGlow: THREE.CanvasTexture | null = null;
function glowCircleTexture() {
  if (circleGlow) return circleGlow;
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d')!;
  g.shadowColor = '#fff'; g.shadowBlur = 20; g.strokeStyle = '#fff'; g.lineWidth = 8;
  g.beginPath(); g.arc(128, 128, 84, 0, 7); g.stroke(); g.stroke();
  g.shadowBlur = 0; g.globalAlpha = 0.16; g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 128, 84, 0, 7); g.fill();
  circleGlow = new THREE.CanvasTexture(cv);
  return circleGlow;
}

/** Table-skin ink as rgba. */
function inkA(t: TableTheme, a: number) {
  const c = new THREE.Color(t.ink);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}
/** Faint printed pattern for themed felts (grid, damask, chickens, sparkles). */
function feltPattern(g: CanvasRenderingContext2D, t: TableTheme, W: number, H: number) {
  if (!t.pattern) return;
  g.save();
  g.strokeStyle = inkA(t, 0.1); g.fillStyle = inkA(t, 0.1); g.lineWidth = 2;
  const step = t.pattern === 'grid' ? 64 : 90;
  for (let x = 0; x < W + step; x += step) for (let y = 0; y < H + step; y += step) {
    const ox = ((y / step) % 2) * (step / 2);
    if (t.pattern === 'grid') { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); if (x === 0) { for (let yy = 0; yy < H; yy += step) { g.beginPath(); g.moveTo(0, yy); g.lineTo(W, yy); g.stroke(); } } continue; }
    const cx = x + ox, cy = y;
    if (t.pattern === 'damask') { g.beginPath(); g.moveTo(cx, cy - 18); g.lineTo(cx + 12, cy); g.lineTo(cx, cy + 18); g.lineTo(cx - 12, cy); g.closePath(); g.stroke(); }
    else if (t.pattern === 'chicken') { g.beginPath(); g.ellipse(cx, cy, 14, 16, 0, 0, 7); g.fill(); g.beginPath(); g.arc(cx + 10, cy - 16, 8, 0, 7); g.fill(); }
    else { g.beginPath(); g.moveTo(cx, cy - 10); g.lineTo(cx + 3, cy - 3); g.lineTo(cx + 10, cy); g.lineTo(cx + 3, cy + 3); g.lineTo(cx, cy + 10); g.lineTo(cx - 3, cy + 3); g.lineTo(cx - 10, cy); g.lineTo(cx - 3, cy - 3); g.closePath(); g.fill(); }
  }
  g.restore();
}
