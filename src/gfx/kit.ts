// Model kit: build models from boxes/cylinders/spheres, each part with its own colour,
// merged into one mesh per material (fast to draw). Every opaque part is toon shaded and
// gets an ink outline automatically (docs/ART_STYLE.md §4); glow parts are never inked.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { _c1, _e1, _m1, _q1, _v1, _v2 } from '../core/util';
import { toonMaterial, inkify, ensureOnormal, type InkOpts } from './toon';

export const MAT = {
  std: toonMaterial({ vertexColors: true }),                       // matte Earth side: ramp + soft rim
  metal: toonMaterial({ vertexColors: true, variant: 'metal' }),   // ramp + rim + small hard glint
  gloss: toonMaterial({ vertexColors: true, variant: 'gloss' }),   // alien side: bigger glint, stronger rim
  glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),   // HDR colour (k > 1 blooms)
};
type MatKey = keyof typeof MAT;
export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt: number, rb: number, h: number, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg);
export const sph = (r: number, ws = 10, hs = 7) => new THREE.SphereGeometry(r, ws, hs);
export const cone = (r: number, h: number, seg = 7) => new THREE.ConeGeometry(r, h, seg);
export const ico = (r: number, d = 0) => new THREE.IcosahedronGeometry(r, d);
export const lathe = (pts: [number, number][], seg: number) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
export const unitPrism = () => { const g = new THREE.CylinderGeometry(1, 1, 1, 3, 1); g.rotateX(-Math.PI / 2); g.scale(1 / 1.732, 1 / 1.5, 1); g.translate(0, 0.5 / 1.5, 0); return g; };
export const unitPyramid = () => new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0);

interface PartOpts { p?: [number, number, number]; r?: [number, number, number]; s?: number | [number, number, number]; m?: MatKey; k?: number }
export class Kit {
  lists: Record<MatKey, THREE.BufferGeometry[]> = { std: [], metal: [], gloss: [], glow: [] };
  base = new THREE.Matrix4();
  /** Move the "pen": following parts are placed relative to this point. */
  at(x = 0, y = 0, z = 0, ry = 0, s = 1) { this.base.compose(_v1.set(x, y, z), _q1.setFromEuler(_e1.set(0, ry, 0)), _v2.set(s, s, s)); return this; }
  add(geo: THREE.BufferGeometry, color: string, o: PartOpts = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo; if (g !== geo) geo.dispose();
    const p = o.p || [0, 0, 0], r = o.r || [0, 0, 0], s = o.s === undefined ? 1 : o.s;
    _m1.compose(_v1.set(p[0], p[1], p[2]), _q1.setFromEuler(_e1.set(r[0], r[1], r[2])), Array.isArray(s) ? _v2.set(s[0], s[1], s[2]) : _v2.set(s, s, s));
    _m1.premultiply(this.base); g.applyMatrix4(_m1);
    for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a);
    _c1.set(color); const k = o.k || 1, n = g.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = _c1.r * k; arr[i * 3 + 1] = _c1.g * k; arr[i * 3 + 2] = _c1.b * k; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.lists[o.m || 'std'].push(g);
    return this;
  }
  geos() {
    const out: Partial<Record<MatKey, THREE.BufferGeometry>> = {};
    for (const m of Object.keys(this.lists) as MatKey[]) {
      const L = this.lists[m]; if (!L.length) continue;
      out[m] = L.length === 1 ? L[0] : mergeGeometries(L, false);
      if (L.length > 1) L.forEach(g => g.dispose());
      out[m].clearGroups(); out[m].computeBoundingSphere(); this.lists[m] = [];   // a lone primitive keeps its face groups otherwise
      if (m !== 'glow') ensureOnormal(out[m]);   // smoothed outline normals, once per merged geometry
    }
    return out;
  }
  /**
   * track: geometry belongs to the current world and is freed when the world is cleared.
   * ink: outline options (e.g. { px: 2.5, fade: false } for the mothership), or false for no outline.
   */
  build(track?: (g: THREE.BufferGeometry) => void, ink: InkOpts | false = {}) { return meshesFrom(this.geos(), track, ink); }
}
export function meshesFrom(geos: Partial<Record<MatKey, THREE.BufferGeometry>>, track?: (g: THREE.BufferGeometry) => void, ink: InkOpts | false = {}) {
  const grp = new THREE.Group();
  for (const m of Object.keys(geos) as MatKey[]) { grp.add(new THREE.Mesh(geos[m], MAT[m])); track?.(geos[m]); }
  if (ink) inkify(grp, ink);   // std / metal / gloss parts only (glow is MeshBasic and skipped)
  return grp;
}
const GEO_CACHE = new Map<string, Partial<Record<MatKey, THREE.BufferGeometry>>>();
/** Build once, reuse forever (shared geometry). `ink` as in Kit.build(). */
export function cachedModel(key: string, fn: (k: Kit) => void, ink: InkOpts | false = {}) {
  if (!GEO_CACHE.has(key)) { const k = new Kit(); fn(k); GEO_CACHE.set(key, k.geos()); }
  return meshesFrom(GEO_CACHE.get(key), undefined, ink);
}

// Toon blob shadow under things so they look grounded: a hard plum oval, solid to 78% of the
// radius and gone at 86% (§4 "Blob shadows").
const shadowTex = (() => {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(26,16,51,0.42)'); g.addColorStop(0.78, 'rgba(26,16,51,0.42)'); g.addColorStop(0.86, 'rgba(26,16,51,0)'); g.addColorStop(1, 'rgba(26,16,51,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false });
export function blobShadow(size: number) { const m = new THREE.Mesh(shadowGeo, shadowMat); m.scale.set(size, 1, size); m.position.y = 0.04; m.renderOrder = -1; return m; }
