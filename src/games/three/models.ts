import * as THREE from 'three';
import { CHICKENS, HATS } from '../../lib/cosmetics';

export const BOX = new THREE.BoxGeometry(1, 1, 1);

export function box(mat: THREE.Material, s: number[], p: number[] = [0, 0, 0], shadow = true) {
  const m = new THREE.Mesh(BOX, mat);
  m.scale.set(s[0], s[1], s[2]);
  m.position.set(p[0], p[1], p[2]);
  m.castShadow = shadow;
  return m;
}

export const std = (color: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });

export const MAT = {
  red: std(0xe63946),
  orange: std(0xf6a623),
  black: std(0x0b0b0b, { roughness: 0.4 }),
  white: std(0xffffff),
  gold: std(0xf4c430, { metalness: 0.75, roughness: 0.28, emissive: 0x3a2800 }),
  goldBright: std(0xffd84d, { metalness: 0.8, roughness: 0.2, emissive: 0x6b4a00, emissiveIntensity: 0.8 }),
  straw: std(0xb88a3e, { roughness: 0.95 }),
  strawDark: std(0x7a5424, { roughness: 1 }),
  wood: std(0x5b3a1e, { roughness: 1 }),
  glass: std(0x1a2233, { metalness: 0.5, roughness: 0.15 }),
  fox: std(0xf97316, { roughness: 0.7 }),
  cream: std(0xf8f6ef, { roughness: 0.75 }),
  flame: new THREE.MeshBasicMaterial({ color: 0xffb03a }),
  flameRed: new THREE.MeshBasicMaterial({ color: 0xe63946 }),
};

/** Voxel rooster with sunglasses, facing +X. */
export function makeChicken(color = '#F8F6EF') {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = std(new THREE.Color(color).getHex(), { roughness: 0.75 });
  const parts: [THREE.Material, number[], number[]][] = [
    [skin, [0.9, 0.75, 0.8], [0, 0.72, 0]],
    [skin, [0.62, 0.62, 0.62], [0.28, 1.35, 0]],
    [skin, [0.2, 0.45, 0.6], [-0.52, 0.95, 0]],
    [skin, [0.5, 0.35, 0.12], [-0.05, 0.75, 0.45]],
    [skin, [0.5, 0.35, 0.12], [-0.05, 0.75, -0.45]],
    [MAT.red, [0.34, 0.22, 0.14], [0.25, 1.76, 0]],
    [MAT.red, [0.18, 0.16, 0.14], [0.05, 1.72, 0]],
    [MAT.orange, [0.26, 0.14, 0.24], [0.7, 1.28, 0]],
    [MAT.red, [0.1, 0.2, 0.12], [0.62, 1.1, 0]],
    [MAT.black, [0.12, 0.16, 0.7], [0.6, 1.44, 0]],
    [MAT.black, [0.05, 0.2, 0.26], [0.63, 1.43, 0.19]],
    [MAT.black, [0.05, 0.2, 0.26], [0.63, 1.43, -0.19]],
    [MAT.orange, [0.09, 0.4, 0.09], [0.05, 0.2, 0.18]],
    [MAT.orange, [0.09, 0.4, 0.09], [0.05, 0.2, -0.18]],
    [MAT.orange, [0.3, 0.05, 0.16], [0.14, 0.02, 0.18]],
    [MAT.orange, [0.3, 0.05, 0.16], [0.14, 0.02, -0.18]],
  ];
  for (const [m, s, p] of parts) body.add(box(m, s, p));
  body.add(box(new THREE.MeshBasicMaterial({ color: 0xffffff }), [0.02, 0.05, 0.1], [0.66, 1.48, 0.23], false));
  return { root, body, skin };
}

/** Voxel fox head + shoulders, facing +Z (towards the camera). */
export function makeFox() {
  const g = new THREE.Group();
  const white = MAT.cream, dark = std(0x7c2d12), nose = MAT.black;
  const parts: [THREE.Material, number[], number[]][] = [
    [MAT.fox, [0.9, 0.7, 0.8], [0, 0.35, 0]], // shoulders
    [MAT.fox, [0.8, 0.62, 0.7], [0, 1.0, 0.05]], // head
    [white, [0.5, 0.3, 0.36], [0, 0.85, 0.42]], // muzzle
    [nose, [0.14, 0.12, 0.1], [0, 0.95, 0.62]],
    [MAT.fox, [0.22, 0.34, 0.16], [-0.26, 1.46, 0.05]], // ears
    [MAT.fox, [0.22, 0.34, 0.16], [0.26, 1.46, 0.05]],
    [dark, [0.12, 0.2, 0.06], [-0.26, 1.46, 0.13]],
    [dark, [0.12, 0.2, 0.06], [0.26, 1.46, 0.13]],
    [white, [0.5, 0.36, 0.1], [0, 0.35, 0.42]], // chest
  ];
  for (const [m, s, p] of parts) g.add(box(m, s, p));
  // evil eyes
  const eye = new THREE.MeshBasicMaterial({ color: 0xffe066 });
  g.add(box(eye, [0.14, 0.08, 0.04], [-0.2, 1.1, 0.41], false), box(eye, [0.14, 0.08, 0.04], [0.2, 1.1, 0.41], false));
  g.add(box(nose, [0.05, 0.08, 0.05], [-0.2, 1.1, 0.43], false), box(nose, [0.05, 0.08, 0.05], [0.2, 1.1, 0.43], false));
  return g;
}

const EGG_GEO = new THREE.SphereGeometry(0.5, 28, 20);
export function makeEgg(color = 0xf4c430, glow = true) {
  const mat = new THREE.MeshStandardMaterial({ color, metalness: glow ? 0.8 : 0.1, roughness: glow ? 0.18 : 0.5, emissive: glow ? 0x5a3f00 : 0x000000, emissiveIntensity: 0.6 });
  const m = new THREE.Mesh(EGG_GEO, mat);
  m.scale.set(1, 1.28, 1);
  m.castShadow = true;
  return m;
}

export function makeCoin(r = 0.35) {
  const g = new THREE.Mesh(new THREE.CylinderGeometry(r, r, r * 0.22, 28), MAT.gold);
  g.castShadow = true;
  return g;
}

export function makeChip(color: number, r = 0.5, stripe?: number, glow = false) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, r * 0.22, 32), std(color, { roughness: 0.5, ...(glow ? { emissive: color, emissiveIntensity: 0.45 } : {}) }));
  const stripeMat = stripe === undefined ? MAT.cream : std(stripe, { roughness: 0.5 });
  body.castShadow = true;
  g.add(body);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const stripe = box(stripeMat, [r * 0.28, r * 0.23, r * 0.14], [Math.cos(a) * r * 0.9, 0, Math.sin(a) * r * 0.9], false);
    stripe.rotation.y = -a;
    g.add(stripe);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.6, r * 0.03, 6, 32), stripeMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = r * 0.115;
  g.add(ring);
  return g;
}

/** A cartoon rocket pointing along +X. */
export function makeRocket() {
  const g = new THREE.Group();
  const bodyMat = std(0xf8f6ef, { metalness: 0.3, roughness: 0.35 });
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 2.2, 24), bodyMat);
  hull.rotation.z = -Math.PI / 2;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 24), MAT.red);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 1.55;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.25, 24), MAT.gold);
  band.rotation.z = -Math.PI / 2;
  band.position.x = 0.7;
  const win = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 20), MAT.glass);
  win.rotation.x = Math.PI / 2;
  win.position.set(0.3, 0.1, 0.44);
  g.add(hull, nose, band, win);
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const fin = box(MAT.red, [0.6, 0.06, 0.5], [-0.95, Math.sin(a) * 0.55, Math.cos(a) * 0.55]);
    fin.rotation.x = a;
    g.add(fin);
  }
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.3, 20), MAT.black);
  nozzle.rotation.z = -Math.PI / 2;
  nozzle.position.x = -1.2;
  g.add(nozzle);
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
  return g;
}

/** Canvas texture with centred text (Montserrat 900). */
export function textTexture(text: string, o: { w?: number; h?: number; size?: number; color?: string; bg?: string; stroke?: string; radius?: number } = {}) {
  const w = o.w ?? 256, h = o.h ?? 128;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const draw = () => {
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, w, h);
    if (o.bg) {
      g.fillStyle = o.bg;
      const r = o.radius ?? 18;
      g.beginPath(); g.moveTo(r, 0); g.arcTo(w, 0, w, h, r); g.arcTo(w, h, 0, h, r); g.arcTo(0, h, 0, 0, r); g.arcTo(0, 0, w, 0, r); g.fill();
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = o.size ?? h * 0.55;
    g.font = `900 ${size}px Montserrat, system-ui, sans-serif`;
    while (g.measureText(text).width > w * 0.9 && size > 8) { size -= 2; g.font = `900 ${size}px Montserrat, system-ui, sans-serif`; }
    if (o.stroke) { g.lineWidth = size * 0.14; g.strokeStyle = o.stroke; g.strokeText(text, w / 2, h / 2 + size * 0.04); }
    g.fillStyle = o.color ?? '#0B0B0B';
    g.fillText(text, w / 2, h / 2 + size * 0.04);
    tex.needsUpdate = true;
  };
  draw();
  document.fonts?.ready.then(draw);
  return tex;
}

export function labelPlane(tex: THREE.Texture, w: number, h: number) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
}

/** Soft radial glow sprite. */
export function glowSprite(color: string, size: number, opacity = 0.6) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, color); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.set(size, size, 1);
  return s;
}

export function starField(count = 600, spread = 120, size = 0.18) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * spread;
    pos[i * 3 + 1] = (Math.random() - 0.3) * spread * 0.6;
    pos[i * 3 + 2] = -10 - Math.random() * spread * 0.5;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size, sizeAttenuation: true, transparent: true, opacity: 0.8, depthWrite: false }));
}

// ---------- equipped chicken looks (skins + hats) for the voxel chickens ----------

/** The body colour a voxel chicken should use for a skin (between the art's light and dark tones). */
export function chickenBodyColor(skinId: string) {
  const st = CHICKENS[skinId] ?? CHICKENS['ch-classic'];
  return new THREE.Color(st.body[0]).lerp(new THREE.Color(st.body[1]), 0.35);
}
/** Emissive glow for shiny skins. */
export function chickenGlow(skinId: string) {
  const st = CHICKENS[skinId];
  if (!st?.glow) return new THREE.Color(0x000000);
  return new THREE.Color(st.body[1]).multiplyScalar(skinId === 'ch-cyber' || skinId === 'ch-lava' ? 0.08 : 0.22);
}

/**
 * Outfit pieces and hat for a voxel chicken facing +X (torso centred at y≈0.72,
 * head at (0.28, 1.35)). Add the returned group to the chicken's body group.
 */
export function buildChickenLook(skinId: string, hatId: string) {
  const g = new THREE.Group();
  const st = CHICKENS[skinId] ?? CHICKENS['ch-classic'];
  const m = (c: string | number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, ...o });
  const add = (mat: THREE.Material, s: number[], p: number[], rot?: number[]) => { const b = box(mat, s, p); if (rot) b.rotation.set(rot[0], rot[1], rot[2]); g.add(b); return b; };
  const a = st.accent ?? '#b3192a';
  switch (st.outfit) {
    case 'suit': case 'tux': {
      const j = m(st.outfit === 'tux' ? '#111111' : '#26262b');
      add(j, [0.94, 0.5, 0.84], [0.0, 0.62, 0]);
      add(m('#f8f6ef'), [0.06, 0.32, 0.22], [0.46, 0.74, 0]);
      add(m(a), st.outfit === 'tux' ? [0.07, 0.1, 0.26] : [0.07, 0.3, 0.1], [0.5, st.outfit === 'tux' ? 0.9 : 0.74, 0]);
      break;
    }
    case 'cowboy': add(m('#7a4a22'), [0.94, 0.42, 0.84], [-0.05, 0.6, 0]); add(m(a), [0.3, 0.18, 0.6], [0.4, 1.05, 0]); break;
    case 'space': {
      add(m('#eef0f4'), [0.94, 0.55, 0.84], [0, 0.62, 0]); add(m(a), [0.06, 0.2, 0.3], [0.47, 0.72, 0]);
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.52, 20, 14), new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.25, roughness: 0.05, transmission: 0.4 }));
      helmet.position.set(0.3, 1.38, 0); g.add(helmet); break;
    }
    case 'robe': add(m(a), [0.5, 0.6, 0.92], [-0.28, 0.7, 0]); add(m('#f8f6ef'), [0.7, 0.14, 0.74], [0.05, 1.05, 0]); break;
    case 'armor': for (const y of [0.5, 0.68, 0.86]) add(m(a, { metalness: 0.3, roughness: 0.3 }), [0.94, 0.12, 0.84], [0, y, 0]); add(m('#f8f6ef'), [0.64, 0.08, 0.64], [0.28, 1.56, 0]); break;
    case 'cyber': for (const [y, z] of [[0.6, 0.41], [0.85, 0.41], [0.6, -0.41], [0.85, -0.41]]) add(new THREE.MeshBasicMaterial({ color: a }), [0.7, 0.04, 0.02], [0, y, z]); add(new THREE.MeshBasicMaterial({ color: a }), [0.1, 0.12, 0.66], [0.59, 1.44, 0]); break;
    case 'bones': for (const y of [0.52, 0.66, 0.8, 0.94]) add(m(a), [0.04, 0.05, 0.86], [0.2 - y * 0.1, y, 0]); add(m(a), [0.6, 0.05, 0.04], [0.05, 0.72, 0.41]); break;
    case 'pirate': for (const y of [0.45, 0.6, 0.75]) add(m(a), [0.94, 0.07, 0.84], [0, y, 0]); add(m(a), [0.64, 0.12, 0.66], [0.28, 1.6, 0]); break;
    case 'ninja': add(m(a), [0.64, 0.12, 0.66], [0.28, 1.46, 0]); add(m(a), [0.3, 0.06, 0.08], [-0.15, 1.42, 0.1], [0, 0, 0.4]); break;
    case 'lava': for (const [x, y, z] of [[0.1, 0.6, 0.41], [-0.2, 0.8, 0.41], [0.15, 0.85, -0.41], [-0.1, 0.55, -0.41]]) add(new THREE.MeshBasicMaterial({ color: a }), [0.32, 0.04, 0.02], [x, y, z], [0, 0, 0.5]); break;
    case 'frost': for (const x of [-0.25, 0.05, 0.3]) add(m('#e0f2fe', { emissive: 0x335566 }), [0.07, 0.18, 0.07], [x, 0.27, 0.2]); break;
    case 'disco': for (let i = 0; i < 10; i++) add(new THREE.MeshBasicMaterial({ color: i % 2 ? '#f0abfc' : '#ffffff' }), [0.12, 0.12, 0.02], [-0.3 + (i % 5) * 0.16, 0.55 + Math.floor(i / 5) * 0.2, 0.41]); break;
    default: break;
  }
  if (st.eyes === 'patch') add(m('#111'), [0.06, 0.2, 0.2], [0.6, 1.43, 0.19]);

  const hat = HATS[hatId] ?? 'none';
  const black = m('#161616'), gold = m('#f4c430', { metalness: 0.8, roughness: 0.25, emissive: 0x3a2800 }), white = m('#fbfbf8');
  switch (hat) {
    case 'tophat': add(black, [0.78, 0.05, 0.78], [0.28, 1.68, 0]); add(black, [0.46, 0.46, 0.46], [0.28, 1.94, 0]); add(m('#b3192a'), [0.48, 0.08, 0.48], [0.28, 1.76, 0]); break;
    case 'crown':
      for (const [x, z, w, d] of [[0.28, 0.27, 0.6, 0.06], [0.28, -0.27, 0.6, 0.06], [0.01, 0, 0.06, 0.6], [0.55, 0, 0.06, 0.6]]) add(gold, [w, 0.16, d], [x, 1.75, z]);
      for (const [x, z] of [[0.02, 0.27], [0.02, -0.27], [0.54, 0.27], [0.54, -0.27], [0.56, 0]]) add(gold, [0.08, 0.16, 0.08], [x, 1.9, z]);
      add(m('#e63946', { emissive: 0x440000 }), [0.04, 0.08, 0.12], [0.59, 1.75, 0]); break;
    case 'cowboy': add(m('#7a4a22'), [1.0, 0.05, 0.9], [0.28, 1.68, 0]); add(m('#8b5a2b'), [0.52, 0.3, 0.48], [0.28, 1.86, 0]); add(m('#3a2414'), [0.54, 0.07, 0.5], [0.28, 1.74, 0]); break;
    case 'chef': add(white, [0.5, 0.3, 0.5], [0.28, 1.82, 0]); add(white, [0.66, 0.24, 0.66], [0.28, 2.06, 0]); break;
    case 'viking':
      add(m('#9ca3af', { metalness: 0.6, roughness: 0.35 }), [0.68, 0.2, 0.68], [0.28, 1.74, 0]); add(m('#9ca3af', { metalness: 0.6, roughness: 0.35 }), [0.46, 0.14, 0.46], [0.28, 1.9, 0]);
      add(m('#f1ede1'), [0.1, 0.36, 0.1], [0.28, 1.92, 0.44], [0.5, 0, 0]); add(m('#f1ede1'), [0.1, 0.36, 0.1], [0.28, 1.92, -0.44], [-0.5, 0, 0]); break;
    case 'santa':
      add(white, [0.68, 0.1, 0.68], [0.28, 1.68, 0]); add(m('#d62839'), [0.58, 0.2, 0.58], [0.26, 1.82, 0]); add(m('#d62839'), [0.4, 0.2, 0.4], [0.18, 1.98, 0]);
      add(m('#d62839'), [0.22, 0.18, 0.22], [0.04, 2.1, 0]); add(white, [0.16, 0.16, 0.16], [-0.06, 2.12, 0]); break;
    case 'headphones': add(black, [0.12, 0.08, 0.74], [0.24, 1.72, 0]); for (const z of [0.36, -0.36]) { add(black, [0.26, 0.3, 0.12], [0.24, 1.4, z]); add(m('#ff2bd6', { emissive: 0x550044 }), [0.18, 0.2, 0.02], [0.24, 1.4, z * 1.2]); } break;
    case 'sombrero': add(m('#e8c47a'), [1.3, 0.05, 1.3], [0.28, 1.68, 0]); add(m('#f2d48f'), [0.46, 0.36, 0.46], [0.28, 1.9, 0]); add(m('#e63946'), [0.48, 0.08, 0.48], [0.28, 1.76, 0]); break;
    case 'gradcap': add(black, [0.52, 0.16, 0.52], [0.28, 1.74, 0]); add(black, [0.84, 0.04, 0.84], [0.28, 1.84, 0], [0, Math.PI / 4, 0]); add(gold, [0.04, 0.26, 0.04], [0.6, 1.72, 0.3]); break;
    case 'chain': for (let i = 0; i < 9; i++) { const t = (i / 8) * Math.PI; add(gold, [0.08, 0.08, 0.08], [0.32 + Math.sin(t) * 0.18, 1.06 - Math.sin(t) * 0.12, Math.cos(t) * 0.34]); } add(gold, [0.04, 0.16, 0.16], [0.52, 0.92, 0]); break;
    default: break;
  }
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
  return g;
}
