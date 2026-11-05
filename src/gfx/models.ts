// Models made in code: the saucer, gray aliens, farm animals and farm/town buildings.
import * as THREE from 'three';
import { Kit, cachedModel, box, cyl, sph, cone, ico, lathe, unitPrism, unitPyramid } from './kit';
import { fresnelMaterial } from '../core/engine';
import { chance, pick, rand } from '../core/util';

export type Footprint = { minX: number; maxX: number; minZ: number; maxZ: number };
export function footprint(x: number, z: number, ry: number, w: number, d: number): Footprint {
  const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)), hx = (w * c + d * s) / 2, hz = (w * s + d * c) / 2;
  return { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz };
}

// ---------- gray aliens ----------
export function addGrayHead(k: Kit, y: number, s = 1, skin = '#a3acb8') {
  k.add(lathe([[0.01, -0.62], [0.15, -0.58], [0.29, -0.42], [0.41, -0.12], [0.53, 0.2], [0.59, 0.5], [0.53, 0.78], [0.34, 0.95], [0.01, 1.0]], 14), skin, { p: [0, y, 0], s });
  for (const side of [-1, 1]) k.add(sph(0.2, 12, 8), '#05060b', { p: [0.215 * side * s, y + 0.2 * s, 0.43 * s], r: [0, 0.42 * side, -0.62 * side], s: [1.15 * s, 1.5 * s, 0.5 * s], m: 'gloss' });
  k.add(box(0.13, 0.016, 0.03), '#5f6673', { p: [0, y - 0.36 * s, 0.37 * s] });
}
export function addGrayBody(k: Kit, skin = '#a3acb8', armor = '#5a3d8f') {
  for (const sx of [-1, 1]) k.add(cyl(0.075, 0.06, 0.72), skin, { p: [0.12 * sx, 0.36, 0] });
  k.add(cyl(0.19, 0.13, 0.58, 8), skin, { p: [0, 1.0, 0] });
  k.add(cyl(0.21, 0.17, 0.32, 8), armor, { p: [0, 1.1, 0], m: 'metal' });
  k.add(cyl(0.05, 0.04, 0.62), skin, { p: [-0.27, 0.97, 0], r: [0, 0, 0.18] });
  k.add(cyl(0.05, 0.04, 0.62), skin, { p: [0.26, 1.0, 0.2], r: [-1.25, 0, -0.08] });
  k.add(box(0.09, 0.11, 0.38), '#3b3550', { p: [0.27, 0.93, 0.52], m: 'metal' });
  k.add(sph(0.055, 6, 5), '#d2a8ff', { p: [0.27, 0.93, 0.73], m: 'glow', k: 3 });
  k.add(cyl(0.05, 0.065, 0.2), skin, { p: [0, 1.36, 0] });
  addGrayHead(k, 1.72, 0.62, skin);
}
export const makeGrayAlien = () => cachedModel('grayAlien', k => addGrayBody(k));

// ---------- the player's flying saucer ----------
export function makeUFO() {
  const group = new THREE.Group(), body = new THREE.Group(); group.add(body);
  body.add(cachedModel('ufo', k => {
    k.add(lathe([[0.01, -1.25], [1.6, -1.18], [3.2, -0.85], [4.6, -0.36], [5.3, -0.02], [5.25, 0.17], [4.3, 0.55], [2.6, 0.93], [0.01, 1.0]], 30), '#c9cfdd', { m: 'metal' });
    k.add(new THREE.TorusGeometry(5.08, 0.17, 6, 40), '#555b6e', { r: [Math.PI / 2, 0, 0], m: 'metal' });
    k.add(cyl(1.75, 1.3, 0.28, 22), '#3a3f52', { p: [0, -1.32, 0], m: 'metal' });
    k.add(new THREE.TorusGeometry(2.75, 0.09, 6, 30), '#8d93a8', { p: [0, 0.82, 0], r: [Math.PI / 2, 0, 0], m: 'metal' });
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; k.add(box(0.5, 0.18, 1.2), '#7c829a', { p: [Math.cos(a) * 3.6, 0.45, Math.sin(a) * 3.6], r: [0, -a, 0], m: 'metal' }); }
    k.add(cyl(0.45, 0.6, 0.5, 10), '#4a3a78', { p: [0, 1.15, 0], m: 'metal' });
    addGrayHead(k, 2.05, 0.62);
  }));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.3, 26, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xa9dcff, transparent: true, opacity: 0.26, roughness: 0.04, metalness: 0.2, envMapIntensity: 2.5, depthWrite: false }));
  dome.position.y = 0.88; dome.renderOrder = 2; body.add(dome);
  const emitterMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.7, 2.4), toneMapped: false });
  const emitter = new THREE.Mesh(new THREE.CircleGeometry(1.45, 26).rotateX(Math.PI / 2), emitterMat); emitter.position.y = -1.47; body.add(emitter);
  const lights: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [], lgeo = new THREE.SphereGeometry(0.2, 8, 6);
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2, m = new THREE.Mesh(lgeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    m.position.set(Math.cos(a) * 5.32, 0.05, Math.sin(a) * 5.32); body.add(m); lights.push(m);
  }
  const shield = new THREE.Mesh(new THREE.SphereGeometry(6.6, 28, 14), fresnelMaterial(0xb98cff, 2.4, 0));
  shield.scale.set(1, 0.55, 1); group.add(shield);
  return { group, body, lights, emitterMat, shield: shield as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> };
}
export const miniSaucer = () => cachedModel('miniufo', k => {
  k.add(lathe([[0.01, -0.5], [0.9, -0.42], [1.8, -0.1], [2.0, 0.05], [1.5, 0.3], [0.7, 0.55], [0.01, 0.6]], 18), '#8d93a8', { m: 'metal' });
  k.add(sph(0.6, 10, 6), '#9fe0ff', { p: [0, 0.5, 0], s: [1, 0.7, 1], m: 'gloss' });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.add(sph(0.12, 5, 4), i % 2 ? '#ffd65c' : '#c58bff', { p: [Math.cos(a) * 1.95, 0.02, Math.sin(a) * 1.95], m: 'glow', k: 3.5 }); }
  k.add(cyl(0.5, 0.5, 0.06, 12), '#c58bff', { p: [0, -0.52, 0], m: 'glow', k: 3 });
});
export function makeWalker() {
  const group = new THREE.Group();
  const body = cachedModel('walkerBody', k => {
    k.add(lathe([[0.01, -1.4], [2.2, -1.2], [3.2, -0.4], [3.3, 0.2], [2.6, 1.0], [1.2, 1.6], [0.01, 1.7]], 20), '#7b8299', { m: 'metal' });
    k.add(sph(0.8, 12, 8), '#ffb347', { p: [0, -0.2, 3.0], m: 'glow', k: 4 });
    k.add(new THREE.TorusGeometry(3.25, 0.13, 5, 26), '#c58bff', { r: [Math.PI / 2, 0, 0], m: 'glow', k: 2.5 });
    k.add(sph(1.3, 12, 8), '#9fe0ff', { p: [0, 1.4, 0], s: [1, 0.6, 1], m: 'gloss' });
  });
  body.position.y = 9; group.add(body);
  const legs: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2 + Math.PI, leg = new THREE.Group(); leg.position.set(Math.sin(a) * 2.2, 8.6, Math.cos(a) * 2.2); leg.rotation.y = a;
    const inner = cachedModel('walkerLeg', k => { k.add(cyl(0.26, 0.18, 10.2, 6), '#5c6275', { p: [0, -5.0, 0], m: 'metal' }); k.add(sph(0.5, 8, 6), '#c58bff', { m: 'glow', k: 2 }); k.add(cone(0.7, 0.9, 6), '#3e4352', { p: [0, -10.1, 0], r: [Math.PI, 0, 0] }); });
    inner.rotation.x = -0.33; leg.add(inner); group.add(leg); legs.push(leg);
  }
  return { group, legs };
}

// ---------- farm animals (the CC0 packs have none, so they are made here; all face +z) ----------
export const makeCow = () => cachedModel('cow', k => {
  k.add(box(1.1, 1.0, 2.1), '#f1efe8', { p: [0, 1.2, 0] });
  for (const [x, y, z, w, h] of [[0.56, 1.3, 0.3, 0.6, 0.5], [-0.56, 1.1, -0.4, 0.7, 0.45], [0.56, 1.0, -0.6, 0.4, 0.35], [0, 1.71, -0.2, 0.6, 0.5]])
    k.add(box(x ? 0.02 : w, x ? h : 0.02, x ? w : 0.7), '#1d1d1d', { p: [x, y, z] });
  k.add(box(0.62, 0.6, 0.62), '#f1efe8', { p: [0, 1.55, 1.25] });
  k.add(box(0.52, 0.3, 0.22), '#e8a0a0', { p: [0, 1.38, 1.6] });
  for (const sx of [-1, 1]) {
    k.add(cone(0.06, 0.25, 5), '#e8dcc0', { p: [0.24 * sx, 1.92, 1.2], r: [0, 0, -0.5 * sx] });
    k.add(box(0.22, 0.1, 0.12), '#1d1d1d', { p: [0.4 * sx, 1.72, 1.15] });
    for (const z of [-0.75, 0.75]) k.add(box(0.22, 0.75, 0.22), z > 0 ? '#f1efe8' : '#1d1d1d', { p: [0.36 * sx, 0.38, z] });
  }
  k.add(box(0.36, 0.16, 0.3), '#efb0b0', { p: [0, 0.66, -0.45] });
  k.add(box(0.06, 0.7, 0.06), '#1d1d1d', { p: [0, 1.25, -1.08], r: [0.25, 0, 0] });
});
export const makeSheep = () => cachedModel('sheep', k => {
  k.add(ico(0.75, 1), '#ece9df', { p: [0, 1.0, 0], s: [1, 0.85, 1.25] });
  k.add(box(0.42, 0.46, 0.5), '#222222', { p: [0, 1.18, 0.88] });
  for (const sx of [-1, 1]) { k.add(box(0.22, 0.1, 0.12), '#222222', { p: [0.27 * sx, 1.3, 0.82] }); for (const z of [-0.45, 0.45]) k.add(box(0.14, 0.6, 0.14), '#222222', { p: [0.3 * sx, 0.3, z] }); }
});
export const makePig = () => cachedModel('pig', k => {
  k.add(box(0.9, 0.8, 1.45), '#f2a7b5', { p: [0, 0.8, 0] });
  k.add(box(0.72, 0.66, 0.5), '#f2a7b5', { p: [0, 0.92, 0.9] });
  k.add(cyl(0.18, 0.18, 0.14, 8), '#e98a9c', { p: [0, 0.86, 1.2], r: [Math.PI / 2, 0, 0] });
  for (const sx of [-1, 1]) { k.add(box(0.2, 0.2, 0.06), '#e98a9c', { p: [0.24 * sx, 1.3, 0.8], r: [0.5, 0, 0] }); for (const z of [-0.45, 0.45]) k.add(box(0.2, 0.42, 0.2), '#e98a9c', { p: [0.28 * sx, 0.21, z] }); }
  k.add(new THREE.TorusGeometry(0.1, 0.03, 4, 8), '#e98a9c', { p: [0, 1.0, -0.76] });
});
export const makeChicken = () => cachedModel('chicken', k => {
  k.add(sph(0.32, 7, 5), '#f6f3ea', { p: [0, 0.48, 0], s: [0.9, 0.9, 1.1] });
  k.add(sph(0.17, 6, 5), '#f6f3ea', { p: [0, 0.82, 0.22] });
  k.add(box(0.06, 0.14, 0.16), '#d8322a', { p: [0, 1.0, 0.22] });
  k.add(cone(0.06, 0.14, 4), '#f0b030', { p: [0, 0.8, 0.42], r: [Math.PI / 2, 0, 0] });
  for (const sx of [-1, 1]) k.add(box(0.04, 0.28, 0.04), '#f0b030', { p: [0.1 * sx, 0.14, 0] });
});
export const makeHaybale = () => cachedModel('haybale', k => {
  k.add(cyl(0.85, 0.85, 1.3, 12), '#d1ad4f', { p: [0, 0.85, 0], r: [0, 0, Math.PI / 2] });
  k.add(cyl(0.6, 0.6, 1.32, 12), '#b8933c', { p: [0, 0.85, 0], r: [0, 0, Math.PI / 2] });
});
export const FARM_MAKERS: Record<string, () => THREE.Group> = { cow: makeCow, sheep: makeSheep, pig: makePig, chicken: makeChicken };

// ---------- farm + town buildings (added straight into a world Kit) ----------
const WARM = '#ffc96b';
function windowsAround(k: Kit, w: number, d: number, y: number, lit = 0.6) {
  const win = (px: number, pz: number, ry: number) => { const on = chance(lit); k.add(box(0.9, 0.95, 0.08), on ? WARM : '#1a2032', { p: [px, y, pz], r: [0, ry, 0], m: on ? 'glow' : 'std', k: on ? 2.4 : 1 }); };
  for (const sx of [-1, 1]) { win(sx * w * 0.27, d / 2 + 0.04, 0); win(sx * w * 0.27, -d / 2 - 0.04, 0); win(w / 2 + 0.04, sx * d * 0.22, Math.PI / 2); win(-w / 2 - 0.04, sx * d * 0.22, Math.PI / 2); }
}
export function addHouse(k: Kit, x: number, z: number, ry: number, walls: string[], roofs: string[], o: { w?: number; d?: number; lit?: number } = {}) {
  const w = o.w || rand(6, 8), d = o.d || rand(5.5, 7), h = rand(3.2, 4);
  k.at(x, 0, z, ry);
  k.add(box(w, h, d), pick(walls), { p: [0, h / 2, 0] });
  k.add(unitPyramid(), pick(roofs), { p: [0, h, 0], s: [w * 1.14, rand(2, 2.8), d * 1.14] });
  k.add(box(1.1, 2.0, 0.12), '#5a3a22', { p: [0, 1.0, d / 2 + 0.05] });
  k.add(box(0.15, 0.15, 0.06), WARM, { p: [0, 2.3, d / 2 + 0.1], m: 'glow', k: 3 });
  k.add(box(0.8, 1.6, 0.8), '#6b4a3a', { p: [w * 0.28, h + 1.4, -d * 0.2] });
  windowsAround(k, w, d, h * 0.55, o.lit ?? 0.65);
  return footprint(x, z, ry, w, d);
}
export function addBarn(k: Kit, x: number, z: number, ry: number) {
  const w = 10, d = 14, h = 6; k.at(x, 0, z, ry);
  k.add(box(w, h, d), '#9b2f2b', { p: [0, h / 2, 0] });
  k.add(unitPrism(), '#3b3f48', { p: [0, h, 0], s: [w * 1.12, 4, d * 1.04] });
  k.add(box(4.2, 4.6, 0.15), '#7d221f', { p: [0, 2.3, d / 2 + 0.06] });
  for (const r of [0.83, -0.83]) k.add(box(0.25, 6.1, 0.1), '#efe9dc', { p: [0, 2.3, d / 2 + 0.16], r: [0, 0, r] });
  k.add(box(4.6, 0.25, 0.12), '#efe9dc', { p: [0, 4.65, d / 2 + 0.16] });
  k.add(box(1.4, 1.2, 0.1), WARM, { p: [0, 7.4, d / 2 + 0.2], m: 'glow', k: 2 });
  return footprint(x, z, ry, w, d);
}
export function addSilo(k: Kit, x: number, z: number) {
  k.at(x, 0, z, 0);
  k.add(cyl(2.2, 2.2, 11, 14), '#9aa6b0', { p: [0, 5.5, 0], m: 'metal' });
  k.add(sph(2.25, 14, 7), '#8a96a0', { p: [0, 11, 0], s: [1, 0.75, 1], m: 'metal' });
  for (let i = 1; i < 5; i++) k.add(new THREE.TorusGeometry(2.24, 0.06, 4, 20), '#6f7a84', { p: [0, i * 2.2, 0], r: [Math.PI / 2, 0, 0], m: 'metal' });
  return { minX: x - 2.4, maxX: x + 2.4, minZ: z - 2.4, maxZ: z + 2.4 };
}
export function addWaterTower(k: Kit, x: number, z: number) {
  k.at(x, 0, z, 0);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.add(cyl(0.18, 0.25, 12, 6), '#7b8794', { p: [sx * 2.2, 6, sz * 2.2], r: [sz * 0.08, 0, -sx * 0.08], m: 'metal' });
  k.add(cyl(3.6, 3.6, 4.5, 16), '#a9b8c4', { p: [0, 14, 0], m: 'metal' });
  k.add(cone(3.9, 1.8, 16), '#8796a3', { p: [0, 17.1, 0], m: 'metal' });
  k.add(sph(0.3, 6, 5), '#ff3030', { p: [0, 18.2, 0], m: 'glow', k: 4 });
  return { minX: x - 2.6, maxX: x + 2.6, minZ: z - 2.6, maxZ: z + 2.6 };
}
export function addStreetLight(k: Kit, x: number, z: number, ry: number) {
  k.at(x, 0, z, ry);
  k.add(cyl(0.1, 0.14, 6, 6), '#41454f', { p: [0, 3, 0], m: 'metal' });
  k.add(box(0.12, 0.12, 1.6), '#41454f', { p: [0, 6, 0.75], m: 'metal' });
  k.add(box(0.5, 0.16, 0.7), '#ffe2a8', { p: [0, 5.92, 1.45], m: 'glow', k: 3.5 });
}
export function addFence(k: Kit, x1: number, z1: number, x2: number, z2: number, color = '#6b5136') {
  const len = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.round(len / 4)), ry = Math.atan2(x2 - x1, z2 - z1);
  for (let i = 0; i <= n; i++) { const t = i / n; k.at(x1 + (x2 - x1) * t, 0, z1 + (z2 - z1) * t, ry); k.add(box(0.2, 1.3, 0.2), color, { p: [0, 0.65, 0] }); }
  k.at((x1 + x2) / 2, 0, (z1 + z2) / 2, ry);
  k.add(box(0.08, 0.14, len), color, { p: [0, 0.95, 0] }); k.add(box(0.08, 0.14, len), color, { p: [0, 0.5, 0] });
}
export function addBarracks(k: Kit, x: number, z: number, ry: number) {
  const w = 8, d = 20, h = 3.6; k.at(x, 0, z, ry);
  k.add(box(w, h, d), '#6a7158', { p: [0, h / 2, 0] });
  k.add(unitPrism(), '#454b3a', { p: [0, h, 0], s: [w * 1.1, 2, d * 1.02] });
  for (let i = -3; i <= 3; i++) for (const sx of [-1, 1]) k.add(box(0.08, 0.8, 1.2), chance(0.6) ? '#ffe9b0' : '#1a2032', { p: [sx * (w / 2 + 0.04), 2, i * 2.6], m: 'glow', k: 2 });
  return footprint(x, z, ry, w, d);
}
export function addFloodlight(k: Kit, x: number, z: number, ry: number) {
  k.at(x, 0, z, ry);
  k.add(cyl(0.12, 0.18, 8, 6), '#555555', { p: [0, 4, 0], m: 'metal' });
  k.add(box(1.6, 0.8, 0.3), '#fff4d6', { p: [0, 8.2, 0.2], r: [0.4, 0, 0], m: 'glow', k: 3 });
}
export const whiteFlag = () => cachedModel('whiteflag', k => { k.add(box(0.06, 1.5, 0.06), '#dddddd', { p: [0, 0.75, 0] }); k.add(box(0.03, 0.55, 0.75), '#ffffff', { p: [0, 1.25, 0.4], m: 'glow', k: 1.1 }); });
