// The Moon Base room panels (docs/gdd/moon-base.md): what each room lets you do. Replaces the old mothership screen;
// building and upgrading also play an animation in the room (scenes/moonbase.ts `celebrate`).
import { G } from '../game/state';
import { RES, UPGRADES, canAfford, payCost, scaleCost } from '../data/balance';
import type { UpgradeKey } from '../data/balance';
import { UNIT_TYPES, UNIT_KEYS, unitPower } from '../data/units';
import type { UnitKey } from '../data/units';
import { CITIES, regionById } from '../data/earth';
import { ROOMS } from '../data/moonbase';
import type { RoomId } from '../data/moonbase';
import { writeSave } from '../core/save';
import { SFX } from '../core/audio';
import { platform } from '../core/platform';
import { armyPower, earthPower, cityLevel, cityState, regionUnlocked, verdict } from '../game/campaign';
import { checkAchievements, SPECIMENS, specimensFound, achievementsDone, ACHIEVEMENTS, artifactsFound } from '../game/meta';
import { ARTIFACTS } from '../core/assets';
import { SKINS } from '../data/skins';
import { chapterCardHTML } from './meta';
import { renderWallet } from '../scenes/globe';
import { $, costHTML } from './dom';

/** Set by scenes/moonbase.ts: play a room's "something was made" animation with a caption. */
export const moonHooks = { celebrate: (_room: RoomId, _text: string) => {}, room: () => null as RoomId | null };
const UNIT_ROOM: Record<UnitKey, RoomId> = { clone: 'hybrid', brute: 'hybrid', saucer: 'shipyard', walker: 'shipyard' };

const unitCard = (k: UnitKey) => {
  const T = UNIT_TYPES[k], s = G.save, res = s.res;
  return `<div class="item"><div class="name">${T.name} <small>×${s.army[k]}</small></div>
    <div class="desc">${T.desc} HP ${T.hp} · power ${unitPower(k)}${T.air ? ' · flies' : ''}</div><div class="cost">${costHTML(T.cost, res)}</div>
    <div class="acts"><button class="btn slime" id="btn-build-${k}" data-build="${k}" data-n="1" ${canAfford(res, T.cost) ? '' : 'disabled'}>Build</button>
    <button class="btn slime" data-build="${k}" data-n="5" ${canAfford(res, scaleCost(T.cost, 5)) ? '' : 'disabled'}>×5</button></div></div>`;
};
const upgradeCard = (k: UpgradeKey) => {
  const U = UPGRADES[k], s = G.save, res = s.res, l = s.up[k], max = l >= 4, c = max ? null : U.costs[l];
  return `<div class="item"><div class="name">${U.name} <span class="pips">${[0, 1, 2, 3, 4].map(i => `<i class="${i <= l ? 'on' : ''}"></i>`).join('')}</span></div>
    <div class="desc">${U.stat(l)}${max ? ' · maxed' : ` → ${U.next(l)}`}</div><div class="cost">${max ? '' : costHTML(c, res)}</div>
    <div class="acts"><button class="btn" id="btn-up-${k}" data-up="${k}" ${!max && canAfford(res, c) ? '' : 'disabled'}>${max ? 'Max' : 'Upgrade'}</button></div></div>`;
};
function nextTarget() {
  return CITIES.filter(c => regionUnlocked(regionById(c.region)) && !cityState(c.id).occupied).sort((a, b) => cityLevel(a) - cityLevel(b))[0];
}
function warRoomHTML() {
  const target = nextTarget(), us = armyPower(), them = target ? earthPower(cityLevel(target)) : 1, top = Math.max(us, them) * 1.1, v = verdict(us, them);
  return `<div class="power"><div class="lane us"><span>Your army</span><div class="track"><i style="width:${(us / top * 100).toFixed(1)}%"></i></div><b>${us}</b></div>
    <div class="lane them"><span>${target ? target.name : 'No target'}</span><div class="track"><i style="width:${(them / top * 100).toFixed(1)}%"></i></div><b>${target ? them : 0}</b></div></div>
    <p class="sub">${target ? `Easiest city in reach: <b>${target.name}</b> (defense ${cityLevel(target)}). ${v.text}.` : 'Every city in reach is yours.'} Earth gets stronger every day.</p>`;
}
const stat = (k: string, v: string | number) => `<dt>${k}</dt><dd>${v}</dd>`;
function bodyHTML(id: RoomId) {
  const s = G.save, T = s.totals;
  switch (id) {
    case 'bridge': return `${warRoomHTML()}${chapterCardHTML()}<div class="row"><button class="btn primary" id="btn-bridge-earth" data-act="earth">Go to Earth</button></div>`;
    case 'hybrid': return `<p class="sub">Clones are grown from biomass; Hypno-Brutes are abducted humans in hypno-helmets.</p>${unitCard('clone')}${unitCard('brute')}`;
    case 'shipyard': return `<p class="sub">War machines are built from stolen metal.</p>${unitCard('saucer')}${unitCard('walker')}`;
    case 'research': return `<p class="sub">Upgrade your saucer. The full research tree arrives with the next update.</p>${(Object.keys(UPGRADES) as UpgradeKey[]).map(upgradeCard).join('')}`;
    case 'cells': return `<dl class="kv">${stat('Specimens catalogued', `${specimensFound()}/${SPECIMENS.length}`)}${stat('Humans abducted, all time', T.humans)}${stat('Things abducted, all time', T.abducted)}</dl>
      <p class="sub">Every new kind of human or animal you beam up gets an entry, and a bonus.</p><div class="row"><button class="btn slime" data-act="catalogue">Open the catalogue</button></div>`;
    case 'storage': return `<dl class="kv">${RES.map(r => stat(r[0].toUpperCase() + r.slice(1), `${Math.floor(s.res[r])} <small>(${T[r]} collected)</small>`)).join('')}${stat('Earth artifacts', `${artifactsFound()}/${ARTIFACTS.length}`)}</dl>
      <p class="sub">${Object.entries(s.artifacts).filter(([, n]) => n).map(([a, n]) => `${a.replace('_', ' ')} ×${n}`).join(' · ') || 'No artifacts yet. Look near houses at night.'}</p>`;
    case 'trophy': return `<dl class="kv">${stat('Achievements', `${achievementsDone()}/${ACHIEVEMENTS.length}`)}${stat('Saucer skins', `${SKINS.filter(k => !k.ach || s.ach[k.ach]).length}/${SKINS.length}`)}${stat('Cities conquered', T.citiesTaken)}${stat('Bosses defeated', s.best.bosses)}</dl>
      <div class="row"><button class="btn" data-act="achievements">Achievements</button><button class="btn slime" data-act="hangar">Saucer skins</button></div>`;
    case 'armory': return `<p><span class="tag hot">Locked</span></p><p class="sub">The Armory opens with <b>city raids</b> in a coming update: plan your attack, then fire powers like the EMP blast, the gravity well, mind control and the orbital laser.</p>`;
    case 'reactor': return `<dl class="kv">${stat('Day', s.day)}${stat('Army power', armyPower())}${stat('Nights flown', T.missions)}${stat('New Game+', s.ngPlus || 0)}</dl><p class="sub">The reactor powers the whole moon. Energy for bigger rooms and ships arrives with the next update.</p>`;
  }
}
/** Fill the panel for the room the camera is in (or hide it at the overview). */
export function renderMoonPanel() {
  const id = moonHooks.room(), p = $('moon-panel'); renderWallet('moon-wallet');
  $('moon-sub').textContent = `The Hollow Moon · Day ${G.save.day}`;
  if (!id) { p.hidden = true; return; }
  p.hidden = false; p.dataset.room = id;
  $('mp-title').textContent = ROOMS[id].name; $('mp-job').textContent = ROOMS[id].job;
  $('mp-body').innerHTML = bodyHTML(id);
}
export function buildUnits(k: UnitKey, n: number) {
  const T = UNIT_TYPES[k]; let built = 0;
  for (let i = 0; i < n; i++) { if (!canAfford(G.save.res, T.cost)) break; payCost(G.save.res, T.cost); G.save.army[k]++; built++; }
  if (built) { SFX.play('buy'); writeSave(G.save); moonHooks.celebrate(UNIT_ROOM[k], `+${built} ${T.name}${built > 1 ? 's' : ''}`); checkAchievements(); } else SFX.play('error');
  renderMoonPanel();
}
export function buyUpgrade(k: UpgradeKey) {
  const U = UPGRADES[k], l = G.save.up[k]; if (l >= 4) return;
  const c = U.costs[l]; if (!canAfford(G.save.res, c)) { SFX.play('error'); return; }
  payCost(G.save.res, c); G.save.up[k]++; SFX.play('buy'); checkAchievements(); writeSave(G.save);
  moonHooks.celebrate('research', `${U.name} level ${G.save.up[k] + 1}`); renderMoonPanel();
  if (G.save.up[k] === 4) platform.happytime();
}
