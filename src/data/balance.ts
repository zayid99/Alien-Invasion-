// GAME BALANCE: tweak numbers here. Everything else reads from these tables.

export const RES = ['humans', 'biomass', 'metal'] as const;
export type ResKey = typeof RES[number];
export type Cost = Partial<Record<ResKey, number>>;
export type Wallet = Record<ResKey, number>;

export const CFG = {
  nightLength: 150,        // seconds per abduction night
  mapHalf: 175,            // countryside maps are 350 x 350 units
  cityHalf: 150,
  ufoAltitude: 15,
  sendTime: 1.6,           // seconds to teleport cargo up to the mothership
  shieldRegenDelay: 3,
  alertDecay: 1.6,         // mission alert points lost per second while you lie low
  regionAlertDecayPerDay: 12,
  tutorialSeed: 777,
};

// Saucer stats per upgrade level (index 0 = starting level, 4 = max).
export const STAT = {
  maxLift:    [3, 5, 8, 12, 20],      // heaviest thing the beam can lift (tonnes)
  liftSpeed:  [6, 7.5, 9, 10.5, 12.5],
  beamRadius: [5, 5.6, 6.2, 6.9, 7.6],
  maxShield:  [100, 140, 190, 250, 330],
  regen:      [5, 6.5, 8, 10, 13],
  speed:      [26, 30, 34, 38, 43],
  rayDmg:     [10, 14, 19, 25, 32],
  rayRate:    [4, 4.6, 5.2, 6, 7],
  cargoCap:   [10, 14, 20, 28, 40],
};
export type UpgradeKey = 'beam' | 'shield' | 'engine' | 'ray' | 'cargo';
export interface UpgradeDef { name: string; stat: (l: number) => string; next: (l: number) => string; costs: Cost[] }
export const UPGRADES: Record<UpgradeKey, UpgradeDef> = {
  beam:   { name: 'Tractor beam', stat: l => `Lifts ${STAT.maxLift[l]} t`, next: l => `Lift ${STAT.maxLift[l + 1]} t${l + 1 >= 2 ? ' (tanks need 8 t)' : ''}`,
            costs: [{ metal: 6 }, { metal: 12, biomass: 4 }, { metal: 20, biomass: 8 }, { metal: 32, humans: 4 }] },
  shield: { name: 'Shield generator', stat: l => `${STAT.maxShield[l]} shield`, next: l => `${STAT.maxShield[l + 1]} shield, faster recharge`,
            costs: [{ metal: 6, biomass: 2 }, { metal: 12, biomass: 5 }, { metal: 20, biomass: 8 }, { metal: 30, biomass: 12 }] },
  engine: { name: 'Ion engines', stat: l => `Speed ${STAT.speed[l]}`, next: l => `Speed ${STAT.speed[l + 1]}`,
            costs: [{ metal: 5 }, { metal: 10 }, { metal: 16, biomass: 4 }, { metal: 24, biomass: 8 }] },
  ray:    { name: 'Stun ray', stat: l => `${STAT.rayDmg[l]} power`, next: l => `${STAT.rayDmg[l + 1]} power, faster`,
            costs: [{ metal: 6, humans: 1 }, { metal: 12, humans: 2 }, { metal: 18, humans: 4 }, { metal: 28, humans: 6 }] },
  cargo:  { name: 'Cargo hold', stat: l => `Holds ${STAT.cargoCap[l]} t`, next: l => `Holds ${STAT.cargoCap[l + 1]} t`,
            costs: [{ metal: 4, biomass: 2 }, { metal: 9, biomass: 4 }, { metal: 15, biomass: 8 }, { metal: 24, biomass: 12 }] },
};

// What each abductable thing is worth, and how heavy it is (tonnes).
export interface Loot { mass: number; humans?: number; biomass?: number; metal?: number }
export const LOOT: Record<string, Loot> = {
  civilian: { mass: 1, humans: 1 }, farmer: { mass: 1, humans: 1 }, scientist: { mass: 1, humans: 2 },
  cop: { mass: 1, humans: 1 }, soldier: { mass: 1.2, humans: 2 },
  cow: { mass: 2.5, biomass: 4 }, sheep: { mass: 1.2, biomass: 2 }, pig: { mass: 1.5, biomass: 3 }, chicken: { mass: 0.3, biomass: 1 },
  deer: { mass: 2, biomass: 3 }, fox: { mass: 0.8, biomass: 2 }, dog: { mass: 0.8, biomass: 2 }, cat: { mass: 0.4, biomass: 1 },
  haybale: { mass: 1, biomass: 1 }, pumpkin: { mass: 0.6, biomass: 1 }, artifact: { mass: 0.2, biomass: 1 },
  car: { mass: 3, metal: 3 }, van: { mass: 3.5, metal: 4 }, bigtruck: { mass: 5, metal: 6 }, tractor: { mass: 4, metal: 4 },
  policecar: { mass: 3, metal: 4 }, jeep: { mass: 3, metal: 4 }, mtruck: { mass: 6, metal: 7 }, tank: { mass: 8, metal: 10 },
};

// Earth's forces defending a city at defense level L.
export function earthForces(L: number) {
  return {
    soldiers: 6 + 3 * L, tanks: 1 + L, turrets: 2 + Math.floor(L / 2),
    pylonHp: 520 + 120 * L, hqHp: 1500 + 320 * L,
    waveEvery: 24, waveSoldiers: 2 + Math.floor(L / 2), waveTankEvery: L >= 2 ? 3 : 0,
  };
}
export const DEFENDER = {
  soldier: { hp: 30, dmg: 4, rate: 1.2, range: 26, speed: 6 },
  tank:    { hp: 170, dmg: 26, rate: 0.3, range: 38, speed: 5, splash: 4 },
  turret:  { hp: 130, dmg: 8, rate: 1.6, range: 50, speed: 0 },
};

export const costText = (c: Cost) => RES.filter(r => c[r]).map(r => `${c[r]} ${r}`).join(' + ');
export const canAfford = (w: Wallet, c: Cost) => RES.every(r => (w[r] || 0) >= (c[r] || 0));
export const payCost = (w: Wallet, c: Cost) => RES.forEach(r => { w[r] -= (c[r] || 0); });
export const scaleCost = (c: Cost, n: number): Cost => Object.fromEntries(RES.map(r => [r, (c[r] || 0) * n]));
