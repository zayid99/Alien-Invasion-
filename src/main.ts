// Alien Invasion: boot, game flow between scenes, buttons, pause menu and the main loop.
import './style.css';
import * as THREE from 'three';
import { G } from './game/state';
import { renderer, renderFrame, setQuality, QUALITY, camera } from './core/engine';
import { INPUT } from './core/input';
import { SFX } from './core/audio';
import { platform } from './core/platform';
import { loadSave, writeSave, newSave, eraseSave } from './core/save';
import type { MissionSite } from './core/save';
import { preload, allModelIds } from './core/assets';
import type { UpgradeKey } from './data/balance';
import type { UnitKey } from './data/units';
import type { City } from './data/earth';
import { FX, BEAM } from './gfx/fx';
import { portrait } from './ui/portrait';
import { $, UI } from './ui/dom';
import { TUT } from './ui/tutorial';
import { initUFO, bankCargo } from './world/player';
import { PROJ, updateLift } from './world/combat';
import { updateEnts } from './world/entity';
import { deployUnit } from './world/invasion';
import { refreshSites, armyPower } from './game/campaign';
import { enterTitle, updateTitle, enterBriefing, finishBriefing } from './scenes/title';
import { startMission, updateMission, endNight, missionHooks } from './scenes/mission';
import { enterMothership, updateMothership, buildUnits, buyUpgrade } from './scenes/mothership';
import { enterGlobe, leaveGlobe, updateGlobe, globeHooks, globeSelection, hideLabels } from './scenes/globe';
import { startInvasion, updateInvasion, updateVictory, endInvasion, invasionScene } from './scenes/invasion';

// ---------------- flow between scenes ----------------
function goGlobe() {
  TUT.stop(); if (!G.save.tutorial.done && G.save.tutorial.ms >= 1) G.save.tutorial.ms = 3;
  refreshSites(); writeSave(G.save);
  G.mode = 'globe'; G.paused = false; G.modeTime = 0; UI.show(null); UI.hud(false); SFX.setMusic('calm'); platform.gameplayStop();
  enterGlobe();
  if (!G.save.tutorial.done) TUT.start('Earth', [
    { text: 'This is Earth! <b>Drag</b> to spin it. Glowing rings are abduction sites. <b>Tap one</b> (or pick it from the list).', check: () => globeSelection()?.type === 'site' },
    { text: 'Press <b>Launch night</b> to start your first real mission. This time Earth\'s army will fight back!', highlight: 'btn-launch-site', check: () => G.mode === 'mission' },
  ], () => { G.save.tutorial.done = true; writeSave(G.save); }, () => { G.save.tutorial.done = true; writeSave(G.save); });
}
function leaveGlobeIfOpen() {
  if (TUT.active && TUT.label === 'Earth') { G.save.tutorial.done = true; TUT.stop(); }   // leaving the globe completes its tutorial
  if (G.mode === 'globe') { leaveGlobe(); hideLabels(); }
}
globeHooks.launchSite = (site: MissionSite) => { leaveGlobeIfOpen(); startMission(site); };
globeHooks.invade = (c: City) => {
  if (armyPower() <= 30 && !Object.values(G.save.army).some(n => n > 0)) { UI.toast('You have no army yet. Build units on the mothership first!', 'warn', 3); SFX.play('error'); return; }
  leaveGlobeIfOpen(); TUT.stop(); startInvasion(c);
};
globeHooks.mothership = () => { leaveGlobeIfOpen(); TUT.stop(); enterMothership(); };
missionHooks.summary = (title, html, note, tutorial) => {
  G.mode = 'summary'; UI.hud(false); UI.hideComm(); BEAM.hide();
  if (tutorial) G.save.tutorial.ms = Math.max(G.save.tutorial.ms, 1);
  writeSave(G.save);
  $('sum-eyebrow').textContent = tutorial ? 'Training report' : `Mission report · ${G.night?.regionName ?? ''}`;
  $('sum-title').textContent = title; $('sum-body').innerHTML = html; $('sum-note').textContent = note;
  $('btn-sum-ms').hidden = tutorial; $('btn-sum-next').textContent = tutorial ? 'To the mothership' : 'Back to Earth';
  UI.show('scr-summary');
};
invasionScene.done = () => writeSave(G.save);
async function betweenMissions(next: () => void) { await platform.midgameAd(); next(); }   // no-op until ads are enabled

function startNewGame() { eraseSave(); G.save = newSave(); writeSave(G.save); enterBriefing(); }
function continueGame() {
  const s = loadSave(); if (s) G.save = s;
  if (G.save.tutorial.done || G.save.tutorial.ms >= 3) goGlobe();
  else if (G.save.tutorial.ms >= 1) enterMothership();
  else startMission(null, true);
}
function setPaused(p: boolean) {
  if (!['mission', 'invasion', 'globe'].includes(G.mode)) return;
  G.paused = p; UI.show(p ? 'scr-pause' : null);
  if (p) { SFX.stopLoops(); platform.gameplayStop(); } else if (G.mode !== 'globe') platform.gameplayStart();
  $('btn-sound').textContent = `Sound: ${SFX.muted ? 'off' : 'on'}`; $('btn-quality').textContent = `Graphics: ${QUALITY}`;
  const msg = { mission: ['End the night', 'Ending the night still delivers the cargo in your hold.'], invasion: ['Retreat', 'Retreating counts as a failed invasion. Surviving units come home.'], globe: ['Save & quit', 'Your progress is saved automatically.'] }[G.mode];
  $('btn-quit').textContent = msg[0]; $('pause-note').textContent = msg[1];
  if (!p) $('game').focus({ preventScroll: true });
}
function wireUI() {
  const click = (id: string, fn: (e: MouseEvent) => void) => $(id).addEventListener('click', e => { SFX.init(); fn(e as MouseEvent); });
  click('btn-new', () => { SFX.play('ui'); if (loadSave()) $('confirm-new').hidden = false; else startNewGame(); });
  click('btn-confirm-yes', () => { $('confirm-new').hidden = true; startNewGame(); });
  click('btn-confirm-no', () => { $('confirm-new').hidden = true; });
  click('btn-continue', () => { SFX.play('ui'); continueGame(); });
  click('btn-howto', () => { SFX.play('ui'); UI.show('scr-howto'); });
  click('btn-howto-back', () => { SFX.play('ui'); UI.show('scr-title'); });
  click('btn-brief-skip', () => finishBriefing());
  click('btn-accept', () => { SFX.play('ui'); finishBriefing(); startMission(null, true); });
  click('btn-sum-next', () => { SFX.play('ui'); if (G.save.tutorial.ms < 3 && !G.save.tutorial.done) enterMothership(); else betweenMissions(goGlobe); });
  click('btn-sum-ms', () => { SFX.play('ui'); betweenMissions(enterMothership); });
  click('ms-army', e => { const b = (e.target as HTMLElement).closest('[data-build]') as HTMLButtonElement; if (b && !b.disabled) buildUnits(b.dataset.build as UnitKey, +b.dataset.n); });
  click('ms-upgrades', e => { const b = (e.target as HTMLElement).closest('[data-up]') as HTMLButtonElement; if (b && !b.disabled) buyUpgrade(b.dataset.up as UpgradeKey); });
  click('btn-ms-earth', () => { SFX.play('ui'); goGlobe(); });
  click('btn-ms-menu', () => { SFX.play('ui'); writeSave(G.save); TUT.stop(); enterTitle(); });
  click('btn-g-ms', () => globeHooks.mothership());
  click('btn-g-menu', () => setPaused(true));
  click('pause-btn', () => setPaused(true));
  click('btn-resume', () => setPaused(false));
  click('btn-sound', () => { SFX.setMuted(!SFX.muted); $('btn-sound').textContent = `Sound: ${SFX.muted ? 'off' : 'on'}`; });
  click('btn-quality', () => { setQuality(QUALITY === 'high' ? 'low' : 'high'); $('btn-quality').textContent = `Graphics: ${QUALITY}`; });
  click('btn-quit', () => {
    G.paused = false; UI.show(null);
    if (G.mode === 'mission') endNight('abort');
    else if (G.mode === 'invasion') { G.player.dead = true; endInvasion(false); }
    else if (G.mode === 'globe') { writeSave(G.save); leaveGlobe(); hideLabels(); TUT.stop(); enterTitle(); }
  });
  click('btn-end', () => { SFX.play('ui'); betweenMissions(goGlobe); });
  click('deploy', e => { const b = (e.target as HTMLElement).closest('[data-deploy]') as HTMLButtonElement; if (b && !b.disabled) deployUnit(b.dataset.deploy as UnitKey); });
  click('tut-skip', () => TUT.skip());
  document.addEventListener('visibilitychange', () => { if (document.hidden && (G.mode === 'mission' || G.mode === 'invasion') && !G.paused) setPaused(true); });
  INPUT.captureKeys = () => (G.mode === 'mission' || G.mode === 'invasion') && !G.paused;
  INPUT.onTouchEnabled = () => { UI.touch = true; UI.hud(!$('hud').hidden); };
  SFX.listener = () => G.player?.pos ?? null;
  platform.onMuteChange = () => SFX.refreshVolume();
  platform.onAdPause = paused => { SFX.adPaused = paused; SFX.refreshVolume(); };
}

// ---------------- main loop ----------------
const clock = new THREE.Clock();
let errShown = false;
function step(dt: number) {
  G.time += dt; G.modeTime += dt;
  switch (G.mode) {
    case 'title': case 'briefing': updateTitle(dt); break;
    case 'mission': updateMission(dt); break;
    case 'invasion': updateInvasion(dt); break;
    case 'victory': updateVictory(dt); break;
    case 'globe': updateGlobe(dt, G.time); TUT.tick(); break;
    case 'mothership': updateMothership(dt, G.time); break;
    case 'summary': case 'end': { const c = G.player?.pos ?? new THREE.Vector3(), a = G.time * 0.08; camera.position.set(c.x + Math.cos(a) * 70, 45, c.z + Math.sin(a) * 70); camera.lookAt(c.x, 4, c.z); break; }
  }
  FX.update(dt);
}
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (document.body.dataset.mode !== G.mode) document.body.dataset.mode = G.mode;
  try {
    if (!G.paused) step(dt);
    UI.tick(dt); portrait.render(dt);
    if (['mission', 'invasion'].includes(G.mode) && (INPUT.hit('KeyP') || INPUT.hit('Escape'))) setPaused(!G.paused);
    if (INPUT.hit('KeyM')) { SFX.init(); SFX.setMuted(!SFX.muted); UI.toast(SFX.muted ? 'Sound off' : 'Sound on', '', 1.2); }
  } catch (err) {
    console.error(err);
    if (!errShown) { errShown = true; UI.toast('Glitch in the matrix: ' + (err as Error).message, 'warn', 6); }
  }
  INPUT.endFrame(); renderFrame();
}
async function boot(data?: { save?: any }) {
  (window as any).__aiBooted = true;
  platform.loadingStart();
  await platform.init(); platform.loadingStart();
  INPUT.init(); FX.init(); BEAM.init(); portrait.init(); initUFO(); setQuality(QUALITY); wireUI();
  const s = data?.save || loadSave(); if (s) G.save = s;
  await preload(allModelIds(), (d, t) => { $('loading').textContent = `Loading Earth… ${Math.round(d / t * 100)}%`; });
  $('loading').hidden = true; $('fail').hidden = true; platform.loadingStop();
  enterTitle();
  renderer.setAnimationLoop(tick);
}

// Handy for testing in the browser console, e.g. __AI.give(100)
(window as any).__AI = {
  G, startMission, startInvasion, enterMothership, goGlobe, endNight, deployUnit, setQuality, INPUT, PROJ, renderer, camera, TUT, bankCargo,
  give(n = 50) { for (const r of ['humans', 'biomass', 'metal'] as const) G.save.res[r] += n; writeSave(G.save); },
  simulate(sec: number, dt = 1 / 30) { for (let t = 0; t < sec; t += dt) { step(dt); INPUT.endFrame(); } },
  updateEnts: (dt: number) => updateEnts(dt, updateLift),
};
const HOT = (window as any).claude?.hot;
if (HOT?.snapshot) HOT.snapshot(() => ({ save: G.save }));
if (HOT?.ready) HOT.ready(boot); else boot(HOT?.data);
