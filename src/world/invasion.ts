// City invasion: Earth's defenders, shield pylons, the defense HQ, and your army's AI.
import * as THREE from 'three';
import { G, track } from '../game/state';
import { DEFENDER, earthForces, canAfford, payCost, costText } from '../data/balance';
import { UNIT_TYPES } from '../data/units';
import type { UnitKey } from '../data/units';
import { instance } from '../core/assets';
import { Kit, box, cyl, sph } from '../gfx/kit';
import { makeGrayAlien, miniSaucer, makeWalker, whiteFlag } from '../gfx/models';
import { FX, FXC, shellMaterial } from '../gfx/fx';
import { PAL } from '../gfx/palette';
import { SFX } from '../core/audio';
import { UI } from '../ui/dom';
import { V3, _v1, _v2, angTo, angWrap, chance, damp, hdist, pick, rand } from '../core/util';
import { makeEnt, stepMove, say, damageEnt, pushOut, attachToBone } from './entity';
import type { Entity } from './entity';
import { fireAt, PROJ } from './combat';
import { damageBuildings } from './cityDamage';
import type { Weapon } from './combat';
import { spawnHuman } from './civilians';
import { spawnTank, smokeIfWrecked, wreckVehicle, aimNode } from './military';
import { FLOW_CELL, PYLON_SPOTS, flowField, flowDir, blockedGrid } from './maps/city';

export const invasionHooks = { onWin: () => {}, onDeploy: () => {}, onBoss: (_name: string) => {} };
// Earth fire is always orange (§6): small arms HDR (4, 2.4, 0.6), cannons HDR (4, 1.6, 0.4). (PROJ.fire enforces it too.)
const INV_RIFLE: Weapon = { range: 26, rate: 1, burst: 1, dmg: DEFENDER.soldier.dmg, speed: 90, lead: 0.6, spread: 1.0, color: FXC.pistol };
const INV_CANNON: Weapon = { speed: 55, lead: 0.7, spread: 0.5, dmg: DEFENDER.tank.dmg, splash: 4, color: FXC.fireOrange };
const FLAK: Weapon = { speed: 80, lead: 0.85, spread: 0.8, dmg: DEFENDER.turret.dmg, color: FXC.fireOrange };
const MECH_GUN: Weapon = { speed: 70, lead: 0.6, spread: 0.7, dmg: 14, splash: 3, color: FXC.fireOrange };
// Your army's blasters are slime (the clone blaster tip is a slime glow, §5); never orange.
const PLASMA = { speed: 72, lead: 0.5, spread: 0.55, color: FXC.slime };
/** Surrender lines (§6 `.ft.say`). */
const SURRENDER = ['I GIVE UP!', 'WE SURRENDER!', 'TAKE THE TANK!'];

export function losClear(a: { x: number; z: number }, b: { x: number; z: number }, endSkip = 4) {
  const B = G.inv && G.inv.grid; if (!B) return true;
  const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz), steps = Math.floor((len - endSkip) / 2);
  for (let i = 1; i < steps; i++) {
    const cx = Math.floor((a.x + dx * (i * 2 / len) + B.half) / FLOW_CELL), cz = Math.floor((a.z + dz * (i * 2 / len) + B.half) / FLOW_CELL);
    if (cx >= 0 && cz >= 0 && cx < B.n && cz < B.n && B.blocked[cz * B.n + cx]) return false;
  }
  return true;
}
const flowFor = (obj: Entity) => { const I = G.inv; if (!I.flows.has(obj)) I.flows.set(obj, flowField(obj.pos, obj.r + 8)); return I.flows.get(obj); };

function spawnHQ(hp: number) {
  // §5 HQ: walls #dfe4f2, upper tier #c8d0e8, tomato gloss dome (the big target), #bfe3ff window band (Earth
  // windows k ≤ 1.3, so it never blooms), red siren beacon k 3. Kit meshes are toon + inked automatically.
  const k = new Kit();
  k.add(cyl(16, 17, 10, 28), '#dfe4f2', { p: [0, 5, 0] });
  for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; k.add(box(2.2, 1.4, 0.2), '#bfe3ff', { p: [Math.cos(a) * 16.6, 6.5, Math.sin(a) * 16.6], r: [0, Math.PI / 2 - a, 0], m: 'glow', k: 1.3 }); }
  k.add(cyl(11, 12, 8, 24), '#c8d0e8', { p: [0, 14, 0] });
  k.add(sph(9, 22, 10), PAL.tomato, { p: [0, 18, 0], s: [1, 0.55, 1], m: 'gloss' });
  k.add(cyl(0.5, 0.7, 16, 6), '#8a90b8', { p: [0, 29, 0], m: 'metal' }); k.add(sph(0.7, 8, 6), PAL.tomato, { p: [0, 37.5, 0], m: 'glow', k: 3 });
  k.add(box(7, 4.5, 1.4), PAL.streetPole, { p: [0, 2.25, 16.6] });
  const obj = k.build(g => G.disposables.push(g));
  const e = makeEnt('hq', obj, { r: 16, hh: 9, team: 'earth', hp, mini: '#ff4a3a', miniR: 8, shadow: 0.01 });
  e.lootable = false; e.zap = true; e.structure = true; e.domeFlash = 0;
  // HQ shield: stepped earth-cyan fresnel (§6); hit = white flash 80 ms + wobble (amplitude scaled to its 30 m radius)
  e.dome = new THREE.Mesh(track(new THREE.SphereGeometry(30, 40, 20)), track(shellMaterial(PAL.earthCyan, 1.8, 0.85, { wobAmp: 0.9 }))); G.world.add(e.dome);
  e.domeHitT = 9;
  e.onDamage = (h: Entity, dmg: number, src: any) => {
    if (G.inv.pylonsLeft > 0) {
      h.domeFlash = 1; if (h.domeHitT > 0.6) h.domeHitT = 0;   // flash + wobble at most every 0.6 s (army fire is constant)
      if (src === 'player' && (h.blockT || 0) < G.time) { h.blockT = G.time + 4; UI.toast('Shielded! Destroy the 3 pylons first', 'warn'); }
      return;
    }
    if (h.hp <= 0) return;
    h.hp -= dmg; if (chance(0.15)) FX.smoke(_v1.set(rand(-12, 12), rand(8, 20), rand(-12, 12)), 1, 2, 1.6, 1);
    if (h.hp <= 0) { h.hp = 0; FX.word(_v1.set(0, 26, 0), 'hq', 3); if (G.inv.boss && !G.inv.bossEnt) spawnBoss(); else if (!G.inv.boss) invasionHooks.onWin(); }
  };
  G.obstacles.push({ minX: -16, maxX: 16, minZ: -16, maxZ: 16 });
  return e;
}
function spawnPylon(x: number, z: number, hp: number) {
  // §5 pylon: base #4a4466, white gloss shaft with 3 tomato hazard bands, earth-cyan glow rings k 2.4, HDR cyan core
  const k = new Kit();
  k.add(box(7, 1.6, 7), PAL.streetPole, { p: [0, 0.8, 0], m: 'metal' }); k.add(cyl(1.1, 2.3, 18, 8), '#eef0f8', { p: [0, 10.6, 0], m: 'gloss' });
  const shaftR = (y: number) => 2.3 - (y - 1.6) / 18 * 1.2;   // shaft radius at height y
  for (const y of [3.6, 9, 14.6]) k.add(cyl(shaftR(y + 0.45) + 0.1, shaftR(y - 0.45) + 0.1, 0.9, 8), PAL.tomato, { p: [0, y, 0] });
  for (const y of [6, 12, 17]) k.add(new THREE.TorusGeometry(2.2 - y * 0.05, 0.22, 5, 14), PAL.earthCyan, { p: [0, y, 0], r: [Math.PI / 2, 0, 0], m: 'glow', k: 2.4 });
  const obj = k.build(g => G.disposables.push(g));
  const core = new THREE.Mesh(track(new THREE.IcosahedronGeometry(1.8, 1)), track(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.6, 3.2), toneMapped: false }))); core.position.y = 21.5; obj.add(core);   // glow: never inked
  obj.position.set(x, 0, z);
  const e = makeEnt('pylon', obj, { r: 3.6, hh: 10, team: 'earth', hp, mini: '#ff4a3a', miniR: 5, shadow: 8 });
  e.lootable = false; e.zap = true; e.structure = true; e.core = core;
  const from = new V3(x, 21.5, z), to = new V3(0, 30, 0), len = from.distanceTo(to);
  // link beam to the HQ: Earth orange, additive (never inked)
  e.link = new THREE.Mesh(track(new THREE.CylinderGeometry(0.35, 0.35, len, 6, 1, true)), track(new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.earthOrange).multiplyScalar(2.2), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
  e.link.position.copy(from).add(to).multiplyScalar(0.5); e.link.quaternion.setFromUnitVectors(new V3(0, 1, 0), to.clone().sub(from).normalize()); G.world.add(e.link);
  e.onDeath = () => {
    FX.word(new V3(x, 24, z), 'pylon', 2.4);   // KER-CHUNK! first, so it wins over the explosion's own word
    FX.explode(new V3(x, 12, z), 2.4); setTimeout(() => FX.explode(new V3(x, 22, z), 1.6), 250); SFX.play('pylon');
    G.world.remove(e.link); e.obj.rotation.x = 0.3; e.obj.position.y = -2.5; e.core.visible = false; e.mini = '#77707a';
    const I = G.inv; I.pylonsLeft--; I.objective = null;
    if (I.pylonsLeft > 0) UI.toast(`Pylon destroyed! ${I.pylonsLeft} left`, 'good', 2.6);
    else { UI.toast('All pylons down: the HQ shield is failing!', 'good', 3); UI.comm('Their shield is down! Send everything at the <b>headquarters</b>.'); }
  };
  G.obstacles.push({ minX: x - 3.5, maxX: x + 3.5, minZ: z - 3.5, maxZ: z + 3.5 });
  return e;
}
function spawnTurret(x: number, z: number, hp: number) {
  const m = instance('turret'); m.root.position.set(x, 0, z);
  const e = makeEnt('turret', m.root, { r: 2.5, hh: 1.8, team: 'earth', hp, brain: brainTurret, mini: '#ff6a5a', miniR: 2.6, shadow: 5 });
  e.lootable = false; e.zap = true; e.structure = true;
  e.onDeath = () => { FX.explode(new V3(x, 2.5, z), 1.4); e.obj.rotation.z = 0.5; e.mini = '#77707a'; G.inv.stats.killed++; };
  G.obstacles.push({ minX: x - 2.5, maxX: x + 2.5, minZ: z - 2.5, maxZ: z + 2.5 });
}
function findAlienTarget(e: Entity, range: number, mode: 'any' | 'air' | 'ground' = 'any') {
  let best: any = null, bd = 1e9; const P = G.player;
  if (P && !P.dead && mode !== 'ground') { const d = hdist(e.pos, P.pos); if (d < range) { bd = d - (mode === 'air' ? 25 : 0) + 4; best = P; } }
  for (const u of G.ents) {
    if (u.team !== 'alien' || u.dead || u.hp <= 0 || u.dropping) continue;
    if (mode === 'ground' && u.air) continue;
    const d = hdist(e.pos, u.pos); if (d > range) continue;
    if (!u.air && !e.structure && d > 8 && !losClear(e.pos, u.pos, 2)) continue;
    const s = d - (mode === 'air' && u.air ? 25 : 0); if (s < bd) { bd = s; best = u; }
  }
  return best;
}
function brainTurret(e: Entity, dt: number) {
  if (smokeIfWrecked(e, dt)) return;
  e.retarget = (e.retarget || 0) - dt;
  if (e.retarget <= 0 || !e.target || e.target.dead || e.target.hp <= 0) { e.retarget = 0.5; e.target = findAlienTarget(e, DEFENDER.turret.range, 'air'); }
  const T = e.target; if (!T) { e.obj.rotation.y += dt * 0.4; return; }
  const ang = Math.atan2(T.pos.x - e.pos.x, T.pos.z - e.pos.z);
  e.obj.rotation.y = angTo(e.obj.rotation.y, ang, 2.6 * dt); e.cool -= dt;
  if (e.cool <= 0 && Math.abs(angWrap(ang - e.obj.rotation.y)) < 0.25) { e.cool = 1 / DEFENDER.turret.rate + rand(0, 0.15); fireAt(e, new V3(e.pos.x + Math.sin(ang) * 2, 3.4, e.pos.z + Math.cos(ang) * 2), T, FLAK, { width: 0.32, trail: 2.6 }); }
}
function surrender(e: Entity) {
  e.hp = 0; e.speed = 0; e.mini = '#ffd65c'; e.target = null;
  if (!e.flag) { const f = whiteFlag(); f.position.set(0.5, 1.2, 0); e.obj.add(f); e.flag = f; popFlag(e, f); }
  e.anim('wave'); say(e, SURRENDER, 'say', 2.2); SFX.play('surrender', e.pos, 0.2);
  if (G.inv) G.inv.stats.surrendered++;
}
/**
 * Surrender flag (§6, §9): pops 0 → 1.2 → 1 over 0.3 s with 4 confetti sparks (poster, bubblegum, slime). The cloth
 * flutter (rotation.y = sin(t·4·2π)·0.25) is built into whiteFlag() itself (models.ts), so it is not added here.
 * Driven by an FX tween, which keeps running in the victory scene and is cleared with the world.
 */
const CONFETTI = [FXC.poster, FXC.bubblegum, FXC.slime, FXC.poster];
function popFlag(e: Entity, f: THREE.Object3D) {
  const base = f.scale.x; let t = 0; f.scale.setScalar(0.001);
  for (const c of CONFETTI) FX.spark(_v1.copy(e.pos).setY(e.pos.y + 2.4), c, 1, 5, 0.35, 0.8, -8);
  FX.tween(dt => {
    if (e.dead || !e.obj.parent || f.parent !== e.obj) { f.scale.setScalar(base); return false; }
    t += dt;
    const k = t < 0.18 ? 1.2 * Math.sin(t / 0.18 * Math.PI / 2) : t < 0.3 ? 1.2 - 0.2 * (t - 0.18) / 0.12 : 1;
    f.scale.setScalar(base * Math.max(0.001, k));
    return t < 0.3;   // done once it has settled at full size
  });
}
function spawnDefender(kind: 'soldier' | 'tank' | 'mech', x: number, z: number, aggressive = false) {
  if (kind === 'soldier') {
    const s = spawnHuman(x, z, 'soldier', { team: 'earth', brain: brainDefender, hp: DEFENDER.soldier.hp, mini: '#ff6a5a' });
    s.weapon = INV_RIFLE; s.zap = true; s.post = s.pos.clone(); s.aggressive = aggressive; s.onDeath = surrender; s.retarget = rand(0, 0.5);
    pushOut(s.pos, 0.6); return s;
  }
  if (kind === 'mech') {
    const m = instance(pick(['mech', 'mech_heavy'])); m.root.position.set(x, 0, z);
    const e = makeEnt('mech', m.root, { model: m, r: 2.2, hh: 3, team: 'earth', hp: 320, brain: brainMech, mini: '#ff4a8a', miniR: 3, shadow: 4 });
    e.zap = true; e.lootable = false; e.aggressive = aggressive; e.retarget = 0; e.anim('idle');
    e.onDeath = (d: Entity) => { FX.explode(_v1.copy(d.pos).setY(3), 1.6); d.anim('stun', { once: true }); d.brain = null; G.inv.stats.killed++; };
    return e;
  }
  const t = spawnTank(x, z, false, chance(0.3)); t.brain = brainDefTank; t.hp = t.maxHp = DEFENDER.tank.hp; t.aggressive = aggressive; t.retarget = 0;
  t.onDeath = (d: Entity) => { wreckVehicle(d); G.inv.stats.killed++; };
  return t;
}
function brainDefender(e: Entity, dt: number) {
  if (e.hp <= 0) { e.anim('wave'); return; }
  if (e.stun > 0) { e.anim('stun', { once: true }); return; }
  e.retarget -= dt;
  if (e.retarget <= 0 || !e.target || e.target.dead || (e.target !== G.player && e.target.hp <= 0)) { e.retarget = 0.5 + rand(0, 0.2); e.target = findAlienTarget(e, e.aggressive ? 95 : 48); }
  const T = e.target, W: Weapon = e.weapon;
  if (T && !(T === G.player && G.player.dead)) {
    const d = hdist(e.pos, T.pos) - (T.r || 0) * 0.5, ang = Math.atan2(T.pos.x - e.pos.x, T.pos.z - e.pos.z);
    if (d > W.range * 0.9) { e.heading = angTo(e.heading, ang, 6 * dt); e.speed = damp(e.speed, e.runSpeed * 0.8, 4, dt); stepMove(e, dt); e.anim('runaim'); }
    else { e.speed = 0; e.heading = angTo(e.heading, ang, 8 * dt); e.obj.rotation.y = e.heading; e.anim('aim'); e.cool -= dt; if (e.cool <= 0) { e.cool = 1 / DEFENDER.soldier.rate + rand(0, 0.35); fireAt(e, _v2.copy(e.pos).setY(1.7), T, W); } }
  } else if (e.post && hdist(e.pos, e.post) > 3) { e.heading = angTo(e.heading, Math.atan2(e.post.x - e.pos.x, e.post.z - e.pos.z), 5 * dt); e.speed = damp(e.speed, e.walkSpeed * 2, 3, dt); stepMove(e, dt); e.anim('walk'); }
  else { e.speed = 0; e.anim('idle'); }
}
function brainDefTank(e: Entity, dt: number) {
  if (smokeIfWrecked(e, dt)) { e.animSpeed = 0; return; }
  e.retarget -= dt;
  if (e.retarget <= 0 || !e.target || e.target.dead || (e.target !== G.player && e.target.hp <= 0)) { e.retarget = 0.6; e.target = findAlienTarget(e, e.aggressive ? 110 : 60, 'any'); if (e.target && e.target.air) e.target = null; }
  const T = e.target; if (!T || (T === G.player && G.player.dead)) { e.speed = damp(e.speed, 0, 2, dt); e.animSpeed = 0; return; }
  const d = hdist(e.pos, T.pos), ang = Math.atan2(T.pos.x - e.pos.x, T.pos.z - e.pos.z);
  if (e.stun > 0) e.speed = 0; else if (d > 32) { e.heading = angTo(e.heading, ang, 0.9 * dt); e.speed = damp(e.speed, 6, 1.5, dt); } else e.speed = damp(e.speed, 0, 2, dt);
  stepMove(e, dt); e.anim('move'); e.animSpeed = e.speed / 6;
  e.turretAngle = angTo(e.turretAngle || 0, angWrap(ang - e.heading), 1.8 * dt); aimNode(e, e.turretAngle);
  e.cool -= dt;
  if (d < DEFENDER.tank.range && e.cool <= 0 && Math.abs(angWrap(ang - e.heading - e.turretAngle)) < 0.2) {
    e.cool = 1 / DEFENDER.tank.rate + rand(0, 0.6);
    const yaw = e.heading + e.turretAngle, from = new V3(e.pos.x + Math.sin(yaw) * 4.3, 2.2, e.pos.z + Math.cos(yaw) * 4.3);
    fireAt(e, from, T, INV_CANNON, { width: 0.45, trail: 2.5, kind: 'shell', sound: 'cannon', hitAir: false }); FX.spark(from, FXC.fireYellow, 6, 6, 0.75, 0.25, 0);
  }
}
function brainMech(e: Entity, dt: number) {
  e.retarget -= dt;
  if (e.retarget <= 0 || !e.target || e.target.dead || (e.target !== G.player && e.target.hp <= 0)) { e.retarget = 0.6; e.target = findAlienTarget(e, e.aggressive ? 100 : 60); }
  const T = e.target; if (!T || (T === G.player && G.player.dead)) { e.anim('idle'); return; }
  const d = hdist(e.pos, T.pos), ang = Math.atan2(T.pos.x - e.pos.x, T.pos.z - e.pos.z);
  e.heading = angTo(e.heading, ang, 2 * dt);
  if (d > 30) { e.speed = damp(e.speed, 4.5, 2, dt); stepMove(e, dt); e.anim('walk'); } else { e.speed = 0; e.obj.rotation.y = e.heading; e.anim('aim'); }
  e.cool -= dt;
  if (d < 40 && e.cool <= 0) { e.cool = 1.4; fireAt(e, new V3(e.pos.x + Math.sin(ang) * 2, 5, e.pos.z + Math.cos(ang) * 2), T, MECH_GUN, { width: 0.4, trail: 2.4, sound: 'cannon' }); }
}
// ---------- city bosses (Phase 2): the biggest cities send a giant war-mech when their HQ falls ----------
export const BOSS_NAMES: Record<string, string> = {
  'North America': 'Liberty Titan', 'South America': 'Jaguar Colossus', Europe: 'Iron Knight', Africa: 'Savanna Goliath',
  Asia: 'Mega Shogun', 'Middle East': 'Desert Djinn', Oceania: 'Reef Kraken',
};
function spawnBoss() {
  const I = G.inv, L = I.L || 1, m = instance('mech_heavy');
  m.root.position.set(0, 0, 22); m.root.scale.multiplyScalar(3.2);
  const hp = 1800 + 500 * L;
  const e = makeEnt('boss', m.root, { model: m, r: 7, hh: 9, team: 'earth', hp, brain: brainBoss, mini: '#ff4a8a', miniR: 6, shadow: 10 });
  e.zap = true; e.lootable = false; e.missT = 2.5; e.stompT = 4.5; e.heading = 0; e.anim('idle');
  e.onDeath = bossDown; I.bossEnt = e;
  FX.explode(_v1.set(0, 4, 22), 3); FX.smoke(_v2.set(0, 6, 22), 18, 4, 4, 6); G.shake = Math.max(G.shake, 1.2);
  UI.banner(`BOSS!<small>The ${I.boss.name} rises from the rubble</small>`, 'alert', 2.8); SFX.play('boss');
  UI.comm(`Earth's last defense: the <b>${I.boss.name}</b>! Keep the army on it, and shoot its missiles down with the ray.`, 6);
}
function brainBoss(e: Entity, dt: number) {
  if (e.hp <= 0) return;
  const I = G.inv, P = G.player, c = I.center, d = hdist(e.pos, c);
  e.heading = angTo(e.heading, Math.atan2(c.x - e.pos.x, c.z - e.pos.z), 1.2 * dt);
  if (d > 20 && e.stun <= 0) { e.speed = damp(e.speed, 3, 2, dt); stepMove(e, dt); e.anim('walk', { speed: 0.6 }); } else { e.speed = 0; e.obj.rotation.y = e.heading; e.anim('aim'); }
  // missile salvo at the saucer: 4 homing missiles the stun ray can shoot down
  if ((e.missT -= dt) <= 0 && P && !P.dead) {
    e.missT = 3.6; SFX.play('cannon', e.pos);
    for (let i = 0; i < 4; i++) {
      const side = i % 2 ? 1 : -1;
      PROJ.fire({ from: new V3(e.pos.x + side * 4, 24, e.pos.z), vel: new V3(side * rand(4, 9), rand(14, 20), rand(-5, 5)), team: 'earth', dmg: 9, splash: 3, life: 7, kind: 'missile', homing: P, turn: 1.5, src: e, width: 0.5 });
    }
  }
  // stomp: a shockwave that hurts nearby ground units
  if ((e.stompT -= dt) <= 0) {
    e.stompT = 5.5; FX.explode(_v1.copy(e.pos).setY(0.5), 2.6); FX.word(_v2.copy(e.pos).setY(4), 'boom', 2); G.shake = Math.max(G.shake, 0.8);
    for (const u of G.ents) if (u.team === 'alien' && !u.dead && !u.air && hdist(u.pos, e.pos) < 18) damageEnt(u, 55, e);
    damageBuildings(e.pos.x, e.pos.z, 20, 220);
  }
}
function bossDown(e: Entity) {
  e.brain = null; e.anim('stun', { once: true }); G.inv.stats.killed++;
  for (let i = 0; i < 5; i++) setTimeout(() => FX.explode(_v1.set(e.pos.x + rand(-6, 6), rand(4, 20), e.pos.z + rand(-6, 6)), 2.2), i * 220);
  invasionHooks.onBoss(G.inv.boss.name); invasionHooks.onWin();
}

// ---------- your army ----------
const hypnoBrute = (x: number, z: number) => spawnHuman(x, z, 'brute', { team: 'alien', brain: brainUnit, hp: UNIT_TYPES.brute.hp, mini: '#d2b0ff' });
export function spawnUnit(type: UnitKey, x: number, z: number, drop = false) {
  const T = UNIT_TYPES[type]; let e: Entity;
  if (type === 'brute') { e = hypnoBrute(x, z); e.r = T.radius; }
  else {
    let obj: THREE.Object3D, legs: THREE.Group[] = null;
    if (type === 'clone') obj = makeGrayAlien(); else if (type === 'saucer') obj = miniSaucer(); else { const w = makeWalker(); obj = w.group; legs = w.legs; }
    obj.position.set(x, T.air ? 12 : 0, z);
    e = makeEnt(type, obj, { r: T.radius, hh: type === 'walker' ? 6 : type === 'saucer' ? 0 : 1, team: 'alien', hp: T.hp, brain: brainUnit, mini: '#d2b0ff', miniR: type === 'walker' ? 3 : 1.7, air: T.air, shadow: type === 'walker' ? 6.5 : type === 'saucer' ? 3.5 : 1.4, heading: Math.PI });
    e.legs = legs;
  }
  e.type = T; e.utype = type; e.retarget = rand(0, 0.4); e.lootable = false; e.punchT = 0; e.onDeath = unitDown;
  if (drop) { FX.pillar(e.pos, PAL.violet, 120, 0.9, T.radius + 0.6); e.pos.y = T.air ? 30 : 16; e.dropping = true; SFX.play('deploy'); }   // Empire tech drop
  return e;
}
function unitDown(e: Entity) {
  e.dead = true;
  FX.pillar(e.pos, PAL.violet, 50, 0.6, e.r + 0.5); FX.spark(_v1.copy(e.pos).setY(e.pos.y + 1.5), FXC.violet, 10, 8, 0.5, 0.5);
  if (e.utype === 'walker' || e.utype === 'saucer') FX.explode(_v1.copy(e.pos).setY(e.pos.y + (e.utype === 'walker' ? 8 : 0)), e.utype === 'walker' ? 1.8 : 0.8);
  G.save.army[e.utype] = Math.max(0, G.save.army[e.utype] - 1); G.save.totals.unitsLost++; G.inv.stats.lost++;
}
function findEarthTarget(e: Entity, range: number) {
  let best: Entity = null, bd = 1e9; const I = G.inv;
  for (const o of G.ents) {
    if (o.team !== 'earth' || o.dead || o.hp <= 0) continue;
    if (o.kind === 'hq' && I.pylonsLeft > 0) continue;
    const d = hdist(e.pos, o.pos) - (o.structure ? o.r : 0); if (d > range) continue;
    if (!e.air && d > 6 && !losClear(e.pos, o.pos, (o.structure ? o.r : 0) + 3)) continue;
    const s = d + (o.structure ? 10 : 0); if (s < bd) { bd = s; best = o; }
  }
  return best;
}
export function armyObjective() {
  const I = G.inv;
  if (I.objective && !I.objective.dead && I.objective.hp > 0) return I.objective;
  let best: Entity = null, bd = 1e9;
  for (const p of I.pylons) if (p.hp > 0) { const d = hdist(I.center, p.pos); if (d < bd) { bd = d; best = p; } }
  I.objective = best || (I.hq.hp > 0 ? I.hq : null);
  return I.objective;
}
const _fd = new V3();
function brainUnit(e: Entity, dt: number) {
  const T = e.type;
  if (e.dropping) { const gy = T.air ? 12 : 0; e.pos.y = damp(e.pos.y, gy, 5, dt); if (Math.abs(e.pos.y - gy) < 0.3) { e.pos.y = gy; e.dropping = false; e.jelly = 1; e.jellyT = 0; FX.spark(e.pos, FXC.slime, 7, 6, 0.5, 0.4, 0); } return; }   // landing: slime splash + jelly squash
  e.retarget -= dt;
  if (e.retarget <= 0 || !e.target || e.target.dead || e.target.hp <= 0) { e.retarget = 0.35 + rand(0, 0.25); e.target = findEarthTarget(e, T.range + 14); }
  const obj = armyObjective(); let tgt = e.target, moving = false;
  if (!tgt && obj && hdist(e.pos, obj.pos) - obj.r <= T.range + 1) tgt = obj;
  if (tgt) {
    const d = hdist(e.pos, tgt.pos) - (tgt.structure ? tgt.r : tgt.r * 0.5), ang = Math.atan2(tgt.pos.x - e.pos.x, tgt.pos.z - e.pos.z);
    if (d > T.range * 0.92) { e.heading = angTo(e.heading, ang, 5 * dt); e.speed = damp(e.speed, T.speed, 4, dt); moving = true; }
    else { e.speed = damp(e.speed, 0, 8, dt); e.heading = angTo(e.heading, ang, 7 * dt); e.cool -= dt; if (e.cool <= 0) { e.cool = (1 / T.rate) * rand(0.9, 1.15); unitAttack(e, tgt); } }
  } else if (obj) {
    if (T.air) e.heading = angTo(e.heading, Math.atan2(obj.pos.x - e.pos.x, obj.pos.z - e.pos.z), 3 * dt);
    else { flowDir(flowFor(obj), e.pos, _fd); if (_fd.lengthSq() > 0) e.heading = angTo(e.heading, Math.atan2(_fd.x, _fd.z), 6 * dt); }
    e.speed = damp(e.speed, T.speed, 3, dt); moving = true;
  } else e.speed = damp(e.speed, 0, 5, dt);
  if (T.air) {
    e.pos.x += Math.sin(e.heading) * e.speed * dt; e.pos.z += Math.cos(e.heading) * e.speed * dt; e.obj.rotation.y = e.heading;
    const H = G.mapHalf - 4; e.pos.x = Math.max(-H, Math.min(H, e.pos.x)); e.pos.z = Math.max(-H, Math.min(H, e.pos.z));
    e.pos.y = 12 + Math.sin(e.t * 2 + e.seed) * 0.6; e.obj.rotation.x = e.speed / T.speed * 0.2;
  } else if (e.speed > 0.05) stepMove(e, dt); else e.obj.rotation.y = e.heading;
  if (e.model) { e.punchT -= dt; e.anim(e.punchT > 0 ? 'punch' : moving ? 'run' : 'idle'); }
  else if (e.utype === 'clone') { e.pos.y = moving ? Math.abs(Math.sin(e.t * 9)) * 0.14 : 0; e.obj.rotation.z = moving ? Math.sin(e.t * 9) * 0.06 : 0; }
  else if (e.utype === 'walker') { const s = moving ? 1 : 0.15; e.legs.forEach((l: THREE.Group, i: number) => { l.rotation.x = Math.sin(e.t * 2.6 + i * 2.1) * 0.22 * s; }); e.obj.children[0].position.y = 9 + Math.sin(e.t * 5.2) * 0.25 * s; }
}
function unitAttack(e: Entity, tgt: Entity) {
  const T = e.type, aim = new V3(tgt.pos.x, tgt.pos.y + (tgt.hh || 0), tgt.pos.z);
  if (e.utype === 'brute') { e.punchT = 0.35; damageEnt(tgt, T.dmg, e); FX.spark(aim.setY(Math.min(aim.y, 2)), FXC.poster, 5, 5, 0.4, 0.25); SFX.play('hit', e.pos, 0.15); return; }
  if (e.utype === 'walker') {
    const from = new V3(e.pos.x + Math.sin(e.heading) * 3, 8.8, e.pos.z + Math.cos(e.heading) * 3);
    FX.line(from, aim, FXC.violet, 0.8, 0.2); FX.explode(aim, 0.7, true); SFX.play('cannon', e.pos, 0.1); damageEnt(tgt, T.dmg, e);   // walker cannon: Empire violet, never orange
    for (const o of G.ents) if (o !== tgt && o.team === 'earth' && !o.dead && o.hp > 0 && hdist(o.pos, aim) < T.splash) damageEnt(o, T.dmg * 0.5, e);
    return;
  }
  const from = e.utype === 'saucer' ? new V3(e.pos.x, e.pos.y - 0.6, e.pos.z) : new V3(e.pos.x + Math.sin(e.heading) * 0.6, 1.5, e.pos.z + Math.cos(e.heading) * 0.6);
  fireAt(e, from, tgt, { ...PLASMA, dmg: T.dmg }, { width: 0.26, trail: 2.2, sound: 'zap' });
}
export function separateUnits() {
  const L = G.ents.filter(e => !e.dead && !e.air && (e.team === 'alien' || (e.team === 'earth' && !e.structure && e.hp > 0)));
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j], dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, min = a.r + b.r, d2 = dx * dx + dz * dz;
    if (d2 < min * min && d2 > 1e-6) { const d = Math.sqrt(d2), k = (min - d) / d * 0.5; a.pos.x -= dx * k; a.pos.z -= dz * k; b.pos.x += dx * k; b.pos.z += dz * k; }
  }
}
export function deployUnit(type: UnitKey) {
  const T = UNIT_TYPES[type]; if (!G.inv || G.inv.over) return;
  if (!canAfford(G.save.res, T.cost)) { UI.toast(`Not enough for a ${T.name} (${costText(T.cost)})`, 'warn', 1.8); SFX.play('error'); return; }
  payCost(G.save.res, T.cost); G.save.army[type]++; G.inv.stats.deployed++;
  const p = new V3(G.player.pos.x + rand(-3, 3), 0, G.player.pos.z + rand(-3, 3)); pushOut(p, T.radius + 0.5);
  spawnUnit(type, p.x, p.z, true); invasionHooks.onDeploy();
}
export function updateWaves(dt: number) {
  const I = G.inv; if (I.hq.hp <= 0 || I.over) return;
  I.waveT -= dt; if (I.waveT > 0) return; I.waveT = I.F.waveEvery; I.waves++;
  for (let i = 0; i < I.F.waveSoldiers; i++) spawnDefender('soldier', rand(-8, 8), 20 + rand(0, 4), true);
  if (I.F.waveTankEvery && I.waves % I.F.waveTankEvery === 0) { const p = pick(G.entries); spawnDefender(I.L >= 5 && chance(0.4) ? 'mech' : 'tank', p.x, p.z, true); }
  UI.toast('Earth reinforcements are coming out of the HQ', 'warn', 2.2);
}
/** Place Earth's defenders and land your army. Returns the invasion state. */
export function setupInvasion(L: number) {
  const F = earthForces(L);
  const I = G.inv = { L, F, waveT: F.waveEvery, waves: 0, flows: new Map(), over: false, objective: null as Entity, center: new V3(0, 0, 140), grid: null as any,
    hq: null as Entity, pylons: [] as Entity[], pylonsLeft: 3, boss: null as { name: string } | null, bossEnt: null as Entity, stats: { humans: 0, animals: 0, vehicles: 0, artifacts: 0, lost: 0, killed: 0, surrendered: 0, deployed: 0, buildings: 0, startArmy: { ...G.save.army } } };
  I.hq = spawnHQ(F.hqHp);
  I.pylons = PYLON_SPOTS.map(([x, z]) => spawnPylon(x, z, F.pylonHp));
  const turretSpots = [[-50, 62], [50, 62], [0, -62], [-20, 22], [20, 22], [0, -24], [-62, 50], [62, 50]];
  for (let i = 0; i < F.turrets; i++) spawnTurret(turretSpots[i % 8][0], turretSpots[i % 8][1], DEFENDER.turret.hp);
  I.grid = blockedGrid();
  const posts = [[-50, 40], [50, 40], [0, -40], [-12, 24], [12, 24], [-25, 75], [25, 75], [-75, 25], [75, 25], [0, 100], [-50, 100], [50, 100]];
  for (let i = 0; i < F.soldiers; i++) { const [x, z] = posts[i % posts.length]; spawnDefender('soldier', x + rand(-5, 5), z + rand(-5, 5)); }
  const tankSpots = [[0, 75], [-25, 50], [25, 50], [-75, 75], [75, 75], [0, 25], [-25, -25], [25, -25]];
  for (let i = 0; i < F.tanks; i++) { const [x, z] = tankSpots[i % 8]; const t = spawnDefender(L >= 4 && i % 3 === 2 ? 'mech' : 'tank', x, z); t.heading = Math.PI; t.obj.rotation.y = Math.PI; }
  let i = 0;
  for (const [k, n] of Object.entries(G.save.army)) for (let j = 0; j < n; j++, i++) spawnUnit(k as UnitKey, ((i % 14) - 6.5) * 4.5 + rand(-1, 1), 136 + Math.floor(i / 14) * 4 + rand(-1, 1));
  return i;
}
/** Per-frame invasion upkeep: army centre, dome + pylon visuals. */
export function tickInvasion(dt: number) {
  const I = G.inv; let n = 0; I.center.set(0, 0, 0);
  for (const e of G.ents) if (e.team === 'alien' && !e.dead) { I.center.add(e.pos); n++; }
  if (n) I.center.multiplyScalar(1 / n); else I.center.copy(G.player.pos);
  const hq = I.hq, dome = hq.dome; hq.domeFlash = Math.max(0, hq.domeFlash - dt * 2); dome.material.uniforms.time.value = G.time;
  hq.domeHitT += dt; const du = dome.material.uniforms;
  du.flash.value = hq.domeHitT < 0.08 ? 1 : 0; du.wob.value = hq.domeHitT < 1 ? Math.exp(-6 * hq.domeHitT) : 0;   // hit flash + wobble
  if (I.pylonsLeft > 0) dome.material.uniforms.opacity.value = 0.55 + hq.domeFlash * 0.4 + Math.sin(G.time * 3) * 0.05;
  else { dome.scale.multiplyScalar(1 - dt * 1.5); dome.material.uniforms.opacity.value *= 1 - dt * 2; if (dome.scale.x < 0.05) dome.visible = false; }
  for (const p of I.pylons) if (p.hp > 0) { p.core.rotation.y += dt * 2; p.core.scale.setScalar(1 + Math.sin(G.time * 4 + p.pos.x) * 0.12); p.link.material.opacity = 0.5 + Math.sin(G.time * 10 + p.pos.x) * 0.2; }
  return n;
}
export function surrenderAll() {
  for (const e of G.ents) {
    if (e.team !== 'earth' || e.dead || e.hp <= 0) continue;
    if (e.kind === 'soldier') { e.hp = 0; surrender(e); e.sayT = rand(0, 1); } else if (!e.structure || e.kind === 'turret') { e.hp = 0; e.brain = null; }
  }
}
