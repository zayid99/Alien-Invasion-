// Empire building in the Moon Base (docs/gdd/moon-base.md, "Clash of Clans" layer): training queues, troop levels
// researched in the lab, and room levels. Every number lives here (ADR 003). Times are seconds; jobs keep running in
// real time, also while you fly missions or are away.
import type { UnitKey } from './units';
import type { Cost } from './balance';
import type { RoomId } from './moonbase';

/** Training time per unit at room level 1 (seconds). */
export const TRAIN_TIME: Record<UnitKey, number> = { clone: 4, brute: 6, saucer: 10, walker: 20 };
/** Which room trains which unit. */
export const TRAINS_IN: Record<UnitKey, RoomId> = { clone: 'hybrid', brute: 'hybrid', saucer: 'shipyard', walker: 'shipyard' };

/** Troop levels (researched in the Research Lab): hp and damage multiplier per level, cost and time to reach it. */
export const TROOP = {
  maxLevel: 5,
  mult: [1, 1, 1.15, 1.32, 1.52, 1.75],                 // index = level
  time: [0, 0, 20, 45, 90, 150],                         // seconds to research level n
  cost: (k: UnitKey, lv: number): Cost => {              // cost to research level lv (2..5)
    const f = Math.pow(2.2, lv - 2);
    const base: Record<UnitKey, Cost> = { clone: { biomass: 60, metal: 20 }, brute: { humans: 20, biomass: 40 }, saucer: { metal: 80, humans: 8 }, walker: { metal: 160, biomass: 60, humans: 16 } };
    return Object.fromEntries(Object.entries(base[k]).map(([r, v]) => [r, Math.round(v * f)])) as Cost;
  },
};
/** Saucer upgrades are research too: seconds to reach level n+1 from level n. */
export const SAUCER_TIME = [5, 20, 45, 90];

/** Rooms that can be upgraded (levels 1-5) and what a level gives. */
export type UpRoom = 'hybrid' | 'shipyard' | 'research' | 'storage';
export const ROOM_UP: Record<UpRoom, { name: string; effect: (lv: number) => string; cost: (lv: number) => Cost; time: (lv: number) => number }> = {
  hybrid:   { name: 'Hybrid Lab', effect: lv => `Trains ${Math.round(speed(lv) * 100)}% speed · queue ${queueSize(lv)}`, cost: lv => sc({ biomass: 40, metal: 30 }, lv), time: lv => [0, 0, 15, 40, 80, 150][lv] },
  shipyard: { name: 'Shipyard', effect: lv => `Builds ${Math.round(speed(lv) * 100)}% speed · queue ${queueSize(lv)}`, cost: lv => sc({ metal: 60, humans: 6 }, lv), time: lv => [0, 0, 20, 50, 100, 180][lv] },
  research: { name: 'Research Lab', effect: lv => `Troops up to level ${Math.min(TROOP.maxLevel, lv + 1)} · research ${Math.round(speed(lv) * 100)}% speed`, cost: lv => sc({ metal: 50, humans: 10 }, lv), time: lv => [0, 0, 25, 60, 120, 200][lv] },
  storage:  { name: 'Cargo Vault', effect: lv => `Daily supply drops +${(lv - 1) * 20}%`, cost: lv => sc({ metal: 40, biomass: 40 }, lv), time: lv => [0, 0, 15, 40, 80, 150][lv] },
};
export const ROOM_MAX = 5;
/** Speed multiplier for a room level (1, 1.25, 1.5 ...). */
export const speed = (lv: number) => 1 + 0.25 * (lv - 1);
/** Training queue length for a room level. */
export const queueSize = (lv: number) => 4 + 2 * (lv - 1);
function sc(c: Cost, lv: number): Cost { const f = Math.pow(2, lv - 2); return Object.fromEntries(Object.entries(c).map(([r, v]) => [r, Math.round(v * f)])) as Cost; }
