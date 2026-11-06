// The live game state shared by all systems (the saved part lives in G.save).
import * as THREE from 'three';
import { newSave } from '../core/save';
import type { SaveData, MissionSite } from '../core/save';
import type { Entity } from '../world/entity';
import type { Footprint } from '../gfx/models';
import type { Vec3 } from '../core/util';

export type Mode = 'boot' | 'title' | 'briefing' | 'globe' | 'mission' | 'summary' | 'mothership' | 'invasion' | 'victory' | 'end';
export interface Cargo { humans: number; biomass: number; metal: number; mass: number }
export interface NightState {
  number: number; level: number; site: MissionSite | null; tutorial: boolean;
  stats: { humans: number; animals: number; vehicles: number; artifacts: number; disabled?: number; kinds: Record<string, number> };
  banked: { humans: number; biomass: number; metal: number };
  spawnT: number; civT: number; hiding: number; quietT: number; ended: boolean; warned?: boolean; noMilitary: boolean;
  biome: string; regionName: string;
  /** Phase 1 meta: current combo and when it last grew, plus 'filled the hold' / 'took damage' flags for achievements. */
  combo?: number; comboT?: number; fullHold?: boolean; hurt?: boolean; maxAlert?: number; mega?: boolean;
  /** v0.4 night twist, objective refresh timer and the end-of-night grade */
  twist?: import('../data/campaign').Twist | null; objT?: number; grade?: { score: number; stars: number; met: boolean | null };
}

export const G = {
  mode: 'boot' as Mode, paused: false, time: 0, modeTime: 0,
  save: newSave() as SaveData,
  /** The last night's banked and lost cargo (rewarded-ad offers on the report). */
  lastNight: null as { banked: Record<string, number>; lost: Record<string, number> } | null,
  /** conquered cities a night just calmed (occupation) */
  lastCalmed: [] as string[],
  /** the final assault was just won: show the ending on the way back to Earth */
  pendingEnding: false,
  world: null as THREE.Group | null,
  ents: [] as Entity[],
  obstacles: [] as Footprint[],
  disposables: [] as { dispose(): void }[],
  player: null as any,
  camYaw: 0, camDist: 36, shake: 0, mapHalf: 175, ufoY: 15,
  alert: 0, nightT: 0,
  cargo: { humans: 0, biomass: 0, metal: 0, mass: 0 } as Cargo,
  night: null as NightState | null,
  inv: null as any,
  entries: [] as { x: number; z: number }[],
  houses: [] as Vec3[],
  cargoWarnT: 0,
};
/** Remember things to free when the current world is cleared. Returns the first one. */
export const track = <T extends { dispose(): void }>(first: T, ...rest: { dispose(): void }[]) => { G.disposables.push(first, ...rest); return first; };
