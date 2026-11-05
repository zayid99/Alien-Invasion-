// Title screen (a saucer drifting over a sleepy town) and the opening briefing.
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
import { leaveGlobe } from './globe';

export function enterTitle() {
  leaveGlobe();
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
  LIGHT.ufo.position.set(P.pos.x, P.pos.y - 2.5, P.pos.z); LIGHT.ufo.intensity = 160;
  UFO.lights.forEach((l, i) => { const on = (G.time * 7 + i) % 14 < 3; l.material.color.setRGB(on ? 3 : 0.5, on ? 1.6 : 0.3, on ? 4 : 0.6); });
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
