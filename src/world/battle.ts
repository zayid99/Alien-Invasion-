// City battle life (invasions): attack helicopters, jet bombing runs, panicking crowds, fleeing traffic and
// sweeping searchlights, so a city fight feels big and busy. Spawned by setupBattle, ticked by updateBattle.
import * as THREE from 'three';
import { G, track } from '../game/state';
import { cachedModel, box, cyl, sph, cone } from '../gfx/kit';
import { FX, FT, FXC } from '../gfx/fx';
import { PAL } from '../gfx/palette';
import { SFX } from '../core/audio';
import { CAR_MODELS } from '../core/assets';
import { V3, _v1, angTo, chance, hdist, pick, rand } from '../core/util';
import { makeEnt, say } from './entity';
import type { Entity } from './entity';
import { fireAt, PROJ } from './combat';
import type { Weapon } from './combat';
import { spawnHuman, spawnVehicle, lane } from './civilians';
import { CITY_ROADS } from './maps/city';
import { DEFENDER, earthForces } from '../data/balance';

const H = DEFENDER.heli, J = DEFENDER.jet;
const HELI_GUN: Weapon = { speed: 85, lead: 0.5, spread: 1.2, dmg: H.dmg, color: FXC.pistol };
const HELI_COLORS = ['#6f8a3f', '#4f6a8a', '#3a3550'];
const makeHeli = (i: number) => cachedModel('heli' + (i % 3), k => {
  const c = HELI_COLORS[i % 3];
  k.add(sph(2, 12, 8), c, { s: [1, 0.85, 1.6], m: 'metal' });
  k.add(sph(1.3, 10, 6), '#8fe8ff', { p: [0, 0.4, 1.6], s: [1, 0.8, 1], m: 'gloss' });
  k.add(box(0.6, 0.6, 5.5), c, { p: [0, 0.4, -4.6], m: 'metal' }); k.add(box(0.2, 1.8, 1.2), c, { p: [0, 1.2, -7.2], m: 'metal' });
  for (const s of [-1, 1]) { k.add(box(0.25, 0.25, 4), '#3a3550', { p: [s * 1.3, -1.9, 0] }); k.add(box(0.2, 0.9, 0.2), '#3a3550', { p: [s * 1.3, -1.4, 0.8] }); k.add(box(0.2, 0.9, 0.2), '#3a3550', { p: [s * 1.3, -1.4, -0.8] }); }
  k.add(cyl(0.2, 0.2, 0.8, 6), '#3a3550', { p: [0, 2, 0] });
  k.add(sph(0.25, 6, 4), PAL.tomato, { p: [0, -1.6, 2.6], m: 'glow', k: 3 });
});
function rotor() {
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: PAL.ink, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(track(new THREE.BoxGeometry(11, 0.12, 0.6)), m); b.rotation.y = i * Math.PI / 2; g.add(b); }
  track(m); return g;
}
const makeJet = () => cachedModel('jet', k => {
  const c = '#9aa0b8';
  k.add(cyl(0.9, 0.9, 9, 10), c, { r: [Math.PI / 2, 0, 0], m: 'metal' }); k.add(cone(0.9, 3, 10), c, { p: [0, 0, 6], r: [Math.PI / 2, 0, 0], m: 'metal' });
  k.add(box(11, 0.3, 3), c, { p: [0, 0, -0.5], m: 'metal' }); k.add(box(4, 0.25, 1.6), c, { p: [0, 0, -4.2], m: 'metal' }); k.add(box(0.25, 2.2, 1.8), c, { p: [0, 1.1, -4], m: 'metal' });
  k.add(sph(0.7, 8, 6), '#8fe8ff', { p: [0, 0.7, 2.5], s: [1, 0.7, 1.8], m: 'gloss' });
  k.add(sph(0.7, 8, 6), PAL.earthOrange, { p: [0, 0, -4.8], m: 'glow', k: 3 });
});

interface Jet { obj: THREE.Object3D; pos: THREE.Vector3; vel: THREE.Vector3; t: number; drops: number }
const B = { jets: [] as Jet[], jetT: 12, jetEvery: 20, lights: [] as THREE.Mesh[], L: 1 };

/** Called by startInvasion after the defenders are placed. */
export function setupBattle(L: number) {
  const F = earthForces(L); B.jets = []; B.jetEvery = F.jetEvery; B.jetT = rand(F.jetEvery * 0.6, F.jetEvery); B.L = L; B.lights = [];
  // attack helicopters (earthForces.helis), circling the army
  for (let i = 0; i < F.helis; i++) spawnHeli(rand(-150, 150), rand(-170, -60), i);
  // panicking crowds on the sidewalks and fleeing traffic on the avenues
  for (let i = 0; i < 18; i++) {
    const r = pick(CITY_ROADS.filter(v => v < 128)), t = rand(-170, 110), side = pick([-1, 1]) * 9.5;
    const h = chance(0.5) ? spawnHuman(r + side, t, 'civ') : spawnHuman(t, r + side, 'civ');
    h.runSpeed = rand(6, 8);
  }
  const lanes = [lane(-75, -190, -75, 120), lane(75, 120, 75, -190), lane(-190, -75, 190, -75), lane(190, -125, -190, -125), lane(-125, 120, -125, -190), lane(125, -190, 125, 120)];
  for (const ln of lanes) for (let i = 0; i < 2; i++) spawnVehicle('car', pick(CAR_MODELS), ln, rand(0, ln.len), { cruise: rand(12, 17) });
  // searchlights sweeping the night sky from the four corners
  const mat = track(new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff6c8').multiplyScalar(0.5), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  const geo = track(new THREE.CylinderGeometry(0.6, 9, 180, 16, 1, true).translate(0, 90, 0));
  for (const [x, z] of [[-185, -185], [185, -185], [-185, 60], [185, 60]]) { const m = new THREE.Mesh(geo, mat); m.position.set(x, 0, z); m.userData.noInk = true; m.userData.ph = rand(0, 6); G.world.add(m); B.lights.push(m); }
}
function spawnHeli(x: number, z: number, i: number) {
  const g = new THREE.Group(); g.add(makeHeli(i)); const r = rotor(); r.position.y = 2.4; g.add(r);
  g.position.set(x, H.alt, z);
  const e = makeEnt('heli', g, { r: 3, hh: 0, team: 'earth', hp: H.hp + B.L * H.hpPerLevel, brain: brainHeli, mini: '#ff6a5a', miniR: 2.2, shadow: 3, air: true });
  e.lootable = false; e.zap = true; e.rotor = r; e.orbit = rand(0, 6); e.cool = rand(0, 2); e.burst = 0; e.pos.y = H.alt;
  e.onDeath = heliDown;
  return e;
}
function brainHeli(e: Entity, dt: number) {
  e.rotor.rotation.y += dt * 30;
  if (e.hp <= 0) return;
  const I = G.inv, c = I?.center || G.player.pos;
  e.orbit += dt * 0.35;
  const tx = c.x + Math.cos(e.orbit) * H.orbit, tz = c.z - 10 + Math.sin(e.orbit) * H.orbit * 0.8;
  e.pos.x += (tx - e.pos.x) * Math.min(1, dt * 0.6); e.pos.z += (tz - e.pos.z) * Math.min(1, dt * 0.6);
  e.pos.y = H.alt + Math.sin(G.time * 1.3 + e.orbit) * 1.5;
  // face the nearest alien unit (or the saucer) and fire bursts at it
  let tgt: any = G.player; let bd = G.player && !G.player.dead ? hdist(e.pos, G.player.pos) : 1e9;
  for (const o of G.ents) if (o.team === 'alien' && !o.dead) { const d = hdist(e.pos, o.pos); if (d < bd) { bd = d; tgt = o; } }
  if (tgt && bd < H.range) {   // bursts of 5 shots: about DEFENDER.heli.rate shots/s on average
    e.heading = angTo(e.heading, Math.atan2(tgt.pos.x - e.pos.x, tgt.pos.z - e.pos.z), 2 * dt);
    e.cool -= dt;
    if (e.cool <= 0) { if (e.burst <= 0) e.burst = 5; e.burst--; e.cool = e.burst > 0 ? 0.12 : rand(1.4, 2.2); fireAt(e, new V3(e.pos.x, e.pos.y - 1.6, e.pos.z), tgt, HELI_GUN, { sound: 'shot' }); }
  }
  e.obj.rotation.y = e.heading; e.obj.rotation.x = 0.12; e.obj.position.copy(e.pos);
}
/** A downed helicopter spins and falls, then explodes where it lands (and hurts what it lands on). */
function heliDown(e: Entity) {
  G.inv.stats.killed++; say(e, ['MAYDAY!', 'Going down!']);
  e.brain = (h: Entity, dt: number) => {
    h.rotor.rotation.y += dt * 12; h.obj.rotation.y += dt * 6; h.pos.y -= dt * 14; h.obj.position.copy(h.pos);
    if (Math.random() < dt * 20) FX.smoke(h.pos, 1, 1.2, 1, 0.5, true);
    if (h.pos.y <= 1) { FX.explode(h.pos.clone().setY(1), 1.8); PROJ.fire({ from: h.pos.clone().setY(0.05), vel: new V3(0, -20, 0), team: 'earth', dmg: 30, splash: 6, life: 0.5, kind: 'shell' }); h.dead = true; }
  };
}

function jetRun() {
  const c = G.inv.center, from = new THREE.Vector3(c.x - 260, 58, c.z + rand(-40, 20)), dir = new THREE.Vector3(1, 0, rand(-0.25, 0.25)).normalize();
  if (chance(0.5)) { from.x = c.x + 260; dir.x *= -1; }
  for (let i = 0; i < 2; i++) {
    const o = makeJet(); o.position.copy(from).add(new THREE.Vector3(0, i * 3, i * 10)); o.lookAt(o.position.clone().add(dir)); G.world.add(o);
    B.jets.push({ obj: o, pos: o.position, vel: dir.clone().multiplyScalar(J.speed), t: 0, drops: J.bombs });
  }
  SFX.play('warp'); FT.spawn(new THREE.Vector3(c.x, 30, c.z), 'INCOMING JETS!', 'warn', 1.6, 2);
}

/** Per frame (invasion): jets, searchlights, the odd scream from the crowd. */
export function updateBattle(dt: number) {
  const I = G.inv; if (!I) return;
  if (!I.over && (B.jetT -= dt) <= 0) { B.jetT = B.jetEvery * rand(0.8, 1.2); jetRun(); }
  for (let i = B.jets.length - 1; i >= 0; i--) {
    const j = B.jets[i]; j.t += dt; j.pos.addScaledVector(j.vel, dt);
    if (Math.random() < dt * 30) FX.smoke(_v1.copy(j.pos).addScaledVector(j.vel, -0.06), 1, 0.8, 0.5, 0.2, false);
    // bombs: dropped while passing over the army
    if (j.drops > 0 && Math.abs(j.pos.x - I.center.x) < 30 && Math.random() < dt * 8) {
      j.drops--; PROJ.fire({ from: j.pos.clone().setY(j.pos.y - 2), vel: new V3(j.vel.x * 0.4, -28, j.vel.z * 0.4), team: 'earth', dmg: J.dmg, splash: J.splash, life: 4, kind: 'shell', width: 0.6, hitAir: false });
    }
    if (j.t > 7) { G.world.remove(j.obj); B.jets.splice(i, 1); }
  }
  for (const m of B.lights) { const ph = m.userData.ph + G.time * 0.35; m.rotation.set(Math.sin(ph) * 0.45, 0, Math.cos(ph * 0.8) * 0.45); }
  if (chance(dt * 0.4)) { const h = G.ents.find(e => e.kind === 'civilian' && !e.dead && chance(0.2)); if (h) say(h, ['RUN!', 'ALIENS!', 'Not my city!', 'Help!', 'Mom?!']); }
}
