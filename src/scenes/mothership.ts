// The mothership: build army units and upgrade the saucer, with Earth turning below.
// Backdrop per docs/ART_STYLE.md §4/§5/§8: banded space sky, sparkle stars, the toon Earth (same painted map,
// toon material and stepped atmosphere as the globe), a ringed cartoon planet, mothership light rig.
import { checkAchievements } from '../game/meta';
import { metaButtonLabels } from '../ui/meta';
import * as THREE from 'three';
import { G, track } from '../game/state';
import { camera, scene, LIGHT, makeStars, fresnelMaterial, gradientSky } from '../core/engine';
import { RES, UPGRADES, canAfford, payCost, scaleCost } from '../data/balance';
import type { UpgradeKey } from '../data/balance';
import { UNIT_TYPES, UNIT_KEYS, unitPower } from '../data/units';
import type { UnitKey } from '../data/units';
import { CITIES, regionById } from '../data/earth';
import { writeSave } from '../core/save';
import { SFX } from '../core/audio';
import { platform } from '../core/platform';
import { miniSaucer, makeMothership } from '../gfx/models';
import { clearWorld } from '../world/maps/common';
import { armyPower, earthPower, cityLevel, cityState, regionUnlocked, verdict } from '../game/campaign';
import { earthCanvas, leaveGlobe, hideLabels, makeRingPlanet, renderWallet } from './globe';
import { toonMaterial, inkify, setRimColor } from '../gfx/toon';
import { PAL, SKY } from '../gfx/palette';
import { $, UI, costHTML } from '../ui/dom';
import { TUT } from '../ui/tutorial';

let space: { earth: THREE.Group; ship: THREE.Object3D; drones: { d: THREE.Object3D; a: number; r: number; y: number }[] } = null;

export function enterMothership() {
  leaveGlobe(); hideLabels();
  clearWorld(); G.mode = 'mothership'; G.paused = false; G.modeTime = 0;
  // sky (§4 globe / mothership row), stars, lights (§4 mothership row), space rim colour
  const S = SKY.space;
  scene.fog = null; scene.background = new THREE.Color(S.bottom);
  const sky = gradientSky(S.top, S.horizon, S.bottom, 1200); sky.renderOrder = -10; track(sky.geometry, sky.material as THREE.Material); G.world.add(sky);
  const stars = makeStars(2600, 900, -1); track(stars.geometry, stars.material as THREE.Material); G.world.add(stars);
  LIGHT.hemi.color.set(0x8a7cff); LIGHT.hemi.groundColor.set(0x1a1040); LIGHT.hemi.intensity = 0.7;
  LIGHT.moon.color.set(0xfff1dc); LIGHT.moon.intensity = 3.4; LIGHT.moon.position.set(220, 140, 160);
  setRimColor(PAL.rimSpace);
  // Earth: the globe's painted map on a toon sphere, ink 2.5 px without fade, stepped cartoon atmosphere
  const earth = new THREE.Group(), tex = track(new THREE.CanvasTexture(earthCanvas())); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const ball = new THREE.Mesh(track(new THREE.SphereGeometry(140, 96, 48)), track(toonMaterial({ map: tex })));
  inkify(ball, { px: 2.5, fade: false }); earth.add(ball);
  earth.add(new THREE.Mesh(track(new THREE.SphereGeometry(146, 64, 32)), track(fresnelMaterial(0x6fe0ff, 2.6, 0.9, 2, 0.2))));
  earth.position.set(-70, -175, -120); earth.rotation.y = 2.2; G.world.add(earth);
  // the ringed cartoon planet, far out on the other side
  const planet = makeRingPlanet(26); planet.position.set(380, 120, 460); G.world.add(planet);
  const ship = makeMothership(); G.world.add(ship);   // inked 2.5 px by the models lane
  space = { earth, ship, drones: [] };
  for (let i = 0; i < 4; i++) { const d = miniSaucer(); d.scale.setScalar(1.4); G.world.add(d); space.drones.push({ d, a: i * 1.57, r: 62 + i * 6, y: -4 + i * 3 }); }
  UI.hud(false); UI.globe(false); UI.show('scr-mothership'); renderMothership();
  SFX.setMusic('calm'); platform.gameplayStop();
  if (!G.save.tutorial.done && G.save.tutorial.ms < 3) startShipTutorial();
  else UI.comm(pickTip(), 6);
}
function pickTip() {
  const tips = ['Hypno-Brutes are made from humans. Soldiers count as two humans!', 'Walkers are expensive but flatten tanks and pylons.', 'A bigger cargo hold means fewer trips. A stronger beam lifts tanks.',
    'You can drop reinforcements during an invasion with keys 1-4.', 'Earth gets stronger every day. Do not wait forever, Commander.', 'Captured cities pay tribute every day.'];
  return tips[Math.floor(Math.random() * tips.length)];
}
function startShipTutorial() {
  const s = G.save, top = { humans: 3, biomass: 12, metal: 8 };
  for (const r of RES) s.res[r] = Math.max(s.res[r], top[r]);   // a starter gift so the first purchases are possible
  renderMothership();
  TUT.start('Mothership', [
    { text: 'Welcome aboard! Spend the biomass you collected: <b>build a Gray Clone</b> for your army.', highlight: 'btn-build-clone', check: () => s.army.clone >= 1 },
    { text: 'Now <b>upgrade your tractor beam</b> so it can lift heavier things.', highlight: 'btn-up-beam', check: () => s.up.beam >= 1 },
    { text: 'Good! Head <b>back to Earth</b> and choose your next target.', highlight: 'btn-ms-earth', check: () => G.mode === 'globe' },
  ], () => { s.tutorial.ms = 3; writeSave(s); }, () => { s.tutorial.done = true; s.tutorial.ms = 3; writeSave(s); });
}
export function updateMothership(dt: number, t: number) {
  if (!space) return;
  space.earth.rotation.y += dt * 0.02; space.ship.rotation.y += dt * 0.05;
  for (const q of space.drones) { q.a += dt * 0.25; q.d.position.set(Math.cos(q.a) * q.r, q.y + Math.sin(t + q.a) * 1.5, Math.sin(q.a) * q.r); q.d.rotation.y += dt * 2; }
  const a = t * 0.05; camera.position.set(Math.cos(a) * 120, 34 + Math.sin(t * 0.1) * 6, Math.sin(a) * 120); camera.lookAt(-10, -18, 0);
  TUT.tick();
}
function nextTarget() {
  return CITIES.filter(c => regionUnlocked(regionById(c.region)) && !cityState(c.id).occupied).sort((a, b) => cityLevel(a) - cityLevel(b))[0];
}
export function renderMothership() {
  const s = G.save, res = s.res;
  $('ms-sub').textContent = `High orbit · Day ${s.day} · ${s.totals.citiesTaken} cities conquered`;
  const L = metaButtonLabels(); $('btn-cat').textContent = L.cat; $('btn-ach').textContent = L.ach;
  renderWallet('ms-wallet');
  $('ms-army').innerHTML = UNIT_KEYS.map(k => {
    const T = UNIT_TYPES[k];
    return `<div class="item"><div class="name">${T.name} <small>×${s.army[k]}</small></div>
      <div class="desc">${T.desc} HP ${T.hp} · power ${unitPower(k)}${T.air ? ' · flies' : ''}</div><div class="cost">${costHTML(T.cost, res)}</div>
      <div class="acts"><button class="btn slime" id="btn-build-${k}" data-build="${k}" data-n="1" ${canAfford(res, T.cost) ? '' : 'disabled'}>Build</button>
      <button class="btn slime" data-build="${k}" data-n="5" ${canAfford(res, scaleCost(T.cost, 5)) ? '' : 'disabled'}>×5</button></div></div>`;
  }).join('');
  $('ms-upgrades').innerHTML = (Object.keys(UPGRADES) as UpgradeKey[]).map(k => {
    const U = UPGRADES[k], l = s.up[k], max = l >= 4, c = max ? null : U.costs[l];
    return `<div class="item"><div class="name">${U.name} <span class="pips">${[0, 1, 2, 3, 4].map(i => `<i class="${i <= l ? 'on' : ''}"></i>`).join('')}</span></div>
      <div class="desc">${U.stat(l)}${max ? ' · maxed' : ` → ${U.next(l)}`}</div><div class="cost">${max ? '' : costHTML(c, res)}</div>
      <div class="acts"><button class="btn" id="btn-up-${k}" data-up="${k}" ${!max && canAfford(res, c) ? '' : 'disabled'}>${max ? 'Max' : 'Upgrade'}</button></div></div>`;
  }).join('');
  const target = nextTarget(), us = armyPower(), them = target ? earthPower(cityLevel(target)) : 1, top = Math.max(us, them) * 1.1;
  $('pw-us').style.width = `${(us / top * 100).toFixed(1)}%`; $('pw-them').style.width = `${(them / top * 100).toFixed(1)}%`;
  $('pw-us-n').textContent = String(us); $('pw-them-n').textContent = String(target ? them : 0);
  $('pw-them-label').textContent = target ? target.name : 'No target';
  const v = verdict(us, them);
  $('ms-verdict').innerHTML = target ? `Easiest city in reach: <b>${target.name}</b> (defense ${cityLevel(target)}). ${v.text}.` : 'Every city in reach is yours. Conquer more to unlock new continents.';
  $('ms-earth-note').textContent = 'Earth gets stronger every day';
}
export function buildUnits(k: UnitKey, n: number) {
  const T = UNIT_TYPES[k]; let built = 0;
  for (let i = 0; i < n; i++) { if (!canAfford(G.save.res, T.cost)) break; payCost(G.save.res, T.cost); G.save.army[k]++; built++; }
  if (built) { SFX.play('buy'); writeSave(G.save); UI.toast(`${built} ${T.name}${built > 1 ? 's' : ''} ready`, 'good', 1.6); } else SFX.play('error');
  renderMothership();
}
export function buyUpgrade(k: UpgradeKey) {
  const U = UPGRADES[k], l = G.save.up[k]; if (l >= 4) return;
  const c = U.costs[l]; if (!canAfford(G.save.res, c)) { SFX.play('error'); return; }
  payCost(G.save.res, c); G.save.up[k]++; SFX.play('buy'); checkAchievements(); writeSave(G.save); UI.toast(`${U.name} upgraded`, 'good', 1.6); renderMothership();
  if (G.save.up[k] === 4) platform.happytime();
}
