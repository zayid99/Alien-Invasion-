// Entities: everything that lives in a mission (people, animals, vehicles, units, structures).
import * as THREE from 'three';
import { G } from '../game/state';
import { LOOT } from '../data/balance';
import type { Loot } from '../data/balance';
import { blobShadow } from '../gfx/kit';
import { FT, FX } from '../gfx/fx';
import { play } from '../core/assets';
import type { ModelInstance } from '../core/assets';
import { V3, clamp, pick, rand } from '../core/util';
import type { Vec3 } from '../core/util';

export type Team = 'neutral' | 'earth' | 'alien';
export type Brain = (e: Entity, dt: number) => void;

export class Entity {
  kind: string; obj: THREE.Object3D; pos: Vec3; vel = new V3();
  r = 0.6; hh = 1; team: Team = 'neutral'; hp = 10; maxHp = 10; dead = false;
  loot: Loot | null = null; lootable = false; zap = false; structure = false; air = false;
  brain: Brain | null = null; state = 'idle'; t = rand(0, 5); stun = 0; sayT = 0; flash = 0; jiggle = 0;
  model: ModelInstance | null = null; animSpeed = 1;
  mini: string | null = null; miniR = 1.6; heading = 0; speed = 0; lift = 0; vy = 0; cool = rand(0, 1.5); seed = rand(0, 10);
  shadow: THREE.Mesh | null = null; shadowSize = 1.5;
  /** Jelly hit spring (§6 "Squash-and-stretch"): strength s (1 on hit, × exp(−8·dt)) and its phase clock. */
  jelly = 0; jellyT = 0;
  /** Seconds since this entity started rising in the tractor beam (lift squash + wobble). */
  liftT = 0;
  /** Rest scale of `obj` while a squash is applied (captured lazily), and whether obj.scale is currently modified. */
  baseScale: Vec3 | null = null; squashed = false;
  onDamage: ((e: Entity, dmg: number, src: any) => void) | null = null;
  onDeath: ((e: Entity, src: any) => void) | null = null;
  onAbduct: ((e: Entity) => void) | null = null;
  [k: string]: any;   // per-kind data (home, goal, lane, weapon, turret...)
  constructor(kind: string, obj: THREE.Object3D) { this.kind = kind; this.obj = obj; this.pos = obj.position; }
  /** Play an animation by meaning ("idle", "run", "lifted", "stun"...). */
  anim(name: string, o: { fade?: number; once?: boolean; speed?: number } = {}) { if (this.model) play(this.model, name, o); }
}

export interface EntOpts { r?: number; hh?: number; team?: Team; hp?: number; brain?: Brain; mini?: string; miniR?: number; air?: boolean; shadow?: number; heading?: number; model?: ModelInstance; lootKind?: string }
export function makeEnt(kind: string, obj: THREE.Object3D, o: EntOpts = {}) {
  const e = new Entity(kind, obj);
  e.r = o.r ?? 0.6; e.hh = o.hh ?? 1; e.team = o.team ?? 'neutral'; e.hp = e.maxHp = o.hp ?? 10;
  const lk = o.lootKind ?? kind; e.loot = LOOT[lk] || null; e.lootable = !!e.loot;
  e.brain = o.brain ?? null; e.mini = o.mini ?? null; e.miniR = o.miniR ?? 1.6; e.air = !!o.air; e.model = o.model ?? null;
  e.heading = o.heading ?? rand(0, Math.PI * 2); obj.rotation.y = e.heading;
  e.shadowSize = o.shadow ?? 1.5; e.shadow = blobShadow(e.shadowSize);
  G.world.add(obj); G.world.add(e.shadow); G.ents.push(e);
  return e;
}
export function removeEnt(e: Entity) {
  G.world.remove(e.obj); if (e.shadow) G.world.remove(e.shadow);
  if (e.model?.mixer) { e.model.mixer.stopAllAction(); e.model.mixer.uncacheRoot(e.obj); }
}
export function updateEnts(dt: number, updateLift: (e: Entity, dt: number) => void) {
  for (let i = 0; i < G.ents.length; i++) {
    const e = G.ents[i]; if (e.dead) continue;
    e.t += dt; e.sayT -= dt; if (e.stun > 0) e.stun -= dt;
    if (e.lift) updateLift(e, dt); else if (e.brain) e.brain(e, dt);
    if (e.jiggle > 0) { e.jiggle -= dt; e.obj.rotation.z = e.jiggle > 0 ? Math.sin(G.time * 45) * 0.05 : 0; }
    applySquash(e, dt);
    if (e.model?.mixer) e.model.mixer.update(dt * e.animSpeed);
    if (e.shadow) { e.shadow.position.set(e.pos.x, 0.05, e.pos.z); e.shadow.scale.setScalar(e.shadowSize * clamp(1 - e.pos.y / 20, 0.15, 1)); }
  }
  for (let i = G.ents.length - 1; i >= 0; i--) if (G.ents[i].dead) { removeEnt(G.ents[i]); G.ents.splice(i, 1); }
}
export function damageEnt(e: Entity, dmg: number, src?: any) {
  if (!e || e.dead) return;
  if (e.hp > 0) jellyHit(e);
  if (e.onDamage) { e.onDamage(e, dmg, src); return; }
  if (e.hp <= 0) return;
  e.hp -= dmg; e.flash = 0.12;
  if (e.hp <= 0) { e.hp = 0; e.onDeath?.(e, src); }
}

// ---------- squash and stretch (visual only: hitboxes use e.r / e.hh, never the object scale) ----------
/**
 * Generic jelly hit spring on the entity's visual root (§6, §9): s = 1 on hit, scale
 * (1 + 0.22·s·sin(30t), 1 − 0.22·s·sin(30t), 1 + 0.22·s·sin(30t)), s *= exp(−8·dt).
 * Structures wobble at a third of the strength; the HQ (whose shield dome shows hits) does not wobble.
 */
export function jellyHit(e: Entity, s = 1) {
  if (!e || e.dead || e.kind === 'hq') return;
  if (e.jelly < 0.3) e.jellyT = 0;   // restart the phase only once the last wobble has mostly settled (rapid fire keeps it going)
  e.jelly = Math.max(e.jelly, e.structure ? s * 0.35 : s);
}
/**
 * Apply the hit spring and the abduction squash (lift start: squash to (0.9, 1.18, 0.9) over 120 ms, ease back,
 * then scale.y = 1 + 0.12·sin(9t) with xz inverse while lifted). Restores the rest scale once both are done.
 */
function applySquash(e: Entity, dt: number) {
  let sxz = 1, sy = 1;
  if (e.jelly > 0.01) {
    const w = 0.22 * e.jelly * Math.sin(30 * e.jellyT);
    sxz += w; sy -= w; e.jellyT += dt; e.jelly *= Math.exp(-8 * dt);
  } else e.jelly = 0;
  if (e.lift === 1) {
    const t = (e.liftT += dt);
    const k = t < 0.12 ? t / 0.12 : Math.max(0, 1 - (t - 0.12) / 0.18), q = k * k * (3 - 2 * k);   // squash in, ease back
    const wob = clamp((t - 0.12) / 0.3, 0, 1) * 0.12 * Math.sin(t * 9);                          // lifted jelly wobble
    sxz *= (1 - 0.1 * q) * (1 - wob); sy *= (1 + 0.18 * q) * (1 + wob);
  } else e.liftT = 0;
  if (sxz === 1 && sy === 1) {
    if (e.squashed) { e.obj.scale.copy(e.baseScale); e.squashed = false; }
    return;
  }
  if (!e.squashed) e.baseScale = (e.baseScale || new V3()).copy(e.obj.scale);   // rest scale (re-read every time a squash starts)
  e.obj.scale.set(e.baseScale.x * sxz, e.baseScale.y * sy, e.baseScale.z * sxz); e.squashed = true;
}
// Dizzy stars orbit every stunned entity (drawn by FX.update; §6 "Dizzy stars").
FX.addDizzySource(() => G.ents);

/** Push a point out of any building it ended up inside. */
export function pushOut(pos: Vec3, r: number) {
  for (const o of G.obstacles) {
    if (pos.x < o.minX - r || pos.x > o.maxX + r || pos.z < o.minZ - r || pos.z > o.maxZ + r) continue;
    const dl = pos.x - (o.minX - r), dr = (o.maxX + r) - pos.x, dn = pos.z - (o.minZ - r), ds = (o.maxZ + r) - pos.z, m = Math.min(dl, dr, dn, ds);
    if (m === dl) pos.x = o.minX - r; else if (m === dr) pos.x = o.maxX + r; else if (m === dn) pos.z = o.minZ - r; else pos.z = o.maxZ + r;
    return true;
  }
  return false;
}
export function stepMove(e: Entity, dt: number, avoid = true) {
  e.pos.x += Math.sin(e.heading) * e.speed * dt; e.pos.z += Math.cos(e.heading) * e.speed * dt;
  if (avoid && pushOut(e.pos, e.r)) e.heading += (e.seed > 5 ? 1 : -1) * 2.2 * dt;
  const H = G.mapHalf - 4; e.pos.x = clamp(e.pos.x, -H, H); e.pos.z = clamp(e.pos.z, -H, H);
  e.obj.rotation.y = e.heading;
}
export function say(e: Entity, lines: readonly string[], cls = 'say', life = 1.6) { if (e.sayT > 0) return; e.sayT = 3; FT.spawn(e.pos, pick(lines), cls, life, 0.4, e); }

/** Attach an object to a named bone (e.g. a helmet on the head), or to the root if not found. */
export function attachToBone(e: Entity, re: RegExp, obj: THREE.Object3D, fallbackY = 1.6) {
  let bone: THREE.Object3D | null = null;
  e.obj.traverse(o => { if (!bone && (o as any).isBone && re.test(o.name)) bone = o; });
  if (!bone) { obj.position.y += fallbackY; e.obj.add(obj); return; }
  e.obj.updateMatrixWorld(true);
  const s = new V3(); (bone as THREE.Object3D).getWorldScale(s); const k = e.obj.scale.x / (s.x || 1);
  obj.scale.multiplyScalar(k); obj.position.multiplyScalar(k); (bone as THREE.Object3D).add(obj);
}
