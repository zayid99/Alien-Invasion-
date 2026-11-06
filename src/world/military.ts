// Earth's response during abduction nights: police, army, tanks, missile trucks.
import * as THREE from 'three';
import { G } from '../game/state';
import { instance , hasModel } from '../core/assets';
import { Kit, box, cyl } from '../gfx/kit';
import { FX } from '../gfx/fx';
import { SFX } from '../core/audio';
import { UI } from '../ui/dom';
import { V3, _v1, _v2, angTo, angWrap, chance, damp, hdist, rand } from '../core/util';
import { makeEnt, stepMove, say } from './entity';
import type { Entity } from './entity';
import { fireAt, alertLevel, raiseAlert, PROJ } from './combat';
import type { Weapon } from './combat';
import { spawnHuman, vehicleEMP } from './civilians';
import { SAY } from './lines';
import { PAL } from '../gfx/palette';

/**
 * Earth fire is always orange (docs/ART_STYLE.md §6), as HDR colours that bloom: small arms (pistol, rifle)
 * HDR (4, 2.4, 0.6); tank shells and missiles HDR (4, 1.6, 0.4). PROJ.fire (combat.ts) also enforces the
 * Earth-fire colours and the 1.4× shell width for every Earth shooter, so these values only document the
 * intent and colour the muzzle flash. Ranges, rates, damage and speeds are untouched.
 */
export const EARTH_FIRE = { small: new THREE.Color(4, 2.4, 0.6), heavy: new THREE.Color(4, 1.6, 0.4) };
export const WEAPON: Record<string, Weapon> = {
  pistol: { range: 30, rate: 1.6, burst: 1, dmg: 1, speed: 80, lead: 0.4, spread: 2.6, color: EARTH_FIRE.small },
  rifle:  { range: 36, rate: 2.0, burst: 3, dmg: 1.05, speed: 95, lead: 0.55, spread: 2.3, color: EARTH_FIRE.small },
};
export const TANK_GUN: Weapon = { speed: 48, lead: 0.7, spread: 0.7, dmg: 11, splash: 3.5, color: EARTH_FIRE.heavy };
const lvl = () => G.night ? G.night.level : 1;

export function wreckVehicle(e: Entity) {
  e.hp = 0; e.speed = 0; FX.explode(_v1.copy(e.pos).setY(1.5), 1.2);
  if (G.night) G.night.stats.disabled = (G.night.stats.disabled || 0) + 1;
}
export function smokeIfWrecked(e: Entity, dt: number) { if (e.hp <= 0) { if (chance(dt * 5)) FX.smoke(_v1.copy(e.pos).setY(2), 1, 1.3, 2.2, 0.6); return true; } return false; }
function pickEntry() {
  const P = G.player, E = G.entries; let best = E[0], bd = 1e9;
  for (const p of E) { const d = Math.hypot(p.x - P.pos.x, p.z - P.pos.z); if (d > 75 && d < bd) { bd = d; best = p; } }
  return best;
}
// ---------- police cars + army trucks that drive in and unload shooters ----------
export function spawnResponder(type: 'police' | 'army') {
  const p = pickEntry(), police = type === 'police', m = instance(police ? 'police_car' : 'suv'); m.root.position.set(p.x, 0, p.z);
  const e = makeEnt(police ? 'policecar' : 'jeep', m.root, { model: m, r: 2, hh: 0.9, brain: brainResponder, mini: '#ff7a6a', miniR: 2.2, shadow: 4.5, team: 'earth', hp: 30 });
  e.crew = police ? 'cop' : 'soldier'; e.crewN = police ? 2 : 3; e.stopDist = (police ? 20 : 28) + rand(0, 6); e.cruise = police ? 17 : 15;
  e.onDamage = vehicleEMP; e.zap = true; e.heading = Math.atan2(G.player.pos.x - p.x, G.player.pos.z - p.z);
}
function brainResponder(e: Entity, dt: number) {
  if (e.stun > 0) { e.speed = damp(e.speed, 0, 4, dt); return; }
  if (e.state === 'parked') return;
  const P = G.player, d = hdist(e.pos, P.pos);
  if (d > e.stopDist && e.t < 40) { e.heading = angTo(e.heading, Math.atan2(P.pos.x - e.pos.x, P.pos.z - e.pos.z), 1.6 * dt); e.speed = damp(e.speed, e.cruise, 2, dt); stepMove(e, dt); return; }
  e.state = 'parked'; e.speed = 0;
  for (let i = 0; i < e.crewN; i++) {
    const side = (i - (e.crewN - 1) / 2) * 1.6, ox = Math.cos(e.heading) * side, oz = -Math.sin(e.heading) * side;
    const s = spawnHuman(e.pos.x + ox + Math.sin(e.heading) * 2.5, e.pos.z + oz + Math.cos(e.heading) * 2.5, e.crew, { team: 'earth', brain: brainShooter, hp: 20, mini: '#ff6a5a' });
    s.weapon = e.crew === 'cop' ? WEAPON.pistol : WEAPON.rifle; s.zap = true; s.heading = e.heading;
    if (i === 0) say(s, e.crew === 'cop' ? SAY.cop : SAY.soldier);
  }
}
export function brainShooter(e: Entity, dt: number) {
  if (e.stun > 0) { e.anim('stun', { once: true, fade: 0.1 }); return; }
  const P = G.player; if (!P || P.dead) { e.anim('idle'); return; }
  const W = e.weapon as Weapon, d = hdist(e.pos, P.pos), ang = Math.atan2(P.pos.x - e.pos.x, P.pos.z - e.pos.z);
  const mv = d > W.range * 0.8 ? 1 : d < W.range * 0.35 ? -1 : 0;
  if (mv) { e.heading = angTo(e.heading, mv > 0 ? ang : ang + Math.PI, 6 * dt); e.speed = damp(e.speed, e.runSpeed * 0.9, 5, dt); stepMove(e, dt); e.anim(mv > 0 ? 'runaim' : 'run'); }
  else { e.speed = 0; e.heading = angTo(e.heading, ang, 8 * dt); e.obj.rotation.y = e.heading; e.anim('aim'); }
  e.cool -= dt;
  if (d < W.range && e.cool <= 0 && !mv) { e.cool = W.rate + rand(-0.2, 0.4); e.burst = W.burst; e.burstT = 0; }
  if (e.burst > 0 && (e.burstT -= dt) <= 0) { e.burst--; e.burstT = 0.11; fireAt(e, _v2.copy(e.pos).setY(1.6), P, W); }
  if (chance(dt * 0.04)) say(e, e.kind === 'cop' ? SAY.cop : SAY.soldier);
}
export function brainGuard(e: Entity, dt: number) {
  if (e.stun > 0) { e.anim('stun', { once: true }); return; }
  e.anim('idle');
  if (alertLevel() >= 2 || (G.player && hdist(e.pos, G.player.pos) < 40)) { e.brain = brainShooter; say(e, ['Intruder!', 'Sound the alarm!']); if (G.alert < 40) raiseAlert(40 - G.alert); }
}
// ---------- tanks ----------
function findNode(root: THREE.Object3D, name: string) { let n: THREE.Object3D = null; root.traverse(o => { if (!n && o.name === name) n = o; }); return n; }
/** Turn a model part around the world's up axis, whatever its own orientation is. */
export function aimNode(e: Entity, angle: number) {
  const t: THREE.Object3D = e.turretNode; if (!t) return;
  if (!e.turretBase) { e.turretBase = t.quaternion.clone(); const pq = new THREE.Quaternion(); t.parent.getWorldQuaternion(pq); e.turretAxis = new V3(0, 1, 0).applyQuaternion(pq.invert()); }
  t.quaternion.copy(e.turretBase).premultiply(new THREE.Quaternion().setFromAxisAngle(e.turretAxis, angle));
}
export function spawnTank(x: number, z: number, parked = false, heavy = false) {
  const m = instance(heavy ? 'tank_heavy' : hasModel('b_tank') ? 'b_tank' : 'tank'); m.root.position.set(x, 0, z);
  const e = makeEnt('tank', m.root, { model: m, r: 3, hh: 1.3, brain: brainTank, mini: '#ff5a4a', miniR: 3, shadow: 6.5, team: 'earth', hp: 60 + 12 * lvl() });
  e.turretNode = findNode(m.root, 'Tank_Turret'); e.turretAngle = 0;
  e.state = parked ? 'parked' : 'hunt'; e.onDeath = wreckVehicle; e.cruise = 7; e.zap = true;
  e.heading = parked || !G.player ? 0 : Math.atan2(G.player.pos.x - x, G.player.pos.z - z); m.root.rotation.y = e.heading;
  return e;
}
function brainTank(e: Entity, dt: number) {
  if (smokeIfWrecked(e, dt)) { e.animSpeed = 0; return; }
  if (e.state === 'parked') { if (alertLevel() >= 3) { e.state = 'hunt'; UI.toast('Tanks are leaving the army base', 'warn'); } else return; }
  const P = G.player; if (!P || P.dead) return;
  const d = hdist(e.pos, P.pos), ang = Math.atan2(P.pos.x - e.pos.x, P.pos.z - e.pos.z);
  if (e.stun > 0) e.speed = 0;
  else if (d > 28) { e.heading = angTo(e.heading, ang, 0.9 * dt); e.speed = damp(e.speed, e.cruise, 1.5, dt); }
  else e.speed = damp(e.speed, 0, 2, dt);
  stepMove(e, dt);
  e.anim('move'); e.animSpeed = e.speed / 6;
  e.turretAngle = angTo(e.turretAngle, angWrap(ang - e.heading), 1.7 * dt); aimNode(e, e.turretAngle);
  e.cool -= dt;
  if (d < 44 && e.cool <= 0 && Math.abs(angWrap(ang - e.heading - e.turretAngle)) < 0.2) {
    e.cool = 3.6 + rand(0, 0.8);
    const yaw = e.heading + e.turretAngle, from = new V3(e.pos.x + Math.sin(yaw) * 4.3, 2.2, e.pos.z + Math.cos(yaw) * 4.3);
    // Base width: PROJ.fire (combat.ts) already widens every Earth 'shell' 1.4× (§6), so it is not applied here too.
    fireAt(e, from, P, TANK_GUN, { width: 0.45, trail: 2.5, kind: 'shell', sound: 'cannon' });
    FX.spark(from, EARTH_FIRE.heavy, 8, 6, 0.6, 0.25, 0); FX.smoke(from, 2, 1, 1, 0.3);   // orange muzzle flash
  }
}
// ---------- missile trucks (Kenney pickup + a missile pod made here) ----------
// (Tanks get their toy-army recolour and cream star decal from the model pipeline, core/assets.ts.)
/** Toy-army missile pod (§5): green box, four tomato missile caps with cream rims; Kit-built, so toon + inked. */
const missilePod = () => {
  const k = new Kit();
  k.add(box(1.5, 0.9, 2.2), PAL.toyArmy, { p: [0, 0.45, 0], r: [-0.45, 0, 0] });
  for (const x of [-0.38, 0.38]) for (const y of [0.15, 0.6]) {
    k.add(cyl(0.2, 0.2, 0.08, 8), PAL.cream, { p: [x, y + 0.2, 0.99], r: [Math.PI / 2 - 0.45, 0, 0] });
    k.add(cyl(0.15, 0.17, 0.14, 8), PAL.tomato, { p: [x, y + 0.2, 1.02], r: [Math.PI / 2 - 0.45, 0, 0] });
  }
  return k.build();
};
export function spawnMissileTruck() {
  const p = pickEntry(), m = instance('truck'); m.root.position.set(p.x, 0, p.z);
  const pod = missilePod(); pod.position.set(0, 1.3, -1.0); m.root.add(pod);
  const e = makeEnt('mtruck', m.root, { model: m, r: 2.6, hh: 1.2, brain: brainMissileTruck, mini: '#ff5a4a', miniR: 2.6, shadow: 5.5, team: 'earth', hp: 45 + 8 * lvl() });
  e.pod = pod; e.onDeath = wreckVehicle; e.zap = true; e.cruise = 10; e.heading = Math.atan2(G.player.pos.x - p.x, G.player.pos.z - p.z);
}
function brainMissileTruck(e: Entity, dt: number) {
  if (smokeIfWrecked(e, dt)) return;
  const P = G.player; if (!P || P.dead) return;
  const d = hdist(e.pos, P.pos), ang = Math.atan2(P.pos.x - e.pos.x, P.pos.z - e.pos.z);
  if (e.stun > 0) e.speed = 0; else if (d > 45) { e.heading = angTo(e.heading, ang, 1.2 * dt); e.speed = damp(e.speed, e.cruise, 1.5, dt); } else e.speed = damp(e.speed, 0, 3, dt);
  stepMove(e, dt);
  e.pod.rotation.y = angTo(e.pod.rotation.y, angWrap(ang - e.heading), 1.5 * dt);
  e.cool -= dt;
  if (d < 70 && e.cool <= 0) {
    e.cool = 6.5 + rand(0, 1.5);
    const from = new V3(e.pos.x, 3.2, e.pos.z);
    PROJ.fire({ from, vel: new V3(Math.sin(ang) * 6, 16, Math.cos(ang) * 6), team: 'earth', dmg: 14, splash: 3, color: EARTH_FIRE.heavy, width: 0.5, trail: 1.6, kind: 'missile', homing: P, turn: 1.5, life: 7, src: e });
    SFX.play('missile', e.pos, 0.1); FX.smoke(from, 3, 1, 1, 0.4);
  }
}
/** Each few seconds, Earth sends more forces depending on the alert level. */
export function updateMilitary(dt: number) {
  const N = G.night; if (N.noMilitary) return;
  N.spawnT -= dt; if (N.spawnT > 0) return; N.spawnT = 3.5;
  const L = alertLevel(); if (L === 0) return;
  let pc = 0, jeeps = 0, soldiers = 0, tanks = 0, trucks = 0;
  for (const e of G.ents) {
    if (e.dead || e.team !== 'earth') continue;
    if (e.kind === 'policecar') pc++; else if (e.kind === 'jeep') jeeps++; else if (e.kind === 'soldier' || e.kind === 'cop') soldiers++;
    else if (e.kind === 'tank' && e.hp > 0 && e.state !== 'parked') tanks++; else if (e.kind === 'mtruck' && e.hp > 0) trucks++;
  }
  const cap = 2 + L * 2;
  if (pc < Math.min(1 + Math.floor(L / 2), 3) && soldiers < cap) spawnResponder('police');
  else if (L >= 2 && jeeps < (L >= 4 ? 3 : 2) && soldiers < cap) spawnResponder('army');
  else if (L >= 3 && tanks < L - 1) { const parked = G.ents.find(e => e.kind === 'tank' && e.state === 'parked' && !e.dead); if (parked) parked.state = 'hunt'; else { const p = pickEntry(); spawnTank(p.x, p.z, false, L >= 5); } }
  else if (L >= 4 && trucks < (L >= 5 ? 2 : 1)) spawnMissileTruck();
}
