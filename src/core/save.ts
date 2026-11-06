// Save data: versioned so future updates can upgrade old saves instead of wiping them.
import type { Wallet, UpgradeKey } from '../data/balance';
import type { UnitKey } from '../data/units';
import type { TwistId } from '../data/campaign';
import { platform } from './platform';

export interface MissionSite {
  id: string; type: 'abduct' | 'invade'; region: string; city?: string;
  lat: number; lon: number; name: string; level: number; expires: number; special?: string;
  /** night twist (docs/gdd/night-sites.md) */ twist?: TwistId;
  /** the daily challenge's local date (docs/gdd/return-hooks.md) */ daily?: string;
}
export interface SaveData {
  v: number; savedAt: number;
  day: number; awareness: number; tierUnlocked: number;
  tutorial: { done: boolean; ms: number; globe: boolean };
  res: Wallet;
  army: Record<UnitKey, number>;
  up: Record<UpgradeKey, number>;
  regions: Record<string, { alert: number }>;
  /** res = resistance 0-100, revolt = paying nothing, garrison = units left behind (docs/gdd/occupation.md) */
  cities: Record<string, { occupied: boolean; attempts: number; since?: number; res?: number; revolt?: boolean; garrison?: number }>;
  sites: MissionSite[];
  artifacts: Record<string, number>;
  totals: { humans: number; biomass: number; metal: number; abducted: number; unitsLost: number; missions: number; citiesTaken: number; playTime: number };
  /** How many of each specimen kind were ever beamed up (game/meta.ts). */
  catalogue: Record<string, number>;
  /** Achievement id -> game day it was earned. */
  ach: Record<string, number>;
  /** Daily supply streak + today's daily mission. Dates are the player's local YYYY-MM-DD. */
  daily: { lastClaim: string; streak: number; completed: number; mission: { id: string; date: string; progress: number; done: boolean } | null };
  /** Records for achievements: best combo, MEGA BEAMs, full holds, perfect nights. */
  best: { combo: number; megas: number; fullHolds: number; perfect: number; bosses: number; nightScore: number; stars3: number; drops: number };
  /** Equipped saucer skin and the skins the player has already been told about. */
  skin: string; skinsSeen: string[];
  /** Recent Earth News headlines (newest first). */
  news: string[];
  /** New Game+ level (0 = first campaign) and whether the ending has been seen. */
  ngPlus: number; ended: boolean;
  /** Today's daily challenge result. */
  challenge: { date: string; score: number; stars: number } | null;
}
export const SAVE_VERSION = 4;
const KEY = 'alien-invasion-save';

export function newSave(): SaveData {
  return {
    v: SAVE_VERSION, savedAt: Date.now(), day: 1, awareness: 0, tierUnlocked: 1,
    tutorial: { done: false, ms: 0, globe: false },
    res: { humans: 0, biomass: 0, metal: 0 },
    army: { clone: 0, brute: 0, saucer: 0, walker: 0 },
    up: { beam: 0, shield: 0, engine: 0, ray: 0, cargo: 0 },
    regions: {}, cities: {}, sites: [], artifacts: {},
    totals: { humans: 0, biomass: 0, metal: 0, abducted: 0, unitsLost: 0, missions: 0, citiesTaken: 0, playTime: 0 },
    catalogue: {}, ach: {},
    daily: { lastClaim: '', streak: 0, completed: 0, mission: null },
    best: { combo: 0, megas: 0, fullHolds: 0, perfect: 0, bosses: 0, nightScore: 0, stars3: 0, drops: 0 },
    skin: 'classic', skinsSeen: ['classic'], news: [], ngPlus: 0, ended: false, challenge: null,
  };
}
/** Fill in anything a newer version added, so old saves keep working. */
function migrate(s: any): SaveData | null {
  if (!s || typeof s !== 'object' || typeof s.v !== 'number') return null;
  const d = newSave();
  return { ...d, ...s, v: SAVE_VERSION, tutorial: { ...d.tutorial, ...s.tutorial }, res: { ...d.res, ...s.res }, army: { ...d.army, ...s.army },
    up: { ...d.up, ...s.up }, totals: { ...d.totals, ...s.totals }, regions: s.regions || {}, cities: s.cities || {}, sites: s.sites || [], artifacts: s.artifacts || {},
    catalogue: s.catalogue || {}, ach: s.ach || {}, daily: { ...d.daily, ...s.daily }, best: { ...d.best, ...s.best }, skin: s.skin || 'classic', skinsSeen: s.skinsSeen || ['classic'], news: s.news || [],
    ngPlus: s.ngPlus || 0, ended: !!s.ended, challenge: s.challenge || null };
}
export function loadSave(): SaveData | null {
  let local: SaveData | null = null, cloud: SaveData | null = null;
  try { local = migrate(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch { /* storage blocked */ }
  try { cloud = migrate(JSON.parse(platform.cloudGet(KEY) || 'null')); } catch { /* no cloud */ }
  if (local && cloud) return cloud.savedAt > local.savedAt ? cloud : local;
  return local || cloud;
}
export function writeSave(s: SaveData) {
  s.savedAt = Date.now(); const json = JSON.stringify(s);
  try { localStorage.setItem(KEY, json); } catch { /* ignore */ }
  platform.cloudSet(KEY, json);
}
export function eraseSave() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } platform.cloudSet(KEY, 'null'); }

// Per-device preferences (sound, graphics).
/** quality = what the game runs at; qualityUser = what the player picked in the pause menu (auto never overrides it). */
export const prefs: { muted?: boolean; quality?: 'high' | 'low'; qualityUser?: 'high' | 'low' } = (() => { try { return JSON.parse(localStorage.getItem('alien-invasion-prefs') || '{}'); } catch { return {}; } })();
export const savePrefs = () => { try { localStorage.setItem('alien-invasion-prefs', JSON.stringify(prefs)); } catch { /* ignore */ } };
