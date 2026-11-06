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
import { TWISTS, nightScore, nightStars, nightTarget } from '../data/campaign';
import type { Twist } from '../data/campaign';

export const missionHooks = { summary: (_title: string, _html: string, _note: string, _tutorial: boolean) => {} };
let marker: THREE.Mesh = null;

export function startMission(site: MissionSite | null, tutorial = false) {
  leaveGlobe(); TUT.leaveScene(); UI.clearGlobe();   // §7 scene hygiene: no globe UI, labels or Earth tutorial in a mission
  const region = regionById(site ? site.region : 'us-midwest'), level = site ? site.level : 1;
  const twist: Twist | null = !tutorial && site?.twist ? TWISTS[site.twist] : null;
  buildCountryside({ biome: region.biome, seed: site ? hashString(site.daily ? 'challenge-' + site.daily : site.id) : CFG.tutorialSeed, level, tutorial, twist: twist?.id });
  G.mode = 'mission'; G.paused = false; G.modeTime = 0; G.nightT = CFG.nightLength;
  G.alert = tutorial ? 0 : Math.min(35, regionState(region.id).alert * 0.5);
  G.cargo = { humans: 0, biomass: 0, metal: 0, mass: 0 };
  G.night = { number: G.save.totals.missions + 1, level, site, tutorial, twist, stats: { humans: 0, animals: 0, vehicles: 0, artifacts: 0, kinds: {} as Record<string, number> }, banked: { humans: 0, biomass: 0, metal: 0 },
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
  else if (twist) UI.comm(`<b>${twist.name}!</b> ${twist.blurb} Goal: ${twistGoalText(twist)} for a bonus.`, 6);
  else UI.comm(G.save.totals.missions < 3 ? `Welcome to ${BIOMES[region.biome].name.toLowerCase()} country. Cows give biomass, cars give metal, humans are humans. Send cargo up before your shield breaks!`
    : pick(['Earth\'s army is waking up, Commander.', 'Try the army base this time: soldiers make strong recruits.', 'Look for Earth artifacts. The Council loves pizza.']), 6);
}
/** Twist goal progress (docs/gdd/night-sites.md): [current, target, met]. */
export function twistProgress(t: Twist, N = G.night): [number, number, boolean] {
  const st = N.stats, g = t.goal;
  if (g.kind === 'alert') { const a = N.maxAlert || 0; return [a, g.n, a <= g.n]; }
  const v = g.kind === 'scientist' || g.kind === 'tank' ? st.kinds[g.kind] || 0 : st[g.kind] || 0;
  return [v, g.n, v >= g.n];
}
const twistGoalText = (t: Twist) => t.goal.kind === 'alert' ? 'end the night with alert 1 or lower' : `abduct ${t.goal.n} ${t.goal.label}`;
const costTxt = (c: Record<string, number>) => Object.entries(c).filter(([, v]) => v).map(([k, v]) => `+${v} ${k}`).join(', ');
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
  if (N.twist && (N.objT = (N.objT || 0) - dt) <= 0) {   // twist goal progress line
    N.objT = 0.25; const [v, n, met] = twistProgress(N.twist);
    $('objective').textContent = N.twist.goal.kind === 'alert' ? `${N.twist.name}: keep the alert at ${n} or lower (now ${v})${met ? '' : ' ✗'}` : `${N.twist.name}: ${N.twist.goal.label} ${Math.min(v, n)}/${n}${met ? ' ✔' : ''}`;
  }
  updateHUD(); drawMinimap();
}
export function endNight(reason: 'dawn' | 'destroyed' | 'abort' | 'tutorial') {
  const N = G.night; if (!N || N.ended) return; N.ended = true;
  if (N.tutorial && reason === 'abort') reason = 'tutorial';   // quitting the training night skips the rest of training
  const lost = { ...G.cargo };
  G.lastNight = { banked: { ...N.banked }, lost: reason === 'destroyed' ? { humans: lost.humans, biomass: lost.biomass, metal: lost.metal } : {} };
  if (reason !== 'destroyed') bankCargo(); else G.cargo = { humans: 0, biomass: 0, metal: 0, mass: 0 };
  SFX.stopLoops(); TUT.stop(); platform.gameplayStop();
  G.save.totals.playTime += CFG.nightLength - Math.max(0, G.nightT);
  let report: DayReport = null;
  if (!N.tutorial) {
    // ending a night early (pause menu) still uses up the day, but tribute is paid only for the share of the night
    // played, and it does not count as a finished night for missions or achievements (no tribute farming)
    const share = reason === 'abort' ? Math.max(0, Math.min(1, 1 - Math.max(0, G.nightT) / CFG.nightLength)) : 1;
    missionDone(N.site, N.stats.humans, N.stats.humans + N.stats.animals + N.stats.vehicles, reason !== 'abort');
    report = advanceDay(share); if (reason !== 'abort') onNightEnd(reason === 'dawn' && !N.hurt); nightNews(N.stats, N.regionName, reason, N.maxAlert || 0, !!N.mega);
  }
  const row = (k: string, v: string | number, cls = '') => `<dt>${k}</dt><dd class="${cls}">${v}</dd>`;
  // grade + twist bonus (docs/gdd/night-sites.md)
  let grade = '';
  if (!N.tutorial) {
    const tw = N.twist ? twistProgress(N.twist) : null, met = tw ? tw[2] && reason !== 'destroyed' : null;
    if (met) for (const [r, v] of Object.entries(N.twist.bonus)) { G.save.res[r] += v; G.save.totals[r] += v; }
    const score = nightScore(N.banked), stars = nightStars(score, N.level, met, reason), B = G.save.best, newBest = score > B.nightScore && reason !== 'abort';
    if (newBest) B.nightScore = score; if (stars === 3) B.stars3++;
    if (N.site?.daily) G.save.challenge = { date: N.site.daily, score, stars };
    N.grade = { score, stars, met };
    grade = row('Grade', `<span class="stars s${stars}">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`, 'grade')
      + row('Score', `${score} <small>(target ${nightTarget(N.level)} · best ${B.nightScore})</small>${newBest ? ' <b class="newbest">New best!</b>' : ''}`)
      + (N.twist ? row(N.twist.name, met ? `goal done: ${costTxt(N.twist.bonus as Record<string, number>)}` : `goal missed (${twistGoalText(N.twist)})`, met ? 'gain' : '') : '');
  }
  let html = grade + row('Humans abducted', N.stats.humans) + row('Animals abducted', N.stats.animals) + row('Vehicles abducted', N.stats.vehicles);
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
