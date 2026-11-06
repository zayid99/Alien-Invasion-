// Meta progression that brings players back: the specimen catalogue, the daily supply streak, the daily mission,
// in-night combos / MEGA BEAM records and 30 achievements. Pure game logic + save data; the UI lives in ui/meta.ts.
import { G } from './state';
import { RES } from '../data/balance';
import type { Wallet } from '../data/balance';
import { platform } from '../core/platform';
import { hashString } from '../core/util';
import { ARTIFACTS } from '../core/assets';

// ---------------------------------------------------------------- specimens
export interface Specimen { kind: string; name: string; group: 'Humans' | 'Animals' | 'Farm finds' | 'Vehicles' }
export const SPECIMENS: Specimen[] = [
  { kind: 'civilian', name: 'Townsperson', group: 'Humans' }, { kind: 'farmer', name: 'Farmer', group: 'Humans' },
  { kind: 'scientist', name: 'Scientist', group: 'Humans' }, { kind: 'cop', name: 'Police officer', group: 'Humans' },
  { kind: 'soldier', name: 'Soldier', group: 'Humans' },
  { kind: 'cow', name: 'Cow', group: 'Animals' }, { kind: 'sheep', name: 'Sheep', group: 'Animals' }, { kind: 'pig', name: 'Pig', group: 'Animals' },
  { kind: 'chicken', name: 'Chicken', group: 'Animals' }, { kind: 'deer', name: 'Deer', group: 'Animals' }, { kind: 'fox', name: 'Fox', group: 'Animals' },
  { kind: 'dog', name: 'Dog', group: 'Animals' }, { kind: 'cat', name: 'Cat', group: 'Animals' },
  { kind: 'haybale', name: 'Hay bale', group: 'Farm finds' }, { kind: 'pumpkin', name: 'Giant pumpkin', group: 'Farm finds' },
  { kind: 'car', name: 'Car', group: 'Vehicles' }, { kind: 'tractor', name: 'Tractor', group: 'Vehicles' }, { kind: 'policecar', name: 'Police car', group: 'Vehicles' },
  { kind: 'jeep', name: 'Army jeep', group: 'Vehicles' }, { kind: 'mtruck', name: 'Missile truck', group: 'Vehicles' }, { kind: 'tank', name: 'Tank', group: 'Vehicles' },
];
const SPEC = new Map(SPECIMENS.map(s => [s.kind, s]));
const HUMANS = new Set(['civilian', 'farmer', 'scientist', 'cop', 'soldier']);
const ANIMALS = new Set(['cow', 'sheep', 'pig', 'chicken', 'deer', 'fox', 'dog', 'cat']);
const VEHICLES = new Set(['car', 'tractor', 'policecar', 'jeep', 'mtruck', 'tank']);
const cat = (k: string) => G.save.catalogue[k] || 0;
const sum = (set: Set<string>) => [...set].reduce((n, k) => n + cat(k), 0);
export const specimensFound = () => SPECIMENS.filter(s => cat(s.kind) > 0).length;
export const artifactsFound = () => ARTIFACTS.filter(a => (G.save.artifacts[a.replace('_', ' ')] || 0) > 0).length;

// ---------------------------------------------------------------- dates (the player's local calendar day)
export function today(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function yesterday() { const d = new Date(); d.setDate(d.getDate() - 1); return today(d); }

// ---------------------------------------------------------------- daily supply drop (login streak)
/** Day 1..7 of the streak (it keeps counting; rewards repeat the 7-day cycle and grow every full week). */
export const STREAK_REWARDS: Partial<Wallet>[] = [
  { biomass: 15 }, { metal: 15 }, { humans: 5 }, { biomass: 25, metal: 10 }, { metal: 25, biomass: 10 }, { humans: 10 }, { humans: 15, biomass: 40, metal: 40 },
];
export function streakReward(streak: number): Partial<Wallet> {
  const base = STREAK_REWARDS[(streak - 1) % 7], k = 1 + Math.floor((streak - 1) / 7) * 0.5, out: Partial<Wallet> = {};
  for (const r of RES) if (base[r]) out[r] = Math.round(base[r] * k);
  return out;
}
/** Can today's supply drop be claimed? (Only once the tutorial is over.) */
export const canClaimDaily = () => G.save.tutorial.done && G.save.daily.lastClaim !== today();
/** Claim today's drop: returns the streak day and the reward (already added to the wallet). */
export function claimDaily() {
  const D = G.save.daily;
  D.streak = D.lastClaim === yesterday() ? D.streak + 1 : 1;
  D.lastClaim = today();
  const reward = streakReward(D.streak);
  give(reward); checkAchievements();
  return { streak: D.streak, reward };
}

// ---------------------------------------------------------------- daily mission
export interface DailyDef { id: string; text: string; target: number; count: (kind: string) => boolean }
const DAILY_DEFS: DailyDef[] = [
  { id: 'cows', text: 'Beam up 8 cows', target: 8, count: k => k === 'cow' },
  { id: 'humans', text: 'Beam up 12 humans', target: 12, count: k => HUMANS.has(k) },
  { id: 'animals', text: 'Beam up 15 animals', target: 15, count: k => ANIMALS.has(k) },
  { id: 'vehicles', text: 'Beam up 5 vehicles', target: 5, count: k => VEHICLES.has(k) },
  { id: 'chickens', text: 'Beam up 6 chickens', target: 6, count: k => k === 'chicken' },
  { id: 'police', text: 'Beam up 4 police officers or police cars', target: 4, count: k => k === 'cop' || k === 'policecar' },
  { id: 'combo', text: 'Reach a ×6 combo in one night', target: 6, count: () => false },
  { id: 'nights', text: 'Complete 3 nights', target: 3, count: () => false },
];
export const dailyDef = () => DAILY_DEFS.find(d => d.id === G.save.daily.mission?.id) || null;
export function dailyReward(): Partial<Wallet> { const k = 1 + Math.min(G.save.day, 40) / 10; return { humans: Math.round(6 * k), biomass: Math.round(20 * k), metal: Math.round(20 * k) }; }
/** Roll today's mission if the day changed (deterministic per date, so a reload gives the same mission). */
export function rollDaily() {
  const D = G.save.daily, t = today();
  if (!G.save.tutorial.done || (D.mission && D.mission.date === t)) return;
  const def = DAILY_DEFS[hashString(t + ':' + (G.save.totals.missions > 0 ? 'v' : 'n')) % DAILY_DEFS.length];
  D.mission = { id: def.id, date: t, progress: 0, done: false };
}
function dailyProgress(n: number, absolute = false) {
  const M = G.save.daily.mission, def = dailyDef(); if (!M || M.done || !def || M.date !== today()) return;
  M.progress = absolute ? Math.max(M.progress, n) : M.progress + n;
  if (M.progress >= def.target) {
    M.progress = def.target; M.done = true; G.save.daily.completed++;
    const reward = dailyReward(); give(reward);
    META.notify({ kind: 'daily', title: 'Daily mission complete!', text: `${def.text} · ${walletText(reward)}` });
    platform.happytime(); checkAchievements();
  }
}

// ---------------------------------------------------------------- events from the game
/** Something was beamed into the saucer (missions and invasions). */
export function onAbduct(kind: string) {
  if (!SPEC.has(kind)) return;
  const first = !G.save.catalogue[kind];
  G.save.catalogue[kind] = (G.save.catalogue[kind] || 0) + 1;
  if (first) {
    const s = SPEC.get(kind), reward: Partial<Wallet> = HUMANS.has(kind) ? { humans: 3 } : VEHICLES.has(kind) ? { metal: 8 } : { biomass: 8 };
    give(reward);
    META.notify({ kind: 'specimen', title: 'New specimen!', text: `${s.name} added to the catalogue (${specimensFound()}/${SPECIMENS.length}) · ${walletText(reward)}` });
  }
  const def = dailyDef(); if (def && def.count(kind)) dailyProgress(1);
  checkAchievements();
}
export function onCombo(n: number) {
  if (n > G.save.best.combo) G.save.best.combo = n;
  if (dailyDef()?.id === 'combo') dailyProgress(n, true);
  checkAchievements();
}
export function onMegaBeam() { G.save.best.megas++; checkAchievements(); }
export function onFullHold() { G.save.best.fullHolds++; checkAchievements(); }
/** A night ended normally (not the tutorial). */
export function onNightEnd(perfect: boolean) {
  if (perfect) G.save.best.perfect++;
  if (dailyDef()?.id === 'nights') dailyProgress(1);
  checkAchievements();
}

// ---------------------------------------------------------------- achievements
export interface Achievement { id: string; name: string; text: string; test: () => boolean }
const armySize = () => Object.values(G.save.army).reduce((a, b) => a + b, 0);
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-contact', name: 'First Contact', text: 'Beam up your first human', test: () => sum(HUMANS) >= 1 },
  { id: 'cattle-call', name: 'Cattle Call', text: 'Beam up 25 cows', test: () => cat('cow') >= 25 },
  { id: 'moo-ving-day', name: 'Moo-ving Day', text: 'Beam up 100 cows', test: () => cat('cow') >= 100 },
  { id: 'bacon-bits', name: 'Bacon Bits', text: 'Beam up 25 pigs', test: () => cat('pig') >= 25 },
  { id: 'fowl-play', name: 'Fowl Play', text: 'Beam up 50 chickens', test: () => cat('chicken') >= 50 },
  { id: 'woolly', name: 'Woolly Business', text: 'Beam up 25 sheep', test: () => cat('sheep') >= 25 },
  { id: 'crowd-control', name: 'Crowd Control', text: 'Beam up 100 humans', test: () => sum(HUMANS) >= 100 },
  { id: 'population', name: 'Population Problem', text: 'Beam up 1,000 humans', test: () => sum(HUMANS) >= 1000 },
  { id: 'arrest', name: 'Arresting Officers', text: 'Beam up 10 police officers', test: () => cat('cop') >= 10 },
  { id: 'big-brains', name: 'Big Brains', text: 'Beam up 10 scientists', test: () => cat('scientist') >= 10 },
  { id: 'drafted', name: 'Drafted', text: 'Beam up 25 soldiers', test: () => cat('soldier') >= 25 },
  { id: 'car-collector', name: 'Car Collector', text: 'Beam up 25 vehicles', test: () => sum(VEHICLES) >= 25 },
  { id: 'tank-you', name: 'Tank You Very Much', text: 'Beam up a tank', test: () => cat('tank') >= 1 },
  { id: 'collector', name: 'Collector', text: 'Find 10 different specimens', test: () => specimensFound() >= 10 },
  { id: 'specimen-master', name: 'Specimen Master', text: `Find all ${SPECIMENS.length} specimens`, test: () => specimensFound() >= SPECIMENS.length },
  { id: 'snack-attack', name: 'Snack Attack', text: 'Find 3 Earth artifacts', test: () => artifactsFound() >= 3 },
  { id: 'pizza-party', name: 'Pizza Party', text: `Find all ${ARTIFACTS.length} Earth artifacts`, test: () => artifactsFound() >= ARTIFACTS.length },
  { id: 'combo-5', name: 'Combo Starter', text: 'Reach a ×5 combo', test: () => G.save.best.combo >= 5 },
  { id: 'combo-12', name: 'Combo Champion', text: 'Reach a ×12 combo', test: () => G.save.best.combo >= 12 },
  { id: 'mega-beam', name: 'MEGA BEAM!', text: 'Power up the MEGA BEAM', test: () => G.save.best.megas >= 1 },
  { id: 'full-hold', name: 'Packed Hold', text: 'Fill your cargo hold to the top', test: () => G.save.best.fullHolds >= 1 },
  { id: 'perfect-night', name: 'Untouchable', text: 'Finish a night without taking damage', test: () => G.save.best.perfect >= 1 },
  { id: 'night-owl', name: 'Night Owl', text: 'Complete 10 nights', test: () => G.save.totals.missions >= 10 },
  { id: 'veteran', name: 'Veteran Abductor', text: 'Complete 50 nights', test: () => G.save.totals.missions >= 50 },
  { id: 'first-conquest', name: 'First Conquest', text: 'Capture a city', test: () => G.save.totals.citiesTaken >= 1 },
  { id: 'continental', name: 'Continental', text: 'Capture 5 cities', test: () => G.save.totals.citiesTaken >= 5 },
  { id: 'half-world', name: 'Half the World', text: 'Capture 30 cities', test: () => G.save.totals.citiesTaken >= 30 },
  { id: 'army-100', name: 'Grand Army', text: 'Have 100 units at once', test: () => armySize() >= 100 },
  { id: 'maxed', name: 'Fully Loaded', text: 'Upgrade a saucer system to the max', test: () => Object.values(G.save.up).some(v => v >= 4) },
  { id: 'loyal', name: 'Loyal Commander', text: 'Claim the daily supply drop 7 days in a row', test: () => G.save.daily.streak >= 7 },
];
export const achievementsDone = () => ACHIEVEMENTS.filter(a => G.save.ach[a.id]).length;
/** Unlock anything newly earned (cheap: called after every relevant event). */
export function checkAchievements() {
  if (!G.save?.ach) return;
  for (const a of ACHIEVEMENTS) {
    if (G.save.ach[a.id]) continue;
    let ok = false; try { ok = a.test(); } catch { ok = false; }
    if (!ok) continue;
    G.save.ach[a.id] = G.save.day;
    META.notify({ kind: 'achievement', title: a.name, text: a.text });
    platform.happytime();
  }
}

// ---------------------------------------------------------------- helpers + UI hook
export function give(w: Partial<Wallet>) { for (const r of RES) if (w[r]) { G.save.res[r] += w[r]; G.save.totals[r] += w[r]; } }
export const walletText = (w: Partial<Wallet>) => RES.filter(r => w[r]).map(r => `+${w[r]} ${r}`).join(' · ');
/** ui/meta.ts sets this to show the pop-up banners. */
export const META = { notify: (_n: { kind: 'achievement' | 'specimen' | 'daily'; title: string; text: string }) => {} };
