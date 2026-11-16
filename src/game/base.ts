// The Moon Base empire (data/base.ts): train troops in queues, research troop levels and saucer upgrades in the lab,
// upgrade rooms one at a time. Jobs run on the real clock (Date.now), so they keep going during missions and while
// the player is away, like a Clash of Clans village. tickBase() completes whatever is due.
import { G } from './state';
import { UNIT_TYPES } from '../data/units';
import type { UnitKey, UnitDef } from '../data/units';
import { UPGRADES, canAfford, payCost, RES } from '../data/balance';
import type { UpgradeKey, Cost } from '../data/balance';
import { TRAIN_TIME, TRAINS_IN, TROOP, SAUCER_TIME, ROOM_UP, ROOM_MAX, speed, queueSize } from '../data/base';
import type { UpRoom } from '../data/base';
import { writeSave } from '../core/save';
import { SFX } from '../core/audio';
import { checkAchievements } from './meta';

export type TrainRoom = 'hybrid' | 'shipyard';
/** UI hooks (ui/roomScreen.ts): something finished; something changed. */
export const baseHooks = { done: (_what: { kind: 'unit' | 'troop' | 'saucer' | 'room'; key: string; room: string; text: string }) => {}, changed: () => {} };
const B = () => G.save.base;
const now = () => Date.now();

// ---------------------------------------------------------------- troop stats with levels
export const unitLevel = (k: UnitKey) => B().unitLv[k] || 1;
/** A unit's stats at its researched level (hp and damage scale; speed and range do not). */
export function unitStats(k: UnitKey): UnitDef {
  const T = UNIT_TYPES[k], m = TROOP.mult[unitLevel(k)];
  return { ...T, hp: Math.round(T.hp * m), dmg: Math.round(T.dmg * m * 10) / 10 };
}
export const unitPowerLv = (k: UnitKey) => { const T = unitStats(k); return Math.round(Math.sqrt(T.hp * T.dmg * T.rate)); };

// ---------------------------------------------------------------- training
export const trainTime = (k: UnitKey) => TRAIN_TIME[k] / speed(B().roomLv[TRAINS_IN[k] as TrainRoom]);
export const queueCap = (r: TrainRoom) => queueSize(B().roomLv[r]);
/** Queue n units (pays now, like the barracks). Returns how many were queued. */
export function train(k: UnitKey, n = 1) {
  const r = TRAINS_IN[k] as TrainRoom, q = B().q[r], T = UNIT_TYPES[k]; let added = 0;
  for (let i = 0; i < n; i++) {
    if (q.length >= queueCap(r) || !canAfford(G.save.res, T.cost)) break;
    payCost(G.save.res, T.cost); if (!q.length) B().qStart[r] = now(); q.push(k); added++;
  }
  if (added) { SFX.play('buy'); writeSave(G.save); baseHooks.changed(); } else SFX.play('error');
  return added;
}
/** Take the last queued unit back out, with a full refund. */
export function cancelLast(r: TrainRoom) {
  const q = B().q[r]; if (!q.length) return;
  const k = q.pop(); for (const res of RES) G.save.res[res] += UNIT_TYPES[k].cost[res] || 0;
  SFX.play('ui'); writeSave(G.save); baseHooks.changed();
}
/** Progress of a room's queue head: 0..1 and seconds left (whole queue). */
export function queueProgress(r: TrainRoom) {
  const q = B().q[r]; if (!q.length) return { p: 0, left: 0, head: null as UnitKey | null };
  const d = trainTime(q[0]) * 1000, el = now() - B().qStart[r], rest = q.slice(1).reduce((a, k) => a + trainTime(k), 0);
  return { p: Math.min(1, el / d), left: Math.max(0, (d - el) / 1000) + rest, head: q[0] };
}

// ---------------------------------------------------------------- research (one job at a time)
export const maxTroopLevel = () => Math.min(TROOP.maxLevel, B().roomLv.research + 1);
export const researchSpeed = () => speed(B().roomLv.research);
export function troopResearch(k: UnitKey) {
  const lv = unitLevel(k) + 1;
  return { lv, cost: lv <= TROOP.maxLevel ? TROOP.cost(k, lv) : null, time: lv <= TROOP.maxLevel ? TROOP.time[lv] / researchSpeed() : 0, locked: lv > maxTroopLevel(), max: lv > TROOP.maxLevel };
}
export function saucerResearch(k: UpgradeKey) {
  const l = G.save.up[k]; return { lv: l + 1, cost: l >= 4 ? null : UPGRADES[k].costs[l], time: l >= 4 ? 0 : SAUCER_TIME[l] / researchSpeed(), max: l >= 4 };
}
export function startResearch(kind: 'troop' | 'saucer', key: string) {
  if (B().lab) { SFX.play('error'); return false; }
  const r = kind === 'troop' ? troopResearch(key as UnitKey) : saucerResearch(key as UpgradeKey);
  if (r.max || !r.cost || (kind === 'troop' && (r as any).locked) || !canAfford(G.save.res, r.cost)) { SFX.play('error'); return false; }
  payCost(G.save.res, r.cost); B().lab = { kind, key, start: now(), dur: r.time * 1000 };
  SFX.play('buy'); writeSave(G.save); baseHooks.changed(); return true;
}

// ---------------------------------------------------------------- room upgrades (one builder)
export const roomLevel = (r: UpRoom) => B().roomLv[r];
export function roomUpgrade(r: UpRoom) {
  const lv = roomLevel(r) + 1; return { lv, max: lv > ROOM_MAX, cost: lv > ROOM_MAX ? null : ROOM_UP[r].cost(lv), time: lv > ROOM_MAX ? 0 : ROOM_UP[r].time(lv) };
}
export function startRoomUpgrade(r: UpRoom) {
  const u = roomUpgrade(r); if (B().build || u.max || !canAfford(G.save.res, u.cost)) { SFX.play('error'); return false; }
  payCost(G.save.res, u.cost); B().build = { room: r, start: now(), dur: u.time * 1000 };
  SFX.play('buy'); writeSave(G.save); baseHooks.changed(); return true;
}
export const jobProgress = (j: { start: number; dur: number } | null) => j ? { p: Math.min(1, (now() - j.start) / Math.max(1, j.dur)), left: Math.max(0, (j.start + j.dur - now()) / 1000) } : null;

// ---------------------------------------------------------------- the clock
let lastSave = 0;
/** Finish everything that is due (called every frame, and at boot for time spent away). */
export function tickBase(t = now()) {
  const b = B(); let any = false;
  for (const r of ['hybrid', 'shipyard'] as TrainRoom[]) {
    const q = b.q[r];
    while (q.length && t >= b.qStart[r] + trainTime(q[0]) * 1000) {
      b.qStart[r] += trainTime(q[0]) * 1000; const k = q.shift(); G.save.army[k]++; any = true;
      baseHooks.done({ kind: 'unit', key: k, room: r, text: `+1 ${UNIT_TYPES[k].name}` });
    }
    if (!q.length) b.qStart[r] = 0;
  }
  if (b.lab && t >= b.lab.start + b.lab.dur) {
    const j = b.lab; b.lab = null; any = true;
    if (j.kind === 'troop') { b.unitLv[j.key as UnitKey] = (b.unitLv[j.key as UnitKey] || 1) + 1; baseHooks.done({ kind: 'troop', key: j.key, room: 'research', text: `${UNIT_TYPES[j.key as UnitKey].name} level ${b.unitLv[j.key as UnitKey]}!` }); }
    else { G.save.up[j.key as UpgradeKey]++; baseHooks.done({ kind: 'saucer', key: j.key, room: 'research', text: `${UPGRADES[j.key as UpgradeKey].name} level ${G.save.up[j.key as UpgradeKey] + 1}!` }); }
  }
  if (b.build && t >= b.build.start + b.build.dur) {
    const j = b.build; b.build = null; b.roomLv[j.room]++; any = true;
    baseHooks.done({ kind: 'room', key: j.room, room: j.room, text: `${ROOM_UP[j.room].name} level ${b.roomLv[j.room]}!` });
  }
  if (any) { checkAchievements(); baseHooks.changed(); if (t - lastSave > 1500) { lastSave = t; writeSave(G.save); } }
}
/** Seconds as "12s", "1m 05s". */
export const fmtTime = (s: number) => s < 60 ? `${Math.ceil(s)}s` : `${Math.floor(s / 60)}m ${String(Math.ceil(s % 60)).padStart(2, '0')}s`;
export const costList = (c: Cost) => RES.filter(r => c[r]).map(r => `${c[r]} ${r}`).join(' · ');
