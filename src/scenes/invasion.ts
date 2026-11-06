// City invasion scene: setup, per-frame update, victory cinematic and the results screen.
import { BOSS_NAMES } from '../world/invasion';
import { regionById } from '../data/earth';
import { onBossDown } from '../game/meta';
import { invasionNews } from '../game/news';
import { retryOffer } from '../ui/rewards';
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
import { setupInvasion, tickInvasion, separateUnits, updateWaves, deployUnit, surrenderAll, invasionHooks, armyObjective } from '../world/invasion';
import { makePlayer, updatePlayer, updateCamera, playerHooks } from '../world/player';
import { updateEnts } from '../world/entity';
import { PROJ, updateLift } from '../world/combat';
import { cityLevel, cityCaptured, invasionFailed, advanceDay, cityState } from '../game/campaign';
import { $, UI } from '../ui/dom';
import { updateHUD, drawMinimap, renderDeployBar, setTimer } from '../ui/hud';
import { TUT } from '../ui/tutorial';
import { PAL } from '../gfx/palette';
import { leaveGlobe } from './globe';

export const invasionScene = {
  city: null as City, emblem: null as THREE.Object3D, done: (_won: boolean) => {},
  /** Screen point the iris closes on when the battle ends (main.ts: the saucer). */
  irisFrom: (): { x: number; y: number } | undefined => undefined,
};

export function startInvasion(city: City) {
  leaveGlobe(); TUT.leaveScene(); UI.clearGlobe();   // §7 scene hygiene: no globe UI, labels or Earth tutorial in battle
  invasionScene.city = city;
  buildCity(hashString(city.id), city.size);
  G.mode = 'invasion'; G.paused = false; G.modeTime = 0; G.cargo = { humans: 0, biomass: 0, metal: 0, mass: 0 };
  const L = cityLevel(city), units = setupInvasion(L);
  // the biggest cities (size 5) keep a boss in reserve: it rises when their HQ falls
  G.inv.boss = city.size >= 5 ? { name: BOSS_NAMES[regionById(city.region).continent] || 'Giga-Mech' } : null;
  makePlayer(0, 118); G.camYaw = 0; G.camDist = innerWidth < innerHeight ? 54 : 40; camera.position.set(0, 70, 190);
  UI.show(null); UI.hud(true); $('alert').hidden = true; $('m-cargo').hidden = true; $('deploy').hidden = false; renderDeployBar();
  $('mode-label').textContent = `${city.name} · defense ${L}`; $('t-send').hidden = true;
  UI.hint(`<kbd>WASD</kbd> fly · <kbd>click</kbd> ray · <kbd>Space</kbd> beam up soldiers + wrecks · <kbd>1</kbd>–<kbd>4</kbd> drop reinforcements`);
  UI.comm(units ? `The army has landed in ${city.name}. Destroy the three <b>shield pylons</b>, then their headquarters. I will cover you from the saucer.` : 'We have no army?! Drop units with keys 1-4 if you have resources, or retreat from the pause menu.', 7);
  SFX.setMusic('battle'); SFX.play('battle'); platform.gameplayStart(); $('game').focus({ preventScroll: true });
  playerHooks.onDown = () => endInvasion(false);
  invasionHooks.onWin = winInvasion; invasionHooks.onDeploy = renderDeployBar; invasionHooks.onBoss = onBossDown;
}
export function updateInvasion(dt: number) {
  const I = G.inv;
  updatePlayer(dt); updateEnts(dt, updateLift); PROJ.update(dt); separateUnits(); updateWaves(dt); updateCamera(dt);
  const n = tickInvasion(dt); armyObjective();
  const B = I.bossEnt;
  $('objective').textContent = I.pylonsLeft > 0 ? `Destroy the shield pylons: ${I.pylonsLeft} left` : I.hq.hp > 0 ? `Destroy the defense HQ: ${Math.ceil(I.hq.hp / I.hq.maxHp * 100)}% left`
    : B && B.hp > 0 ? `Defeat the ${I.boss.name}: ${Math.ceil(B.hp / B.maxHp * 100)}% left` : `${invasionScene.city.name} has fallen!`;
  setTimer(`${n} unit${n === 1 ? '' : 's'}`);   // Lilita counter, one fixed-width cell per digit
  if ((I.deployT = (I.deployT || 0) - dt) <= 0) { I.deployT = 0.5; renderDeployBar(); }
  for (const k of UNIT_KEYS) if (INPUT.hit('Digit' + UNIT_TYPES[k].key)) deployUnit(k);
  updateHUD(); drawMinimap();
}
function winInvasion() {
  const I = G.inv; if (I.over) return; I.over = true;
  const hq = I.hq; SFX.play('boom');
  for (let i = 0; i < 6; i++) setTimeout(() => FX.explode(new THREE.Vector3(rand(-12, 12), rand(4, 24), rand(-12, 12)), 2 + rand(0, 1)), i * 260);
  setTimeout(() => { hq.obj.scale.y = 0.45; hq.obj.rotation.z = 0.08; FX.smoke(new THREE.Vector3(0, 10, 0), 30, 5, 5, 10); }, 900);
  surrenderAll();
  G.mode = 'victory'; G.modeTime = 0; SFX.stopLoops(); SFX.setMusic('none'); SFX.play('fanfare'); platform.gameplayStop(); platform.happytime();
  UI.hud(false); UI.hideComm(); BEAM.hide();
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
  setTimeout(() => endInvasion(true), 6500);
}
export function updateVictory(dt: number) {
  updateEnts(dt, updateLift); PROJ.update(dt);
  const t = G.modeTime, a = t * 0.18, e = invasionScene.emblem;
  camera.position.set(Math.sin(a) * (70 + t * 4), 30 + t * 6, Math.cos(a) * (70 + t * 4)); camera.lookAt(0, 20 + t * 2, 0);
  if (e) { e.rotation.y += dt * 0.6; e.position.y = 45 + Math.min(t, 3) * 5; e.scale.setScalar(Math.min(1, t / 1.5)); }
}
export function endInvasion(won: boolean) {
  if (G.mode === 'end') return;
  const I = G.inv, s = G.save, city = invasionScene.city; I.over = true;
  const from = won ? undefined : invasionScene.irisFrom();   // a defeat closes on the warping saucer
  SFX.stopLoops(); platform.gameplayStop(); G.mode = 'end'; BEAM.hide();
  if (won) cityCaptured(city); else invasionFailed(city);
  invasionNews(city.name, won);
  const report = advanceDay(); writeSave(s);
  const row = (k: string, v: string | number, cls = '') => `<dt>${k}</dt><dd class="${cls}">${v}</dd>`;
  const sent = Object.values(I.stats.startArmy as Record<string, number>).reduce((a, b) => a + b, 0) + I.stats.deployed;
  let html = row('Units sent into battle', sent) + row('Units lost', I.stats.lost, I.stats.lost ? 'lost' : '') + row('Earth soldiers surrendered', I.stats.surrendered) + row('Prisoners beamed up', I.stats.humans + I.stats.vehicles);
  if (won) html += row('Daily tribute from this city', `${city.size} humans, ${city.size * 2} biomass, ${city.size} metal`, 'gain');
  $('end-eyebrow').textContent = `Invasion report · ${won ? 'Victory' : 'Defeat'}`;
  $('end-title').textContent = won ? `${city.name} has fallen` : `${city.name} pushed us back`;
  $('end-lede').textContent = won ? `${city.name} now serves the Gray Empire.${report.unlocked ? ` New regions unlocked: ${report.unlocked}!` : ''} Its people's first job: a statue of Commander Zix.`
    : 'Your saucer warped out. Surviving units are back on the mothership, and the city is on high alert (its defense level went up by 1).';
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
