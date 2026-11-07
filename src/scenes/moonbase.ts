// The Moon Base (docs/gdd/moon-base.md): the hollow moon is the Gray Empire's ship. A cutaway shows the rooms inside,
// each alive with its own animation; tapping a room will open it (playable build). Two cutaway layouts:
//   'slice': the front half is cut away (a flat cross-section, like an ant farm)
//   'wedge': a quarter is cut out (two faces meeting at the reactor shaft)
import * as THREE from 'three';
import { G, track } from '../game/state';
import { camera, LIGHT, makeStars, fresnelMaterial, gradientSky, scene } from '../core/engine';
import { Kit, box, cyl, sph, cone, cachedModel } from '../gfx/kit';
import { PAL, SKY } from '../gfx/palette';
import { toonMaterial, inkify, setRimColor } from '../gfx/toon';
import { makeGrayAlien, miniSaucer, FARM_MAKERS } from '../gfx/models';
import { instance, hasModel, ARTIFACTS } from '../core/assets';
import { clearWorld } from '../world/maps/common';
import { earthCanvas, leaveGlobe, hideLabels, makeRingPlanet } from './globe';
import { FX, FXC } from '../gfx/fx';
import { MOON, ROOMS, ROOM_IDS } from '../data/moonbase';
import type { RoomId } from '../data/moonbase';
import { mulberry32 } from '../core/util';

export type MoonLayout = 'slice' | 'wedge';
const R = MOON.radius, D = MOON.roomDepth, ROCK = '#8d84b0', ROCK_DARK = '#6a5f94', CRUST = '#b9b2d6', HULL = '#4b3a8f';
const Q = Math.PI / 4;

interface Anim { t: number; fn: (dt: number, t: number) => void }
const MB = { layout: 'slice' as MoonLayout, anims: [] as Anim[], labels: new Map<RoomId, HTMLElement>(), centers: new Map<RoomId, THREE.Vector3>(), orbit: [] as { o: THREE.Object3D; a: number; r: number; y: number; s: number }[], root: null as THREE.Group | null };

/** Which face a room is on and the face's turn (local x = along the face, local z = out of the face). */
function faceOf(id: RoomId) {
  if (MB.layout === 'slice') return { face: 0, ry: 0 };
  const u = ROOMS[id].rect[0] + ROOMS[id].rect[1];
  return u >= 0 ? { face: 1, ry: -Q } : { face: 2, ry: Q };
}
const anim = (fn: (dt: number, t: number) => void) => MB.anims.push({ t: 0, fn });

export function enterMoonBase(layout: MoonLayout = 'slice') {
  leaveGlobe(); hideLabels(); clearWorld();
  G.mode = 'moonbase'; G.paused = false; G.modeTime = 0;
  MB.layout = layout; MB.anims = []; MB.orbit = []; MB.centers.clear();
  const S = SKY.space; scene.fog = null; scene.background = new THREE.Color(S.bottom);
  const sky = gradientSky(S.top, S.horizon, S.bottom, 1200); sky.renderOrder = -10; track(sky.geometry, sky.material as THREE.Material); G.world.add(sky);
  const stars = makeStars(2600, 900, -1); track(stars.geometry, stars.material as THREE.Material); G.world.add(stars);
  LIGHT.hemi.color.set(0x8a7cff); LIGHT.hemi.groundColor.set(0x1a1040); LIGHT.hemi.intensity = 0.85;
  LIGHT.moon.color.set(0xfff1dc); LIGHT.moon.intensity = 3.2; LIGHT.moon.position.set(140, 160, 220);
  setRimColor(PAL.rimSpace);
  // Earth below, a ringed planet far away
  const tex = track(new THREE.CanvasTexture(earthCanvas())); tex.colorSpace = THREE.SRGBColorSpace;
  const earth = new THREE.Mesh(track(new THREE.SphereGeometry(70, 64, 32)), track(toonMaterial({ map: tex })));
  inkify(earth, { px: 2.5, fade: false }); earth.position.set(-150, -70, -260); earth.rotation.y = 2.4; G.world.add(earth);
  const atm = new THREE.Mesh(track(new THREE.SphereGeometry(74, 48, 24)), track(fresnelMaterial(0x6fe0ff, 2.6, 0.9, 2, 0.2))); atm.position.copy(earth.position); G.world.add(atm);
  anim(dt => { earth.rotation.y += dt * 0.02; });
  const planet = makeRingPlanet(18); planet.position.set(260, 110, -380); G.world.add(planet);

  const root = new THREE.Group(); MB.root = root; G.world.add(root);
  buildShell(root); buildFaces(root); buildReactor(root);
  for (const id of ROOM_IDS) if (id !== 'reactor') buildRoom(root, id);
  buildExterior(root);
  makeLabels();
  // camera: the whole moon in view, a little from above
  const fit = (R + 6) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.min(1, camera.aspect);
  if (layout === 'slice') { camera.position.set(14, 12, fit); camera.lookAt(0, -1, 0); }
  else { camera.position.set(0, 20, fit * 1.02); camera.lookAt(0, -2, 0); }
}

// ------------------------------------------------------------------ the rock: shell, cut faces, reactor
function buildShell(root: THREE.Group) {
  const geo = MB.layout === 'slice' ? new THREE.SphereGeometry(R, 72, 40, Math.PI, Math.PI) : new THREE.SphereGeometry(R, 72, 40, 3 * Q, 6 * Q);
  // craters painted into a canvas map (cheaper than geometry)
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d'); const rnd = mulberry32(7);
  x.fillStyle = CRUST; x.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 220; i++) { x.fillStyle = `rgba(90,80,140,${0.12 + rnd() * 0.2})`; x.beginPath(); x.ellipse(rnd() * 1024, rnd() * 512, 6 + rnd() * 18, 4 + rnd() * 12, 0, 0, Math.PI * 2); x.fill(); }
  for (let i = 0; i < 45; i++) {
    const cx = rnd() * 1024, cy = 60 + rnd() * 392, r = 10 + rnd() * 34;
    x.fillStyle = 'rgba(80,70,130,0.45)'; x.beginPath(); x.ellipse(cx, cy, r, r * 0.7, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(240,236,255,0.55)'; x.lineWidth = 3; x.beginPath(); x.ellipse(cx - 2, cy - 2, r, r * 0.7, 0, Math.PI * 0.9, Math.PI * 1.9); x.stroke();
  }
  // glowing seams: the moon is a machine
  x.strokeStyle = 'rgba(156,255,63,0.55)'; x.lineWidth = 2;
  for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(0, 90 + i * 66); for (let k = 0; k <= 32; k++) x.lineTo(k * 32, 90 + i * 66 + (k % 2 ? 6 : -6)); x.stroke(); }
  const t = track(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace;
  const shell = new THREE.Mesh(track(geo), track(toonMaterial({ map: t })));
  inkify(shell, { px: 3, fade: false }); root.add(shell);
}
/** The flat cut face(s): rock with a crust rim and holes where the rooms are. */
function buildFaces(root: THREE.Group) {
  const faces = MB.layout === 'slice' ? [{ face: 0, ry: 0, side: 0 }] : [{ face: 1, ry: -Q, side: 1 }, { face: 2, ry: Q, side: -1 }];
  for (const F of faces) {
    const inner = R - MOON.crust, shape = new THREE.Shape(), rim = new THREE.Shape();
    if (F.side === 0) { shape.absarc(0, 0, inner, 0, Math.PI * 2, false); rim.absarc(0, 0, R, 0, Math.PI * 2, false); const h = new THREE.Path(); h.absarc(0, 0, inner, 0, Math.PI * 2, true); rim.holes.push(h); }
    else {
      // half discs: u ≥ 0 (side 1) or u ≤ 0 (side -1); arcs run counter-clockwise from a0 to a1
      const a0 = F.side > 0 ? -Math.PI / 2 : Math.PI / 2, a1 = a0 + Math.PI;
      shape.moveTo(Math.cos(a0) * inner, Math.sin(a0) * inner); shape.absarc(0, 0, inner, a0, a1, false); shape.closePath();
      rim.moveTo(Math.cos(a0) * R, Math.sin(a0) * R); rim.absarc(0, 0, R, a0, a1, false); rim.lineTo(Math.cos(a1) * inner, Math.sin(a1) * inner);
      rim.absarc(0, 0, inner, a1, a0, true); rim.closePath();
    }
    for (const id of ROOM_IDS) {
      const fo = faceOf(id); if (fo.face !== F.face && !(id === 'reactor' && MB.layout === 'slice')) continue;
      if (id === 'reactor' && MB.layout !== 'slice') continue;
      const [u0, u1, v0, v1] = ROOMS[id].rect, h = new THREE.Path();
      h.moveTo(u0, v0); h.lineTo(u0, v1); h.lineTo(u1, v1); h.lineTo(u1, v0); h.lineTo(u0, v0); shape.holes.push(h);
    }
    const k = new Kit(); k.at(0, 0, 0, F.ry);
    k.add(new THREE.ShapeGeometry(shape, 48), ROCK, { m: 'std' });
    k.add(new THREE.ShapeGeometry(rim, 64), CRUST, { p: [0, 0, 0.02] });
    // strata stripes and pipes on the face, between the rooms
    for (const v of [10, 0, -11]) for (const u of F.side === 0 ? [-1, 1] : [F.side]) k.add(box(Math.sqrt(inner * inner - v * v) - 3.5, 0.5, 0.3), HULL, { p: [u * (3 + (Math.sqrt(inner * inner - v * v) - 3.5) / 2), v, 0.15], m: 'metal' });
    root.add(k.build(g => G.disposables.push(g)));
    buildFaceLife(root, F.ry, F.side, inner);
  }
}
/** Life on the cut face: crew walking the ledges between floors, elevator capsules running up and down. */
function buildFaceLife(root: THREE.Group, ry: number, side: number, inner: number) {
  const grp = new THREE.Group(); grp.rotation.y = ry; root.add(grp);
  const sides = side === 0 ? [-1, 1] : [side];
  for (const s of sides) {
    // walkers on the three ledges
    for (const v of [10, 0, -11]) {
      const span = Math.sqrt(inner * inner - v * v) - 4, a = alien(grp, s * (4 + span / 2), v + 0.25, 0.7, 0, 0.7), ph = v * 0.37 + s;
      anim((dt, t) => { const x = Math.sin(t * 0.25 + ph); a.position.x = s * (4 + span / 2 + x * span * 0.45); a.rotation.y = Math.cos(t * 0.25 + ph) > 0 === s > 0 ? Math.PI / 2 : -Math.PI / 2; a.position.y = v + 0.25 + Math.abs(Math.sin(t * 8 + ph)) * 0.1; });
    }
    // an elevator shaft at the outer end of the floors
    const u = s * 3.2, k = new Kit();
    k.add(box(1.4, 38, 0.3), '#2b1b72', { p: [u, 0, 0.1] }); for (const e of [-0.75, 0.75]) k.add(box(0.15, 38, 0.2), '#9cff3f', { p: [u + e, 0, 0.3], m: 'glow', k: 1.6 });
    grp.add(k.build(g => G.disposables.push(g)));
    const cap = put(grp, cachedModel('liftCap', kk => { kk.add(box(1.2, 1.8, 0.8), '#d9def0', { m: 'metal' }); kk.add(box(0.8, 0.8, 0.1), '#5fe8ff', { p: [0, 0.2, 0.42], m: 'glow', k: 1.4 }); }), u, 0, 0.6), ph = s * 1.7;
    anim((dt, t) => { cap.position.y = Math.sin(t * 0.35 + ph) * 17; });
  }
}
function buildReactor(root: THREE.Group) {
  // the glowing shaft through the moon's middle (slice: recessed in the face; wedge: standing in the cut corner)
  const z = MB.layout === 'slice' ? -2.5 : 0, k = new Kit();
  if (MB.layout === 'slice') { k.add(box(5, 40, 0.4), '#1b1150', { p: [0, 0, -5] }); for (const s of [-1, 1]) k.add(box(0.4, 40, 5), HULL, { p: [s * 2.3, 0, -2.5], m: 'metal' }); }
  const rr = MB.layout === 'slice' ? 0.9 : 1.6;
  k.add(cyl(rr, rr, 40, 16), PAL.violet, { p: [0, 0, z], m: 'glow', k: 2.2 });
  if (MB.layout !== 'slice') for (let y = -16; y <= 16; y += 4) k.add(cyl(rr + 0.5, rr + 0.5, 0.5, 16), HULL, { p: [0, y, 0], m: 'metal' });
  for (const y of [-19, 19]) k.add(cyl(2.4, 2.4, 1.2, 12), HULL, { p: [0, y, z], m: 'metal' });
  root.add(k.build(g => G.disposables.push(g)));
  const core = new THREE.Mesh(track(new THREE.IcosahedronGeometry(2.2, 1)), track(new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.slime).multiplyScalar(2.4), toneMapped: false })));
  core.position.set(0, -1, z); root.add(core);
  const rings: THREE.Object3D[] = [];
  for (let i = 0; i < 3; i++) { const r = cachedModel('reactorRing', kk => kk.add(new THREE.TorusGeometry(2.6, 0.22, 6, 28), PAL.violet, { m: 'glow', k: 2.6 }), false); r.position.set(0, -1, z); root.add(r); rings.push(r); }
  MB.centers.set('reactor', new THREE.Vector3(0, -1, z + (MB.layout === 'slice' ? 2.5 : 2.4)));
  anim((dt, t) => { core.scale.setScalar(1 + Math.sin(t * 3) * 0.12); core.rotation.y += dt; rings.forEach((r, i) => { r.rotation.x = t * (0.8 + i * 0.3) + i; r.rotation.y = t * (0.5 + i * 0.2); }); });
}

// ------------------------------------------------------------------ rooms
function buildRoom(root: THREE.Group, id: RoomId) {
  const def = ROOMS[id], [u0, u1, v0, v1] = def.rect, w = u1 - u0, h = v1 - v0, uc = (u0 + u1) / 2;
  const fo = faceOf(id), grp = new THREE.Group(); grp.rotation.y = fo.ry; root.add(grp);
  const k = new Kit();
  // shell of the room: back wall, floor, ceiling, side walls; a glowing trim under the ceiling
  k.add(box(w, h, 0.4), def.wall, { p: [uc, v0 + h / 2, -D] });
  k.add(box(w, 0.5, D), def.floor, { p: [uc, v0 + 0.25, -D / 2] });
  k.add(box(w, 0.5, D), HULL, { p: [uc, v1 - 0.25, -D / 2], m: 'metal' });
  for (const s of [u0 + 0.2, u1 - 0.2]) k.add(box(0.4, h, D), def.wall, { p: [s, v0 + h / 2, -D / 2] });
  k.add(box(w - 0.8, 0.22, 0.22), def.accent, { p: [uc, v1 - 0.75, -D + 0.4], m: 'glow', k: 2 });
  for (let x = u0 + 2; x < u1 - 1; x += 3) k.add(box(1.4, 0.18, 0.18), def.accent, { p: [x, v0 + 0.55, -0.3], m: 'glow', k: 1.6 });   // floor edge lights
  const F = v0 + 0.5;   // floor height
  PROPS[id]?.(k, grp, { u0, u1, v0: F, v1, uc, w, h: v1 - F, accent: def.accent });
  grp.add(k.build(g => G.disposables.push(g)));
  const c = new THREE.Vector3(uc, v1 - 0.25, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), fo.ry); MB.centers.set(id, c);
}
interface RoomBox { u0: number; u1: number; v0: number; v1: number; uc: number; w: number; h: number; accent: string }
const glass = () => track(new THREE.MeshBasicMaterial({ color: '#8ff4ff', transparent: true, opacity: 0.22, depthWrite: false }));
function put(grp: THREE.Group, o: THREE.Object3D, x: number, y: number, z: number, s = 1, ry = 0) { o.position.set(x, y, z); o.scale.multiplyScalar(s); o.rotation.y = ry; grp.add(o); return o; }
function alien(grp: THREE.Group, x: number, y: number, z: number, ry = 0, s = 0.9) { return put(grp, hasModel('b_alien') ? instance('b_alien').root : makeGrayAlien(), x, y, z, s, ry); }
/** A two-part robot arm on a base; returns the part that swings and the tip. */
function robotArm(grp: THREE.Group, x: number, y: number, z: number, color: string, ry = 0) {
  const base = put(grp, cachedModel('armBase', k => { k.add(cyl(0.9, 1.1, 0.8, 10), '#4a4466', { p: [0, 0.4, 0], m: 'metal' }); k.add(cyl(0.35, 0.35, 2.2, 8), '#b8bedc', { p: [0, 1.9, 0], m: 'metal' }); }), x, y, z, 1, ry);
  const arm = new THREE.Group(); arm.position.set(0, 3, 0); base.add(arm);
  arm.add(cachedModel('armSeg' + color, k => { k.add(box(0.5, 0.5, 3.2), color, { p: [0, 0, 1.4], m: 'metal' }); k.add(sph(0.45, 8, 6), '#4a4466', { p: [0, 0, 0], m: 'metal' }); k.add(cone(0.35, 0.8, 6), '#4a4466', { p: [0, -0.3, 3], r: [Math.PI, 0, 0], m: 'metal' }); }));
  const tip = new THREE.Object3D(); tip.position.set(0, -0.8, 3); arm.add(tip);
  return { base, arm, tip };
}
const _tw = new THREE.Vector3();
const PROPS: Partial<Record<RoomId, (k: Kit, grp: THREE.Group, b: RoomBox) => void>> = {
  bridge(k, grp, b) {
    // big window onto Earth (back wall glow), curved console, captain's chair, hologram Earth, crew
    k.add(box(b.w - 3, 3.6, 0.3), '#5fe8ff', { p: [b.uc, b.v0 + 4.2, -D + 0.3], m: 'glow', k: 0.9 });
    for (let i = -2; i <= 2; i++) k.add(box(1.8, 1.1, 1.2), '#4a4466', { p: [b.uc + i * 2, b.v0 + 0.55, -3.6 + Math.abs(i) * 0.5], r: [0, -i * 0.25, 0], m: 'metal' });
    for (let i = -2; i <= 2; i++) k.add(box(1.4, 0.1, 0.8), b.accent, { p: [b.uc + i * 2, b.v0 + 1.15, -3.6 + Math.abs(i) * 0.5], r: [-0.3, -i * 0.25, 0], m: 'glow', k: 1.8 });
    k.add(cyl(0.8, 1, 0.4, 10), '#2b1b72', { p: [b.uc, b.v0 + 0.2, -1.6], m: 'metal' });
    const holo = new THREE.Mesh(track(new THREE.SphereGeometry(1.1, 16, 10)), track(new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.slime).multiplyScalar(1.6), wireframe: true, toneMapped: false })));
    holo.position.set(b.uc - 4, b.v0 + 3, -3); grp.add(holo);
    k.add(cyl(0.6, 0.8, 1.4, 10), '#4a4466', { p: [b.uc - 4, b.v0 + 0.7, -3], m: 'metal' });
    const crew = [alien(grp, b.uc - 2, b.v0, -4.4, 0), alien(grp, b.uc + 2.2, b.v0, -4.2, 0.3), alien(grp, b.uc, b.v0, -1.6, Math.PI, 1)];
    anim((dt, t) => { holo.rotation.y += dt * 0.8; crew.forEach((c, i) => { c.rotation.z = Math.sin(t * 2 + i) * 0.04; }); });
  },
  research(k, grp, b) {
    // desks with screens, a specimen tube with a floating cow, a robot arm and bubbling flasks
    for (const x of [b.u0 + 2.5, b.u0 + 5.5]) { k.add(box(2.4, 1, 1.4), '#d9def0', { p: [x, b.v0 + 0.5, -D + 1.2], m: 'metal' }); k.add(box(2, 1.3, 0.15), b.accent, { p: [x, b.v0 + 1.9, -D + 0.8], m: 'glow', k: 1.4 }); }
    k.add(cyl(1.5, 1.5, 0.4, 14), '#4a4466', { p: [b.u1 - 3, b.v0 + 0.2, -4], m: 'metal' }); k.add(cyl(1.5, 1.5, 0.4, 14), '#4a4466', { p: [b.u1 - 3, b.v0 + 6, -4], m: 'metal' });
    const tube = new THREE.Mesh(track(new THREE.CylinderGeometry(1.4, 1.4, 5.4, 18, 1, true)), glass()); tube.position.set(b.u1 - 3, b.v0 + 3.1, -4); tube.userData.noInk = true; grp.add(tube);
    const cow = put(grp, FARM_MAKERS.cow(), b.u1 - 3, b.v0 + 2.6, -4, 0.75);
    const arm = robotArm(grp, b.u0 + 8.6, b.v0, -3, '#5fe8ff', Math.PI / 2);
    for (let i = 0; i < 4; i++) k.add(cyl(0.22, 0.32, 0.8, 8), [PAL.bubblegum, PAL.mint, PAL.poster, PAL.slime][i], { p: [b.u0 + 1.6 + i * 0.7, b.v0 + 1.4, -2], m: 'glow', k: 1.8 });
    k.add(box(3.6, 1, 1), '#d9def0', { p: [b.u0 + 2.6, b.v0 + 0.5, -2], m: 'metal' });
    alien(grp, b.u0 + 4, b.v0, -4.4, 0.4);
    anim((dt, t) => { cow.rotation.y += dt * 0.6; cow.position.y = b.v0 + 2.6 + Math.sin(t * 1.4) * 0.35; cow.rotation.z = Math.sin(t) * 0.2; arm.arm.rotation.x = -0.4 + Math.sin(t * 1.3) * 0.35; arm.base.rotation.y = Math.PI / 2 + Math.sin(t * 0.7) * 0.6; });
  },
  hybrid(k, grp, b) {
    // a row of cloning vats, each growing a gray, with rising bubbles; pipes along the ceiling
    const n = 5, step = (b.w - 3) / n, bubbles: THREE.Mesh[] = [];
    const bmat = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.mint).multiplyScalar(1.8), toneMapped: false })), bgeo = track(new THREE.SphereGeometry(0.14, 6, 4));
    for (let i = 0; i < n; i++) {
      const x = b.u0 + 2 + step * (i + 0.5);
      k.add(cyl(1.1, 1.2, 0.6, 14), '#2b1b72', { p: [x, b.v0 + 0.3, -4.6], m: 'metal' }); k.add(cyl(1.1, 1.1, 0.5, 14), '#2b1b72', { p: [x, b.v0 + 5.6, -4.6], m: 'metal' });
      k.add(cyl(0.18, 0.18, b.h - 5.8, 6), '#4a4466', { p: [x, b.v0 + 5.8 + (b.h - 5.8) / 2, -4.6], m: 'metal' });
      const liquid = new THREE.Mesh(track(new THREE.CylinderGeometry(1, 1, 4.6, 16)), track(new THREE.MeshBasicMaterial({ color: '#4ff0d0', transparent: true, opacity: 0.32, depthWrite: false }))); liquid.position.set(x, b.v0 + 2.95, -4.6); liquid.userData.noInk = true; grp.add(liquid);
      const g = alien(grp, x, b.v0 + 0.9, -4.6, 0, 0.55 + i * 0.08);
      anim((dt, t) => { g.position.y = b.v0 + 0.9 + Math.sin(t * 1.1 + i) * 0.15; g.rotation.y = Math.sin(t * 0.4 + i) * 0.4; });
      for (let j = 0; j < 4; j++) { const m = new THREE.Mesh(bgeo, bmat); m.position.set(x + (j - 1.5) * 0.35, b.v0 + 1 + j * 1.1, -4.6 + 0.6); m.userData.noInk = true; m.userData.x0 = m.position.x; grp.add(m); bubbles.push(m); }
    }
    k.add(box(b.w - 1, 0.5, 0.5), '#b8bedc', { p: [b.uc, b.v1 - 1.2, -4.6], m: 'metal' });
    k.add(box(3, 1, 1.2), '#d9def0', { p: [b.u1 - 2.4, b.v0 + 0.5, -1.4], m: 'metal' }); k.add(box(2.4, 0.1, 0.8), b.accent, { p: [b.u1 - 2.4, b.v0 + 1.05, -1.4], m: 'glow', k: 1.8 });
    alien(grp, b.u1 - 2.4, b.v0, -0.2, Math.PI, 0.9);
    anim((dt, t) => { for (const m of bubbles) { m.position.y += dt * 1.6; if (m.position.y > b.v0 + 5.1) m.position.y = b.v0 + 0.8; m.position.x = m.userData.x0 + Math.sin(t * 4 + m.position.y) * 0.1; } });
  },
  cells(k, grp, b) {
    // "guest quarters": three cells with bars, humans on a couch watching alien TV, a guard
    const n = 3, cw = (b.w - 1) / n;
    for (let i = 0; i < n; i++) {
      const x0 = b.u0 + 0.5 + i * cw, xc = x0 + cw / 2;
      k.add(box(0.3, b.h, D - 2), '#4a3358', { p: [x0, b.v0 + b.h / 2, -D / 2 - 1] });
      for (let x = x0 + 0.4; x < x0 + cw; x += 0.7) k.add(cyl(0.08, 0.08, b.h - 0.2, 5), '#b8bedc', { p: [x, b.v0 + b.h / 2, -2.2], m: 'metal' });
      k.add(box(cw - 1.2, 0.6, 1.2), ['#ff9fb0', '#7fd6ff', '#c6f04a'][i], { p: [xc, b.v0 + 0.5, -D + 1.4] }); k.add(box(cw - 1.2, 1, 0.4), ['#ff9fb0', '#7fd6ff', '#c6f04a'][i], { p: [xc, b.v0 + 1.1, -D + 0.8] });
      const pick = ['mini_male_a', 'mini_female_b', 'mini_male_c', 'mini_female_d', 'mini_male_e', 'mini_female_f'];
      for (let j = 0; j < 2; j++) { if (!hasModel(pick[i * 2 + j])) continue; const hm = put(grp, instance(pick[i * 2 + j]).root, xc + (j ? 0.8 : -0.8), b.v0 + 0.4, -D + 1.5, 0.9, 0); const ph = i * 2 + j; anim((dt, t) => { hm.rotation.y = Math.sin(t * 0.7 + ph) * 0.5; hm.position.y = b.v0 + 0.4 + Math.abs(Math.sin(t * 2 + ph)) * 0.08; }); }
    }
    // the TV on the corridor wall flickers through alien shows
    k.add(box(2.6, 1.6, 0.3), '#2b1b72', { p: [b.uc, b.v1 - 1.6, -1.4] });
    const tv = new THREE.Mesh(track(new THREE.PlaneGeometry(2.2, 1.2)), track(new THREE.MeshBasicMaterial({ color: '#ff6fb5', toneMapped: false }))); tv.position.set(b.uc, b.v1 - 1.6, -1.2); tv.userData.noInk = true; grp.add(tv);
    alien(grp, b.u1 - 1.2, b.v0, -0.9, -Math.PI / 2, 0.95);
    const tvc = ['#ff6fb5', '#9cff3f', '#5fe8ff', '#ffd23f'];
    anim((dt, t) => { (tv.material as THREE.MeshBasicMaterial).color.set(tvc[Math.floor(t * 1.5) % 4]).multiplyScalar(1.5); });
  },
  shipyard(k, grp, b) {
    // a saucer being assembled on a lift: two robot arms weld it (sparks), parts roll in on a conveyor
    k.add(cyl(3, 3.4, 0.6, 20), '#4a4466', { p: [b.uc, b.v0 + 0.3, -4.2], m: 'metal' });
    for (let i = 0; i < 10; i++) k.add(box(0.7, 0.12, 0.7), i % 2 ? '#ffd23f' : '#1a1033', { p: [b.uc - 3.2 + i * 0.7, b.v0 + 0.62, -1.2] });   // hazard stripes
    const lift = put(grp, cachedModel('liftPad', kk => { kk.add(cyl(2.6, 2.6, 0.3, 20), '#b8bedc', { m: 'metal' }); kk.add(cyl(0.5, 0.5, 2, 8), '#6a6488', { p: [0, -1, 0], m: 'metal' }); }), b.uc, b.v0 + 0.8, -4.2);
    const ship = put(grp, hasModel('b_saucer') ? instance('b_saucer').root : miniSaucer(), b.uc, b.v0 + 2.2, -4.2, hasModel('b_saucer') ? 1.2 : 1.6);
    const arms = [robotArm(grp, b.uc - 5.5, b.v0, -4.2, '#ffd23f', Math.PI / 2), robotArm(grp, b.uc + 5.5, b.v0, -4.2, '#ffd23f', -Math.PI / 2)];
    k.add(box(b.w - 2, 0.6, 1.6), '#2f2a48', { p: [b.uc, b.v0 + 0.3, -7], m: 'metal' });   // conveyor at the back
    const parts: THREE.Object3D[] = [];
    for (let i = 0; i < 4; i++) parts.push(put(grp, cachedModel('shipPart' + (i % 2), kk => { if (i % 2) kk.add(cyl(0.8, 0.8, 0.4, 12), '#d9def0', { m: 'metal' }); else kk.add(box(1.2, 0.6, 1), '#b8bedc', { m: 'metal' }); }), b.u0 + 1.5 + i * 4, b.v0 + 0.9, -7));
    k.add(box(b.w - 2, 0.4, 0.4), '#4a4466', { p: [b.uc, b.v1 - 1.4, -6], m: 'metal' });   // gantry rail
    const crane = put(grp, cachedModel('craneHook', kk => { kk.add(box(1.2, 0.6, 1.2), '#ffd23f', { m: 'metal' }); kk.add(cyl(0.06, 0.06, 2.6, 4), '#1a1033', { p: [0, -1.6, 0] }); kk.add(box(0.8, 0.5, 0.8), '#d9def0', { p: [0, -3, 0], m: 'metal' }); }), b.uc, b.v1 - 1.8, -6);
    alien(grp, b.u1 - 2, b.v0, -1.4, -0.6);
    let sparkT = 0;
    anim((dt, t) => {
      const lift01 = (Math.sin(t * 0.5) + 1) / 2; lift.position.y = b.v0 + 0.8 + lift01 * 1.2; ship.position.y = lift.position.y + 1.4; ship.rotation.y += dt * 0.4;
      arms.forEach((a, i) => { a.arm.rotation.x = -0.25 + Math.sin(t * 2.2 + i * 2) * 0.25; a.base.rotation.y = (i ? -1 : 1) * Math.PI / 2 + Math.sin(t * 1.4 + i) * 0.35; });
      for (const p of parts) { p.position.x += dt * 1.8; if (p.position.x > b.u1 - 1.5) p.position.x = b.u0 + 1.5; }
      crane.position.x = b.uc + Math.sin(t * 0.6) * (b.w / 2 - 3);
      if ((sparkT -= dt) <= 0) { sparkT = 0.12; const a = arms[Math.floor(t * 3) % 2]; a.tip.getWorldPosition(_tw); FX.spark(_tw, FXC.poster, 5, 5, 0.18, 0.35, -10); }
    });
  },
  storage(k, grp, b) {
    // stacks of crates in the resource colours, artifacts on a shelf, a hover-drone moving crates
    const cols = [PAL.rHumans, PAL.rBiomass, PAL.rMetal], rnd = mulberry32(3);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 1 + Math.floor(rnd() * 3); j++) {
      const c = cols[i % 3], x = b.u0 + 2 + i * 2.6, y = b.v0 + 0.8 + j * 1.6, z = -D + 1.6 + (i % 2) * 2;
      k.add(box(2.2, 1.5, 1.8), c, { p: [x, y, z], r: [0, (rnd() - 0.5) * 0.2, 0] }); k.add(box(2.3, 0.2, 1.9), '#3e3328', { p: [x, y + 0.6, z] });
    }
    k.add(box(b.w - 4, 0.3, 1.2), '#7a5a3a', { p: [b.uc + 1, b.v1 - 2.6, -D + 0.9] });
    ARTIFACTS.slice(0, 6).forEach((a, i) => { if (hasModel(a)) put(grp, instance(a).root, b.u0 + 4 + i * 2.6, b.v1 - 2.4, -D + 0.9, 1.4); });
    const drone = put(grp, miniSaucer(), b.uc, b.v1 - 4, -3, 0.9);
    const crate = new THREE.Group(); crate.add(cachedModel('heldCrate', kk => kk.add(box(1.2, 0.9, 1), PAL.rMetal, {}))); crate.position.set(0, -1.6, 0); drone.add(crate);
    anim((dt, t) => { drone.position.x = b.uc + Math.sin(t * 0.5) * (b.w / 2 - 3); drone.position.y = b.v1 - 4 + Math.sin(t * 2) * 0.3; drone.rotation.y += dt; });
  },
  trophy(k, grp, b) {
    // stolen landmarks on pedestals under spotlights: a Liberty torch, an Eiffel top, a pyramid tip, a golden Zix
    const xs = [b.u0 + 2.5, b.uc, b.u1 - 2.5], tops: THREE.Object3D[] = [];
    const beamMat = track(new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })), beamGeo = track(new THREE.ConeGeometry(1.7, b.h - 1.2, 16, 1, true));
    for (const x of xs) { k.add(cyl(1.3, 1.5, 1, 10), '#d9def0', { p: [x, b.v0 + 0.5, -4.2], m: 'metal' }); const sp = new THREE.Mesh(beamGeo, beamMat); sp.position.set(x, b.v0 + 1 + (b.h - 1.2) / 2, -4.2); sp.userData.noInk = true; grp.add(sp); }
    tops.push(put(grp, cachedModel('trophyTorch', kk => { kk.add(cyl(0.35, 0.45, 2.2, 8), '#78c4a8', { p: [0, 1.1, 0] }); kk.add(cyl(0.6, 0.3, 0.6, 8), '#ffd23f', { p: [0, 2.4, 0], m: 'metal' }); kk.add(sph(0.5, 8, 6), PAL.poster, { p: [0, 3, 0], m: 'glow', k: 2.6 }); }), xs[0], b.v0 + 1, -4.2));
    tops.push(put(grp, cachedModel('trophyEiffel', kk => { for (const s of [-1, 1]) for (const t of [-1, 1]) kk.add(box(0.2, 3.2, 0.2), '#9a7a5a', { p: [s * 0.45, 1.5, t * 0.45], r: [t * 0.12, 0, -s * 0.12], m: 'metal' }); kk.add(box(1.3, 0.2, 1.3), '#9a7a5a', { p: [0, 1.2, 0], m: 'metal' }); kk.add(cone(0.35, 1.2, 4), '#9a7a5a', { p: [0, 3.5, 0], m: 'metal' }); }), xs[1], b.v0 + 1, -4.2));
    tops.push(put(grp, cachedModel('trophyZix', kk => { kk.add(cone(1.2, 1.8, 4), '#e0c060', { p: [0, 0.9, 0] }); kk.add(sph(0.7, 10, 8), '#ffd23f', { p: [0, 2.3, 0], s: [1, 1.25, 1], m: 'metal' }); }), xs[2], b.v0 + 1, -4.2));
    anim((dt) => { tops.forEach(t => { t.rotation.y += dt * 0.5; }); });
  },
  armory(k, grp, b) {
    // racks of glowing weapons and power canisters, a blinking control panel, an attack saucer on a stand
    for (let i = 0; i < 6; i++) { const x = b.u0 + 1.4 + i * 1.1; k.add(box(0.3, 3.4, 0.3), '#4a4466', { p: [x, b.v0 + 1.9, -D + 0.6], m: 'metal' }); k.add(cyl(0.22, 0.22, 2.6, 8), [PAL.tomato, PAL.violet, PAL.slime][i % 3], { p: [x, b.v0 + 2.2, -D + 1.1], m: 'glow', k: 2 }); }
    k.add(box(4, 1.2, 1.4), '#d9def0', { p: [b.u1 - 3, b.v0 + 0.6, -2], m: 'metal' });
    const lamps: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(track(new THREE.SphereGeometry(0.18, 6, 4)), track(new THREE.MeshBasicMaterial({ color: '#ff5a4f', toneMapped: false }))); m.position.set(b.u1 - 4.4 + i * 0.9, b.v0 + 1.3, -1.6); m.userData.noInk = true; grp.add(m); lamps.push(m); }
    const s = put(grp, miniSaucer(), b.u1 - 3, b.v0 + 3, -5.4, 1.2);
    anim((dt, t) => { lamps.forEach((m, i) => { (m.material as THREE.MeshBasicMaterial).color.set(Math.floor(t * 3 + i) % 2 ? '#ff5a4f' : '#ffd23f').multiplyScalar(2); }); s.rotation.y += dt * 0.6; s.position.y = b.v0 + 3 + Math.sin(t * 1.5) * 0.2; });
  },
};

// ------------------------------------------------------------------ outside: dome, antennas, docking bay, flying saucers
function buildExterior(root: THREE.Group) {
  const k = new Kit();
  // observation dome on the north pole + antennas
  k.add(cyl(5, 6, 1.2, 24), HULL, { p: [0, R - 0.6, -4], m: 'metal' });
  for (const [x, z, h] of [[9, -12, 7], [-11, -9, 5], [14, -20, 4]] as const) { const y = Math.sqrt(Math.max(0, R * R - x * x - z * z)); k.add(cyl(0.25, 0.4, h, 6), '#b8bedc', { p: [x, y + h / 2 - 0.5, z], m: 'metal' }); k.add(sph(0.5, 8, 6), PAL.tomato, { p: [x, y + h - 0.3, z], m: 'glow', k: 3 }); }
  // docking ring on the far side with landing lights
  k.add(new THREE.TorusGeometry(R + 3, 0.8, 8, 64, MB.layout === 'slice' ? Math.PI : 6 * Q), HULL, { r: [Math.PI / 2, 0, MB.layout === 'slice' ? Math.PI : 3 * Q], p: [0, -4, 0], m: 'metal' });
  root.add(k.build(g => G.disposables.push(g)));
  const dome = new THREE.Mesh(track(new THREE.SphereGeometry(4.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), glass()); dome.position.set(0, R, -4); dome.userData.noInk = true; root.add(dome);
  put(root as any, makeGrayAlien(), 0, R, -4, 1.1);
  // saucers coming and going around the moon
  for (let i = 0; i < 5; i++) { const d = miniSaucer(); d.scale.setScalar(1.3); root.add(d); MB.orbit.push({ o: d, a: i * 1.3, r: R + 9 + (i % 3) * 4, y: -10 + i * 5, s: 0.25 + (i % 2) * 0.12 }); }
}

// ------------------------------------------------------------------ labels + per frame
function makeLabels() {
  let box = document.getElementById('moon-labels'); if (!box) { box = document.createElement('div'); box.id = 'moon-labels'; document.body.appendChild(box); }
  box.innerHTML = ''; MB.labels.clear(); box.hidden = false;
  for (const id of ROOM_IDS) { const el = document.createElement('button'); el.className = 'moon-label'; el.dataset.room = id; el.innerHTML = `<b>${ROOMS[id].name}</b>`; el.title = ROOMS[id].job; box.appendChild(el); MB.labels.set(id, el); }
}
export function leaveMoonBase() { const b = document.getElementById('moon-labels'); if (b) b.hidden = true; }
const _p = new THREE.Vector3();
export function updateMoonBase(dt: number) {
  const t = G.time;
  for (const a of MB.anims) a.fn(dt, t);
  for (const s of MB.orbit) { s.a += dt * s.s; s.o.position.set(Math.cos(s.a) * s.r, s.y + Math.sin(s.a * 2) * 2, Math.sin(s.a) * s.r - 6); s.o.rotation.y = -s.a; s.o.rotation.z = 0.15; }
  const W = innerWidth, H = innerHeight;
  for (const [id, el] of MB.labels) {
    const c = MB.centers.get(id); if (!c) continue;
    _p.copy(c).project(camera);
    el.style.transform = `translate(${((_p.x * 0.5 + 0.5) * W).toFixed(0)}px, ${((-_p.y * 0.5 + 0.5) * H).toFixed(0)}px) translate(-50%, -50%)`;
  }
}
