// The mothership: build army units and upgrade the saucer, with Earth turning below.
import * as THREE from 'three';
import { G, track } from '../game/state';
import { camera, scene, LIGHT, makeStars, fresnelMaterial } from '../core/engine';
import { RES, UPGRADES, canAfford, payCost, scaleCost } from '../data/balance';
import type { UpgradeKey } from '../data/balance';
import { UNIT_TYPES, UNIT_KEYS, unitPower } from '../data/units';
import type { UnitKey } from '../data/units';
import { CITIES, regionById } from '../data/earth';
import { writeSave } from '../core/save';
import { SFX } from '../core/audio';
import { platform } from '../core/platform';
import { cachedModel, box, cyl, sph, lathe } from '../gfx/kit';
import { miniSaucer } from '../gfx/models';
import { clearWorld } from '../world/maps/common';
import { armyPower, earthPower, cityLevel, cityState, regionUnlocked, verdict } from '../game/campaign';
import { earthCanvas, leaveGlobe } from './globe';
import { $, UI, ICON, costHTML } from '../ui/dom';
import { TUT } from '../ui/tutorial';

const makeMothership = () => cachedModel('mothership', k => {
  k.add(lathe([[0.01, -6], [10, -5.2], [22, -3], [34, -0.7], [36.5, 0], [34, 1.5], [20, 4.2], [8, 7], [0.01, 8]], 56), '#646a80', { m: 'metal' });
  k.add(new THREE.TorusGeometry(41, 1.5, 8, 72), '#474c5f', { r: [Math.PI / 2, 0, 0], m: 'metal' });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.add(box(1.8, 1.1, 6), '#3b4052', { p: [Math.cos(a) * 38.5, 0, Math.sin(a) * 38.5], r: [0, Math.PI / 2 - a, 0], m: 'metal' }); }
  for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2; k.add(box(1.4, 0.55, 0.2), '#c69bff', { p: [Math.cos(a) * 34.9, 0.55, Math.sin(a) * 34.9], r: [0, Math.PI / 2 - a, 0], m: 'glow', k: 3 }); }
  for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; k.add(sph(0.55, 6, 5), i % 2 ? '#ffd65c' : '#b98cff', { p: [Math.cos(a) * 42.6, 0, Math.sin(a) * 42.6], m: 'glow', k: 3 }); }
  k.add(cyl(3, 5.5, 8, 14), '#6e7590', { p: [0, 11, 0], m: 'metal' });
  k.add(sph(3.4, 18, 10), '#d8bcff', { p: [0, 15.6, 0], s: [1, 0.6, 1], m: 'glow', k: 1.8 });
  k.add(cyl(9, 9, 0.3, 36), '#b07cff', { p: [0, -6.1, 0], m: 'glow', k: 2.4 });
});
let space: { earth: THREE.Group; ship: THREE.Object3D; drones: { d: THREE.Object3D; a: number; r: number; y: number }[] } = null;

export function enterMothership() {
  leaveGlobe();
  clearWorld(); G.mode = 'mothership'; G.paused = false; G.modeTime = 0;
  scene.fog = null; scene.background = new THREE.Color(0x02030a);
  const stars = makeStars(2600, 900, -1); track(stars.geometry, stars.material as THREE.Material); G.world.add(stars);
  const earth = new THREE.Group(), tex = track(new THREE.CanvasTexture(earthCanvas())); tex.colorSpace = THREE.SRGBColorSpace;
  earth.add(new THREE.Mesh(track(new THREE.SphereGeometry(140, 64, 32)), track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }))));
  earth.add(new THREE.Mesh(track(new THREE.SphereGeometry(146, 64, 32)), track(fresnelMaterial(0x6fb8ff, 3.2, 1))));
  earth.position.set(-70, -175, -120); earth.rotation.y = 2.2; G.world.add(earth);
  const ship = makeMothership(); G.world.add(ship);
  space = { earth, ship, drones: [] };
  for (let i = 0; i < 4; i++) { const d = miniSaucer(); d.scale.setScalar(1.4); G.world.add(d); space.drones.push({ d, a: i * 1.57, r: 62 + i * 6, y: -4 + i * 3 }); }
  LIGHT.hemi.color.set(0x8a7cff); LIGHT.hemi.groundColor.set(0x0a0a20); LIGHT.hemi.intensity = 0.55;
  LIGHT.moon.color.set(0xfff1dc); LIGHT.moon.intensity = 3.2; LIGHT.moon.position.set(220, 140, 160);
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
  $('ms-wallet').innerHTML = RES.map(r => `<span class="chip ${r}" title="${r}">${ICON(r)}${Math.floor(res[r])}</span>`).join('');
  $('ms-army').innerHTML = UNIT_KEYS.map(k => {
    const T = UNIT_TYPES[k];
    return `<div class="item"><div class="name">${T.name} <small>×${s.army[k]}</small></div>
      <div class="desc">${T.desc} HP ${T.hp} · power ${unitPower(k)}${T.air ? ' · flies' : ''}</div><div class="cost">${costHTML(T.cost, res)}</div>
      <div class="acts"><button class="btn" id="btn-build-${k}" data-build="${k}" data-n="1" ${canAfford(res, T.cost) ? '' : 'disabled'}>Build</button>
      <button class="btn" data-build="${k}" data-n="5" ${canAfford(res, scaleCost(T.cost, 5)) ? '' : 'disabled'}>×5</button></div></div>`;
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
  payCost(G.save.res, c); G.save.up[k]++; SFX.play('buy'); writeSave(G.save); UI.toast(`${U.name} upgraded`, 'good', 1.6); renderMothership();
  if (G.save.up[k] === 4) platform.happytime();
}
