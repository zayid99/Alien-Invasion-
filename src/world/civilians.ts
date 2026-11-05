// Civilian life: people, farm + wild animals, traffic, and things lying around.
import * as THREE from 'three';
import { G } from '../game/state';
import { instance, CIVILIAN_MODELS, SCIENTIST_MODELS, COP_MODEL } from '../core/assets';
import { FARM_MAKERS, makeHaybale } from '../gfx/models';
import { Kit, box, cyl, sph } from '../gfx/kit';
import { SFX } from '../core/audio';
import { FX } from '../gfx/fx';
import { V3, _v1, angTo, chance, clamp, damp, hdist, pick, rand } from '../core/util';
import type { Vec3 } from '../core/util';
import { makeEnt, stepMove, say, attachToBone, pushOut } from './entity';
import type { Entity, Brain, Team } from './entity';
import { alertLevel } from './combat';
import { SAY } from './lines';

const strawHat = () => { const k = new Kit(); k.add(cyl(0.55, 0.55, 0.05, 12), '#d9b45a', { p: [0, 0, 0] }); k.add(cyl(0.3, 0.33, 0.24, 10), '#cfa64a', { p: [0, 0.13, 0] }); return k.build(); };
const hypnoHelmet = () => { const k = new Kit(); k.add(sph(0.42, 10, 6), '#8f96ad', { s: [1, 0.7, 1], m: 'metal' }); k.add(box(0.7, 0.1, 0.12), '#c58bff', { p: [0, -0.05, 0.36], m: 'glow', k: 3.5 }); k.add(cyl(0.02, 0.02, 0.4, 4), '#8f96ad', { p: [0, 0.4, 0], m: 'metal' }); k.add(sph(0.07, 6, 5), '#ff9cf5', { p: [0, 0.62, 0], m: 'glow', k: 3 }); return k.build(); };

export type HumanStyle = 'civ' | 'farmer' | 'scientist' | 'cop' | 'soldier' | 'brute';
export function spawnHuman(x: number, z: number, style: HumanStyle = 'civ', o: { brain?: Brain; team?: Team; hp?: number; mini?: string; home?: Vec3 | null } = {}) {
  const id = style === 'soldier' ? 'soldier' : style === 'cop' ? COP_MODEL : style === 'scientist' ? pick(SCIENTIST_MODELS) : pick(CIVILIAN_MODELS);
  const m = instance(id); m.root.position.set(x, 0, z);
  const kind = style === 'civ' ? 'civilian' : style === 'brute' ? 'brute' : style;
  const e = makeEnt(kind, m.root, { model: m, r: 0.5, hh: 1, brain: o.brain || brainWalker, mini: o.mini || (style === 'scientist' ? '#9fe0ff' : '#ffe6d2'), shadow: 1.3, team: o.team, hp: o.hp, lootKind: style === 'brute' ? '' : kind });
  if (style === 'farmer') attachToBone(e, /head/i, strawHat(), 1.9);
  if (style === 'brute') { attachToBone(e, /head/i, hypnoHelmet(), 1.9); m.root.scale.setScalar(1.3); }
  e.runSpeed = rand(5, 6.6); e.walkSpeed = rand(1.2, 1.8); e.home = o.home || null; e.goal = null;
  e.anim('idle');
  return e;
}
/** Civilians wander; when the saucer comes close they panic, run home or away. */
export function brainWalker(e: Entity, dt: number) {
  const P = G.player;
  if (e.stun > 0) { e.anim('stun', { once: true, fade: 0.1 }); return; }
  const d = P ? hdist(e.pos, P.pos) : 999, fleeR = 24 + alertLevel() * 5;
  if (P && !P.dead && d < fleeR && !e.calm) {
    if (e.state !== 'flee') { e.state = 'flee'; if (chance(0.4)) say(e, e.kind === 'scientist' ? SAY.scientist : SAY.panic); if (chance(0.35)) SFX.play('scream', e.pos, 0.25); }
    let tx = e.pos.x - P.pos.x, tz = e.pos.z - P.pos.z;
    if (e.home && hdist(e.pos, e.home) < 25) { tx = e.home.x - e.pos.x; tz = e.home.z - e.pos.z; if (hdist(e.pos, e.home) < 1.6) { e.dead = true; if (G.night) G.night.hiding++; return; } }
    e.heading = angTo(e.heading, Math.atan2(tx, tz) + Math.sin(e.t * 2 + e.seed) * 0.45, 7 * dt);
    e.speed = damp(e.speed, e.runSpeed, 6, dt); e.anim('panic', { speed: 1.15 });
  } else {
    e.state = 'wander';
    if (e.pause > 0) { e.pause -= dt; e.speed = damp(e.speed, 0, 8, dt); e.anim('idle'); }
    else {
      const base = e.home || e.anchor || e.pos;
      if (!e.goal || hdist(e.pos, e.goal) < 1.2) { e.goal = new V3(base.x + rand(-18, 18), 0, base.z + rand(-18, 18)); if (chance(0.4)) e.pause = rand(1, 4); }
      e.heading = angTo(e.heading, Math.atan2(e.goal.x - e.pos.x, e.goal.z - e.pos.z), 3 * dt);
      e.speed = damp(e.speed, e.walkSpeed, 4, dt); e.anim('walk');
    }
  }
  stepMove(e, dt);
}

// ---------- animals ----------
const WILD: Record<string, { model: string; kind: string; r: number; shadow: number; walk: number; run: number }> = {
  deer: { model: 'deer', kind: 'deer', r: 1, shadow: 2.4, walk: 1.2, run: 7 },
  fox: { model: 'fox', kind: 'fox', r: 0.6, shadow: 1.4, walk: 1.5, run: 6.5 },
  dog: { model: 'shiba', kind: 'dog', r: 0.5, shadow: 1.2, walk: 1.6, run: 6 },
  cat: { model: 'cat', kind: 'cat', r: 0.4, shadow: 0.9, walk: 1.2, run: 5 },
};
export type Pen = { minX: number; maxX: number; minZ: number; maxZ: number };
export function spawnAnimal(kind: string, x: number, z: number, pen: Pen) {
  let e: Entity;
  if (FARM_MAKERS[kind]) {
    const obj = FARM_MAKERS[kind](); obj.position.set(x, 0, z);
    e = makeEnt(kind, obj, { r: kind === 'chicken' ? 0.4 : 1, hh: kind === 'chicken' ? 0.5 : 1, brain: brainGrazer, mini: '#9ee86a', shadow: kind === 'chicken' ? 0.9 : 2.4 });
    e.walkSpeed = kind === 'chicken' ? 1.6 : 0.9; e.runSpeed = kind === 'chicken' ? 4 : 2.6;
  } else {
    const w = WILD[kind] || WILD.deer, m = instance(w.model); m.root.position.set(x, 0, z);
    e = makeEnt(w.kind, m.root, { model: m, r: w.r, hh: 0.8, brain: brainGrazer, mini: '#9ee86a', shadow: w.shadow });
    e.walkSpeed = w.walk; e.runSpeed = w.run; e.anim('idle');
  }
  e.pen = pen; e.zap = true;
  return e;
}
const ANIMAL_SOUND: Record<string, string> = { cow: 'moo', sheep: 'baa', pig: 'oink', chicken: 'cluck', dog: 'bark' };
export function brainGrazer(e: Entity, dt: number) {
  const P = G.player;
  if (e.stun > 0) { if (e.model) e.anim('stun', { once: true }); else e.obj.rotation.z = damp(e.obj.rotation.z, 1.5, 5, dt); return; }
  if (!e.model) e.obj.rotation.z = damp(e.obj.rotation.z, 0, 5, dt);
  const d = P ? hdist(e.pos, P.pos) : 999, wild = !!e.model && e.kind !== 'dog' && e.kind !== 'cat';
  if (P && d < (wild ? 22 : 13)) {
    e.heading = angTo(e.heading, Math.atan2(e.pos.x - P.pos.x, e.pos.z - P.pos.z), 3 * dt); e.speed = damp(e.speed, e.runSpeed, 3, dt); e.anim('run');
    if (chance(dt * 0.25)) { say(e, SAY.animal[e.kind] || ['?']); if (ANIMAL_SOUND[e.kind]) SFX.play(ANIMAL_SOUND[e.kind], e.pos, 0.5); }
  } else {
    if (!e.goal || hdist(e.pos, e.goal) < 1 || e.t > e.goalT) { const p = e.pen; e.goal = new V3(rand(p.minX, p.maxX), 0, rand(p.minZ, p.maxZ)); e.goalT = e.t + rand(4, 10); e.wait = rand(0, 5); }
    if (e.wait > 0) { e.wait -= dt; e.speed = damp(e.speed, 0, 4, dt); e.anim(e.kind === 'deer' && e.seed > 5 ? 'eat' : 'idle'); }
    else { e.heading = angTo(e.heading, Math.atan2(e.goal.x - e.pos.x, e.goal.z - e.pos.z), 2 * dt); e.speed = damp(e.speed, e.walkSpeed, 2, dt); e.anim('walk'); }
  }
  if (!e.model) e.obj.position.y = e.speed > 0.2 ? Math.abs(Math.sin(e.t * 8)) * 0.08 : 0;
  stepMove(e, dt);
  if (e.pen && d >= 13) { const p = e.pen; e.pos.x = clamp(e.pos.x, p.minX, p.maxX); e.pos.z = clamp(e.pos.z, p.minZ, p.maxZ); }
}

// ---------- props: hay bales, pumpkins, Earth artifacts ----------
export function spawnProp(kind: string, obj: THREE.Object3D, x: number, z: number, o: { r?: number; hh?: number; mini?: string; shadow?: number; lootKind?: string } = {}) {
  obj.position.set(x, 0, z);
  return makeEnt(kind, obj, { r: o.r || 1, hh: o.hh || 0.8, mini: o.mini || '#d8c070', shadow: o.shadow || 2, lootKind: o.lootKind, heading: rand(0, 6) });
}
export function spawnHaybale(x: number, z: number) { return spawnProp('haybale', makeHaybale(), x, z, { r: 1.2, shadow: 2.4 }); }
export function spawnArtifact(id: string, x: number, z: number) {
  const m = instance(id); const e = spawnProp('artifact', m.root, x, z, { r: 0.6, hh: 0.4, mini: '#ffd65c', shadow: 1, lootKind: 'artifact' });
  e.artifact = id.replace('_', ' '); e.brain = (a: Entity) => { a.obj.rotation.y += 0.02; if (chance(0.02)) FX.spark(_v1.copy(a.pos).setY(1), 0xffd65c, 1, 2, 0.2, 0.6, 0); };
  return e;
}

// ---------- traffic ----------
export interface Lane { a: Vec3; b: Vec3; len: number; loop: boolean; next?: Lane }
export const lane = (ax: number, az: number, bx: number, bz: number, loop = true): Lane => ({ a: new V3(ax, 0, az), b: new V3(bx, 0, bz), len: Math.hypot(bx - ax, bz - az), loop });
export function spawnVehicle(kind: string, modelId: string, ln: Lane, u: number, o: { cruise?: number; mini?: string; team?: Team; hp?: number; lootKind?: string } = {}) {
  const m = instance(modelId);
  const e = makeEnt(kind, m.root, { model: m, r: 2, hh: 0.9, brain: brainDriver, mini: o.mini || '#ffd65c', miniR: 2, shadow: 4.5, team: o.team, hp: o.hp, lootKind: o.lootKind });
  e.lane = ln; e.u = u; e.cruise = o.cruise || rand(9, 13); e.speed = e.cruise; e.zap = true;
  e.onDamage = vehicleEMP; placeOnLane(e);
  return e;
}
export function vehicleEMP(e: Entity) { e.stun = Math.max(e.stun, 5); e.flash = 0.1; FX.smoke(_v1.copy(e.pos).setY(1.5), 2, 0.9, 1, 0.6); }
function placeOnLane(e: Entity) {
  const L: Lane = e.lane, len = L.len; e.u = ((e.u % len) + len) % len;
  e.pos.set(L.a.x + (L.b.x - L.a.x) * e.u / len, e.pos.y, L.a.z + (L.b.z - L.a.z) * e.u / len);
  e.heading = Math.atan2(L.b.x - L.a.x, L.b.z - L.a.z); e.obj.rotation.y = e.heading;
}
export function brainDriver(e: Entity, dt: number) {
  if (e.stun > 0) { e.speed = damp(e.speed, 0, 4, dt); if (chance(dt * 4)) FX.smoke(_v1.copy(e.pos).setY(1.5), 1, 0.8, 1, 0.5); return; }
  if (!e.lane) return;
  const P = G.player, scared = P && hdist(e.pos, P.pos) < 40 && alertLevel() >= 1;
  let want = e.cruise * (scared ? 1.8 : 1);
  for (const o of G.ents) if (o !== e && o.lane === e.lane && !o.dead && !o.lift) { const ahead = o.u - e.u; if (ahead > 0 && ahead < 9) want = Math.min(want, o.speed * 0.9); }
  e.speed = damp(e.speed, want, 2, dt); e.u += e.speed * dt;
  if (e.u >= e.lane.len) { if (e.lane.loop) e.u -= e.lane.len; else { e.lane = e.lane.next || null; e.u = 0; } }
  if (e.lane) placeOnLane(e);
}

/** Keep the town lively: people come back outside when the coast is clear. */
export function respawnCivilians(dt: number) {
  const N = G.night; N.civT -= dt; if (N.civT > 0) return; N.civT = 2.5;
  let civs = 0; for (const e of G.ents) if (e.kind === 'civilian' && !e.dead) civs++;
  if (civs >= 30 || !G.houses.length) return;
  const h = pick(G.houses); if (hdist(h, G.player.pos) < 55) return;
  const e = spawnHuman(h.x, h.z, 'civ', { home: chance(0.4) ? h : null }); e.anchor = h.clone(); pushOut(e.pos, 0.6);
  if (N.hiding > 0) { N.hiding--; if (chance(0.5)) say(e, SAY.hide); }
}
