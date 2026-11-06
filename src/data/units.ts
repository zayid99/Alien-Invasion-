// Army units you build on the mothership (and drop in battle with keys 1-4).
// Costs were doubled in Phase 1 pacing: a new player can win the first city on about night 3 (~16 min), not night 1.
import type { Cost } from './balance';

export type UnitKey = 'clone' | 'brute' | 'saucer' | 'walker';
export interface UnitDef {
  name: string; key: string; desc: string; cost: Cost;
  hp: number; dmg: number; rate: number; range: number; speed: number;
  air: boolean; radius: number; splash?: number;
}
export const UNIT_TYPES: Record<UnitKey, UnitDef> = {
  clone:  { name: 'Gray Clone', key: '1', desc: 'Cloned foot soldier with a ray pistol.',
            cost: { biomass: 10 }, hp: 45, dmg: 8, rate: 1.0, range: 19, speed: 7, air: false, radius: 0.8 },
  brute:  { name: 'Hypno-Brute', key: '2', desc: 'Abducted human in a hypno-helmet. Tough, punches hard.',
            cost: { humans: 6, biomass: 4 }, hp: 110, dmg: 17, rate: 1.1, range: 2.8, speed: 8.5, air: false, radius: 0.9 },
  saucer: { name: 'Attack Saucer', key: '3', desc: 'Fast flying drone. Flies over buildings.',
            cost: { metal: 16, humans: 2 }, hp: 70, dmg: 9, rate: 1.6, range: 24, speed: 15, air: true, radius: 2 },
  walker: { name: 'Mega Walker', key: '4', desc: 'Three-legged siege machine with a heat ray.',
            cost: { metal: 44, biomass: 20, humans: 8 }, hp: 560, dmg: 44, rate: 0.6, range: 32, speed: 4.6, air: false, radius: 3, splash: 4.5 },
};
export const UNIT_KEYS = Object.keys(UNIT_TYPES) as UnitKey[];
export const unitPower = (k: UnitKey) => { const t = UNIT_TYPES[k]; return Math.round(Math.sqrt(t.hp * t.dmg * t.rate)); };
