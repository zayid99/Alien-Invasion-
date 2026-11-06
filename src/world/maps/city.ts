// The invasion map: a 7 × 6 block city in its region's architecture style, with its landmark, parks, the defense
// HQ plaza, three shield-pylon plazas and destructible buildings. "Moonlit Toybox" toon + ink look.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, track } from '../../game/state';
import { Kit, cyl } from '../../gfx/kit';
import { addStreetLight } from '../../gfx/models';
import { StaticBatch, CAR_MODELS } from '../../core/assets';
import { chance, pick, rand, seeded } from '../../core/util';
import { clearWorld, nightSky, groundCanvas, addGround } from './common';
import { toonMaterial, withCollapse, collapseInk, ensureOnormal } from '../../gfx/toon';
import { cityLook } from '../../data/cityLooks';
import type { StyleKey } from '../../data/cityLooks';
import { CityGeo, BUILD, LANDMARKS, pickKind, facadeTextures } from './cityStyle';
import type { CityMat, FacadeKey } from './cityStyle';
import { resetCityDamage, addBuilding } from '../cityDamage';
import { PAL, SKY } from '../../gfx/palette';

export const CITY_HALF = 200;
export const CITY_ROADS = [-175, -125, -75, -25, 25, 75, 125, 175];
export const BLOCKS_X = [-150, -100, -50, 0, 50, 100, 150];
export const BLOCKS_Z = [-150, -100, -50, 0, 50, 100];
export const PYLON_SPOTS: [number, number][] = [[-50, 50], [50, 50], [0, -50]];
const LANDMARK_SPOTS: [number, number][] = [[-50, -50], [50, -50], [-100, 0], [100, 0]];
const WARM: StyleKey[] = ['mideast', 'gulf', 'africa'], TROPIC: StyleKey[] = ['latam', 'southasia', 'sea'];
const WATER = '#2a7fd6', SAND = '#e8d39a';
/** Reused between invasions: the facade materials only need compiling once. */
let MATS: Record<CityMat, THREE.Material> = null, CITY_INK: THREE.Material = null;
function cityMats() {
  if (MATS) return MATS;
  const F = facadeTextures(), fac = (k: FacadeKey) => withCollapse(toonMaterial({ map: F[k].map, emissiveMap: F[k].em, emissive: 0xffffff, emissiveIntensity: 1.3, vertexColors: true }));
  MATS = { office: fac('office'), glass: fac('glass'), old: fac('old'), plain: withCollapse(toonMaterial({ vertexColors: true })), glow: withCollapse(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })) };
  CITY_INK = collapseInk();
  return MATS;
}
/**
 * The invasion map for one city: its region's architecture style (data/cityLooks.ts) on a 7 × 6 block grid,
 * its landmark, a beach and sea in the south for coastal cities, and destructible buildings (cityDamage.ts).
 */
export function buildCity(seed: number, size: number, cityId = 'kansas-city', region = 'us-midwest') {
  clearWorld(); resetCityDamage();
  const half = CITY_HALF; G.mapHalf = half; G.ufoY = 27;
  const look = cityLook(cityId, region), st = look.style;
  const S0 = SKY.city, S = WARM.includes(look.key) ? { ...S0, horizon: SKY.desert.horizon } : TROPIC.includes(look.key) ? { ...S0, horizon: SKY.tropical.horizon } : S0;
  nightSky(S.top, S.horizon, S.fog, S.density * 0.8, { bottom: S.bottom, biome: 'city' });
  const mats = cityMats();
  const backdrop = look.landmark === 'bridge' || look.landmark === 'mesa';
  seeded(seed, () => {
    const lm = pick(LANDMARK_SPOTS);
    const special = (bx: number, bz: number) => (bx === 0 && bz === 0) || PYLON_SPOTS.some(([x, z]) => x === bx && z === bz) || (!backdrop && bx === lm[0] && bz === lm[1]);
    const parks = new Set<string>(); while (parks.size < 4) { const k = `${pick(BLOCKS_X)},${pick(BLOCKS_Z)}`; if (!special(+k.split(',')[0], +k.split(',')[1])) parks.add(k); }
    if (backdrop) parks.add(`${lm[0]},${lm[1]}`);
    const cnv = groundCanvas(2048, half, g => {
      g.rect(-half, -half, half, half, PAL.road);
      for (const bx of BLOCKS_X) for (const bz of BLOCKS_Z) {
        g.rect(bx - 19, bz - 19, bx + 19, bz + 19, st.sidewalk);
        g.x.strokeStyle = 'rgba(26,16,51,0.45)'; g.x.lineWidth = Math.max(1, g.s * 0.35);
        g.x.strokeRect(g.P(bx - 19), g.P(bz - 19), g.P(bx + 19) - g.P(bx - 19), g.P(bz + 19) - g.P(bz - 19));
        g.rect(bx - 17, bz - 17, bx + 17, bz + 17, special(bx, bz) ? st.plaza : parks.has(`${bx},${bz}`) ? st.park : st.block);
        if (special(bx, bz)) for (let r = 4; r < 17; r += 4) { g.x.strokeStyle = 'rgba(255,255,255,0.14)'; g.x.lineWidth = 2; g.x.beginPath(); g.x.arc(g.P(bx), g.P(bz), r * g.s, 0, 7); g.x.stroke(); }
      }
      for (const r of CITY_ROADS) { g.road(-half, r, half, r, 12, PAL.road, st.lane); g.road(r, -half, r, half, 12, PAL.road, st.lane); }
      // the landing zone in the south; coastal cities end in a beach and the sea
      g.rect(-half, 128, half, half, st.park);
      if (look.coast) { g.rect(-half, 166, half, half, SAND); g.rect(-half, 176, half, half, WATER); for (let i = 0; i < 30; i++) { const x = rand(-half, half); g.rect(x, 182 + rand(0, 14), x + rand(4, 14), 183 + rand(0, 14), '#5fb0f0'); } }
      g.blotches(1200, ['#34314f', '#4a466c'], 3, 12, 0.1);
    });
    addGround(cnv, half, look.coast ? 0x2a7fd6 : 0x34314f);
    const B = new CityGeo(), k = new Kit(), sb = new StaticBatch(), tall = 0.6 + size * 0.14;
    let bid = 0;
    for (const bx of BLOCKS_X) for (const bz of BLOCKS_Z) {
      if (special(bx, bz)) continue;
      if (parks.has(`${bx},${bz}`)) { for (let i = 0; i < 10; i++) sb.add(pick(st.trees), bx + rand(-14, 14), 0, bz + rand(-14, 14), rand(0, 6), rand(3.4, 4.6)); continue; }
      for (const ox of [-8.5, 8.5]) for (const oz of [-8.5, 8.5]) {
        const x = bx + ox, z = bz + oz;
        if (chance(0.08) || bid >= 500) { sb.add(pick(st.trees), x, 0, z, rand(0, 6), 4); continue; }
        B.bid = bid;
        const f = BUILD[pickKind(st)](B, st, { x, z, central: Math.max(0, 1 - Math.hypot(bx, bz) / 220), tall });
        addBuilding(bid++, f.x, f.z, f.w, f.d, f.h);
        G.obstacles.push({ minX: f.x - f.w / 2, maxX: f.x + f.w / 2, minZ: f.z - f.d / 2, maxZ: f.z + f.d / 2 });
      }
      // street trees on the block corners (palm boulevards in hot cities)
      if (chance(0.5)) for (const [cx, cz] of [[-18, -18], [18, 18]]) sb.add(pick(st.trees), bx + cx, 0, bz + cz, rand(0, 6), 3);
    }
    // the landmark (or a backdrop: the bridge along the coast, Table Mountain behind the city)
    if (look.landmark === 'bridge') { k.at(0, 0, 186, 0); LANDMARKS.bridge(k, st); }
    else if (look.landmark === 'mesa') { k.at(0, 0, -320, 0); k.add(cyl(80, 105, 46, 9), '#7a6a8a', { p: [0, 23, 0] }); k.add(cyl(81, 81, 2, 9), '#9a8aaa', { p: [0, 46.5, 0] }); }
    else {
      // landmarks are the city's signature: as big as their block allows (up to 1.7×)
      const probe = new Kit(), r0 = LANDMARKS[look.landmark](probe, st) || 10, sc = Math.min(1.7, 17 / r0);
      probe.geos();   // discard the probe
      k.at(lm[0], 0, lm[1], 0, sc); const r = LANDMARKS[look.landmark](k, st) * sc;
      if (r) G.obstacles.push({ minX: lm[0] - r, maxX: lm[0] + r, minZ: lm[1] - r, maxZ: lm[1] + r });
    }
    k.at(0, 0, 0, 0);
    for (const r of CITY_ROADS) for (const t of [-160, -110, -60, -10, 40, 90]) { addStreetLight(k, r + 7.5, t, -Math.PI / 2); if (r < 128) addStreetLight(k, t + 25, r - 7.5, 0); }
    for (let i = 0; i < 60; i++) { const r = pick(CITY_ROADS), t = rand(-190, 120), side = pick([-1, 1]); if (chance(0.5)) sb.add(pick(CAR_MODELS), r + side * 4.5, 0, t, side > 0 ? 0 : Math.PI, 1); else if (r < 128) sb.add(pick(CAR_MODELS), t, 0, r + side * 4.5, side > 0 ? Math.PI / 2 : -Math.PI / 2, 1); }
    // merge the buildings: one mesh per facade material (+ its collapsing ink hull)
    for (const m of Object.keys(B.lists) as CityMat[]) {
      const L = B.lists[m]; if (!L.length) continue;
      const geo = mergeGeometries(L, false); L.forEach(g => g.dispose()); if (!geo) continue;
      geo.computeBoundingSphere(); track<{ dispose(): void }>(geo);
      const mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]> = new THREE.Mesh(geo, mats[m]);
      if (m !== 'glow') { ensureOnormal(geo); const n = geo.attributes.position.count; geo.clearGroups(); geo.addGroup(0, n, 0); geo.addGroup(0, n, 1); mesh.material = [mats[m], CITY_INK]; }
      mesh.userData.noInk = true; G.world.add(mesh);
    }
    G.world.add(k.build(g => G.disposables.push(g)));
    G.world.add(sb.build());
  });
  G.entries = [{ x: 0, z: -190 }, { x: -190, z: 0 }, { x: 190, z: 0 }];
  return look;
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
