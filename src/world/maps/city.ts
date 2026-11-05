// The invasion map: a city grid with lit towers, parks, a defense HQ plaza and three shield-pylon plazas.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, track } from '../../game/state';
import { CFG } from '../../data/balance';
import { Kit } from '../../gfx/kit';
import { addStreetLight } from '../../gfx/models';
import { StaticBatch, CAR_MODELS } from '../../core/assets';
import { _c1, chance, mulberry32, pick, rand, randi, seeded } from '../../core/util';
import { clearWorld, nightSky, groundCanvas, addGround } from './common';

export const CITY_ROADS = [-125, -75, -25, 25, 75, 125];
export const CITY_BLOCKS = [-100, -50, 0, 50, 100];
export const PYLON_SPOTS: [number, number][] = [[-50, 50], [50, 50], [0, -50]];
let windowTex: { map: THREE.CanvasTexture; em: THREE.CanvasTexture } = null;
function makeWindowTextures() {
  const mk = (emissive: boolean) => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    x.fillStyle = emissive ? '#000' : '#a3a3ad'; x.fillRect(0, 0, 256, 256);
    const r = mulberry32(99);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      const v = r(), lit = v < 0.42, warm = v < 0.3;
      x.fillStyle = emissive ? (lit ? (warm ? '#ffcf80' : '#cfe6ff') : '#000') : (lit ? (warm ? '#ffe2a8' : '#e6f0ff') : '#20263a');
      x.fillRect(i * 32 + 7, j * 32 + 6, 18, 20);
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  windowTex = { map: mk(false), em: mk(true) };
}
function towerGeo(cx: number, cz: number, w: number, d: number, h: number, tint: string) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(cx, h / 2, cz);
  const uv = g.attributes.uv as THREE.BufferAttribute, off = randi(0, 7) / 8, T = 16;
  for (let i = 0; i < uv.count; i++) {
    const face = Math.floor(i / 4);
    if (face === 2 || face === 3) { uv.setXY(i, 0.01, 0.01); continue; }
    uv.setXY(i, uv.getX(i) * (face < 2 ? d : w) / T + off, uv.getY(i) * h / T);
  }
  const col = new Float32Array(uv.count * 3); _c1.set(tint);
  for (let i = 0; i < uv.count; i++) col.set([_c1.r, _c1.g, _c1.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
export function buildCity(seed: number, size: number) {
  clearWorld();
  const half = CFG.cityHalf; G.mapHalf = half; G.ufoY = 27;
  nightSky(0x05081a, 0x3b1f52, 0x120c24, 0.0042);
  if (!windowTex) makeWindowTextures();
  const special = (bx: number, bz: number) => (bx === 0 && bz === 0) || PYLON_SPOTS.some(([x, z]) => x === bx && z === bz);
  seeded(seed, () => {
    const parks = new Set<string>(); while (parks.size < 3) parks.add(`${pick(CITY_BLOCKS)},${pick(CITY_BLOCKS)}`);
    const cnv = groundCanvas(2048, half, g => {
      g.rect(-half, -half, half, half, '#2a2c33');
      for (const bx of CITY_BLOCKS) for (const bz of CITY_BLOCKS) {
        g.rect(bx - 19, bz - 19, bx + 19, bz + 19, '#6b6d72');
        g.rect(bx - 17, bz - 17, bx + 17, bz + 17, special(bx, bz) ? '#7c7f86' : parks.has(`${bx},${bz}`) ? '#2f5a2c' : '#4b4d53');
        if (special(bx, bz)) for (let r = 4; r < 17; r += 4) { g.x.strokeStyle = 'rgba(255,255,255,0.08)'; g.x.lineWidth = 2; g.x.beginPath(); g.x.arc(g.P(bx), g.P(bz), r * g.s, 0, 7); g.x.stroke(); }
      }
      for (const r of CITY_ROADS) { g.road(-half, r, half, r, 12, '#26282e', '#c9b45a'); g.road(r, -half, r, half, 12, '#26282e', '#c9b45a'); }
      g.rect(-half, 128, half, half, '#2c4a2a');
      g.blotches(900, ['#24272d', '#30333a'], 3, 12, 0.25);
    });
    addGround(cnv, half, 0x15161b);
    const geos: THREE.BufferGeometry[] = [], k = new Kit(), sb = new StaticBatch(), tall = 0.5 + size * 0.15;
    for (const bx of CITY_BLOCKS) for (const bz of CITY_BLOCKS) {
      if (special(bx, bz)) continue;
      if (parks.has(`${bx},${bz}`)) { for (let i = 0; i < 9; i++) sb.add(pick(['tree_oak', 'tree_fat', 'tree_pine']), bx + rand(-14, 14), 0, bz + rand(-14, 14), rand(0, 6), rand(3.6, 4.8)); continue; }
      for (const ox of [-8.5, 8.5]) for (const oz of [-8.5, 8.5]) {
        const cx = bx + ox, cz = bz + oz;
        if (chance(0.1)) { sb.add('tree_oak', cx, 0, cz, rand(0, 6), 4.2); continue; }
        if (chance(0.25)) {   // Kenney skyscraper or office block
          const id = chance(0.5 * tall) ? pick(['skyscraper_a', 'skyscraper_b', 'skyscraper_c']) : pick(['building_a', 'building_b', 'building_f', 'building_g', 'building_h']);
          sb.add(id, cx, 0, cz, randi(0, 3) * Math.PI / 2, 1); G.obstacles.push({ minX: cx - 5, maxX: cx + 5, minZ: cz - 5, maxZ: cz + 5 }); continue;
        }
        const w = rand(10, 15), d = rand(10, 15), central = 1 - Math.hypot(bx, bz) / 180, h = (rand(8, 13) + central * rand(4, 10)) * tall;
        geos.push(towerGeo(cx, cz, w, d, h, pick(['#c8ccd6', '#b9b2a6', '#9fb3c8', '#c9b8a8', '#a9b0a0', '#d6d0c4'])));
        G.obstacles.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
        k.at(cx, h, cz, 0);
        if (chance(0.4)) { k.add(new THREE.CylinderGeometry(0.12, 0.12, 4, 4), '#777777', { p: [w * 0.3, 2, -d * 0.3] }); k.add(new THREE.SphereGeometry(0.25, 6, 4), '#ff3030', { p: [w * 0.3, 4.1, -d * 0.3], m: 'glow', k: 4 }); }
      }
    }
    for (const r of CITY_ROADS) for (const t of [-110, -60, -10, 40, 90]) { addStreetLight(k, r + 7.5, t, -Math.PI / 2); addStreetLight(k, t + 25, r - 7.5, 0); }
    for (let i = 0; i < 40; i++) { const r = pick(CITY_ROADS), t = rand(-140, 140), side = pick([-1, 1]); if (chance(0.5)) sb.add(pick(CAR_MODELS), r + side * 4.5, 0, t, side > 0 ? 0 : Math.PI, 1); else sb.add(pick(CAR_MODELS), t, 0, r + side * 4.5, side > 0 ? Math.PI / 2 : -Math.PI / 2, 1); }
    const merged = mergeGeometries(geos, false); geos.forEach(g => g.dispose());
    const bmat = new THREE.MeshStandardMaterial({ map: windowTex.map, emissiveMap: windowTex.em, emissive: 0xffffff, emissiveIntensity: 1.25, vertexColors: true, roughness: 0.75, metalness: 0.1 });
    G.world.add(new THREE.Mesh(merged, bmat)); track<{ dispose(): void }>(merged, bmat);
    G.world.add(k.build(g => G.disposables.push(g)));
    G.world.add(sb.build());
  });
  G.entries = [{ x: 0, z: -140 }, { x: -140, z: 0 }, { x: 140, z: 0 }];
}

// Flow field: for every 3x3 cell, which way leads to the goal around the buildings.
export const FLOW_CELL = 3;
export function blockedGrid() {
  const half = G.mapHalf, n = Math.ceil(half * 2 / FLOW_CELL), blocked = new Uint8Array(n * n);
  for (const o of G.obstacles) {
    const x0 = Math.floor((o.minX - 1 + half) / FLOW_CELL), x1 = Math.floor((o.maxX + 1 + half) / FLOW_CELL), z0 = Math.floor((o.minZ - 1 + half) / FLOW_CELL), z1 = Math.floor((o.maxZ + 1 + half) / FLOW_CELL);
    for (let z = Math.max(0, z0); z <= Math.min(n - 1, z1); z++) for (let x = Math.max(0, x0); x <= Math.min(n - 1, x1); x++) blocked[z * n + x] = 1;
  }
  return { n, half, blocked };
}
export function flowField(goal: { x: number; z: number }, radius: number) {
  const B = (G.inv && G.inv.grid) || blockedGrid(), half = B.half, n = B.n, dist = new Float32Array(n * n).fill(1e9), blocked = B.blocked.slice();
  const q: number[] = []; let head = 0;
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
    const wx = x * FLOW_CELL - half + FLOW_CELL / 2, wz = z * FLOW_CELL - half + FLOW_CELL / 2;
    if (Math.hypot(wx - goal.x, wz - goal.z) < radius) { dist[z * n + x] = 0; blocked[z * n + x] = 0; q.push(z * n + x); }
  }
  const nb = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (head < q.length) {
    const i = q[head++], x = i % n, z = (i / n) | 0, d0 = dist[i];
    for (const [dx, dz, c] of nb) {
      const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= n || zz >= n) continue;
      const j = zz * n + xx; if (blocked[j]) continue;
      if (dx && dz && (blocked[z * n + xx] || blocked[zz * n + x])) continue;
      if (d0 + c < dist[j] - 1e-3) { dist[j] = d0 + c; q.push(j); }
    }
  }
  return { n, dist, half };
}
export function flowDir(F: { n: number; dist: Float32Array; half: number }, pos: { x: number; z: number }, out: THREE.Vector3) {
  const n = F.n, x = Math.min(n - 1, Math.max(0, Math.floor((pos.x + F.half) / FLOW_CELL))), z = Math.min(n - 1, Math.max(0, Math.floor((pos.z + F.half) / FLOW_CELL)));
  let best = F.dist[z * n + x], bx = 0, bz = 0;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dz) continue; const xx = x + dx, zz = z + dz; if (xx < 0 || zz < 0 || xx >= n || zz >= n) continue;
    const v = F.dist[zz * n + xx] + (dx && dz ? 0.01 : 0); if (v < best) { best = v; bx = dx; bz = dz; }
  }
  return out.set(bx, 0, bz).normalize();
}
