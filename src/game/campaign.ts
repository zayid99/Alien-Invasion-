// The world campaign: days, regional alert, global awareness, tribute, unlocks and mission sites.
import { checkAchievements } from './meta';
import { G } from './state';
import { REGIONS, CITIES, regionById, cityById, TIER_NAMES } from '../data/earth';
import type { City, Region } from '../data/earth';
import type { MissionSite } from '../core/save';
import { CFG, RES, earthForces, DEFENDER } from '../data/balance';
import type { Wallet } from '../data/balance';
import { UNIT_KEYS, unitPower } from '../data/units';
import { clamp, pick, rand, hashString } from '../core/util';
import { TWISTS, TWIST_IDS, NIGHT, LOSS, OCC, CHAPTERS, FINAL, NGPLUS, RETURN } from '../data/campaign';
import type { Chapter } from '../data/campaign';
import { addNews } from './news';
import type { TwistId } from '../data/campaign';
import { today } from './meta';

export const regionState = (id: string) => (G.save.regions[id] ||= { alert: 0 });
export const cityState = (id: string) => (G.save.cities[id] ||= { occupied: false, attempts: 0 });
export const regionUnlocked = (r: Region) => r.tier <= G.save.tierUnlocked;
export const occupiedCities = () => CITIES.filter(c => G.save.cities[c.id]?.occupied);

/** How hard an abduction night is in a region (1 = easy). */
export function missionLevel(regionId: string) {
  const s = G.save; return 1 + Math.floor(s.day / 6) + Math.floor(s.awareness / 20) + Math.floor(regionState(regionId).alert / 40) + NGPLUS.missionLevel * (s.ngPlus || 0);
}
/** Earth's defense level for a city invasion. */
export function cityLevel(c: City) {
  const s = G.save; if (c.id === FINAL.city.id) return FINAL.level + FINAL.ngLevel * (s.ngPlus || 0);
  return NGPLUS.cityLevel * (s.ngPlus || 0) + Math.max(1, c.size - 1 + Math.floor(s.day / 8) + Math.floor(s.awareness / 25) + Math.min(LOSS.maxPenalty, cityState(c.id).attempts));
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
/** What a conquered city pays per day: resistance lowers it, a revolt stops it (docs/gdd/occupation.md). */
export function cityTribute(c: City): Wallet {
  const st = cityState(c.id), k = st.revolt ? 0 : 1 - OCC.tributeLoss * (st.res || 0) / 100;
  return { humans: Math.floor(c.size * k), biomass: Math.floor(c.size * 2 * k), metal: Math.floor(c.size * k) };
}
export function tribute(): Wallet {
  const w: Wallet = { humans: 0, biomass: 0, metal: 0 };
  for (const c of occupiedCities()) { const t = cityTribute(c); for (const r of RES) w[r] += t[r]; }
  return w;
}
// ---------------------------------------------------------------- chapters (docs/gdd/campaign-chapters.md)
/** The first chapter whose capital still stands (null once all four have fallen). */
export const currentChapter = (): Chapter | null => CHAPTERS.find(ch => !cityState(ch.capital).occupied) || null;
/** Tier reached by conquering the capitals in order. */
export function chapterTier() { let t = 1; for (const ch of CHAPTERS) if (t === ch.tier && cityState(ch.capital).occupied) t = ch.tier + 1; return Math.min(4, t); }
export const finalOpen = () => !currentChapter() && !G.save.ended;
export const chapterOf = (cityId: string) => CHAPTERS.find(ch => ch.capital === cityId) || null;
/** New Game+: keep upgrades, army, skins and records; the map resets and Earth gets stronger. */
export function startNewGamePlus() {
  const s = G.save; s.ngPlus = (s.ngPlus || 0) + 1; s.ended = false;
  s.day = 1; s.awareness = 0; s.tierUnlocked = 1; s.regions = {}; s.cities = {}; s.sites = [];
  s.res = { humans: FINAL.ngStart, biomass: FINAL.ngStart, metal: FINAL.ngStart };
  addNews(`Earth rebuilds its defenses. "This time we are ready," says the World Defense Command (New Game+ ${s.ngPlus})`);
  refreshSites();
}
// ---------------------------------------------------------------- return hooks (docs/gdd/return-hooks.md)
export interface AwayReport { hours: number; gain: Wallet; attacked: string | null }
/** Coming back: cities kept paying (up to 8 h), and after 2 h+ Earth counter-attacks one city. Applies it to the save. */
export function applyAway(savedAt: number, now = Date.now()): AwayReport | null {
  const s = G.save, hours = Math.min(RETURN.maxAwayH, Math.max(0, (now - savedAt) / 3.6e6)), cities = occupiedCities();
  if (!s.tutorial.done || hours < RETURN.minAwayH || !cities.length) return null;
  const t = tribute(), gain: Wallet = { humans: 0, biomass: 0, metal: 0 };
  for (const r of RES) { gain[r] = Math.floor(t[r] * hours / RETURN.hoursPerDay); s.res[r] += gain[r]; s.totals[r] += gain[r]; }
  let attacked: string | null = null;
  if (hours >= RETURN.attackAfterH && cities.length >= RETURN.minCities) {
    const c = [...cities].sort((a, b) => (cityState(a.id).garrison || 0) - (cityState(b.id).garrison || 0) || (cityState(b.id).res || 0) - (cityState(a.id).res || 0))[0];
    const st = cityState(c.id); st.res = Math.min(100, (st.res || 0) + RETURN.attackRes); if (st.res >= 100) st.revolt = true;
    attacked = c.name; addNews(`Earth strikes back! Resistance fighters rise in ${c.name}`);
  }
  return { hours, gain, attacked };
}
/** Daily resistance growth; returns the cities that just revolted. */
function growResistance(): string[] {
  const out: string[] = [];
  for (const c of occupiedCities()) {
    const st = cityState(c.id); if (st.revolt) continue;
    st.res = Math.min(100, (st.res || 0) + Math.max(1, OCC.base + c.size - OCC.perGarrison * (st.garrison || 0)));
    if (st.res >= 100) { st.revolt = true; out.push(c.name); addNews(`Revolt in ${c.name}! Citizens chase the alien garrison into the sewers`); }
  }
  return out;
}
/** A night in a region scares its cities: resistance drops, revolts end. Returns the names calmed. */
export function calmRegion(regionId: string): string[] {
  const out: string[] = [];
  for (const c of occupiedCities()) {
    if (c.region !== regionId) continue;
    const st = cityState(c.id), before = st.res || 0;
    if (st.revolt) { st.revolt = false; st.res = OCC.afterRevolt; } else st.res = Math.max(0, before - OCC.nightCalm);
    if (before > 0) out.push(c.name);
  }
  return out;
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
    // night twists (docs/gdd/night-sites.md): from the 3rd night most sites carry one
    const twist = s.totals.missions + 1 >= NIGHT.twistFromNight && Math.random() < NIGHT.twistChance ? pickTwist(Math.random()) : undefined;
    s.sites.push({ id: `s${s.day}-${Math.floor(rand(0, 1e6))}`, type: 'abduct', region: r.id, lat, lon, name: twist ? `${TWISTS[twist].name} near ${c.name}` : `${flavor} ${c.name}`, level: missionLevel(r.id), expires: s.day + 3, twist });
  }
  refreshChallenge();
}
/** A twist the player can do (a Tank Depot needs a beam that lifts tanks); r in [0, 1). */
export function pickTwist(r: number): TwistId {
  const ok = TWIST_IDS.filter(id => !TWISTS[id].allowed || TWISTS[id].allowed(G.save));
  return ok[Math.floor(r * ok.length) % ok.length];
}
/** The daily challenge (docs/gdd/return-hooks.md): one seeded site per local date, playable once. */
export function refreshChallenge() {
  const s = G.save, date = today();
  s.sites = s.sites.filter(x => !x.daily || x.daily === date);
  if (!s.tutorial.done || s.sites.some(x => x.daily === date) || s.challenge?.date === date) return;
  const h = hashString('challenge-' + date), open = REGIONS.filter(regionUnlocked), r = open[h % open.length];
  const c = CITIES.filter(x => x.region === r.id)[(h >>> 4) % CITIES.filter(x => x.region === r.id).length];
  const twist = pickTwist(((h >>> 8) % 1000) / 1000);
  s.sites.unshift({ id: `daily-${date}`, type: 'abduct', region: r.id, lat: c.lat + 2.2, lon: c.lon - 2.2, name: `Daily challenge: ${TWISTS[twist].name}`, level: missionLevel(r.id) + 1, expires: s.day + 99, twist, daily: date });
}
export interface DayReport { day: number; tribute: Wallet; unlocked: string | null; revolts: string[] }
/** One day passes (after every mission). */
export function advanceDay(share = 1): DayReport {
  const s = G.save; s.day++;
  for (const id in s.regions) s.regions[id].alert = Math.max(0, s.regions[id].alert - CFG.regionAlertDecayPerDay);
  s.awareness = Math.max(0, s.awareness - 0.5);
  const revolts = growResistance();
  const t = tribute(); for (const r of RES) { t[r] = Math.floor(t[r] * share); s.res[r] += t[r]; s.totals[r] += t[r]; }   // share < 1: a night ended early
  const before = s.tierUnlocked; s.tierUnlocked = Math.max(s.tierUnlocked, chapterTier());   // chapters: each capital opens the next tier (never lowered)
  refreshSites();
  return { day: s.day, tribute: t, unlocked: s.tierUnlocked > before ? TIER_NAMES[s.tierUnlocked] : null, revolts };
}
export function missionDone(site: MissionSite | null, humans: number, total: number, counts = true) {
  const s = G.save; if (counts) s.totals.missions++;
  if (site && counts) G.lastCalmed = calmRegion(site.region);
  if (site) { regionState(site.region).alert = clamp(regionState(site.region).alert + 12 + humans * 1.5, 0, 100); s.sites = s.sites.filter(x => x.id !== site.id); }
  s.awareness = clamp(s.awareness + 0.8 + total * 0.08, 0, 100);
}
export function cityCaptured(c: City) {
  queueMicrotask(checkAchievements);
  const s = G.save, st = cityState(c.id); st.occupied = true; st.since = s.day; st.res = 0; st.revolt = false; s.totals.citiesTaken++;
  regionState(c.region).alert = clamp(regionState(c.region).alert + 40, 0, 100); s.awareness = clamp(s.awareness + 6 + c.size, 0, 100);
}
export function invasionFailed(c: City) { cityState(c.id).attempts++; G.save.awareness = clamp(G.save.awareness + 4, 0, 100); }
export { regionById, cityById };
