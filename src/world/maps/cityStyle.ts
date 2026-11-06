// City identity builders: facade textures, building kinds per architecture style, and landmarks.
// Buildings are written into a CityGeo: per-material geometry lists where every vertex carries its building id
// ('bid'), so the merged city meshes can crumble building by building (gfx/toon.ts withCollapse).
import * as THREE from 'three';
import { Kit, box, cyl, sph, cone } from '../../gfx/kit';
import { PAL } from '../../gfx/palette';
import { _c1, chance, mulberry32, pick, rand } from '../../core/util';
import type { BuildingKind, CityStyle, Landmark } from '../../data/cityLooks';

// ---------------------------------------------------------------- facade textures
export type FacadeKey = 'office' | 'glass' | 'old';
export type CityMat = FacadeKey | 'plain' | 'glow';
const INK = PAL.ink, DARK = '#2a2350', WARM = '#ffd46b', COOL = '#8fe8ff';
function rr(x: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, r: number, fill: string) {
  x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r);
  x.closePath(); x.fillStyle = fill; x.fill();
}
function tex(draw: (x: CanvasRenderingContext2D, emissive: boolean, r: () => number) => void) {
  const mk = (em: boolean) => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = em ? '#000' : '#fff'; x.fillRect(0, 0, 256, 256); draw(x, em, mulberry32(99));
    // keep the top-left texel clean wall (non-facade parts sample it)
    x.fillStyle = em ? '#000' : '#fff'; x.fillRect(0, 0, 4, 4);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  return { map: mk(false), em: mk(true) };
}
let FACADES: Record<FacadeKey, { map: THREE.CanvasTexture; em: THREE.CanvasTexture }> = null;
/** Office grid, glass curtain wall and old-town (tall shuttered windows). One texture repeat = T world units. */
export function facadeTextures() {
  if (FACADES) return FACADES;
  FACADES = {
    office: tex((x, em, r) => {
      if (!em) { x.fillStyle = 'rgba(26,16,51,0.12)'; for (let j = 0; j < 8; j++) x.fillRect(0, j * 32, 256, 2); }
      for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
        const v = r(), X = i * 32 + 5, Y = j * 32 + 4;
        if (!em) { rr(x, X, Y, 22, 24, 7, INK); rr(x, X + 3, Y + 3, 16, 18, 4, DARK); } else if (v < 0.42) rr(x, X + 3, Y + 3, 16, 18, 4, v < 0.3 ? WARM : COOL);
      }
    }),
    glass: tex((x, em, r) => {
      for (let j = 0; j < 8; j++) {
        const Y = j * 32 + 6;
        if (!em) { x.fillStyle = '#3a4a8a'; x.fillRect(0, Y, 256, 22); x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillRect(0, Y + 2, 256, 4); x.fillStyle = INK; for (let i = 0; i <= 8; i++) x.fillRect(i * 32 - 1, Y, 3, 22); x.fillRect(0, Y - 2, 256, 3); }
        else for (let i = 0; i < 8; i++) { const v = r(); if (v < 0.5) { x.fillStyle = v < 0.2 ? WARM : COOL; x.fillRect(i * 32 + 3, Y + 2, 27, 18); } }
      }
    }),
    old: tex((x, em, r) => {
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        const v = r(), X = i * 64 + 20, Y = j * 64 + 12;
        if (!em) {
          x.fillStyle = 'rgba(26,16,51,0.1)'; x.fillRect(0, j * 64 + 58, 256, 4);   // floor cornice
          rr(x, X - 9, Y + 4, 7, 34, 2, '#3d7b6a'); rr(x, X + 26, Y + 4, 7, 34, 2, '#3d7b6a');   // shutters
          x.beginPath(); x.arc(X + 12, Y + 12, 13, Math.PI, 0); x.lineTo(X + 25, Y + 42); x.lineTo(X - 1, Y + 42); x.closePath(); x.fillStyle = INK; x.fill();
          x.beginPath(); x.arc(X + 12, Y + 12, 10, Math.PI, 0); x.lineTo(X + 22, Y + 39); x.lineTo(X + 2, Y + 39); x.closePath(); x.fillStyle = DARK; x.fill();
          x.fillStyle = INK; x.fillRect(X - 3, Y + 42, 30, 4);   // sill
        } else if (v < 0.4) { x.beginPath(); x.arc(X + 12, Y + 12, 10, Math.PI, 0); x.lineTo(X + 22, Y + 39); x.lineTo(X + 2, Y + 39); x.closePath(); x.fillStyle = WARM; x.fill(); }
      }
    }),
  };
  return FACADES;
}

// ---------------------------------------------------------------- geometry collector with building ids
const KEEP = new Set(['position', 'normal', 'uv']);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export class CityGeo {
  lists: Record<CityMat, THREE.BufferGeometry[]> = { office: [], glass: [], old: [], plain: [], glow: [] };
  bid = 0;
  private push(mat: CityMat, g0: THREE.BufferGeometry, color: string, k = 1, p: number[] = [0, 0, 0], r: number[] = [0, 0, 0], s: number | number[] = 1) {
    const g = g0.index ? g0.toNonIndexed() : g0; if (g !== g0) g0.dispose();
    for (const a of Object.keys(g.attributes)) if (!KEEP.has(a)) g.deleteAttribute(a);
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    _m.compose(_p.set(p[0], p[1], p[2]), _q.setFromEuler(_e.set(r[0], r[1], r[2])), Array.isArray(s) ? _s.set(s[0], s[1], s[2]) : _s.set(s, s, s));
    g.applyMatrix4(_m);
    _c1.set(color); const col = new Float32Array(n * 3), bid = new Float32Array(n).fill(this.bid);
    for (let i = 0; i < n; i++) { col[i * 3] = _c1.r * k; col[i * 3 + 1] = _c1.g * k; col[i * 3 + 2] = _c1.b * k; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('bid', new THREE.BufferAttribute(bid, 1));
    this.lists[mat].push(g);
  }
  /** A box with windows on its four sides (one texture repeat every T units); top and bottom sample plain wall. */
  facade(mat: FacadeKey, x: number, y0: number, z: number, w: number, h: number, d: number, tint: string, T = 16, ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv as THREE.BufferAttribute, off = Math.floor(rand(0, 8)) / 8;
    for (let i = 0; i < uv.count; i++) {
      const face = Math.floor(i / 4);
      if (face === 2 || face === 3) { uv.setXY(i, 0.004, 0.996); continue; }
      uv.setXY(i, uv.getX(i) * (face < 2 ? d : w) / T + off, uv.getY(i) * h / T);
    }
    this.push(mat, g, tint, 1, [x, y0 + h / 2, z], [0, ry, 0]);
  }
  /** Any other part, plain toon (or glow with HDR factor k). */
  part(geo: THREE.BufferGeometry, color: string, p: number[], o: { r?: number[]; s?: number | number[]; glow?: number } = {}) {
    const uv = geo.attributes.uv as THREE.BufferAttribute; if (uv) for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.004, 0.996);
    this.push(o.glow ? 'glow' : 'plain', geo, color, o.glow || 1, p, o.r, o.s);
  }
}
/** A gable roof: triangular prism, ridge along z. */
export function gable(w: number, h: number, d: number) {
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return g;
}

// ---------------------------------------------------------------- building kinds (one lot ≈ 15 × 15)
export interface Lot { x: number; z: number; central: number; tall: number }
export type Footprint = { x: number; z: number; w: number; d: number; h: number };
function neon(B: CityGeo, st: CityStyle, x: number, z: number, w: number, d: number, h: number) {
  if (!chance(st.neon)) return;
  const side = Math.floor(rand(0, 4)), c = pick(st.accents), sh = Math.min(h * 0.5, rand(4, 9)), y = rand(3, Math.max(4, h - sh - 2)) + sh / 2;
  const off = [[w / 2 + 0.2, 0], [-w / 2 - 0.2, 0], [0, d / 2 + 0.2], [0, -d / 2 - 0.2]][side];
  B.part(box(side < 2 ? 0.3 : 1.4, sh, side < 2 ? 1.4 : 0.3), c, [x + off[0], y, z + off[1]], { glow: 2.4 });
}
function rooftop(B: CityGeo, st: CityStyle, x: number, z: number, h: number, w: number) {
  const r = rand(0, 1);
  if (r < 0.3) { B.part(cyl(1.2, 1.2, 2.2, 8), '#5a4a5a', [x + rand(-w / 4, w / 4), h + 2.2, z]); B.part(cone(1.4, 1.2, 8), '#5a4a5a', [x, h + 3.9, z]); B.part(box(0.2, 1.2, 0.2), '#5a4a5a', [x, h + 0.6, z]); }
  else if (r < 0.55) { B.part(cyl(0.12, 0.12, 5, 4), PAL.streetPole, [x + w * 0.25, h + 2.5, z]); B.part(sph(0.3, 6, 4), PAL.tomato, [x + w * 0.25, h + 5.1, z], { glow: 3 }); }
  else if (r < 0.7) B.part(box(w * 0.45, 1.6, w * 0.35), pick(st.walls), [x, h + 0.8, z]);
}
export const BUILD: Record<BuildingKind, (B: CityGeo, st: CityStyle, L: Lot) => Footprint> = {
  tower(B, st, L) {
    const w = rand(10, 14), d = rand(10, 14), h = (rand(14, 24) + L.central * rand(4, 14)) * st.height * L.tall, t = pick(st.walls);
    B.facade('office', L.x, 0, L.z, w, h, d, t);
    B.part(box(w + 0.5, 0.6, d + 0.5), t, [L.x, h + 0.2, L.z]); rooftop(B, st, L.x, L.z, h, w); neon(B, st, L.x, L.z, w, d, h);
    return { x: L.x, z: L.z, w, d, h };
  },
  glass(B, st, L) {
    const w = rand(10, 13), d = rand(10, 13), h = (rand(22, 36) + L.central * rand(10, 28)) * st.height * L.tall, t = pick(['#a0d8ff', '#c8e6ff', '#9fe8c8', '#eef0ff', ...st.walls]);
    B.facade('glass', L.x, 0, L.z, w, h, d, t, 14);
    const h2 = h * rand(0.15, 0.3), w2 = w * 0.7, d2 = d * 0.7;
    B.facade('glass', L.x, h, L.z, w2, h2, d2, t, 14);
    if (chance(0.5)) { B.part(cone(Math.min(w2, d2) * 0.3, 8, 4), '#c8d0e8', [L.x, h + h2 + 4, L.z], { r: [0, Math.PI / 4, 0] }); B.part(sph(0.35, 6, 4), PAL.tomato, [L.x, h + h2 + 8.4, L.z], { glow: 3 }); }
    else B.part(box(w2 + 0.6, 1, d2 + 0.6), '#3a3550', [L.x, h + h2 + 0.5, L.z]);
    neon(B, st, L.x, L.z, w, d, h);
    return { x: L.x, z: L.z, w, d, h: h + h2 };
  },
  old(B, st, L) {
    // two narrow row houses with gable roofs and chimneys
    let H = 0;
    for (const s of [-1, 1]) {
      const w = 6.6, d = rand(11, 13), h = rand(9, 14) * Math.min(1.1, st.height + 0.25), t = pick(st.walls), roof = pick(st.roofs), x = L.x + s * 3.6;
      B.facade('old', x, 0, L.z, w, h, d, t, 10);
      B.part(box(w + 0.4, 0.6, d + 0.4), '#fff6e0', [x, h + 0.3, L.z]);
      B.part(gable(w + 1.2, rand(3, 4.5), d + 1), roof, [x, h + 0.6, L.z]);
      if (chance(0.7)) B.part(box(0.9, 2.4, 0.9), '#8a5a4a', [x + rand(-1.5, 1.5), h + 2.6, L.z + rand(-3, 3)]);
      H = Math.max(H, h + 4);
    }
    return { x: L.x, z: L.z, w: 14, d: 13, h: H };
  },
  slab(B, st, L) {
    const w = rand(13, 14.5), d = rand(6.5, 8), h = rand(20, 30) * st.height * L.tall, t = pick(st.walls);
    B.facade('office', L.x, 0, L.z, w, h, d, t, 12);
    B.part(box(w + 0.4, 0.8, d + 0.4), '#9a98a8', [L.x, h + 0.4, L.z]);
    B.part(box(3, 2.4, 3), '#9a98a8', [L.x + rand(-4, 4), h + 1.6, L.z]);
    if (chance(0.3)) B.part(box(w * 0.7, 1.4, 0.3), pick(st.accents), [L.x, h * 0.85, L.z + d / 2 + 0.2], { glow: 1.8 });   // a slogan banner
    return { x: L.x, z: L.z, w, d, h };
  },
  dome(B, st, L) {
    const w = rand(9, 13), d = rand(9, 13), h = rand(6, 12) * Math.max(0.8, st.height * 0.9), t = pick(st.walls), acc = pick(st.accents);
    B.facade('old', L.x, 0, L.z, w, h, d, t, 10);
    B.part(box(w + 0.6, 1, d + 0.6), t, [L.x, h + 0.5, L.z]);
    let top = h + 1;
    if (chance(0.5)) { const r = Math.min(w, d) * 0.34; B.part(cyl(r, r, 1.6, 16), t, [L.x, h + 1.8, L.z]); B.part(sph(r, 16, 10), acc, [L.x, h + 2.6, L.z], { s: [1, 0.85, 1] }); B.part(cone(0.3, 1.8, 6), '#e8c86a', [L.x, h + 2.6 + r * 0.85 + 0.8, L.z]); top = h + 3 + r; }
    if (chance(0.3)) {
      const mx = L.x + w / 2 - 1, mz = L.z + d / 2 - 1, mh = h + rand(10, 16);
      B.part(cyl(0.7, 0.9, mh, 8), '#fff6e0', [mx, mh / 2, mz]); B.part(cyl(1.3, 1.3, 0.6, 10), t, [mx, mh * 0.8, mz]); B.part(cone(0.9, 3, 8), acc, [mx, mh + 1.5, mz]);
      top = Math.max(top, mh + 3);
    }
    return { x: L.x, z: L.z, w, d, h: top };
  },
  pagoda(B, st, L) {
    const n = Math.floor(rand(3, 6)), base = rand(10, 12.5), roof = pick(st.roofs); let y = 0, w = base;
    for (let i = 0; i < n; i++) {
      const fh = 3.4; B.facade('old', L.x, y, L.z, w, fh, w, pick(st.walls), 8);
      B.part(box(w + 3.2, 0.5, w + 3.2), roof, [L.x, y + fh + 0.25, L.z]);
      B.part(cone((w + 3.2) * 0.72, 0.9, 4), roof, [L.x, y + fh + 0.95, L.z], { r: [0, Math.PI / 4, 0] });
      y += fh + 1.2; w *= 0.84;
    }
    B.part(cyl(0.2, 0.2, 3, 5), '#e8c86a', [L.x, y + 1.5, L.z]); B.part(sph(0.45, 8, 5), '#ffd23f', [L.x, y + 3.2, L.z], { glow: 1.6 });
    B.part(sph(0.6, 8, 6), '#ff5a4f', [L.x + base / 2 + 1, 2.6, L.z], { glow: 2.2 });   // a lantern
    return { x: L.x, z: L.z, w: base, d: base, h: y + 3 };
  },
  colorful(B, st, L) {
    // 2–4 stacked, slightly offset storeys in candy colours, flat roofs, water tanks and awnings
    const n = Math.floor(rand(2, 5)); let y = 0, w = rand(10, 13.5), d = rand(10, 13.5), ox = 0, oz = 0;
    for (let i = 0; i < n; i++) {
      const fh = rand(3.4, 4.4), t = pick(st.walls);
      B.facade('old', L.x + ox, y, L.z + oz, w, fh, d, t, 9);
      if (i === 0 && chance(0.7)) B.part(box(w * 0.8, 0.25, 2.2), pick(st.accents), [L.x + ox, fh * 0.75, L.z + oz + d / 2 + 1], { r: [0.3, 0, 0] });   // awning
      y += fh; ox += rand(-0.8, 0.8); oz += rand(-0.8, 0.8); w *= rand(0.88, 1); d *= rand(0.88, 1);
    }
    B.part(box(w + 0.4, 0.5, d + 0.4), pick(st.walls), [L.x + ox, y + 0.25, L.z + oz]);
    if (chance(0.6)) { B.part(cyl(1, 1, 1.8, 8), '#2a2a3a', [L.x + ox + w * 0.25, y + 1.4, L.z + oz - d * 0.2]); }
    neon(B, st, L.x, L.z, w, d, y);
    return { x: L.x, z: L.z, w, d, h: y + 1 };
  },
};
export function pickKind(st: CityStyle): BuildingKind {
  const e = Object.entries(st.mix) as [BuildingKind, number][]; let t = e.reduce((a, [, v]) => a + v, 0) * Math.random();
  for (const [k, v] of e) { t -= v; if (t <= 0) return k; } return e[0][0];
}

// ---------------------------------------------------------------- landmarks (Kit: toon + ink, they never collapse)
type LM = (k: Kit, st: CityStyle) => number;   // returns the footprint half-size
const STONE = '#e0d4b8', WHITE = '#f4f0e8', GOLD = '#e8c86a';
function lattice(k: Kit, color: string, band: string | null, H: number) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.add(box(2.2, H * 0.42, 2.2), color, { p: [sx * 7, H * 0.19, sz * 7], r: [-sz * 0.3, 0, sx * 0.3], m: 'metal' });
  k.add(box(18, 1.6, 18), band || color, { p: [0, H * 0.33, 0], m: 'metal' });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.add(box(1.4, H * 0.27, 1.4), color, { p: [sx * 3.2, H * 0.47, sz * 3.2], r: [-sz * 0.12, 0, sx * 0.12], m: 'metal' });
  k.add(box(9, 1.2, 9), band || color, { p: [0, H * 0.6, 0], m: 'metal' });
  k.add(cyl(1.2, 2.6, H * 0.32, 4), color, { p: [0, H * 0.77, 0], r: [0, Math.PI / 4, 0], m: 'metal' });
  if (band) for (let i = 0; i < 3; i++) k.add(cyl(1.5 - i * 0.2, 1.7 - i * 0.2, 1, 4), band, { p: [0, H * (0.68 + i * 0.07), 0], r: [0, Math.PI / 4, 0] });
  k.add(cyl(0.25, 0.25, H * 0.12, 4), color, { p: [0, H * 0.99, 0] }); k.add(sph(0.5, 6, 4), PAL.tomato, { p: [0, H * 1.05, 0], m: 'glow', k: 3 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.add(sph(0.45, 6, 4), PAL.poster, { p: [sx * 8.6, H * 0.35, sz * 8.6], m: 'glow', k: 2.6 });
  return 12;
}
export const LANDMARKS: Record<Landmark, LM> = {
  liberty(k) {
    k.add(box(14, 4, 14), STONE, { p: [0, 2, 0] }); k.add(box(10, 10, 10), STONE, { p: [0, 9, 0] }); k.add(box(12, 1, 12), STONE, { p: [0, 14.5, 0] });
    const g = '#78c4a8';
    k.add(cyl(1.6, 3.2, 12, 10), g, { p: [0, 21, 0] }); k.add(cyl(1.4, 1.6, 4, 10), g, { p: [0, 29, 0] }); k.add(sph(1.3, 10, 8), g, { p: [0, 32.2, 0] });
    for (let i = -3; i <= 3; i++) k.add(cone(0.25, 1.6, 4), g, { p: [Math.sin(i * 0.4) * 1.3, 33.4, Math.cos(i * 0.4) * 0.6], r: [0.3, 0, -i * 0.35] });
    k.add(cyl(0.45, 0.5, 7, 6), g, { p: [1.7, 34.2, 0], r: [0, 0, -0.25] }); k.add(cyl(0.6, 0.35, 1.2, 8), GOLD, { p: [2.6, 37.9, 0] });
    k.add(sph(0.75, 8, 6), PAL.poster, { p: [2.6, 38.9, 0], m: 'glow', k: 3 }); k.add(box(1.6, 2.6, 0.5), g, { p: [-1.7, 28, 0.8], r: [0, 0, 0.3] });
    return 8;
  },
  capitol(k) {
    k.add(box(34, 8, 16), WHITE, { p: [0, 4, 0] });
    for (let i = 0; i < 6; i++) k.add(cyl(0.6, 0.6, 8, 8), WHITE, { p: [-5 + i * 2, 4, 8.6] });
    k.add(box(14, 2, 2), WHITE, { p: [0, 8.6, 8.6] }); k.add(cyl(7, 7, 6, 24), WHITE, { p: [0, 11, 0] });
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; k.add(cyl(0.35, 0.35, 5, 6), WHITE, { p: [Math.cos(a) * 7.6, 11, Math.sin(a) * 7.6] }); }
    k.add(sph(7, 24, 12), WHITE, { p: [0, 14, 0], s: [1, 0.95, 1], m: 'gloss' }); k.add(cyl(1.2, 1.2, 3, 10), WHITE, { p: [0, 22.5, 0] }); k.add(sph(0.8, 8, 6), GOLD, { p: [0, 24.6, 0] });
    for (let i = 0; i < 8; i++) k.add(box(1.4, 2.2, 0.2), PAL.windowLit, { p: [-14 + i * 4, 4, 8.1], m: 'glow', k: 1.3 });
    return 17;
  },
  supertall(k) {
    const c = '#3a3550';
    k.add(box(14, 40, 14), c, { p: [0, 20, 0], m: 'metal' }); k.add(box(10, 26, 10), c, { p: [-1, 53, 1], m: 'metal' }); k.add(box(7, 16, 7), c, { p: [1, 74, -1], m: 'metal' });
    for (let y = 4; y < 80; y += 5) { const w = y < 40 ? 14 : y < 66 ? 10 : 7; k.add(box(w + 0.2, 0.35, w + 0.2), COOL, { p: [y < 40 ? 0 : y < 66 ? -1 : 1, y, y < 40 ? 0 : y < 66 ? 1 : -1], m: 'glow', k: 1.3 }); }
    for (const s of [-1.6, 1.6]) { k.add(cyl(0.3, 0.3, 14, 4), '#c8d0e8', { p: [1 + s, 89, -1] }); k.add(sph(0.45, 6, 4), PAL.tomato, { p: [1 + s, 96.4, -1], m: 'glow', k: 3 }); }
    return 8;
  },
  tvtower(k) {
    k.add(cyl(1.6, 2.6, 40, 12), '#d8d4e0', { p: [0, 20, 0] }); k.add(sph(5, 18, 12), '#c8d0e8', { p: [0, 44, 0], m: 'gloss' });
    k.add(new THREE.TorusGeometry(5.05, 0.4, 6, 24), COOL, { p: [0, 44, 0], r: [Math.PI / 2, 0, 0], m: 'glow', k: 1.4 });
    k.add(cyl(0.6, 0.4, 16, 6), '#d8d4e0', { p: [0, 57, 0] }); k.add(sph(0.5, 6, 4), PAL.tomato, { p: [0, 65.4, 0], m: 'glow', k: 3 });
    k.add(box(8, 3, 8), '#d8d4e0', { p: [0, 1.5, 0] });
    return 5;
  },
  rocket(k) {
    k.add(box(4, 42, 4), '#8a90b8', { p: [-6, 21, 0], m: 'metal' });
    for (let y = 10; y < 40; y += 10) k.add(box(5, 0.8, 1), '#8a90b8', { p: [-3.5, y, 0], m: 'metal' });
    k.add(cyl(2.4, 2.4, 30, 14), WHITE, { p: [0, 17, 0] }); k.add(cone(2.4, 8, 14), WHITE, { p: [0, 36, 0] });
    for (const y of [8, 24]) k.add(cyl(2.45, 2.45, 1.4, 14), PAL.tomato, { p: [0, y, 0] });
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; k.add(box(0.4, 5, 3), PAL.tomato, { p: [Math.cos(a) * 2.8, 3.5, Math.sin(a) * 2.8], r: [0, -a, 0] }); }
    k.add(box(12, 1, 12), '#5a5f80', { p: [0, 0.5, 0] });
    return 7;
  },
  lighthouse(k) {
    k.add(cyl(2.5, 3.6, 22, 14), WHITE, { p: [0, 11, 0] });
    for (const y of [5, 12, 19]) k.add(cyl(2.9 - y * 0.03, 3.1 - y * 0.03, 2.4, 14), PAL.tomato, { p: [0, y, 0] });
    k.add(cyl(2.2, 2.2, 3, 12), PAL.poster, { p: [0, 23.5, 0], m: 'glow', k: 2.4 }); k.add(cone(2.8, 3, 12), PAL.tomato, { p: [0, 26.5, 0] });
    k.add(box(10, 2, 10), STONE, { p: [0, 1, 0] });
    return 5;
  },
  observatory(k) {
    k.add(cone(22, 9, 12), '#6a8a4a', { p: [0, 4.5, 0] });
    k.add(box(18, 5, 6), WHITE, { p: [0, 11.5, 0] }); k.add(sph(3.4, 14, 8), '#b88a5a', { p: [0, 14, 0], m: 'metal' });
    for (const s of [-7, 7]) { k.add(cyl(2, 2, 3, 12), WHITE, { p: [s, 14.5, 0] }); k.add(sph(2.1, 12, 8), '#b88a5a', { p: [s, 16, 0], m: 'metal' }); }
    return 16;
  },
  neon(k) {
    const cols = ['#ff6fb5', '#5fe8ff', '#ffd23f', '#9cff3f'];
    for (let i = 0; i < 3; i++) {
      const x = -8 + i * 8, h = 22 + i * 7; k.add(box(6, h, 6), '#3a3550', { p: [x, h / 2, 0], m: 'metal' });
      for (let y = 2; y < h; y += 3) k.add(box(6.2, 0.6, 6.2), cols[(i + y) % 4], { p: [x, y, 0], m: 'glow', k: 2.4 });
    }
    k.add(sph(5, 18, 12), '#ffd23f', { p: [0, 40, 0], m: 'glow', k: 1.6 }); k.add(new THREE.TorusGeometry(7, 0.5, 6, 30), '#ff6fb5', { p: [0, 40, 0], r: [1.2, 0, 0], m: 'glow', k: 2.6 });
    return 12;
  },
  bridge(k) {   // a red suspension bridge along the coast (placed by the city builder, x-axis)
    const red = '#d8452a';
    for (const x of [-34, 34]) for (const z of [-4, 4]) { k.add(box(2.2, 46, 2.2), red, { p: [x, 23, z], m: 'metal' }); }
    for (const x of [-34, 34]) for (const y of [20, 32, 44]) k.add(box(2, 1.6, 10), red, { p: [x, y, 0], m: 'metal' });
    k.add(box(150, 1.6, 10), red, { p: [0, 14, 0], m: 'metal' });
    for (const z of [-4.6, 4.6]) for (const [a, b] of [[-75, -34], [-34, 0], [0, 34], [34, 75]] as const) {
      const x0 = a, x1 = b, y0 = Math.abs(a) === 34 ? 45 : 15, y1 = Math.abs(b) === 34 ? 45 : 15, len = Math.hypot(x1 - x0, y1 - y0);
      k.add(cyl(0.3, 0.3, len, 4), red, { p: [(x0 + x1) / 2, (y0 + y1) / 2, z], r: [0, 0, Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2] });
    }
    return 0;
  },
  needle(k) {
    k.add(cyl(1.8, 3.2, 60, 10), '#d8d4e0', { p: [0, 30, 0] }); k.add(cyl(5.5, 4, 4, 18), '#c8d0e8', { p: [0, 50, 0], m: 'gloss' });
    k.add(new THREE.TorusGeometry(5.6, 0.35, 6, 24), COOL, { p: [0, 50.5, 0], r: [Math.PI / 2, 0, 0], m: 'glow', k: 1.4 });
    k.add(cyl(2.2, 2.2, 2, 12), '#c8d0e8', { p: [0, 62, 0] }); k.add(cyl(0.5, 0.3, 22, 6), '#d8d4e0', { p: [0, 74, 0] }); k.add(sph(0.5, 6, 4), PAL.tomato, { p: [0, 85.4, 0], m: 'glow', k: 3 });
    return 6;
  },
  pyramid(k) {
    const c = '#b8a080';
    for (let i = 0; i < 5; i++) k.add(box(30 - i * 5, 5, 30 - i * 5), c, { p: [0, 2.5 + i * 5, 0] });
    k.add(box(6, 4, 6), '#a08870', { p: [0, 27, 0] }); k.add(box(5, 1.2, 18), '#a08870', { p: [0, 12, 10], r: [-0.85, 0, 0] });
    k.add(sph(0.8, 8, 6), PAL.poster, { p: [0, 30, 0], m: 'glow', k: 2.6 });
    return 15;
  },
  cathedral(k) {
    k.add(box(10, 12, 24), STONE, { p: [0, 6, 0] }); k.add(box(7.5, 7.5, 24.4), '#5a5f80', { p: [0, 12, 0], r: [0, 0, Math.PI / 4] });
    for (const s of [-1, 1]) { k.add(box(5, 26, 5), STONE, { p: [s * 4.5, 13, 11] }); k.add(cone(3.6, 10, 4), '#5a5f80', { p: [s * 4.5, 31, 11], r: [0, Math.PI / 4, 0] }); k.add(sph(0.5, 6, 4), GOLD, { p: [s * 4.5, 36.4, 11] }); }
    k.add(cyl(2.2, 2.2, 0.4, 16), '#a77bff', { p: [0, 9, 12.2], r: [Math.PI / 2, 0, 0], m: 'glow', k: 1.6 });
    return 13;
  },
  christ(k) {
    k.add(cone(16, 16, 9), '#4f8a45', { p: [0, 8, 0] }); k.add(box(3, 3, 3), STONE, { p: [0, 17.5, 0] });
    k.add(cyl(1.1, 1.6, 9, 10), WHITE, { p: [0, 23.5, 0] }); k.add(box(13, 1.2, 1.2), WHITE, { p: [0, 26.5, 0] }); k.add(sph(0.9, 8, 6), WHITE, { p: [0, 28.8, 0] });
    return 16;
  },
  obelisk(k) {
    k.add(box(7, 2, 7), STONE, { p: [0, 1, 0] }); k.add(cyl(1.4, 2.1, 30, 4), WHITE, { p: [0, 17, 0], r: [0, Math.PI / 4, 0] });
    k.add(cone(1.45, 3, 4), WHITE, { p: [0, 33.5, 0], r: [0, Math.PI / 4, 0] }); k.add(sph(0.4, 6, 4), PAL.tomato, { p: [0, 35.3, 0], m: 'glow', k: 3 });
    return 4;
  },
  clocktower(k) {
    const sand = '#d9c38a';
    k.add(box(8, 34, 8), sand, { p: [0, 17, 0] }); k.add(box(9, 7, 9), sand, { p: [0, 37.5, 0] });
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; k.add(cyl(2.8, 2.8, 0.3, 20), '#fff6e0', { p: [Math.sin(a) * 4.6, 37.5, Math.cos(a) * 4.6], r: [Math.PI / 2, 0, a], m: 'glow', k: 1.3 }); k.add(box(0.25, 2, 0.1), PAL.ink, { p: [Math.sin(a) * 4.8, 38, Math.cos(a) * 4.8], r: [0, a, 0] }); }
    k.add(box(7, 4, 7), sand, { p: [0, 43, 0] }); k.add(cone(5.2, 10, 4), '#3a4a5a', { p: [0, 50, 0], r: [0, Math.PI / 4, 0] }); k.add(sph(0.5, 6, 4), GOLD, { p: [0, 55.4, 0] });
    k.add(box(26, 10, 7), sand, { p: [-17, 5, 0] }); for (let i = 0; i < 5; i++) k.add(cone(0.8, 4, 4), '#3a4a5a', { p: [-28 + i * 5.5, 12, 0] });
    return 16;
  },
  eiffel: k => lattice(k, '#9a7a5a', null, 68),
  redtower: k => lattice(k, '#e8452a', '#fff6e0', 74),
  gate(k) {
    for (const s of [-1, 1]) k.add(box(5, 18, 6), STONE, { p: [s * 6, 9, 0] });
    k.add(box(19, 5, 6.4), STONE, { p: [0, 20.5, 0] }); k.add(box(11, 3, 5), STONE, { p: [0, 24.5, 0] }); k.add(cyl(2, 2.5, 2, 12), STONE, { p: [0, 27, 0] });
    k.add(sph(0.9, 8, 6), PAL.earthOrange, { p: [0, 1, 0], m: 'glow', k: 3 });
    return 10;
  },
  colosseum(k) {
    const c = '#e0cfa8';
    k.add(cyl(13, 13, 1, 24), '#d8c090', { p: [0, 0.5, 0], s: [1, 1, 0.75] });
    for (let i = 0; i < 36; i++) {
      const a = i / 36 * Math.PI * 2, h = i > 8 && i < 15 ? rand(8, 12) : 18;
      k.add(box(3.4, h, 1.6), c, { p: [Math.cos(a) * 16, h / 2, Math.sin(a) * 12], r: [0, -a + Math.PI / 2, 0] });
      for (let r = 0; r < Math.floor(h / 6); r++) k.add(box(1.6, 3, 0.2), '#5a4a5a', { p: [Math.cos(a) * 16.85, 3 + r * 6, Math.sin(a) * 12.65], r: [0, -a + Math.PI / 2, 0] });
    }
    return 17;
  },
  mosque(k, st) {
    const w = '#fff6e0', dome = pick(st.accents);
    k.add(box(18, 8, 18), w, { p: [0, 4, 0] }); k.add(sph(7, 20, 12), dome, { p: [0, 8, 0], s: [1, 0.95, 1], m: 'gloss' }); k.add(cone(0.4, 3, 6), GOLD, { p: [0, 16, 0] });
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; k.add(sph(3.6, 14, 8), dome, { p: [Math.cos(a) * 7, 8, Math.sin(a) * 7], m: 'gloss' }); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      k.add(cyl(0.9, 1.1, 26, 10), w, { p: [sx * 11, 13, sz * 11] }); k.add(cyl(1.6, 1.6, 0.6, 10), w, { p: [sx * 11, 20, sz * 11] });
      k.add(cone(1.1, 4, 10), dome, { p: [sx * 11, 28, sz * 11] }); k.add(sph(0.35, 6, 4), PAL.poster, { p: [sx * 11, 21, sz * 11], m: 'glow', k: 2.4 });
    }
    return 13;
  },
  onion(k) {
    k.add(box(20, 4, 20), '#c4502e', { p: [0, 2, 0] });
    k.add(cyl(3, 3.5, 22, 8), '#e8dcc0', { p: [0, 15, 0] }); k.add(sph(3.3, 14, 10), GOLD, { p: [0, 28, 0], s: [1, 1.3, 1], m: 'gloss' }); k.add(cone(1.2, 4, 8), GOLD, { p: [0, 33, 0] });
    const cols = ['#ff5a4f', '#2fb38a', '#3d7be0', '#ffd23f'];
    [[-7, -7], [7, -7], [-7, 7], [7, 7]].forEach(([x, z], i) => {
      k.add(cyl(2.2, 2.5, 14, 8), '#e8dcc0', { p: [x, 11, z] }); k.add(sph(2.6, 12, 8), cols[i], { p: [x, 19.5, z], s: [1, 1.3, 1], m: 'gloss' });
      k.add(new THREE.TorusGeometry(2.3, 0.3, 4, 12), cols[(i + 1) % 4], { p: [x, 19.5, z], r: [Math.PI / 2, 0, 0] }); k.add(cone(0.9, 3, 8), GOLD, { p: [x, 23.5, z] });
    });
    return 11;
  },
  pyramids(k) {
    const c = '#e3c27a';
    k.add(cone(13, 17, 4), c, { p: [-3, 8.5, -3], r: [0, Math.PI / 4, 0] }); k.add(cone(10, 13, 4), c, { p: [9, 6.5, 6], r: [0, Math.PI / 4, 0] }); k.add(cone(6, 8, 4), c, { p: [-10, 4, 10], r: [0, Math.PI / 4, 0] });
    k.add(box(3, 3, 9), '#d8b060', { p: [10, 1.5, -10] }); k.add(box(2.4, 3, 2.4), '#d8b060', { p: [10, 4, -5.5] });
    return 16;
  },
  mesa: () => 0,   // Table Mountain is a backdrop (city builder)
  burj(k) {
    for (let i = 0; i < 9; i++) { const r = 5.2 - i * 0.5; k.add(cyl(r, r + 0.4, 12, 6), '#a0d8ff', { p: [0, 6 + i * 12, 0], m: 'gloss' }); k.add(cyl(r + 0.05, r + 0.05, 0.4, 6), COOL, { p: [0, 12 + i * 12, 0], m: 'glow', k: 1.4 }); }
    k.add(cyl(0.6, 0.15, 22, 6), '#c8d0e8', { p: [0, 119, 0] }); k.add(sph(0.5, 6, 4), PAL.tomato, { p: [0, 130.4, 0], m: 'glow', k: 3 });
    return 6;
  },
  parliament(k) {
    const c = '#d8cfc0';
    k.add(cyl(17, 17, 0.4, 24), '#3d7be0', { p: [0, 0.2, 0] });
    k.add(cyl(7, 7, 22, 8), c, { p: [0, 11, 0] });
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, x = Math.cos(a) * 10, z = Math.sin(a) * 10;
      k.add(box(7, 14 + (i % 2) * 4, 5), c, { p: [x, 7 + (i % 2) * 2, z], r: [0, -a, 0] });
      k.add(cyl(1.8, 1.8, 0.4, 16), '#3a3550', { p: [Math.cos(a) * 12.6, 9, Math.sin(a) * 12.6], r: [Math.PI / 2, 0, -a + Math.PI / 2] });
    }
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; k.add(cone(1.4, 2.4, 3), '#3a3550', { p: [Math.cos(a) * 7.1, 16, Math.sin(a) * 7.1], r: [Math.PI / 2, 0, -a + Math.PI / 2] }); }
    return 17;
  },
  temple(k) {
    for (const [r, y] of [[14, 0.75], [11, 2.25], [8.5, 3.75]] as const) k.add(cyl(r, r, 1.5, 24), WHITE, { p: [0, y, 0] });
    k.add(cyl(6, 6, 8, 16), '#c4302e', { p: [0, 8.5, 0] });
    k.add(cone(8, 3, 24), '#2f5fa8', { p: [0, 13.8, 0] }); k.add(cyl(5, 5, 3, 16), '#c4302e', { p: [0, 16.5, 0] });
    k.add(cone(6.5, 3, 24), '#2f5fa8', { p: [0, 19.3, 0] }); k.add(cyl(3.6, 3.6, 2.5, 16), '#c4302e', { p: [0, 21.8, 0] });
    k.add(cone(5, 4.5, 24), '#2f5fa8', { p: [0, 25.2, 0] }); k.add(sph(0.9, 8, 6), GOLD, { p: [0, 28.2, 0], m: 'gloss' });
    return 14;
  },
  pearl(k) {
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; k.add(cyl(0.9, 0.9, 20, 8), '#c8d0e8', { p: [Math.cos(a) * 4, 9, Math.sin(a) * 4], r: [Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18] }); }
    k.add(cyl(1.5, 1.5, 62, 10), '#c8d0e8', { p: [0, 31, 0] });
    k.add(sph(6, 18, 12), '#ff6fb5', { p: [0, 18, 0], m: 'gloss' }); k.add(sph(4.5, 16, 10), '#ff6fb5', { p: [0, 46, 0], m: 'gloss' }); k.add(sph(2, 10, 8), '#ff6fb5', { p: [0, 60, 0], m: 'gloss' });
    k.add(cyl(0.4, 0.3, 12, 6), '#c8d0e8', { p: [0, 68, 0] }); k.add(sph(0.45, 6, 4), PAL.tomato, { p: [0, 74.4, 0], m: 'glow', k: 3 });
    return 7;
  },
  castle(k) {
    k.add(box(22, 8, 22), '#8a8aa0', { p: [0, 4, 0] }); let y = 8, w = 16;
    for (let i = 0; i < 5; i++) { k.add(box(w, 4, w), WHITE, { p: [0, y + 2, 0] }); k.add(box(w + 4, 0.6, w + 4), '#2f8a7a', { p: [0, y + 4.3, 0] }); k.add(cone((w + 4) * 0.7, 1.6, 4), '#2f8a7a', { p: [0, y + 5.4, 0], r: [0, Math.PI / 4, 0] }); y += 5; w *= 0.8; }
    for (const s of [-1.6, 1.6]) k.add(cone(0.6, 2, 6), GOLD, { p: [s, y + 1.5, 0], r: [0, 0, s * 0.4] });
    return 12;
  },
  stupa(k) {
    for (let i = 0; i < 4; i++) k.add(box(20 - i * 4, 2, 20 - i * 4), WHITE, { p: [0, 1 + i * 2, 0] });
    k.add(sph(6, 18, 12), GOLD, { p: [0, 10, 0], s: [1, 0.85, 1], m: 'gloss' }); k.add(cone(3, 22, 12), GOLD, { p: [0, 24, 0], m: 'gloss' }); k.add(sph(0.6, 8, 6), PAL.poster, { p: [0, 35.5, 0], m: 'glow', k: 2.4 });
    return 10;
  },
  monas(k) {
    k.add(box(18, 4, 18), WHITE, { p: [0, 2, 0] }); k.add(cyl(1.6, 2.6, 34, 4), WHITE, { p: [0, 21, 0], r: [0, Math.PI / 4, 0] });
    k.add(cyl(2.2, 1.2, 2, 8), '#5a5f80', { p: [0, 39, 0] }); k.add(sph(1.6, 10, 8), GOLD, { p: [0, 41.5, 0], s: [1, 1.6, 1], m: 'glow', k: 1.6 });
    return 9;
  },
  marina(k) {
    for (const x of [-12, 0, 12]) k.add(box(6, 40, 8), '#c8e6ff', { p: [x, 20, 0], m: 'gloss' });
    k.add(box(36, 2, 8), '#eef0ff', { p: [0, 41, 0] }); k.add(box(38, 0.6, 0.4), COOL, { p: [0, 40, 4.1], m: 'glow', k: 1.6 });
    for (let y = 5; y < 40; y += 6) for (const x of [-12, 0, 12]) k.add(box(6.2, 0.4, 8.2), COOL, { p: [x, y, 0], m: 'glow', k: 1.2 });
    return 18;
  },
  opera(k) {
    k.add(box(30, 3, 20), '#e8dcc0', { p: [0, 1.5, 0] });
    [[-8, 9, 0.5], [-1, 12, 0.4], [6, 10, 0.5], [11, 7, 0.6]].forEach(([x, s, t]) => k.add(sph(s, 16, 10), '#f8f4ec', { p: [x, 3, 0], s: [0.45, 1.3, 1], r: [0, 0, t], m: 'gloss' }));
    return 15;
  },
  ferris(k) {
    k.add(new THREE.TorusGeometry(14, 0.6, 6, 40), '#eef0ff', { p: [0, 17, 0], m: 'metal' });
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; k.add(box(0.3, 14, 0.3), '#eef0ff', { p: [Math.cos(a) * 7, 17 + Math.sin(a) * 7, 0], r: [0, 0, a + Math.PI / 2] }); k.add(sph(1, 8, 6), ['#ff6fb5', '#5fe8ff', '#ffd23f', '#9cff3f'][i % 4], { p: [Math.cos(a) * 14, 17 + Math.sin(a) * 14, 0], m: 'glow', k: 1.8 }); }
    for (const s of [-1, 1]) k.add(box(1, 19, 1), '#c8d0e8', { p: [s * 5, 8.5, 0], r: [0, 0, s * 0.28] });
    return 15;
  },
};
