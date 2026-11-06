// Destructible city: every building has hit points; shells, missiles, explosions and boss stomps wear it down,
// it smokes and burns, then crumbles (the merged mesh collapses on the GPU, gfx/toon.ts withCollapse).
import * as THREE from 'three';
import { G } from '../game/state';
import { FX, FXC } from '../gfx/fx';
import { SFX } from '../core/audio';
import { COLLAPSE, collapseTexture } from '../gfx/toon';
import { clamp, rand } from '../core/util';

export interface Bld { bid: number; x: number; z: number; hw: number; hd: number; h: number; hp: number; maxHp: number; c: number; falling: boolean; down: boolean; fxT: number }
const CELL = 25;
export const CITY_DMG = { list: [] as Bld[], grid: new Map<number, Bld[]>(), falling: [] as Bld[], destroyed: 0, onCollapse: (_b: Bld) => {} };
const key = (cx: number, cz: number) => (cx + 256) * 1024 + (cz + 256);
const _v = new THREE.Vector3();

export function resetCityDamage() {
  CITY_DMG.list = []; CITY_DMG.grid.clear(); CITY_DMG.falling = []; CITY_DMG.destroyed = 0;
  COLLAPSE.data.fill(0); collapseTexture().needsUpdate = true;
}
export function addBuilding(bid: number, x: number, z: number, w: number, d: number, h: number) {
  const hp = clamp(w * d * h / 16, 140, 1100);
  const b: Bld = { bid, x, z, hw: w / 2, hd: d / 2, h, hp, maxHp: hp, c: 0, falling: false, down: false, fxT: rand(0, 1) };
  CITY_DMG.list.push(b);
  for (let cx = Math.floor((x - b.hw) / CELL); cx <= Math.floor((x + b.hw) / CELL); cx++)
    for (let cz = Math.floor((z - b.hd) / CELL); cz <= Math.floor((z + b.hd) / CELL); cz++) {
      const k = key(cx, cz); let l = CITY_DMG.grid.get(k); if (!l) CITY_DMG.grid.set(k, (l = [])); l.push(b);
    }
  return b;
}
/** The standing building whose volume contains this point, if any. */
export function buildingAt(x: number, y: number, z: number): Bld | null {
  const l = CITY_DMG.grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))); if (!l) return null;
  for (const b of l) if (!b.down && Math.abs(x - b.x) < b.hw && Math.abs(z - b.z) < b.hd && y < b.h * (1 - 0.93 * b.c)) return b;
  return null;
}
/** Splash damage to every building within `radius` of (x, z) (falls off with distance to its walls). */
export function damageBuildings(x: number, z: number, radius: number, dmg: number) {
  const seen = new Set<Bld>();
  for (let cx = Math.floor((x - radius) / CELL); cx <= Math.floor((x + radius) / CELL); cx++)
    for (let cz = Math.floor((z - radius) / CELL); cz <= Math.floor((z + radius) / CELL); cz++) {
      const l = CITY_DMG.grid.get(key(cx, cz)); if (!l) continue;
      for (const b of l) {
        if (seen.has(b)) continue; seen.add(b);
        const dx = Math.max(0, Math.abs(x - b.x) - b.hw), dz = Math.max(0, Math.abs(z - b.z) - b.hd), d = Math.hypot(dx, dz);
        if (d < radius) hurtBuilding(b, dmg * (1 - d / radius * 0.6));
      }
    }
}
export function hurtBuilding(b: Bld, dmg: number) {
  if (b.falling || b.down || dmg <= 0) return;
  b.hp -= dmg;
  if (b.hp <= 0) collapse(b);
}
function collapse(b: Bld) {
  b.falling = true; CITY_DMG.falling.push(b); CITY_DMG.destroyed++;
  SFX.play('boom', _v.set(b.x, 0, b.z)); G.shake = Math.max(G.shake, 0.5);
  FX.explode(_v.set(b.x, b.h * 0.6, b.z), 1.4 + b.h / 30);
  FX.word(_v.set(b.x, b.h + 3, b.z), 'boom', 1.6);
  CITY_DMG.onCollapse(b);
}
/** Per frame: crumbling buildings sink in 1.6 s under dust; damaged ones smoke (below 60 %) and burn (below 30 %). */
export function updateCityDamage(dt: number) {
  let dirty = false;
  for (let i = CITY_DMG.falling.length - 1; i >= 0; i--) {
    const b = CITY_DMG.falling[i];
    b.c = Math.min(1, b.c + dt / 1.6); COLLAPSE.data[b.bid] = Math.round(b.c * 255); dirty = true;
    if (Math.random() < dt * 14) FX.smoke(_v.set(b.x + rand(-b.hw, b.hw), b.h * (1 - b.c) * rand(0.3, 1), b.z + rand(-b.hd, b.hd)), 2, 2.4, 1.8, 2, false);
    if (Math.random() < dt * 6) FX.spark(_v.set(b.x, b.h * (1 - b.c), b.z), FXC.fireOrange, 6, 9, 0.5, 0.6, -18);
    if (b.c >= 1) {
      b.falling = false; b.down = true; CITY_DMG.falling.splice(i, 1);
      for (let k = 0; k < 6; k++) FX.smoke(_v.set(b.x + rand(-b.hw, b.hw), 1, b.z + rand(-b.hd, b.hd)), 3, 3.2, 2.4, 3, false);
    }
  }
  if (dirty) collapseTexture().needsUpdate = true;
  // damaged buildings: thin smoke, then fire from the roof
  for (const b of CITY_DMG.list) {
    if (b.down || b.falling || b.hp > b.maxHp * 0.6) continue;
    if ((b.fxT -= dt) > 0) continue;
    const burning = b.hp < b.maxHp * 0.3; b.fxT = burning ? rand(0.15, 0.3) : rand(0.5, 1);
    _v.set(b.x + rand(-b.hw, b.hw) * 0.6, b.h, b.z + rand(-b.hd, b.hd) * 0.6);
    FX.smoke(_v, 1, burning ? 2 : 1.4, 2.2, 1.2, burning);
    if (burning) FX.spark(_v, FXC.fireOrange, 3, 4, 0.5, 0.5, 6);
  }
}
