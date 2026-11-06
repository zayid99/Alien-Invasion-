// Campaign tuning (v0.4): night twists and grades, occupation, chapters and the ending, return hooks.
// Design: docs/gdd/night-sites.md, occupation.md, campaign-chapters.md, return-hooks.md. All numbers live here (ADR 003).
import type { Cost } from './balance';

// ---------------------------------------------------------------- night twists + grade
export type TwistId = 'fair' | 'market' | 'rush' | 'expo' | 'depot' | 'quiet';
export interface Twist {
  id: TwistId; name: string; blurb: string;
  /** what the goal counts: an abducted-kind group, or the night's max alert */
  goal: { kind: 'animals' | 'humans' | 'vehicles' | 'scientist' | 'tank' | 'alert'; n: number; label: string };
  bonus: Cost;
  /** only offered when this returns true (save is passed in) */
  allowed?: (s: { up: { beam: number } }) => boolean;
}
export const TWISTS: Record<TwistId, Twist> = {
  fair:   { id: 'fair', name: 'County Fair', blurb: 'The pens are packed with prize animals.', goal: { kind: 'animals', n: 16, label: 'animals' }, bonus: { biomass: 25 } },
  market: { id: 'market', name: 'Night Market', blurb: 'The whole town is out shopping late.', goal: { kind: 'humans', n: 18, label: 'humans' }, bonus: { humans: 8 } },
  rush:   { id: 'rush', name: 'Rush Hour', blurb: 'Bumper-to-bumper traffic on every road.', goal: { kind: 'vehicles', n: 8, label: 'vehicles' }, bonus: { metal: 20 } },
  expo:   { id: 'expo', name: 'Science Expo', blurb: 'Six scientists show off gadgets in the plaza.', goal: { kind: 'scientist', n: 4, label: 'scientists' }, bonus: { humans: 6, metal: 10 } },
  depot:  { id: 'depot', name: 'Tank Depot', blurb: 'Three spare tanks parked at the army base.', goal: { kind: 'tank', n: 2, label: 'tanks' }, bonus: { metal: 30 }, allowed: s => s.up.beam >= 2 },
  quiet:  { id: 'quiet', name: 'Quiet Night', blurb: 'Stay sneaky: keep the alert at 1 or lower.', goal: { kind: 'alert', n: 1, label: 'max alert' }, bonus: { humans: 5, biomass: 15, metal: 10 } },
};
export const TWIST_IDS = Object.keys(TWISTS) as TwistId[];
export const NIGHT = {
  twistChance: 0.65, twistFromNight: 3,
  /** map changes */
  fairAnimals: 2, marketCrowd: 1.6, rushTraffic: 2, expoScientists: 6, depotTanks: 3,
  /** grade: score = humans*3 + biomass + metal*2; target = base + perLevel * level */
  scoreW: { humans: 3, biomass: 1, metal: 2 }, targetBase: 40, targetPerLevel: 15, star1: 0.5, star3NoTwist: 1.6,
};
export const nightTarget = (level: number) => NIGHT.targetBase + NIGHT.targetPerLevel * level;
export function nightScore(b: { humans: number; biomass: number; metal: number }) {
  return Math.round(b.humans * NIGHT.scoreW.humans + b.biomass * NIGHT.scoreW.biomass + b.metal * NIGHT.scoreW.metal);
}
/** 0-3 stars (docs/gdd/night-sites.md). */
export function nightStars(score: number, level: number, twistMet: boolean | null, reason: string) {
  if (reason === 'abort') return 0;
  const t = nightTarget(level); let s = score >= t * NIGHT.star1 ? 1 : 0;
  if (score >= t) s = 2;
  if (s === 2 && (twistMet === null ? score >= t * NIGHT.star3NoTwist : twistMet)) s = 3;
  return reason === 'destroyed' ? Math.min(1, s) : s;
}

// ---------------------------------------------------------------- invasion command
export const DROP = { base: 40, perTon: 14, radius: 7, minImpact: 9, self: 999, buildingShare: 0.8 };
export const RALLY = { radius: 50, time: 25 };
export const LOSS = { maxPenalty: 1 };

// ---------------------------------------------------------------- occupation
export const OCC = { base: 2, perGarrison: 0.5, nightCalm: 35, afterRevolt: 20, tributeLoss: 0.6, garrisonShare: 0.15 };

// ---------------------------------------------------------------- chapters + ending
export interface Chapter { n: number; tier: number; name: string; capital: string; boss: string }
export const CHAPTERS: Chapter[] = [
  { n: 1, tier: 1, name: 'North America', capital: 'new-york', boss: 'Liberty Titan' },
  { n: 2, tier: 2, name: 'South America & Europe', capital: 'paris', boss: 'Iron Knight' },
  { n: 3, tier: 3, name: 'Africa, Russia & the Middle East', capital: 'cairo', boss: 'Savanna Goliath' },
  { n: 4, tier: 4, name: 'Asia & Oceania', capital: 'tokyo', boss: 'Mega Shogun' },
];
export const FINAL = {
  city: { id: 'wdc', name: 'World Defense Command', country: 'Switzerland', region: 'central-europe', lat: 46.2, lon: 6.14, size: 5 as const },
  boss: 'Project Halo', level: 7, ngLevel: 2, ngStart: 40, skin: 'conqueror',
};
/** Earth gets this much stronger per New Game+ level. */
export const NGPLUS = { cityLevel: 2, missionLevel: 1 };

// ---------------------------------------------------------------- return hooks
export const RETURN = { minAwayH: 0.5, maxAwayH: 8, hoursPerDay: 4, attackAfterH: 2, attackRes: 40, minCities: 2 };
