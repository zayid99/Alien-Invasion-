// The world campaign: days, regional alert, global awareness, tribute, unlocks and mission sites.
import { checkAchievements } from './meta';
import { G } from './state';
import { REGIONS, CITIES, regionById, cityById, TIER_NAMES } from '../data/earth';
import type { City, Region } from '../data/earth';
import type { MissionSite } from '../core/save';
import { CFG, RES, earthForces, DEFENDER } from '../data/balance';
import type { Wallet } from '../data/balance';
import { UNIT_KEYS, unitPower } from '../data/units';
import { clamp, pick, rand } from '../core/util';

export const regionState = (id: string) => (G.save.regions[id] ||= { alert: 0 });
export const cityState = (id: string) => (G.save.cities[id] ||= { occupied: false, attempts: 0 });
export const regionUnlocked = (r: Region) => r.tier <= G.save.tierUnlocked;
export const occupiedCities = () => CITIES.filter(c => G.save.cities[c.id]?.occupied);

/** How hard an abduction night is in a region (1 = easy). */
export function missionLevel(regionId: string) {
  const s = G.save; return 1 + Math.floor(s.day / 6) + Math.floor(s.awareness / 20) + Math.floor(regionState(regionId).alert / 40);
}
/** Earth's defense level for a city invasion. */
export function cityLevel(c: City) {
  const s = G.save; return Math.max(1, c.size - 1 + Math.floor(s.day / 8) + Math.floor(s.awareness / 25) + cityState(c.id).attempts);
}
const defPower = (k: keyof typeof DEFENDER) => { const d = DEFENDER[k]; return Math.round(Math.sqrt(d.hp * d.dmg * d.rate)); };
export function earthPower(L: number) {
  const f = earthForces(L), jets = 120 / f.jetEvery * 2 * DEFENDER.jet.bombs * DEFENDER.jet.dmg / 40;   // bombs dropped in a ~2 min battle, per 40 hp
  return Math.round(f.soldiers * defPower('soldier') + f.tanks * defPower('tank') + f.turrets * defPower('turret') + f.helis * defPower('heli') + jets + (f.pylonHp * 3 + f.hqHp) / 40);
}
export function armyPower() { let s = 0; for (const k of UNIT_KEYS) s += G.save.army[k] * unitPower(k); const u = G.save.up; return Math.round(s + 30 + (u.ray + u.shield) * 10); }
export function verdict(us: number, them: number) {
  const r = us / them;
  return r >= 1.25 ? { cls: 'ok', text: 'Victory is likely' } : r >= 0.9 ? { cls: 'uv', text: 'An even fight' } : r >= 0.6 ? { cls: 'hot', text: 'Risky' } : { cls: 'hot', text: 'Earth would crush this army' };
}
export function tribute(): Wallet {
  const w: Wallet = { humans: 0, biomass: 0, metal: 0 };
  for (const c of occupiedCities()) { w.humans += c.size; w.biomass += c.size * 2; w.metal += c.size; }
  return w;
}
/** Make sure there are fresh abduction sites to choose from. */
export function refreshSites() {
  const s = G.save; s.sites = s.sites.filter(x => x.expires >= s.day);
  const open = REGIONS.filter(regionUnlocked); let guard = 0;
  while (s.sites.filter(x => x.type === 'abduct').length < Math.min(6, 3 + s.tierUnlocked) && guard++ < 40) {
    const r = pick(open.filter(r => !s.sites.some(x => x.region === r.id)).concat(open));
    const cities = CITIES.filter(c => c.region === r.id), c = pick(cities);
    const dx = r.lon - c.lon, dy = r.lat - c.lat, l = Math.hypot(dx, dy) || 1, k = rand(1.5, 4);
    const lat = clamp(c.lat + dy / l * k + rand(-1, 1), -70, 75), lon = c.lon + dx / l * k + rand(-1, 1);
    const flavor = pick(['Farms outside', 'Countryside near', 'Villages near', 'Ranches near', 'Back roads near']);
    s.sites.push({ id: `s${s.day}-${Math.floor(rand(0, 1e6))}`, type: 'abduct', region: r.id, lat, lon, name: `${flavor} ${c.name}`, level: missionLevel(r.id), expires: s.day + 3 });
  }
}
export interface DayReport { day: number; tribute: Wallet; unlocked: string | null }
/** One day passes (after every mission). */
export function advanceDay(share = 1): DayReport {
  const s = G.save; s.day++;
  for (const id in s.regions) s.regions[id].alert = Math.max(0, s.regions[id].alert - CFG.regionAlertDecayPerDay);
  s.awareness = Math.max(0, s.awareness - 0.5);
  const t = tribute(); for (const r of RES) { t[r] = Math.floor(t[r] * share); s.res[r] += t[r]; s.totals[r] += t[r]; }   // share < 1: a night ended early
  const before = s.tierUnlocked; s.tierUnlocked = Math.min(4, 1 + (s.totals.citiesTaken >= 1 ? 1 : 0) + (s.totals.citiesTaken >= 3 ? 1 : 0) + (s.totals.citiesTaken >= 6 ? 1 : 0));
  refreshSites();
  return { day: s.day, tribute: t, unlocked: s.tierUnlocked > before ? TIER_NAMES[s.tierUnlocked] : null };
}
export function missionDone(site: MissionSite | null, humans: number, total: number, counts = true) {
  const s = G.save; if (counts) s.totals.missions++;
  if (site) { regionState(site.region).alert = clamp(regionState(site.region).alert + 12 + humans * 1.5, 0, 100); s.sites = s.sites.filter(x => x.id !== site.id); }
  s.awareness = clamp(s.awareness + 0.8 + total * 0.08, 0, 100);
}
export function cityCaptured(c: City) {
  queueMicrotask(checkAchievements);
  const s = G.save, st = cityState(c.id); st.occupied = true; st.since = s.day; s.totals.citiesTaken++;
  regionState(c.region).alert = clamp(regionState(c.region).alert + 40, 0, 100); s.awareness = clamp(s.awareness + 6 + c.size, 0, 100);
}
export function invasionFailed(c: City) { cityState(c.id).attempts++; G.save.awareness = clamp(G.save.awareness + 4, 0, 100); }
export { regionById, cityById };
