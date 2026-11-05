// Alien Invasion: boot, game flow between scenes, buttons, pause menu and the main loop.
import './style.css';
import * as THREE from 'three';
import { G } from './game/state';
import { renderer, renderFrame, setQuality, QUALITY, camera, scene } from './core/engine';
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

// ---------------- screen transitions (iris, docs/ART_STYLE.md §7) ----------------
const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
/**
 * Compile every material of the current scene behind the loading screen or the closed iris (§4, §10), capped so
 * a slow driver can never hold the transition. Never rejects.
 */
function prewarmScene(maxMs: number): Promise<void> {
  let job: Promise<unknown>;
  try { job = renderer.compileAsync(scene, camera); } catch (e) { console.warn('prewarm failed', e); return Promise.resolve(); }
  return Promise.race([job.then(() => undefined, e => { console.warn('prewarm failed', e); }), wait(maxMs)]);
}
UI.prewarm = () => prewarmScene(3000);
/** Where the last pointer went down (the iris closes on the clicked button). */
const pointer = { x: 0, y: 0, t: -1e9 };
addEventListener('pointerdown', e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.t = performance.now(); }, { capture: true, passive: true });
/** The screen point of a click: the pointer if it was just pressed, else the element's centre (keyboard use). */
function clickPoint(el?: Element | null): { x: number; y: number } | undefined {
  if (performance.now() - pointer.t < 1500) return { x: pointer.x, y: pointer.y };
  if (el) { const r = el.getBoundingClientRect(); if (r.width) return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  return undefined;
}
/** The saucer's screen point (mission / invasion endings close the iris on it). */
function saucerPoint(): { x: number; y: number } | undefined {
  const P = G.player; if (!P?.pos) return undefined;
  const v = new THREE.Vector3().copy(P.pos).project(camera);
  if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) return undefined;
  return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
}

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
// Globe exits close the iris on the clicked site / button (the globe calls these hooks without an event).
globeHooks.launchSite = (site: MissionSite) => { if (UI.irisClosing) return; UI.iris(() => { leaveGlobeIfOpen(); startMission(site); }, clickPoint()); };
globeHooks.invade = (c: City) => {
  if (UI.irisClosing) return;
  if (armyPower() <= 30 && !Object.values(G.save.army).some(n => n > 0)) { UI.toast('You have no army yet. Build units on the mothership first!', 'warn', 3); SFX.play('error'); return; }
  UI.iris(() => { leaveGlobeIfOpen(); TUT.stop(); startInvasion(c); }, clickPoint());
};
globeHooks.mothership = () => { if (UI.irisClosing) return; UI.iris(() => { leaveGlobeIfOpen(); TUT.stop(); enterMothership(); }, clickPoint($('btn-g-ms'))); };
missionHooks.summary = (title, html, note, tutorial) => {
  // The mode switches now (the night is over: no more input), the screen swaps behind the iris, closing on the saucer.
  G.mode = 'summary'; BEAM.hide();
  if (tutorial) G.save.tutorial.ms = Math.max(G.save.tutorial.ms, 1);
  writeSave(G.save);
  $('sum-eyebrow').textContent = tutorial ? 'Training report' : `Mission report · ${G.night?.regionName ?? ''}`;
  $('sum-title').textContent = title; $('sum-body').innerHTML = html; $('sum-note').textContent = note;
  $('btn-sum-ms').hidden = tutorial; $('btn-sum-next').textContent = tutorial ? 'To the mothership' : 'Back to Earth';
  UI.iris(() => { UI.hud(false); UI.hideComm(); UI.show('scr-summary'); }, saucerPoint());
};
invasionScene.done = () => writeSave(G.save);
invasionScene.irisFrom = saucerPoint;
/** Leave a report screen: the midgame ad (a no-op until ads are enabled) plays while the iris is closed. */
function betweenMissions(next: () => void, from?: { x: number; y: number }) { return UI.iris(async () => { await platform.midgameAd(); next(); }, from); }

function startNewGame(from?: { x: number; y: number }) { eraseSave(); G.save = newSave(); writeSave(G.save); UI.iris(enterBriefing, from); }
function continueGame(from?: { x: number; y: number }) {
  const s = loadSave(); if (s) G.save = s;
  UI.iris(() => {
    if (G.save.tutorial.done || G.save.tutorial.ms >= 3) goGlobe();
    else if (G.save.tutorial.ms >= 1) enterMothership();
    else startMission(null, true);
  }, from);
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
  // While the iris is closing the old screen is on its way out: ignore its buttons (keyboard repeats included).
  const click = (id: string, fn: (e: MouseEvent) => void) => $(id).addEventListener('click', e => { if (UI.irisClosing) return; SFX.init(); fn(e as MouseEvent); });
  const at = (e: MouseEvent) => clickPoint(e.currentTarget as Element);   // the iris closes on the clicked button
  click('btn-new', e => { SFX.play('ui'); if (loadSave()) $('confirm-new').hidden = false; else startNewGame(at(e)); });
  click('btn-confirm-yes', e => { $('confirm-new').hidden = true; startNewGame(at(e)); });
  click('btn-confirm-no', () => { $('confirm-new').hidden = true; });
  click('btn-continue', e => { SFX.play('ui'); continueGame(at(e)); });
  click('btn-howto', () => { SFX.play('ui'); UI.show('scr-howto'); });
  click('btn-howto-back', () => { SFX.play('ui'); UI.show('scr-title'); });
  click('btn-brief-skip', () => finishBriefing());
  click('btn-accept', e => { SFX.play('ui'); finishBriefing(); UI.iris(() => startMission(null, true), at(e)); });
  click('btn-sum-next', e => { SFX.play('ui'); if (G.save.tutorial.ms < 3 && !G.save.tutorial.done) UI.iris(enterMothership, at(e)); else betweenMissions(goGlobe, at(e)); });
  click('btn-sum-ms', e => { SFX.play('ui'); betweenMissions(enterMothership, at(e)); });
  click('ms-army', e => { const b = (e.target as HTMLElement).closest('[data-build]') as HTMLButtonElement; if (b && !b.disabled) buildUnits(b.dataset.build as UnitKey, +b.dataset.n); });
  click('ms-upgrades', e => { const b = (e.target as HTMLElement).closest('[data-up]') as HTMLButtonElement; if (b && !b.disabled) buyUpgrade(b.dataset.up as UpgradeKey); });
  click('btn-ms-earth', e => { SFX.play('ui'); UI.iris(goGlobe, at(e)); });
  click('btn-ms-menu', e => { SFX.play('ui'); writeSave(G.save); UI.iris(() => { TUT.stop(); enterTitle(); }, at(e)); });
  click('btn-g-ms', () => globeHooks.mothership());
  click('btn-g-menu', () => setPaused(true));
  click('pause-btn', () => setPaused(true));
  click('btn-resume', () => setPaused(false));
  click('btn-sound', () => { SFX.setMuted(!SFX.muted); $('btn-sound').textContent = `Sound: ${SFX.muted ? 'off' : 'on'}`; });
  click('btn-quality', () => { setQuality(QUALITY === 'high' ? 'low' : 'high'); $('btn-quality').textContent = `Graphics: ${QUALITY}`; });
  click('btn-quit', e => {
    G.paused = false; UI.show(null);
    if (G.mode === 'mission') endNight('abort');
    else if (G.mode === 'invasion') { G.player.dead = true; endInvasion(false); }
    else if (G.mode === 'globe') { writeSave(G.save); UI.iris(() => { leaveGlobe(); hideLabels(); TUT.stop(); enterTitle(); }, at(e)); }
  });
  click('btn-end', e => { SFX.play('ui'); betweenMissions(goGlobe, at(e)); });
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
    case 'summary': case 'end': {
      // While the iris closes, the finished night holds still under the old camera (no AI, shots or lifts: the
      // night is over and its cargo already banked); the slow report orbit starts behind the closed iris.
      if (UI.irisClosing) break;
      const c = G.player?.pos ?? new THREE.Vector3(), a = G.time * 0.08; camera.position.set(c.x + Math.cos(a) * 70, 45, c.z + Math.sin(a) * 70); camera.lookAt(c.x, 4, c.z); break;
    }
  }
  FX.update(dt);
}
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (document.body.dataset.mode !== G.mode) document.body.dataset.mode = G.mode;
  try {
    if (!G.paused) step(dt);
    UI.tick(dt); portrait.render(dt);
    if (['mission', 'invasion'].includes(G.mode) && !UI.irisBusy && (INPUT.hit('KeyP') || INPUT.hit('Escape'))) setPaused(!G.paused);
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
  // Loading screen (§7): the sticker meter fills with the model downloads, then the title scene is built and its
  // shaders compiled; the screen hides once that and Lilita One (or a 2.5 s timeout) are ready.
  const fill = $('load-fill');
  const progress = (f: number) => {
    if (fill) fill.style.setProperty('--p', Math.min(1, f).toFixed(3));
    else $('loading').textContent = `Loading Earth… ${Math.round(f * 100)}%`;   // older markup without the meter
  };
  progress(0.06);
  await preload(allModelIds(), (d, t) => progress(0.06 + 0.8 * d / t));
  enterTitle(); progress(0.9);
  const font = document.fonts?.load ? document.fonts.load('40px "Lilita One"').then(() => undefined, () => undefined) : Promise.resolve();
  await Promise.all([Promise.race([font, wait(2500)]), prewarmScene(10000)]);
  progress(1);
  renderer.setAnimationLoop(tick);
  await Promise.race([new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))), wait(400)]);   // first frames behind the curtain
  $('loading').hidden = true; $('fail').hidden = true; platform.loadingStop();
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
