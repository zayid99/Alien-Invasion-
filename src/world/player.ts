// The player's flying saucer: flight, tractor beam, stun ray, cargo, shield and the follow camera.
import * as THREE from 'three';
import { G } from '../game/state';
import { scene, camera, LIGHT } from '../core/engine';
import { INPUT } from '../core/input';
import { SFX } from '../core/audio';
import { makeUFO } from '../gfx/models';
import { FX, FT, BEAM } from '../gfx/fx';
import { UI } from '../ui/dom';
import { CFG, STAT, RES } from '../data/balance';
import { V3, _v1, _v2, chance, clamp, damp, hdist, rand, reducedMotion } from '../core/util';
import { damageEnt, say } from './entity';
import type { Entity } from './entity';
import { PROJ, raiseAlert } from './combat';
import { HUMAN_KINDS, ANIMAL_KINDS, SAY } from './lines';

export let UFO: ReturnType<typeof makeUFO> = null;
export const playerHooks = { onDown: () => {}, onSend: () => {} };
export function initUFO() { UFO = makeUFO(); scene.add(UFO.group); UFO.group.visible = false; }

export function playerStats() {
  const u = G.save.up;
  return { maxLift: STAT.maxLift[u.beam], liftSpeed: STAT.liftSpeed[u.beam], beamRadius: STAT.beamRadius[u.beam], maxShield: STAT.maxShield[u.shield],
    regen: STAT.regen[u.shield], speed: STAT.speed[u.engine], rayDmg: STAT.rayDmg[u.ray], rayRate: STAT.rayRate[u.ray], cargoCap: STAT.cargoCap[u.cargo] };
}
export function makePlayer(x: number, z: number) {
  const s = playerStats();
  UFO.group.position.set(x, G.ufoY, z); UFO.group.visible = true; UFO.group.rotation.set(0, 0, 0);
  G.player = { obj: UFO.group, pos: UFO.group.position, vel: new V3(), stats: s, shield: s.maxShield, maxShield: s.maxShield, boost: 1, beamOn: false,
    dead: false, hurtT: 9, rayCool: 0, sending: 0, pulse: 0, hitFlash: 0, liftingMass: 0, hh: 0, lowWarned: false, moved: 0 };
  return G.player;
}
export function updatePlayer(dt: number) {
  const P = G.player; if (!P || P.dead) return;
  const S = P.stats, m = INPUT.move(), yaw = G.camYaw;
  const wx = Math.cos(yaw) * m.x - Math.sin(yaw) * m.z, wz = -Math.sin(yaw) * m.x - Math.cos(yaw) * m.z;
  let speed = S.speed * (P.beamOn ? 0.55 : 1);
  if (INPUT.boost() && P.boost > 0.04 && (m.x || m.z)) { speed *= 1.8; P.boost = Math.max(0, P.boost - dt * 0.5); } else P.boost = Math.min(1, P.boost + dt * 0.2);
  P.vel.x = damp(P.vel.x, wx * speed, 4.5, dt); P.vel.z = damp(P.vel.z, wz * speed, 4.5, dt);
  P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt; P.moved += Math.hypot(P.vel.x, P.vel.z) * dt;
  const H = G.mapHalf - 8; P.pos.x = clamp(P.pos.x, -H, H); P.pos.z = clamp(P.pos.z, -H, H);
  P.pos.y = G.ufoY + Math.sin(G.time * 2) * 0.35;
  P.obj.rotation.z = damp(P.obj.rotation.z, -P.vel.x / S.speed * 0.22, 5, dt);
  P.obj.rotation.x = damp(P.obj.rotation.x, P.vel.z / S.speed * 0.22, 5, dt);
  UFO.body.rotation.y += dt * (0.7 + P.liftingMass * 0.1);
  P.beamOn = INPUT.beam() && P.sending <= 0;
  if (P.beamOn) beamGrab(P); else P.liftingMass = 0;
  BEAM.update(dt, P.pos, S.beamRadius, P.beamOn, G.time);
  const sp = Math.hypot(P.vel.x, P.vel.z) / S.speed;
  SFX.setLoop('beam', P.beamOn ? 0.13 : 0, 1 + P.liftingMass * 0.03); SFX.setLoop('engine', 0.05 + sp * 0.07, 1 + sp * 0.5);
  P.rayCool -= dt;
  if (INPUT.zap() && P.rayCool <= 0 && P.sending <= 0) { P.rayCool = 1 / S.rayRate; fireRay(P); }
  if (G.mode === 'mission' && INPUT.hit('KeyR')) startSend();
  if (P.sending > 0) { P.sending -= dt; if (P.sending <= 0) finishSend(); }
  P.hurtT += dt; if (P.hurtT > CFG.shieldRegenDelay) P.shield = Math.min(P.maxShield, P.shield + S.regen * dt);
  P.pulse = Math.max(0, P.pulse - dt * 3); P.hitFlash = Math.max(0, P.hitFlash - dt * 2.5);
  animateSaucer(P);
}
function animateSaucer(P: any) {
  const low = P.shield < P.maxShield * 0.25;
  UFO.lights.forEach((l, i) => {
    const on = (G.time * 7 + i) % 14 < 3;
    if (P.sending > 0) l.material.color.setRGB(3, 3, 3.5);
    else if (low && (G.time * 6) % 2 < 1) l.material.color.setRGB(4, 0.3, 0.2);
    else if (i % 2) l.material.color.setRGB(on ? 4 : 0.6, on ? 3 : 0.45, on ? 1 : 0.15);
    else l.material.color.setRGB(on ? 2.8 : 0.45, on ? 1.4 : 0.22, on ? 4 : 0.6);
  });
  const glow = 1 + BEAM.on * 1.5 + P.pulse * 2; UFO.emitterMat.color.setRGB(0.9 * glow, 0.5 * glow, 2.2 * glow);
  UFO.shield.material.uniforms.opacity.value = Math.max(P.hitFlash * 0.9, P.sending > 0 ? 0.5 : 0, low ? 0.12 + 0.1 * Math.sin(G.time * 10) : 0);
  UFO.shield.material.uniforms.time.value = G.time;
  LIGHT.ufo.position.set(P.pos.x, P.pos.y - 7, P.pos.z); LIGHT.ufo.intensity = 220 + BEAM.on * 200;
}
function beamGrab(P: any) {
  const S = P.stats; let lifting = 0;
  for (const e of G.ents) if (e.lift === 1 && !e.dead) lifting += e.loot.mass;
  for (const e of G.ents) {
    if (e.dead || e.lift || !e.lootable || e.team === 'alien' || hdist(e.pos, P.pos) > S.beamRadius) continue;
    const m = e.loot.mass;
    if (m > S.maxLift) {
      e.jiggle = 0.25;
      if ((e.heavyT || 0) < G.time) { e.heavyT = G.time + 2.2; FT.spawn(_v1.copy(e.pos).setY(3), `Too heavy: ${m} t (beam lifts ${S.maxLift} t)`, 'warn', 1.4, 1); SFX.play('heavy'); }
      continue;
    }
    if (G.mode === 'mission' && G.cargo.mass + lifting + m > S.cargoCap + 0.01) {
      if (G.cargoWarnT < G.time) { G.cargoWarnT = G.time + 3; UI.toast(INPUT.touch ? 'Cargo full! Tap SEND' : 'Cargo full! Press R to send it up', 'good', 2.4); SFX.play('error'); }
      continue;
    }
    e.lift = 1; e.vy = 0; lifting += m; e.stun = 0;
    if (HUMAN_KINDS.has(e.kind) && chance(0.5)) say(e, SAY.lifted);
  }
  P.liftingMass = lifting;
}
const _aim = new V3();
function fireRay(P: any) {
  let target: Entity = null, point: THREE.Vector3 = null;
  const from = new V3(P.pos.x, P.pos.y - 1.5, P.pos.z);
  if (INPUT.mouse.has && !INPUT.tb.zap) {
    const a = INPUT.aim(_aim); if (!a) return;
    const dd = hdist(a, P.pos); if (dd > 85) { a.x = P.pos.x + (a.x - P.pos.x) * 85 / dd; a.z = P.pos.z + (a.z - P.pos.z) * 85 / dd; }
    const mis = PROJ.list.find(p => p.kind === 'missile' && hdist(p.pos, a) < 7);
    if (mis) { mis.hp = -1; FX.explode(mis.pos, 0.6); point = mis.pos.clone(); }
    else { target = rayTargetNear(a, 5.5); point = target ? target.pos.clone().setY(target.pos.y + target.hh) : a.clone(); }
  } else {
    const mis = PROJ.list.find(p => p.kind === 'missile' && p.pos.distanceTo(P.pos) < 50);
    if (mis) { mis.hp = -1; FX.explode(mis.pos, 0.6); point = mis.pos.clone(); }
    else { target = autoTarget(P); if (!target) return; point = target.pos.clone().setY(target.pos.y + target.hh); }
  }
  FX.line(from, point, new THREE.Color(2.6, 1.3, 4.2), 0.32, 0.09); FX.spark(point, new THREE.Color(2.6, 1.5, 4), 6, 6, 0.3, 0.3);
  SFX.play('zap', null, 0.03);
  if (target) rayHit(target, P.stats.rayDmg);
}
function rayTargetNear(a: THREE.Vector3, r: number) {
  let best: Entity = null, bd = r;
  for (const e of G.ents) {
    if (e.dead || e.lift || e.team === 'alien' || !e.zap) continue;
    const s = hdist(e.pos, a) - e.r * 0.6 - (e.team === 'earth' && e.hp > 0 ? 2.5 : 0);
    if (s < bd) { bd = s; best = e; }
  }
  return best;
}
function autoTarget(P: any) {
  let best: Entity = null, bd = 1e9;
  for (const e of G.ents) {
    if (e.dead || e.lift || e.team === 'alien' || !e.zap) continue;
    if (e.kind === 'hq' && G.inv && G.inv.pylonsLeft > 0) continue;
    const d = hdist(e.pos, P.pos); if (d > 52) continue;
    let s: number;
    if (e.team === 'earth' && e.hp > 0 && !(e.stun > 0.5)) s = d - 60;
    else if (G.mode === 'mission' && HUMAN_KINDS.has(e.kind) && e.state === 'flee' && !(e.stun > 0) && d < 26) s = d;
    else continue;
    if (s < bd) { bd = s; best = e; }
  }
  return best;
}
export function rayHit(e: Entity, dmg: number) {
  e.flash = 0.1;
  if (HUMAN_KINDS.has(e.kind) || ANIMAL_KINDS.has(e.kind)) {
    if (G.mode === 'invasion' && e.team === 'earth') { damageEnt(e, dmg, 'player'); return; }
    const was = e.stun > 0; e.stun = Math.max(e.stun, 3.4 + dmg * 0.05);
    if (!was && HUMAN_KINDS.has(e.kind)) FT.spawn(e.pos, '✦ ✦ ✦', 'info', Math.min(e.stun, 2.2), 0.2, e);
    if (G.mode === 'mission' && e.team !== 'earth') raiseAlert(0.6);
    e.wasStunned = true;
    return;
  }
  damageEnt(e, e.structure ? dmg * 0.4 : dmg, 'player');   // a stun ray is weak against buildings: you need your army
}
export function damagePlayer(dmg: number) {
  const P = G.player; if (!P || P.dead || G.mode === 'victory' || P.invulnerable) return;
  P.shield -= dmg; P.hurtT = 0; P.hitFlash = 1;
  SFX.play('hit', null, 0.06); G.shake = Math.max(G.shake, 0.2 + dmg * 0.02);
  if (P.shield <= P.maxShield * 0.25 && !P.lowWarned) { P.lowWarned = true; UI.toast('Shield critical! Fly away to recharge', 'warn'); }
  if (P.shield > P.maxShield * 0.5) P.lowWarned = false;
  if (P.shield <= 0) {
    P.shield = 0; P.dead = true; P.beamOn = false;
    FX.explode(P.pos, 2.2); SFX.play('warp'); FX.pillar(P.pos, 0xff6a5a, 200, 1.5, 3); UFO.group.visible = false; BEAM.hide();
    setTimeout(() => playerHooks.onDown(), 1600);
  }
}
export function startSend() {
  const P = G.player; if (P.sending > 0) return;
  if (G.cargo.mass <= 0) { UI.toast('The cargo hold is empty', '', 1.5); SFX.play('error'); return; }
  P.sending = CFG.sendTime; SFX.play('send'); FX.pillar(P.pos, 0xc58bff, 220, CFG.sendTime + 0.4, 2.4);
}
function finishSend() { bankCargo(); UI.toast('Cargo received by the mothership', 'good', 1.8); playerHooks.onSend(); }
export function bankCargo() {
  for (const r of RES) { G.save.res[r] += G.cargo[r]; G.save.totals[r] += G.cargo[r]; if (G.night) G.night.banked[r] += G.cargo[r]; G.cargo[r] = 0; }
  G.cargo.mass = 0;
}
export function updateCamera(dt: number) {
  const P = G.player; if (!P) return;
  if (INPUT.down('KeyQ')) G.camYaw += 1.7 * dt;
  if (INPUT.down('KeyE')) G.camYaw -= 1.7 * dt;
  G.camDist = clamp(G.camDist + INPUT.wheel * 3, 22, 75);
  const d = G.camDist, yaw = G.camYaw;
  const lx = P.pos.x + P.vel.x * 0.3 - Math.sin(yaw) * 4, lz = P.pos.z + P.vel.z * 0.3 - Math.cos(yaw) * 4;
  _v1.set(lx + Math.sin(yaw) * d * 0.78, P.pos.y + d * 0.62, lz + Math.cos(yaw) * d * 0.78);
  camera.position.lerp(_v1, 1 - Math.exp(-5 * dt));
  G.shake = Math.max(0, G.shake - dt * 2.2);
  if (G.shake > 0 && !reducedMotion) camera.position.add(_v2.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(G.shake * 0.6));
  camera.lookAt(lx, P.pos.y * 0.3, lz);
}
FX.onShake((pos, size) => { if (G.player) G.shake = Math.max(G.shake, clamp(1.2 * size - hdist(pos, G.player.pos) / 60, 0, 1.4)); });
