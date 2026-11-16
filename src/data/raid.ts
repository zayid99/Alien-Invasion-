// City raids, Clash of Clans style (docs/gdd/city-raids.md): no saucer to fly; you command from above. All tuning here.
export type PowerId = 'laser' | 'emp' | 'rally';
export interface PowerDef { id: PowerId; name: string; icon: string; blurb: string; charges: (armoryLv: number) => number; radius: number }
export const POWERS: Record<PowerId, PowerDef & Record<string, any>> = {
  laser: { id: 'laser', name: 'Orbital Laser', icon: '☄', blurb: 'A beam from orbit: heavy damage to everything in the circle.', charges: lv => lv, radius: 10, dmg: 260, buildingDmg: 320, delay: 0.8 },
  emp:   { id: 'emp', name: 'EMP Blast', icon: '⚡', blurb: 'Stuns turrets, tanks, soldiers and helicopters for a few seconds.', charges: lv => lv, radius: 20, stun: 6 },
  rally: { id: 'rally', name: 'Rally Beacon', icon: '⚑', blurb: 'Sends your troops to the spot and onto the target there.', charges: () => 3, radius: 50 },
};
export const POWER_IDS = Object.keys(POWERS) as PowerId[];
export const RAID = {
  time: 180,               // seconds of battle, counted from the first deployment
  zoneIn: 138, zoneOut: 194, // the deploy zone: a band around the city edge (|x| or |z| between these)
  holdEvery: 0.14,         // holding on the zone keeps dropping troops this often
  threeStarLeft: 60,       // win with at least this many seconds left for the third star
  cam: { pitch: 0.95, start: { x: 0, z: 125, d: 185 }, min: 60, max: 260, bound: 210, keys: 140 },
  prisonerHumans: 2,       // each surrendered soldier is shipped to the Moon Base as this many humans
};
