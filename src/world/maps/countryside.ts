// The countryside used for abduction nights: a town at a crossroads, three farms, an army base,
// forests and traffic. Its look (ground, trees, animals, houses, sky) comes from the region's biome
// ("Moonlit Toybox", docs/ART_STYLE.md §2, §4, §5).
import * as THREE from 'three';
import { G, track } from '../../game/state';
import { CFG } from '../../data/balance';
import { BIOMES } from '../../data/biomes';
import type { Biome } from '../../data/earth';
import { Kit } from '../../gfx/kit';
import { TOON_RAMP } from '../../gfx/toon';
import { PAL } from '../../gfx/palette';
import { addHouse, addBarn, addSilo, addWaterTower, addStreetLight, addFence, addBarracks, addFloodlight } from '../../gfx/models';
import { StaticBatch, CAR_MODELS, ARTIFACTS } from '../../core/assets';
import { V3, chance, pick, rand, seeded } from '../../core/util';
import { clearWorld, nightSky, groundCanvas, addGround } from './common';
import { spawnHuman, spawnAnimal, spawnHaybale, spawnVehicle, spawnArtifact, spawnProp, lane } from '../civilians';
import type { Pen } from '../civilians';
import { spawnTank, brainGuard, WEAPON } from '../military';
import { instance } from '../../core/assets';
import { pushOut } from '../entity';

const ROAD_Z = 0, ROAD_X = 30;
const PENS: Record<string, Pen> = {
  A: { minX: -140, maxX: -104, minZ: -62, maxZ: -34 }, B: { minX: -150, maxX: -112, minZ: 30, maxZ: 58 },
  P: { minX: -92, maxX: -68, minZ: 96, maxZ: 114 }, C: { minX: 92, maxX: 146, minZ: -142, maxZ: -114 },
};
const BASE = { minX: 96, maxX: 166, minZ: 82, maxZ: 162 };
const BASE_FENCE = '#8a90b8';   // steel fence round the army base (farm fences are wooden PAL.fence)
export interface CountryOpts { biome: Biome; seed: number; level: number; tutorial?: boolean; title?: boolean }

export function buildCountryside(o: CountryOpts) {
  clearWorld();
  const B = BIOMES[o.biome], half = CFG.mapHalf; G.mapHalf = half; G.ufoY = CFG.ufoAltitude;
  const S = B.sky; nightSky(S.top, S.horizon, S.fog, S.density, { bottom: S.bottom, biome: o.biome });   // §4 sky row + light rig
  const houses: THREE.Vector3[] = [];
  seeded(o.seed, () => {
    const cnv = groundCanvas(2048, half, g => {
      g.rect(-half, -half, half, half, B.ground);
      g.blotches(3500, B.blotches, 4, 26, 0.35);
      const [f1, f2, f3] = B.fields;
      g.field(-160, -152, -64, -98, f1[0], f1[1], true); g.field(-58, -152, -8, -92, f2[0], f2[1], false);
      g.field(-58, 30, -2, 82, f3[0], f3[1], true); g.field(-58, 90, -2, 150, f1[0], f1[1], false); g.field(60, -152, 160, -150, f2[0], f2[1], false);
      for (const p of Object.values(PENS)) g.rect(p.minX - 2, p.minZ - 2, p.maxX + 2, p.maxZ + 2, B.pasture);
      g.x.strokeStyle = 'rgba(26,16,51,0.3)'; g.x.lineWidth = 2.2 * g.s;   // a crop circle, of course
      for (const r of [5, 9, 13]) { g.x.beginPath(); g.x.arc(g.P(-112), g.P(-125), r * g.s, 0, Math.PI * 2); g.x.stroke(); }
      if (B.water) { g.circle(-28, -58, 15, B.shore); g.circle(-28, -58, 13, B.water); }   // pond shore (the water is a mesh on top)
      g.rect(42, 14, 70, 40, B.plaza); g.rect(BASE.minX, BASE.minZ, BASE.maxX, BASE.maxZ, B.base);
      g.circle(150, 146, 8, PAL.streetPole); g.x.fillStyle = PAL.cream; g.x.font = `bold ${Math.round(9 * g.s)}px sans-serif`; g.x.textAlign = 'center'; g.x.textBaseline = 'middle'; g.x.fillText('H', g.P(150), g.P(146));
      g.road(-120, -20, 26, -20, 4, B.dirt, null); g.road(-100, 70, 26, 70, 4, B.dirt, null); g.road(100, -90, 100, -6, 4, B.dirt, null); g.road(36, 100, BASE.minX, 100, 7, B.road, null);
      g.road(-half, ROAD_Z, half, ROAD_Z, 10, B.road); g.road(ROAD_X, -half, ROAD_X, half, 10, B.road);   // asphalt + poster lane dashes
      // Painted kerbs: a thin plum line along both edges of the main roads (toy-diorama edges; the ground itself
      // is never inked), broken at the crossroads and where a side road joins. Gaps are [from, to], ascending.
      g.x.fillStyle = 'rgba(26,16,51,0.4)'; const kw = Math.max(1, g.s * 0.35);
      const kerb = (horiz: boolean, at: number, gaps: [number, number][]) => {
        let a = -half;
        for (const [g0, g1] of [...gaps, [half, half]]) {
          if (horiz) g.x.fillRect(g.P(a), g.P(at) - kw / 2, g.P(g0) - g.P(a), kw); else g.x.fillRect(g.P(at) - kw / 2, g.P(a), kw, g.P(g0) - g.P(a));
          a = g1;
        }
      };
      kerb(true, ROAD_Z - 5, [[ROAD_X - 5, ROAD_X + 5], [98, 102]]); kerb(true, ROAD_Z + 5, [[ROAD_X - 5, ROAD_X + 5]]);
      kerb(false, ROAD_X - 5, [[-22, -18], [ROAD_Z - 5, ROAD_Z + 5], [68, 72]]); kerb(false, ROAD_X + 5, [[ROAD_Z - 5, ROAD_Z + 5], [96.5, 103.5]]);
    });
    addGround(cnv, half, B.outer);
    if (B.water) {
      // Pond (ice in the snow): toon ramp like the ground, no rim and no ink (§4: lakes are MeshToon, ground is never inked).
      const wgeo = new THREE.CircleGeometry(13.5, 40).rotateX(-Math.PI / 2), wmat = new THREE.MeshToonMaterial({ color: B.water, gradientMap: TOON_RAMP });
      const pond = new THREE.Mesh(wgeo, wmat); pond.position.set(-28, 0.06, -58); pond.userData.noInk = true; G.world.add(pond); track<{ dispose(): void }>(wgeo, wmat);
      G.obstacles.push({ minX: -38, maxX: -18, minZ: -68, maxZ: -48 });
    }
    const k = new Kit(), sb = new StaticBatch(), ob = G.obstacles;
    // ---- town ----
    const lots: [number, number, number][] = [];
    for (let x = -18; x <= 92; x += 15) for (const side of [-1, 1]) lots.push([x, ROAD_Z + side * 14, side > 0 ? Math.PI : 0]);
    for (let z = -62; z <= 64; z += 15) for (const side of [-1, 1]) if (Math.abs(z) > 16) lots.push([ROAD_X + side * 14, z, side > 0 ? -Math.PI / 2 : Math.PI / 2]);
    for (const [x, z, ry] of lots) {
      if (Math.abs(x - ROAD_X) < 12 && Math.abs(z - ROAD_Z) < 20) continue;
      if (x > 40 && x < 72 && z > 12 && z < 42) continue;
      if (chance(0.15)) continue;
      if (Math.abs(x - ROAD_X) < 40 && Math.abs(z) < 20 && chance(0.45)) {           // shops near the crossroads (Kenney city kit)
        const id = pick(['building_c', 'building_a', 'building_d']); sb.add(id, x, 0, z, ry + Math.PI, 1); ob.push({ minX: x - 4.5, maxX: x + 4.5, minZ: z - 4.5, maxZ: z + 4.5 });
      } else ob.push(addHouse(k, x, z, ry, B.houseWalls, B.roofs));
      houses.push(new V3(x + Math.sin(ry) * 4.5, 0, z + Math.cos(ry) * 4.5));
    }
    for (let x = -20; x <= 95; x += 18) { addStreetLight(k, x, ROAD_Z + 6.5, Math.PI); addStreetLight(k, x + 9, ROAD_Z - 6.5, 0); }
    for (let z = -60; z <= 62; z += 18) if (Math.abs(z) > 10) { addStreetLight(k, ROAD_X + 6.5, z, -Math.PI / 2); addStreetLight(k, ROAD_X - 6.5, z + 9, Math.PI / 2); }
    ob.push(addWaterTower(k, 56, 27));
    // ---- farms ----
    const farm = (hx: number, hz: number, bx: number, bz: number, sx: number, sz: number, p: Pen) => {
      ob.push(addHouse(k, hx, hz, rand(0, 6), B.houseWalls, B.roofs, { w: 8, d: 7 })); houses.push(new V3(hx, 0, hz + 5));
      ob.push(addBarn(k, bx, bz, rand(-0.3, 0.3))); ob.push(addSilo(k, sx, sz));
      addFence(k, p.minX - 2, p.minZ - 2, p.maxX + 2, p.minZ - 2); addFence(k, p.maxX + 2, p.minZ - 2, p.maxX + 2, p.maxZ + 2);
      addFence(k, p.maxX + 2, p.maxZ + 2, p.minX - 2, p.maxZ + 2); addFence(k, p.minX - 2, p.maxZ + 2, p.minX - 2, p.minZ - 2);
    };
    farm(-92, -78, -122, -88, -104, -100, PENS.A); farm(-96, 78, -128, 92, -142, 76, PENS.B); farm(112, -80, 140, -96, 124, -62, PENS.C);
    // ---- army base ----
    if (!o.tutorial) {
      ob.push(addBarracks(k, 116, 112, 0)); ob.push(addBarracks(k, 134, 112, 0));
      sb.add('hangar', 150, 0, 132, Math.PI, 1); ob.push({ minX: 139, maxX: 161, minZ: 122, maxZ: 142 });
      sb.add('satellite_dish', 154, 0, 94, rand(0, 6), 1); ob.push({ minX: 150, maxX: 158, minZ: 90, maxZ: 98 });
      addFence(k, BASE.minX, BASE.minZ, BASE.maxX, BASE.minZ, BASE_FENCE); addFence(k, BASE.maxX, BASE.minZ, BASE.maxX, BASE.maxZ, BASE_FENCE);
      addFence(k, BASE.maxX, BASE.maxZ, BASE.minX, BASE.maxZ, BASE_FENCE); addFence(k, BASE.minX, BASE.maxZ, BASE.minX, 106, BASE_FENCE);
      for (const [x, z] of [[100, 86], [162, 86], [100, 158], [162, 158]]) addFloodlight(k, x, z, Math.atan2(130 - x, 120 - z));
    }
    // ---- forest + scatter (CC0 trees, drawn instanced) ----
    const blocked = (x: number, z: number) =>
      Math.abs(z - ROAD_Z) < 10 || Math.abs(x - ROAD_X) < 10 || (x > -25 && x < 98 && z > -70 && z < 70) ||
      (x > -165 && x < 0 && z > -156 && z < -88) || (x > -62 && x < 2 && z > 26 && z < 154) || (x > 56 && x < 164 && z > -156 && z < -108) ||
      (x > BASE.minX - 6 && x < BASE.maxX + 6 && z > BASE.minZ - 6 && z < BASE.maxZ + 6) || ob.some(f => x > f.minX - 4 && x < f.maxX + 4 && z > f.minZ - 4 && z < f.maxZ + 4) ||
      Object.values(PENS).some(p => x > p.minX - 5 && x < p.maxX + 5 && z > p.minZ - 5 && z < p.maxZ + 5) || Math.hypot(x + 28, z + 58) < 17 ||
      (Math.abs(z - 100) < 6 && x > 30 && x < BASE.minX) || (Math.abs(z + 20) < 5 && x > -125 && x < 30) || (Math.abs(z - 70) < 5 && x > -105 && x < 30) || (Math.abs(x - 100) < 5 && z > -95 && z < 0);
    let placed = 0;
    for (let i = 0; i < 4000 && placed < 560; i++) {
      const edge = i % 3 === 0, x = edge ? rand(-half - 30, half + 30) : rand(-half, half), z = edge ? pick([-1, 1]) * rand(half - 18, half + 40) : rand(-half, half);
      const [xx, zz] = edge && chance(0.5) ? [z, x] : [x, z];
      if (blocked(xx, zz)) continue;
      if (Math.abs(xx) < half - 20 && Math.abs(zz) < half - 20 && chance(0.55)) continue;
      sb.add(pick(B.trees), xx, 0, zz, rand(0, 6), rand(B.treeScale[0], B.treeScale[1])); placed++;
    }
    for (let i = 0; i < 180; i++) { const x = rand(-half, half), z = rand(-half, half); if (!blocked(x, z)) sb.add(pick(B.extras), x, 0, z, rand(0, 6), rand(0.7, 1.3)); }
    G.world.add(k.build(g => G.disposables.push(g)));
    G.world.add(sb.build());
  });
  // ---- traffic + entry points for the army ----
  const lanes = [lane(-half - 15, ROAD_Z + 2.4, half + 15, ROAD_Z + 2.4), lane(half + 15, ROAD_Z - 2.4, -half - 15, ROAD_Z - 2.4),
                 lane(ROAD_X + 2.4, -half - 15, ROAD_X + 2.4, half + 15), lane(ROAD_X - 2.4, half + 15, ROAD_X - 2.4, -half - 15)];
  G.entries = [{ x: -half + 6, z: ROAD_Z }, { x: half - 6, z: ROAD_Z }, { x: ROAD_X, z: -half + 6 }, { x: ROAD_X, z: half - 6 }, { x: 100, z: 100 }];
  G.houses = houses;
  const busy = o.title ? 0.6 : o.tutorial ? 0.5 : 1;
  const townN = Math.round((24 + Math.min(10, o.level * 2)) * busy);
  for (let i = 0; i < townN; i++) {
    const h = pick(houses.slice(0, -3)), e = spawnHuman(h.x + rand(-8, 8), h.z + rand(-8, 8), 'civ', { home: chance(0.35) ? h : null });
    e.anchor = h.clone(); pushOut(e.pos, 0.6);
  }
  for (let i = 0; i < (o.tutorial ? 0 : 2); i++) { const s = spawnHuman(56 + rand(-10, 10), 27 + rand(-12, 12), 'scientist'); s.anchor = new V3(56, 0, 27); pushOut(s.pos, 0.6); }
  for (const [x, z] of [[-96, -68], [-100, 88], [108, -70], [-80, 70], [-120, -40], [118, -120]]) for (let i = 0; i < 2; i++) { const e = spawnHuman(x + rand(-6, 6), z + rand(-6, 6), 'farmer'); e.anchor = new V3(x, 0, z); }
  const animals = B.farm, fill = (pen: Pen, n: number) => { for (let i = 0; i < n; i++) spawnAnimal(pick(animals), rand(pen.minX, pen.maxX), rand(pen.minZ, pen.maxZ), pen); };
  fill(PENS.A, 11); fill(PENS.B, 9); fill(PENS.P, 12); fill(PENS.C, 11);
  if (o.tutorial) { for (let i = 0; i < 3; i++) spawnAnimal('cow', rand(-60, -50), rand(30, 40), { minX: -66, maxX: -44, minZ: 26, maxZ: 46 }); }
  const wildPen = { minX: -half + 20, maxX: half - 20, minZ: -half + 20, maxZ: half - 20 };
  for (let i = 0; i < 6; i++) spawnAnimal(pick(B.wild), pick([-1, 1]) * rand(110, 160), rand(-150, 150), wildPen);
  const townPen = { minX: -20, maxX: 90, minZ: -60, maxZ: 60 };
  for (let i = 0; i < 4; i++) spawnAnimal(i < 3 ? 'dog' : 'cat', rand(-15, 85), pick([-1, 1]) * rand(18, 40), townPen);
  for (const [bx, bz] of [[-122, -72], [-128, 108], [140, -78]]) for (let i = 0; i < 5; i++) spawnHaybale(bx + rand(-9, 9), bz + rand(4, 9));
  if (o.biome === 'temperate' || o.biome === 'tropical') for (let i = 0; i < 6; i++) spawnProp('pumpkin', instance(pick(['pumpkin', 'watermelon'])).root, rand(-56, -6), rand(32, 80), { r: 0.6, hh: 0.4, shadow: 1.2 });
  if (!o.title) for (let i = 0; i < (o.tutorial ? 0 : 3); i++) { const h = pick(houses); spawnArtifact(pick(ARTIFACTS), h.x + rand(-6, 6), h.z + rand(4, 8)); }
  lanes.forEach(ln => { for (let i = 0; i < Math.round(4 * busy); i++) spawnVehicle('car', pick(CAR_MODELS), ln, i * ln.len / 4 + rand(0, 30), { lootKind: 'car' }); });
  for (const [x0, z0, x1, z1] of [[-150, -110, -70, -110], [-50, 50, -10, 50], [-50, 120, -10, 120]]) {
    const a = lane(x0, z0, x1, z1, false), b = lane(x1, z1, x0, z0, false); a.next = b; b.next = a;
    spawnVehicle('tractor', 'tractor', a, rand(0, a.len), { cruise: 3.5 });
  }
  if (!o.title && !o.tutorial) {
    spawnTank(114, 146, true); spawnTank(130, 146, true);
    for (const [x, z] of [[102, 98], [104, 104], [126, 98], [146, 128]]) {
      const s = spawnHuman(x, z, 'soldier', { team: 'earth', brain: brainGuard, hp: 20, mini: '#ff6a5a' }); s.weapon = WEAPON.rifle; s.zap = true;
    }
  }
}
