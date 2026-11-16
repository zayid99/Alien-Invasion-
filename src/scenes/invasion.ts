// City invasion scene: setup, per-frame update, victory cinematic and the results screen.
import { updateCityDamage, CITY_DMG } from '../world/cityDamage';
import { setupBattle, updateBattle } from '../world/battle';
import { BOSS_NAMES } from '../world/invasion';
import { regionById } from '../data/earth';
import { onBossDown } from '../game/meta';
import { invasionNews } from '../game/news';
import { retryOffer } from '../ui/rewards';
import { OCC, FINAL } from '../data/campaign';
import * as THREE from 'three';
import { G } from '../game/state';
import { camera } from '../core/engine';
import { INPUT } from '../core/input';
import { SFX } from '../core/audio';
import { platform } from '../core/platform';
import { writeSave } from '../core/save';
import type { City } from '../data/earth';
import { UNIT_KEYS, UNIT_TYPES } from '../data/units';
import { hashString, rand } from '../core/util';
import { Kit, sph } from '../gfx/kit';
import { FX, BEAM } from '../gfx/fx';
import { buildCity } from '../world/maps/city';
import { setupInvasion, tickInvasion, separateUnits, updateWaves, deployUnit, surrenderAll, invasionHooks, armyObjective, setRally } from '../world/invasion';
import { makePlayer, updatePlayer, updateCamera, playerHooks } from '../world/player';
import { updateEnts } from '../world/entity';
import { PROJ, updateLift } from '../world/combat';
import { cityLevel, cityCaptured, invasionFailed, advanceDay, cityState, chapterOf, currentChapter } from '../game/campaign';
import { $, UI } from '../ui/dom';
import { startRaid, stopRaid, updateRaid, raidHooks, raidStars, RD } from '../world/raid';
import { roomLevel } from '../game/base';
import { RAID } from '../data/raid';
import { updateHUD, drawMinimap, renderDeployBar, setTimer } from '../ui/hud';
import { TUT } from '../ui/tutorial';
import { PAL } from '../gfx/palette';
import { leaveGlobe } from './globe';

export const invasionScene = {
  city: null as City, emblem: null as THREE.Object3D, done: (_won: boolean) => {},
  /** Screen point the iris closes on when the battle ends (main.ts: the saucer). */
  irisFrom: (): { x: number; y: number } | undefined => undefined,
  /** leave a raid before any troop landed (main.ts: back to the Moon Base) */ retreat: () => {},
};

export function startInvasion(city: City) {
  leaveGlobe(); TUT.leaveScene(); UI.clearGlobe();   // §7 scene hygiene: no globe UI, labels or Earth tutorial in battle
  invasionScene.city = city;
  buildCity(hashString(city.id), city.size, city.id, city.region);
  G.mode = 'invasion'; G.paused = false; G.modeTime = 0; G.cargo = { humans: 0, biomass: 0, metal: 0, mass: 0 };
  const L = cityLevel(city); setupInvasion(L, true); G.inv.raid = true;   // a raid: troops wait on the Moon Base until deployed
  // the biggest cities (size 5) keep a boss in reserve: it rises when their HQ falls
  const ch = chapterOf(city.id);
  G.inv.boss = city.id === FINAL.city.id ? { name: FINAL.boss } : city.size >= 5 ? { name: ch?.boss || BOSS_NAMES[regionById(city.region).continent] || 'Giga-Mech' } : null;
  setupBattle(L);   // helicopters, jets, crowds, traffic, searchlights
  // no saucer to fly: the player commands from above (the saucer stays out of reach, hidden, so Earth ignores it)
  const P = makePlayer(0, -400); P.dead = true; P.invulnerable = true; P.obj.visible = false;
  UI.show(null); UI.hud(false); BEAM.hide();
  $('raid').hidden = false; $('rd-name').textContent = city.name; $('rd-def').textContent = `defense ${L}${G.inv.boss ? ` · boss: ${G.inv.boss.name}` : ''}`;
  startRaid(roomLevel('armory'));
  UI.hint(`<kbd>drag</kbd> look around · <kbd>wheel</kbd> zoom · <kbd>1</kbd>–<kbd>4</kbd> troops · <kbd>5</kbd>–<kbd>7</kbd> powers · tap the green zone to deploy`);
  const n = Object.values(G.save.army).reduce((a, b) => a + b, 0);
  UI.comm(n ? `${city.name}, Commander. Scout their defenses, then drop our troops in the <b>green zone</b>. The clock starts with the first troop.` : 'We have no troops?! Train some in the Moon Base first. Tap <b>End battle</b> to go back.', 7);
  SFX.setMusic('battle'); SFX.play('battle'); platform.gameplayStart(); $('game').focus({ preventScroll: true });
  playerHooks.onDown = () => { if (G.mode === 'invasion' && !G.inv.over) endInvasion(false); };   // the army may still win in the 1.6 s warp-out
  invasionHooks.onWin = winInvasion; invasionHooks.onDeploy = renderDeployBar; invasionHooks.onBoss = onBossDown;
  raidHooks.lost = why => { if (G.inv.over) return; UI.toast(why, 'warn', 2.6); endInvasion(false); };
  raidHooks.cancel = () => { stopRaid(); $('raid').hidden = true; platform.gameplayStop(); SFX.stopLoops(); invasionScene.retreat(); };   // nothing deployed: no penalty
}
export function updateInvasion(dt: number) {
  const I = G.inv;
  updateRaid(dt); updateEnts(dt, updateLift); PROJ.update(dt); separateUnits(); updateWaves(dt); updateCityDamage(dt); updateBattle(dt);
  const n = tickInvasion(dt); armyObjective();
  const B = I.bossEnt;
  $('rd-obj').textContent = !I.raidStarted ? 'Scout the city' : I.rally && I.objective && !I.objective.rallyPoint ? `Rally: attacking the ${I.objective.kind === 'hq' ? 'HQ' : I.objective.kind}`
    : I.pylonsLeft > 0 ? `Destroy the shield pylons: ${I.pylonsLeft} left` : I.hq.hp > 0 ? `Destroy the HQ: ${Math.ceil(I.hq.hp / I.hq.maxHp * 100)}% left`
    : B && B.hp > 0 ? `Defeat the ${I.boss.name}: ${Math.ceil(B.hp / B.maxHp * 100)}% left` : `${invasionScene.city.name} has fallen!`;
  void n;
}
function winInvasion() {
  const I = G.inv; if (I.over) return; I.over = true;
  const hq = I.hq; SFX.play('boom');
  for (let i = 0; i < 6; i++) setTimeout(() => FX.explode(new THREE.Vector3(rand(-12, 12), rand(4, 24), rand(-12, 12)), 2 + rand(0, 1)), i * 260);
  setTimeout(() => { hq.obj.scale.y = 0.45; hq.obj.rotation.z = 0.08; FX.smoke(new THREE.Vector3(0, 10, 0), 30, 5, 5, 10); }, 900);
  surrenderAll();
  G.mode = 'victory'; G.modeTime = 0; SFX.stopLoops(); SFX.setMusic('none'); SFX.play('fanfare'); platform.gameplayStop(); platform.happytime();
  UI.hud(false); UI.hideComm(); BEAM.hide(); $('raid').hidden = true;
  // Victory emblem: the Gray Empire sigil in the brand colours (slime outer ring = alien signature, poster inner
  // ring = triumph, violet face = Empire tech), with Zix's black eyes and their white catchlights (§5).
  const k = new Kit();
  k.add(new THREE.TorusGeometry(14, 0.8, 8, 48), PAL.slime, { m: 'glow', k: 2.6 }); k.add(new THREE.TorusGeometry(9, 0.5, 8, 40), PAL.poster, { m: 'glow', k: 2.4 });
  k.add(sph(3.2, 16, 10), PAL.violet, { s: [1, 1.3, 0.4], m: 'glow', k: 2 });
  for (const sx of [-1, 1]) {
    k.add(sph(1.1, 10, 8), PAL.alienEye, { p: [sx * 1.2, 0.6, 1.1], r: [0, 0, -0.6 * sx], s: [1, 1.6, 0.5], m: 'gloss' });
    k.add(sph(0.26, 8, 6), '#ffffff', { p: [sx * 1.45, 1.3, 1.62], m: 'glow', k: 1.2 });   // upper-outer catchlight
    k.add(sph(0.13, 6, 5), '#ffffff', { p: [sx * 0.95, 0.15, 1.62], m: 'glow', k: 1.2 });  // lower-inner catchlight
  }
  invasionScene.emblem = k.build(g => G.disposables.push(g)); invasionScene.emblem.position.set(0, 60, 0); G.world.add(invasionScene.emblem);
  setTimeout(() => { if (G.inv === I && G.mode === 'victory') endInvasion(true); }, 6500);   // only this battle (ADR 002: delayed callbacks check their scene)
}
export function updateVictory(dt: number) {
  updateEnts(dt, updateLift); PROJ.update(dt);
  const t = G.modeTime, a = t * 0.18, e = invasionScene.emblem;
  camera.position.set(Math.sin(a) * (70 + t * 4), 30 + t * 6, Math.cos(a) * (70 + t * 4)); camera.lookAt(0, 20 + t * 2, 0);
  if (e) { e.rotation.y += dt * 0.6; e.position.y = 45 + Math.min(t, 3) * 5; e.scale.setScalar(Math.min(1, t / 1.5)); }
}
/** Garrison (docs/gdd/occupation.md): a share of the survivors stays to hold the city, cheapest units first. */
function leaveGarrison(cityId: string) {
  const army = G.save.army, total = UNIT_KEYS.reduce((a, k) => a + army[k], 0); if (!total) return '';
  let n = Math.max(1, Math.ceil(OCC.garrisonShare * total)); const left: string[] = [];
  for (const k of UNIT_KEYS) { const take = Math.min(n, army[k]); if (!take) continue; army[k] -= take; n -= take; left.push(`${take} ${UNIT_TYPES[k].name}${take > 1 ? 's' : ''}`); if (!n) break; }
  const st = cityState(cityId); st.garrison = (st.garrison || 0) + Math.max(1, Math.ceil(OCC.garrisonShare * total));
  return left.join(', ');
}
export function endInvasion(won: boolean) {
  if (G.mode === 'end') return;
  const I = G.inv, s = G.save, city = invasionScene.city; I.over = true; const stars = I.raid ? raidStars() : 0; stopRaid(); $('raid').hidden = true;
  const from = won ? undefined : invasionScene.irisFrom();   // a defeat closes on the warping saucer
  SFX.stopLoops(); platform.gameplayStop(); G.mode = 'end'; BEAM.hide();
  if (won) cityCaptured(city); else invasionFailed(city);
  const isFinal = city.id === FINAL.city.id, chDone = won ? chapterOf(city.id) : null;
  if (won && isFinal) { s.ended = true; G.pendingEnding = true; }
  const garrison = won && !isFinal ? leaveGarrison(city.id) : '';
  invasionNews(city.name, won);
  const report = advanceDay(); writeSave(s);
  const row = (k: string, v: string | number, cls = '') => `<dt>${k}</dt><dd class="${cls}">${v}</dd>`;
  const sent = Object.values(I.stats.startArmy as Record<string, number>).reduce((a, b) => a + b, 0) + I.stats.deployed;
  let html = row('Units sent into battle', sent) + row('Buildings destroyed', CITY_DMG.destroyed) + row('Units lost', I.stats.lost, I.stats.lost ? 'lost' : '') + row('Earth soldiers surrendered', I.stats.surrendered) + row('Prisoners beamed up', I.stats.humans + I.stats.vehicles);
  if (I.raid) html = row('Stars', `<span class="stars s${stars}">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`, 'grade') + row('Time left', RD.started ? `${Math.floor(RD.timeLeft / 60)}:${String(Math.floor(RD.timeLeft % 60)).padStart(2, '0')}` : '-') + html;
  if (won && I.stats.surrendered) { const h = I.stats.surrendered * RAID.prisonerHumans; s.res.humans += h; s.totals.humans += h; html += row('Prisoners shipped to the Moon Base', `+${h} humans`, 'gain'); }
  if (won) html += row('Daily tribute from this city', `${city.size} humans, ${city.size * 2} biomass, ${city.size} metal`, 'gain');
  if (garrison) html += row('Garrison left behind', garrison);
  $('end-eyebrow').textContent = `Invasion report · ${won ? 'Victory' : 'Defeat'}`;
  $('end-title').textContent = won ? `${city.name} has fallen` : `${city.name} pushed us back`;
  const next = currentChapter();
  $('end-lede').textContent = won && isFinal ? 'The World Defense Command has fallen. Earth belongs to the Gray Empire!'
    : won ? `${city.name} now serves the Gray Empire.${chDone ? ` Chapter ${chDone.n} complete!${next ? ` Chapter ${next.n}: ${next.name} begins.` : ' The road to the World Defense Command is open!'}` : ''}${report.unlocked ? ` New regions unlocked: ${report.unlocked}!` : ''} Its people's first job: a statue of Commander Zix.`
    : 'Our troops pulled back. Troops you never deployed are safe on the Moon Base, and the city is on high alert (its defense level went up by 1).';
  $('end-body').innerHTML = html; $('btn-end').textContent = 'Back to Earth';
  SFX.play(won ? 'fanfare' : 'sad');
  invasionScene.done(won);
  // Full Launch: after a defeat, a rewarded ad retries with the army that went in and no defense penalty.
  retryOffer(!won, () => {
    s.army = { ...I.stats.startArmy }; const st = cityState(city.id); st.attempts = Math.max(0, st.attempts - 1);
    s.awareness = Math.max(0, s.awareness - 4); writeSave(s); UI.iris(() => startInvasion(city));
  });
  UI.iris(() => { UI.hud(false); UI.hideComm(); UI.show('scr-end'); }, from);
}
