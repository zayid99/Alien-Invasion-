// An abduction night (and the Training Night tutorial).
import * as THREE from 'three';
import { G } from '../game/state';
import { camera } from '../core/engine';
import { CFG, RES } from '../data/balance';
import { regionById } from '../data/earth';
import { BIOMES } from '../data/biomes';
import type { MissionSite } from '../core/save';
import { SFX } from '../core/audio';
import { INPUT } from '../core/input';
import { platform } from '../core/platform';
import { hashString, hdist, pick } from '../core/util';
import { buildCountryside } from '../world/maps/countryside';
import { makePlayer, updatePlayer, updateCamera, bankCargo, playerHooks } from '../world/player';
import { updateEnts } from '../world/entity';
import type { Entity } from '../world/entity';
import { PROJ, updateLift, alertLevel } from '../world/combat';
import { updateMilitary, brainShooter, WEAPON } from '../world/military';
import { spawnHuman, respawnCivilians } from '../world/civilians';
import { regionState, missionDone, advanceDay } from '../game/campaign';
import type { DayReport } from '../game/campaign';
import { $, UI } from '../ui/dom';
import { updateHUD, drawMinimap } from '../ui/hud';
import { TUT } from '../ui/tutorial';
import { cone } from '../gfx/kit';
import { PAL } from '../gfx/palette';
import { leaveGlobe } from './globe';
import { BRIEF } from './title';
import { onNightEnd } from '../game/meta';
import { nightNews } from '../game/news';

export const missionHooks = { summary: (_title: string, _html: string, _note: string, _tutorial: boolean) => {} };
let marker: THREE.Mesh = null;

export function startMission(site: MissionSite | null, tutorial = false) {
  leaveGlobe(); TUT.leaveScene(); UI.clearGlobe();   // §7 scene hygiene: no globe UI, labels or Earth tutorial in a mission
  const region = regionById(site ? site.region : 'us-midwest'), level = site ? site.level : 1;
  buildCountryside({ biome: region.biome, seed: site ? hashString(site.id) : CFG.tutorialSeed, level, tutorial });
  G.mode = 'mission'; G.paused = false; G.modeTime = 0; G.nightT = CFG.nightLength;
  G.alert = tutorial ? 0 : Math.min(35, regionState(region.id).alert * 0.5);
  G.cargo = { humans: 0, biomass: 0, metal: 0, mass: 0 };
  G.night = { number: G.save.totals.missions + 1, level, site, tutorial, stats: { humans: 0, animals: 0, vehicles: 0, artifacts: 0 }, banked: { humans: 0, biomass: 0, metal: 0 },
    spawnT: 2, civT: 3, hiding: 0, quietT: 0, ended: false, noMilitary: tutorial, biome: region.biome, regionName: region.name };
  const P = makePlayer(-40, 40); P.invulnerable = tutorial; G.camYaw = 0.35; G.camDist = innerWidth < innerHeight ? 52 : 36;
  camera.position.set(-40, 60, 90);
  // tutorial target arrow: poster yellow (the "look here" colour), HDR so it pops through the night
  if (!marker) { marker = new THREE.Mesh(cone(0.9, 1.8, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.poster).multiplyScalar(3), toneMapped: false })); }
  marker.visible = false; G.world.add(marker);
  UI.show(null); UI.hud(true); $('alert').hidden = tutorial; $('m-cargo').hidden = false; $('deploy').hidden = true; $('objective').textContent = '';
  $('mode-label').textContent = tutorial ? 'Training night · US Midwest' : `Day ${G.save.day} · ${region.name}`;
  UI.hint(`<kbd>WASD</kbd> fly · hold <kbd>Space</kbd> beam · hold <kbd>click</kbd> stun ray · <kbd>Shift</kbd> boost · <kbd>R</kbd> send cargo · <kbd>Q</kbd>/<kbd>E</kbd> camera`);
  $('t-send').hidden = false;
  SFX.setMusic('tense'); platform.gameplayStart(); $('game').focus({ preventScroll: true });
  playerHooks.onDown = () => endNight('destroyed');
  if (tutorial) startTraining();
  else UI.comm(G.save.totals.missions < 3 ? `Welcome to ${BIOMES[region.biome].name.toLowerCase()} country. Cows give biomass, cars give metal, humans are humans. Send cargo up before your shield breaks!`
    : pick(['Earth\'s army is waking up, Commander.', 'Try the army base this time: soldiers make strong recruits.', 'Look for Earth artifacts. The Council loves pizza.']), 6);
}
function nearest(kind: string) { const P = G.player; let best: Entity = null, bd = 1e9; for (const e of G.ents) if (e.kind === kind && !e.dead) { const d = hdist(e.pos, P.pos); if (d < bd) { bd = d; best = e; } } return best; }
function target(e: Entity) { for (const o of G.ents) o.tutTarget = false; if (e) e.tutTarget = true; }
function startTraining() {
  const N = G.night; let cop: Entity = null;
  const touch = INPUT.touch;
  TUT.start('Training', [
    { text: `${BRIEF} Fly your saucer with ${touch ? 'the <b>joystick</b>' : '<b>W A S D</b> or the arrow keys'}.`, check: () => G.player.moved > 30 },
    { text: `See the cow under the yellow arrow? Fly over it and ${touch ? 'hold <b>BEAM</b>' : 'hold <b>SPACE</b>'} to beam it up.`, enter: () => target(nearest('cow')), check: () => { const t = G.ents.find(e => e.tutTarget); if (!t || t.dead) target(nearest('cow')); return N.stats.animals >= 1; } },
    { text: 'Now a human. They run when they see you, so get right above one and hold the beam.', enter: () => target(nearest('civilian')), check: () => { const t = G.ents.find(e => e.tutTarget); if (!t || t.dead) target(nearest('civilian')); return N.stats.humans >= 1; } },
    { text: `Your cargo hold is filling up. ${touch ? 'Tap <b>SEND</b>' : 'Press <b>R</b>'} to teleport the cargo to the mothership.`, enter: () => target(null), check: () => N.banked.humans + N.banked.biomass > 0 },
    { text: `A police officer! ${touch ? 'Hold <b>ZAP</b>' : 'Point at him and hold the <b>left mouse button</b>'} to fire the stun ray. It never kills: the Empire needs humans alive.`,
      enter: () => { const P = G.player; cop = spawnHuman(P.pos.x + 14, P.pos.z - 6, 'cop', { team: 'earth', brain: brainShooter, hp: 20, mini: '#ff6a5a' }); cop.weapon = { ...WEAPON.pistol, dmg: 0 }; cop.zap = true; target(cop); },
      check: () => !!cop && (cop.wasStunned || cop.dead) },
    { text: 'Stunned humans can\'t run away. Beam him up!', check: () => !cop || cop.dead },
  ], () => {
    target(null); UI.comm('Excellent work! That\'s everything you need. Back to the mothership, Commander.', 4);
    setTimeout(() => { if (G.mode === 'mission') endNight('tutorial'); }, 3500);
  }, () => endNight('tutorial'));
}
export function updateMission(dt: number) {
  const N = G.night;
  if (!N.tutorial) G.nightT -= dt;
  N.quietT += dt; if (N.quietT > 5) G.alert = Math.max(0, G.alert - CFG.alertDecay * dt);
  updatePlayer(dt); updateEnts(dt, updateLift); PROJ.update(dt);
  updateMilitary(dt); respawnCivilians(dt); updateCamera(dt);
  TUT.tick();
  const t = G.ents.find(e => e.tutTarget && !e.dead);
  marker.visible = !!t; if (t) marker.position.set(t.pos.x, t.pos.y + t.hh * 2 + 2.6 + Math.sin(G.time * 5) * 0.5, t.pos.z);
  if (!N.tutorial && G.nightT <= 20 && !N.warned) { N.warned = true; UI.toast('Dawn in 20 seconds! Send your cargo', 'warn', 3); }
  if (!N.tutorial && G.nightT <= 0 && !N.ended) endNight('dawn');
  updateHUD(); drawMinimap();
}
export function endNight(reason: 'dawn' | 'destroyed' | 'abort' | 'tutorial') {
  const N = G.night; if (!N || N.ended) return; N.ended = true;
  const lost = { ...G.cargo };
  G.lastNight = { banked: { ...N.banked }, lost: reason === 'destroyed' ? { humans: lost.humans, biomass: lost.biomass, metal: lost.metal } : {} };
  if (reason !== 'destroyed') bankCargo(); else G.cargo = { humans: 0, biomass: 0, metal: 0, mass: 0 };
  SFX.stopLoops(); TUT.stop(); platform.gameplayStop();
  G.save.totals.playTime += CFG.nightLength - Math.max(0, G.nightT);
  let report: DayReport = null;
  if (!N.tutorial) { missionDone(N.site, N.stats.humans, N.stats.humans + N.stats.animals + N.stats.vehicles); report = advanceDay(); onNightEnd(reason === 'dawn' && !N.hurt); nightNews(N.stats, N.regionName, reason, N.maxAlert || 0, !!N.mega); }
  const row = (k: string, v: string | number, cls = '') => `<dt>${k}</dt><dd class="${cls}">${v}</dd>`;
  let html = row('Humans abducted', N.stats.humans) + row('Animals abducted', N.stats.animals) + row('Vehicles abducted', N.stats.vehicles);
  if (N.stats.artifacts) html += row('Earth artifacts found', N.stats.artifacts, 'gain');
  for (const r of RES) html += row(`${r[0].toUpperCase() + r.slice(1)} banked`, `+${N.banked[r]}`, 'gain');
  if (reason === 'destroyed' && lost.mass > 0) html += row('Cargo lost in the warp', RES.filter(r => lost[r]).map(r => `${lost[r]} ${r}`).join(', ') || '0', 'lost');
  if (report && RES.some(r => report.tribute[r])) html += row('Tribute from your cities', RES.filter(r => report.tribute[r]).map(r => `${report.tribute[r]} ${r}`).join(', '), 'gain');
  const title = reason === 'tutorial' ? 'Training complete' : reason === 'destroyed' ? 'Shield failure: emergency warp' : reason === 'abort' ? 'Mission ended early' : 'The sun rises. Night complete';
  const note = reason === 'tutorial' ? 'Next: build your first unit on the mothership.' : `${report?.unlocked ? `New regions unlocked: ${report.unlocked}! ` : ''}Day ${G.save.day} begins. Earth's awareness of aliens: ${G.save.awareness.toFixed(0)}%.`;
  SFX.play(reason === 'destroyed' ? 'sad' : 'fanfare');
  missionHooks.summary(title, html, note, reason === 'tutorial');
}
export { alertLevel };
