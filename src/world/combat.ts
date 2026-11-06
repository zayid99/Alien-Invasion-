// Projectiles, aimed shots, Earth's alert level, and lifting things into the saucer.
import * as THREE from 'three';
import { G } from '../game/state';
import { FX, FT, FXC } from '../gfx/fx';
import { SFX } from '../core/audio';
import { UI } from '../ui/dom';
import { RES } from '../data/balance';
import { V3, _v1, _v3, chance, clamp, hdist, rand } from '../core/util';
import type { Vec3 } from '../core/util';
import { damageEnt, say } from './entity';
import type { Entity } from './entity';
import { damagePlayer, saucerBurp } from './player';
import { SAY, HUMAN_KINDS, ANIMAL_KINDS } from './lines';
import { onAbduct, onCombo, onFullHold } from '../game/meta';
import { startMegaBeam } from './player';

export interface Proj { pos: Vec3; vel: Vec3; team: string; dmg: number; splash: number; life: number; color: THREE.Color; width: number; trail: number; homing: any; turn: number; kind: string; hp: number; src: any; hitAir: boolean; hitGround: boolean; puffT: number }
/**
 * Earth fire is always orange (§6): small arms HDR (4, 2.4, 0.6); tank shells HDR (4, 1.6, 0.4) at 1.4× width.
 * Applied here, and only here, so every Earth shooter (military.ts, invasion.ts) follows the rule: shooters pass
 * the base width. Missiles get a hot yellow head and leave toon puffs.
 */
function earthFire(kind: string, width: number) {
  if (kind === 'shell') return { color: FXC.fireOrange.clone(), width: width * 1.4 };
  if (kind === 'missile') return { color: FXC.fireYellow.clone(), width };   // white-hot head → poster-orange
  return { color: FXC.pistol.clone(), width };
}
export const PROJ = {
  list: [] as Proj[], _prev: new V3(), _c: new V3(),
  fire(o: { from: Vec3; vel: Vec3; team: string; dmg: number; splash?: number; life?: number; color?: THREE.ColorRepresentation; width?: number; trail?: number; homing?: any; turn?: number; kind?: string; src?: any; hitAir?: boolean; hitGround?: boolean }) {
    if (this.list.length > 300) return;
    const kind = o.kind || 'bullet';
    let color = new THREE.Color(o.color ?? 0xffc36a), width = o.width || 0.18;
    if (o.team === 'earth') ({ color, width } = earthFire(kind, width));
    this.list.push({ pos: o.from.clone(), vel: o.vel.clone(), team: o.team, dmg: o.dmg, splash: o.splash || 0, life: o.life || 2.5, color,
      width, trail: o.trail || 2.2, homing: o.homing || null, turn: o.turn || 0, kind, hp: kind === 'missile' ? 1 : 0, src: o.src || null,
      hitAir: o.hitAir !== false, hitGround: o.hitGround !== false, puffT: 0 });
  },
  clear() { this.list.length = 0; },
  update(dt: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i]; p.life -= dt;
      if (p.homing && !p.homing.dead) {
        const sp = p.vel.length(); _v1.copy(p.homing.pos).sub(p.pos).normalize().multiplyScalar(sp);
        p.vel.lerp(_v1, clamp(p.turn * dt, 0, 1)).setLength(sp);
        if ((p.puffT -= dt) <= 0) { p.puffT = 0.08; FX.smoke(p.pos, 1, 0.5, 0.7, 0.1); }   // toon trail puff every 0.08 s
      }
      this._prev.copy(p.pos); p.pos.addScaledVector(p.vel, dt);
      const hit = p.pos.y <= 0 ? 'ground' : this.collide(p, this._prev);
      if (hit || p.life <= 0 || p.hp < 0) { if (hit) this.impact(p, hit); this.list[i] = this.list[this.list.length - 1]; this.list.pop(); }
    }
  },
  collide(p: Proj, prev: Vec3): any {
    const seg = _v3.copy(p.pos).sub(prev), segLen = seg.length() || 1e-6;
    const test = (center: Vec3, r: number) => { _v1.copy(center).sub(prev); const t = clamp(_v1.dot(seg) / (segLen * segLen), 0, 1); _v1.copy(prev).addScaledVector(seg, t); return _v1.distanceToSquared(center) <= r * r; };
    if (p.team === 'earth') {
      const pl = G.player; if (pl && !pl.dead && test(pl.pos, 5.6)) return pl;
      if (G.mode === 'invasion') for (const e of G.ents) if (e.team === 'alien' && !e.dead && ((e.air && p.hitAir) || (!e.air && p.hitGround)) && test(this._c.copy(e.pos).setY(e.pos.y + e.hh), e.r + 0.4)) return e;
    } else {
      for (const e of G.ents) if (e.team === 'earth' && !e.dead && e.hp > 0 && test(this._c.copy(e.pos).setY(e.pos.y + e.hh), e.r + 0.5)) return e;
    }
    return null;
  },
  impact(p: Proj, hit: any) {
    if (p.splash > 0) {
      FX.explode(p.pos.clone().setY(Math.max(0.5, p.pos.y)), p.splash / 4.5);
      for (const e of G.ents) if (!e.dead && e.team !== p.team && e.team !== 'neutral' && e.hp > 0 && hdist(e.pos, p.pos) < p.splash + e.r && Math.abs(e.pos.y - p.pos.y) < 8) damageEnt(e, p.dmg * 0.6, p.src);
      if (p.team === 'earth' && G.player && hit !== G.player && G.player.pos.distanceTo(p.pos) < p.splash + 5) damagePlayer(p.dmg * 0.4);
    } else FX.spark(p.pos, p.color, 5, 6, 0.25, 0.3);
    if (hit === 'ground') return;
    if (hit === G.player) { FX.word(p.pos, 'bonk', p.splash > 0 ? 1 : 0.9); damagePlayer(p.dmg); } else damageEnt(hit, p.dmg, p.src);
  },
};
FX.addBoltSource(() => PROJ.list);

export interface Weapon { range?: number; rate?: number; burst?: number; dmg: number; speed: number; lead: number; spread: number; color: THREE.Color; splash?: number }
/** Shoot at a moving target, leading it a little (so flying fast makes them miss). */
export function fireAt(src: Entity, from: Vec3, tgt: any, W: Weapon, extra: { width?: number; trail?: number; kind?: string; sound?: string; hitAir?: boolean; hitGround?: boolean } = {}) {
  const tp = new V3().copy(tgt.pos); if (tgt.hh && tgt !== G.player) tp.y += tgt.hh;
  const dist = from.distanceTo(tp), tFlight = dist / W.speed;
  if (tgt.vel) tp.addScaledVector(tgt.vel, tFlight * W.lead * rand(0.3, 1.15));
  tp.x += rand(-1, 1) * W.spread * dist * 0.045; tp.z += rand(-1, 1) * W.spread * dist * 0.045; tp.y += rand(-1, 1) * W.spread * dist * 0.02;
  const vel = tp.sub(from).normalize().multiplyScalar(W.speed);
  PROJ.fire({ from, vel, team: src.team, dmg: W.dmg, color: W.color, width: extra.width || 0.1, trail: extra.trail || 2.2, kind: extra.kind || 'bullet', splash: W.splash || 0, life: 2.4, src, hitAir: extra.hitAir, hitGround: extra.hitGround });
  SFX.play(extra.sound || 'shot', src.pos, 0.05);
}

// ---------- Earth's alert level during a night ----------
export const alertLevel = () => clamp(Math.floor(G.alert / 20), 0, 5);
export function raiseAlert(n: number) {
  if (!G.night || G.night.noMilitary) return;
  const before = alertLevel(); G.alert = clamp(G.alert + n, 0, 100); G.night.quietT = 0;
  const after = alertLevel();
  if (after > before) {
    SFX.play('alarm');
    // Loud and readable (Phase 1): a big comic banner saying what is coming, a red edge flash and the siren.
    const what = ['', 'Police are on the way!', 'The army is coming!', 'Tanks rolling in!', 'Missile trucks deployed!', 'Everything they have!'][after];
    UI.banner(`ALERT ${after}<small>${what}</small>`, 'alert', 2.4);
    document.body.classList.remove('alarm'); void document.body.offsetWidth; document.body.classList.add('alarm');
    setTimeout(() => document.body.classList.remove('alarm'), 2100);
    if (after === 1 && G.save.totals.missions < 2) UI.comm('The locals called their "police". Zap them with the stun ray, then beam them up. Two birds, one saucer.');
    if (after === 3 && G.save.up.beam < 2) UI.comm('Tanks! Disable them with the ray. Our beam needs <b>level 3</b> to lift something that heavy.');
  }
}

// ---------- tractor-beam physics for anything being lifted ----------
/** Lift-start shouts (§6): 40 % chance of a .ft.say balloon. */
const LIFT_SHOUT: Record<string, readonly string[]> = { human: ['HELP!', 'Not again!', 'My hat!'], cow: ['MOO?!'], sheep: ['BAA?!'], pig: ['OINK?!'], chicken: ['BAWK!'] };
/**
 * A target starts rising in the beam (§6 "Abduction"): the squash and wobble run in entity.ts (liftT), here it
 * gets a pooled jelly bubble, a YOINK!-style word and maybe a shout.
 */
export function liftStart(e: Entity) {
  e.liftT = 0; FX.bubble(e);
  FX.word(_v1.copy(e.pos).setY(e.pos.y + e.hh * 2 + 0.5), 'lift');
  const lines = HUMAN_KINDS.has(e.kind) ? LIFT_SHOUT.human : LIFT_SHOUT[e.kind];
  if (lines && chance(0.4)) say(e, lines);
}
export function updateLift(e: Entity, dt: number) {
  const P = G.player;
  if (e.lift === 1) {
    if (!P || !P.beamOn || P.dead || hdist(e.pos, P.pos) > P.stats.beamRadius * 1.6) { e.lift = 2; e.vy = 0; return; }
    e.pos.y += P.stats.liftSpeed * clamp(2.4 / (1 + e.loot.mass * 0.45), 0.3, 1.3) * dt;
    const k = 1 - Math.exp(-3.2 * dt); e.pos.x += (P.pos.x - e.pos.x) * k; e.pos.z += (P.pos.z - e.pos.z) * k;
    e.obj.rotation.y += dt * 1.2; e.obj.rotation.z = Math.sin(e.t * 6) * 0.22; e.obj.rotation.x = 0;   // slow spin + jelly wobble
    if (e.model) e.anim('lifted', { speed: 1.4 });
    if (HUMAN_KINDS.has(e.kind) && chance(dt * 0.6)) say(e, SAY.lifted);
    if (e.pos.y >= P.pos.y - 1.9) abductEnt(e);
  } else {
    e.vy -= 32 * dt; e.pos.y += e.vy * dt;
    if (e.pos.y <= 0) {
      const impact = -e.vy; e.pos.y = 0; e.vy = 0; e.lift = 0; e.obj.rotation.x = 0; e.obj.rotation.z = 0; e.lane = null;
      if (impact > 9) { e.stun = Math.max(e.stun, 2.5); e.jelly = 1; e.jellyT = 0; FX.smoke(e.pos, 2, 0.8, 0.7, 0.5, false); if (HUMAN_KINDS.has(e.kind)) say(e, ['Ow!', 'My back!', 'Ouch!']); }
    }
  }
}
export function abductEnt(e: Entity) {
  const P = G.player, L = e.loot; e.dead = true; e.lift = 0;
  const into = G.mode === 'invasion' ? G.save.res : G.cargo;
  for (const r of RES) if (L[r]) into[r] += L[r];
  if (G.mode !== 'invasion') G.cargo.mass += L.mass; else for (const r of RES) if (L[r]) G.save.totals[r] += L[r];
  const r = RES.find(k => L[k]);
  // arrival (§6): the bubble pops, 8 poster star sparks + 10 slime sparks, BLORP!, a "+N" float in the resource
  // colour, and the saucer burps (the HUD chip pop is driven by hud.ts when the value changes)
  const at = _v1.copy(P.pos).setY(P.pos.y - 1.6);
  FX.popBubble(e);
  FX.spark(at, FXC.poster, 8, 7, 0.35, 0.45, 0); FX.spark(at, FXC.slime, 10, 6, 0.3, 0.45, 0);
  FX.word(_v3.copy(P.pos).setY(P.pos.y - 3.2), 'bank');
  FT.spawn(P.pos.clone().setY(P.pos.y - 2), e.artifact ? `Artifact: ${e.artifact}!` : `+${L[r]}`, e.artifact ? 'humans' : r, 1.2, 3);
  saucerBurp();
  SFX.play('abduct', null, 0.05); P.pulse = 1;
  const stats = G.mode === 'invasion' ? G.inv.stats : G.night.stats;
  const cat = HUMAN_KINDS.has(e.kind) ? 'humans' : ANIMAL_KINDS.has(e.kind) ? 'animals' : e.artifact ? 'artifacts' : 'vehicles';
  stats[cat] = (stats[cat] || 0) + 1;
  G.save.totals.abducted++;
  if (e.artifact) G.save.artifacts[e.artifact] = (G.save.artifacts[e.artifact] || 0) + 1;
  if (G.mode === 'mission') raiseAlert(HUMAN_KINDS.has(e.kind) ? (e.team === 'earth' ? 7 : 5) : cat === 'animals' ? 2.5 : cat === 'artifacts' ? 0 : 5);
  if (G.mode === 'mission') comboHit(r ? L[r] : 1, r);
  if (G.mode === 'mission' && !G.night.fullHold && G.cargo.mass >= P.stats.cargoCap - 0.29) { G.night.fullHold = true; onFullHold(); }
  onAbduct(e.kind);
  e.onAbduct?.(e);
}

// ---------- combos: abductions less than COMBO_GAP seconds apart chain up ----------
export const COMBO_GAP = 2.6, MEGA_AT = 8;
/**
 * Each abduction within 2.6 s of the last one raises the combo. From ×3 every arrival brings a bonus
 * (+25 % of its value per step, up to +100 %), without taking cargo space. Reaching ×8 powers up the MEGA BEAM.
 */
function comboHit(value: number, r: string | undefined) {
  const N = G.night; if (!N || N.tutorial) return;
  N.combo = G.time - (N.comboT ?? -99) <= COMBO_GAP ? (N.combo || 0) + 1 : 1;
  N.comboT = G.time;
  if (N.combo >= 2) onCombo(N.combo);
  if (N.combo >= 3 && r) {
    const bonus = Math.max(1, Math.ceil(value * Math.min(N.combo - 2, 4) * 0.25));
    (G.cargo as any)[r] += bonus;
    FT.spawn(G.player.pos.clone().setY(G.player.pos.y + 2.5), `COMBO ×${N.combo}  +${bonus}`, 'combo', 1.1, 3);
  }
  if (N.combo === MEGA_AT) startMegaBeam();
}
