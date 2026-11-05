// Title screen (a saucer drifting over a sleepy town) and the opening briefing.
import * as THREE from 'three';
import { G } from '../game/state';
import { camera, LIGHT } from '../core/engine';
import { BEAM } from '../gfx/fx';
import { SFX } from '../core/audio';
import { platform } from '../core/platform';
import { loadSave } from '../core/save';
import { buildCountryside } from '../world/maps/countryside';
import { makePlayer, UFO } from '../world/player';
import { updateEnts } from '../world/entity';
import { updateLift } from '../world/combat';
import { $, UI } from '../ui/dom';
import { portrait } from '../ui/portrait';
import { TUT } from '../ui/tutorial';
import { reducedMotion } from '../core/util';
import { PAL } from '../gfx/palette';
import { leaveGlobe } from './globe';

// Saucer running lights on the title (§5): an 8 Hz chase cycling slime / bubblegum / poster / earth-cyan at k 3.
const CHASE = [PAL.slime, PAL.bubblegum, PAL.poster, PAL.earthCyan].map(c => new THREE.Color(c).multiplyScalar(3));

export function enterTitle() {
  leaveGlobe(); TUT.leaveScene(); UI.clearGlobe(); UI.hideComm();
  G.mode = 'title'; G.paused = false; G.modeTime = 0; SFX.stopLoops(); SFX.setMusic('calm'); platform.gameplayStop();
  buildCountryside({ biome: 'temperate', seed: 1234, level: 1, title: true });
  const P = makePlayer(30, 10); P.title = true;
  UI.hud(false); UI.globe(false); UI.show('scr-title');
  const s = loadSave(); $('btn-continue').hidden = !s;
  if (s) $('btn-continue').textContent = s.tutorial.done || s.tutorial.ms >= 3 ? `Continue · day ${s.day}` : 'Continue training';
}
export function updateTitle(dt: number) {
  const P = G.player, t = G.modeTime;
  P.pos.set(30 + Math.cos(t * 0.15) * 40, G.ufoY + Math.sin(t * 2) * 0.4, 10 + Math.sin(t * 0.15) * 40);
  UFO.body.rotation.y += dt * 0.8; P.beamOn = Math.sin(t * 0.5) > 0.4;
  BEAM.update(dt, P.pos, 5, P.beamOn, G.time);
  LIGHT.ufo.position.set(P.pos.x, P.pos.y - 2.5, P.pos.z); LIGHT.ufo.intensity = 140 + (P.beamOn ? 60 : 0);   // slime underglow (§4), brighter with the beam on (as player.ts)
  const step = reducedMotion ? 0 : Math.floor(G.time * 8);
  UFO.lights.forEach((l, i) => { l.material.color.copy(CHASE[(i + step) % 4]); });
  const glow = P.beamOn ? 1.4 : 1; UFO.emitterMat.color.setRGB(0.9 * glow, 2.4 * glow, 0.5 * glow);   // slime emitter disc
  // antenna bobble (models lane, C8): a lazy sway while the saucer idles on the title
  const ant = (UFO as typeof UFO & { antenna?: THREE.Object3D }).antenna;
  if (ant && !reducedMotion) { ant.rotation.z = Math.sin(t * 1.3) * 0.12; ant.rotation.x = Math.sin(t * 0.9) * 0.06; }
  const a = t * 0.05 + 0.8; camera.position.set(P.pos.x + Math.cos(a) * 48, 30, P.pos.z + Math.sin(a) * 48); camera.lookAt(P.pos.x, 6, P.pos.z);
  updateEnts(dt, updateLift);
}
export const BRIEF = `Commander <b>Zix</b>. The High Council has chosen a planet called <b>Earth</b>.
Its inhabitants, "humans", are loud and confused, and they will make excellent servants.
Your orders:
1. <b>Abduct</b> humans, livestock and machines from every continent.
2. <b>Build an army</b> on the mothership.
3. <b>Conquer</b> Earth's great cities, one by one.
First, a training night. Do not disappoint us.`;
let typer: ReturnType<typeof setInterval> = null;
export function enterBriefing() {
  G.mode = 'briefing'; UI.show('scr-briefing'); portrait.attach($('brief-face'));
  const el = $('brief-text'); let i = 0; el.innerHTML = ''; clearInterval(typer);
  typer = setInterval(() => {
    i += 3; const lt = BRIEF.lastIndexOf('<', i - 1), gt = BRIEF.lastIndexOf('>', i - 1); if (lt > gt) i = BRIEF.indexOf('>', lt) + 1;
    if (i >= BRIEF.length) { clearInterval(typer); i = BRIEF.length; }
    el.innerHTML = BRIEF.slice(0, i); portrait.talk = 0.4;
  }, 30);
}
export function finishBriefing() { clearInterval(typer); $('brief-text').innerHTML = BRIEF; }
