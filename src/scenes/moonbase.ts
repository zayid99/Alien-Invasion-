// The Moon Base (docs/gdd/moon-base.md): the hollow moon is the Gray Empire's ship. A quarter of the moon is cut away
// (the "wedge"); the two cut faces show four storeys of rooms each, reaching out to the moon's curved edge, with the
// reactor shaft standing in the corner. Every room is alive. Tapping a room's tag flies the camera into it.
import * as THREE from 'three';
import { G, track } from '../game/state';
import { camera, LIGHT, makeStars, fresnelMaterial, gradientSky, scene, QUALITY } from '../core/engine';
import { FT } from '../gfx/fx';
import { UI } from '../ui/dom';
import { TUT } from '../ui/tutorial';
import { SFX } from '../core/audio';
import { platform } from '../core/platform';
import { moonHooks, renderMoonPanel } from '../ui/moonPanel';
import { Kit, box, cyl, sph, cone, cachedModel } from '../gfx/kit';
import { PAL, SKY } from '../gfx/palette';
import { toonMaterial, inkify, setRimColor, setInk } from '../gfx/toon';
import { makeGrayAlien, makeZix, miniSaucer, makeWalker, FARM_MAKERS } from '../gfx/models';
import { instance, hasModel, ARTIFACTS } from '../core/assets';
import { clearWorld } from '../world/maps/common';
import { earthCanvas, leaveGlobe, hideLabels, makeRingPlanet } from './globe';
import { FX, FXC } from '../gfx/fx';
import { MOON, ROOMS, ROOM_IDS } from '../data/moonbase';
import type { RoomId } from '../data/moonbase';
import { mulberry32 } from '../core/util';

const R = MOON.radius, A = MOON.arc, CORE = MOON.core, D = MOON.depth, Q = Math.PI / 4;
const ROCK = '#8d84b0', CRUST = '#b9b2d6', HULL = '#4b3a8f', STEEL = '#b8bedc', WHITE = '#d9def0', DARK = '#2b1b72';
/** Half-width of the room space at height v (rooms reach out to the arc). */
const arcU = (v: number) => Math.sqrt(Math.max(0, A * A - v * v));
const faceRy = (side: number) => (side > 0 ? -Q : Q);
/** Out-of-face direction (towards the open wedge) for each side, in world space. */
const faceN = (side: number) => new THREE.Vector3(side > 0 ? -Math.SQRT1_2 : Math.SQRT1_2, 0, Math.SQRT1_2);

interface Anim { fn: (dt: number, t: number) => void }
const MB = {
  anims: [] as Anim[], labels: new Map<RoomId, HTMLElement>(), anchors: new Map<RoomId, THREE.Vector3>(), views: new Map<RoomId, { pos: THREE.Vector3; look: THREE.Vector3 }>(),
  orbit: [] as { o: THREE.Object3D; a: number; r: number; y: number; s: number }[], focus: null as RoomId | null,
  /** per-room "something was just made here" animation (moonPanel → celebrate) */ cel: new Map<RoomId, () => void>(),
  /** each room's group: outlines are drawn only for the room the camera is in (draw-call budget) */ groups: new Map<RoomId, THREE.Object3D>(), life: [] as THREE.Object3D[],
  down: null as { x: number; y: number } | null, ray: new THREE.Raycaster(), reactor: null as THREE.Object3D | null,
  cam: { from: new THREE.Vector3(), to: new THREE.Vector3(), lookFrom: new THREE.Vector3(), lookTo: new THREE.Vector3(), look: new THREE.Vector3(), t: 1, dur: 1.1 },
  home: { pos: new THREE.Vector3(), look: new THREE.Vector3() },
};
const anim = (fn: (dt: number, t: number) => void) => MB.anims.push({ fn });

export function enterMoonBase(o: { intro?: boolean } = {}) {
  leaveGlobe(); hideLabels(); clearWorld();
  G.mode = 'moonbase'; G.paused = false; G.modeTime = 0;
  MB.anims = []; MB.orbit = []; MB.anchors.clear(); MB.views.clear(); MB.focus = null; MB.cel.clear(); MB.groups.clear(); MB.life = [];
  moonHooks.room = () => MB.focus; moonHooks.celebrate = celebrate;
  const S = SKY.space; scene.fog = null; scene.background = new THREE.Color(S.bottom);
  const sky = gradientSky(S.top, S.horizon, S.bottom, 1200); sky.renderOrder = -10; track(sky.geometry, sky.material as THREE.Material); G.world.add(sky);
  const stars = makeStars(2600, 900, -1); track(stars.geometry, stars.material as THREE.Material); G.world.add(stars);
  LIGHT.hemi.color.set(0x8a7cff); LIGHT.hemi.groundColor.set(0x1a1040); LIGHT.hemi.intensity = 0.95;
  LIGHT.moon.color.set(0xfff1dc); LIGHT.moon.intensity = 3.2; LIGHT.moon.position.set(60, 160, 240);
  setRimColor(PAL.rimSpace);
  const tex = track(new THREE.CanvasTexture(earthCanvas())); tex.colorSpace = THREE.SRGBColorSpace;
  const earth = new THREE.Mesh(track(new THREE.SphereGeometry(70, 64, 32)), track(toonMaterial({ map: tex })));
  inkify(earth, { px: 2.5, fade: false }); earth.position.set(-170, -80, -280); earth.rotation.y = 2.4; G.world.add(earth);
  const atm = new THREE.Mesh(track(new THREE.SphereGeometry(74, 48, 24)), track(fresnelMaterial(0x6fe0ff, 2.6, 0.9, 2, 0.2))); atm.position.copy(earth.position); G.world.add(atm);
  anim(dt => { earth.rotation.y += dt * 0.02; });
  const planet = makeRingPlanet(18); planet.position.set(280, 120, -400); G.world.add(planet);

  const root = new THREE.Group(); G.world.add(root);
  buildShell(root); buildFaces(root); buildReactor(root);
  for (const id of ROOM_IDS) if (id !== 'reactor') buildRoom(root, id);
  buildExterior(root);
  removeEventListener('keydown', onKey); addEventListener('keydown', onKey);
  const cv = document.getElementById('game'); if (cv && !cv.dataset.moonPick) { cv.dataset.moonPick = '1'; cv.addEventListener('pointerdown', e => { MB.down = { x: e.clientX, y: e.clientY }; }); cv.addEventListener('pointerup', onPick); }
  for (const o of MB.orbit) MB.life.push(o.o);
  applyInk();
  root.updateMatrixWorld(true);
  makeLabels();
  const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), fit = camera.aspect < 1 ? (R + 2) / tv / camera.aspect : (R + 5.5) / tv / Math.min(1, camera.aspect * 0.9);
  MB.home.pos.set(0, 14, fit); MB.home.look.set(0, 0.5, 0);
  camera.position.copy(MB.home.pos); MB.cam.look.copy(MB.home.look); camera.lookAt(MB.cam.look); MB.cam.t = 1;
  if (o.intro) {   // the first visit: swoop in from deep space while the moon turns towards you
    const c = MB.cam; c.from.set(-120, 90, fit * 3.2); c.lookFrom.set(-20, 0, 0); c.to.copy(MB.home.pos); c.lookTo.copy(MB.home.look); c.t = 0; c.dur = 3.2;
    camera.position.copy(c.from); c.look.copy(c.lookFrom); camera.lookAt(c.look);
  }
  UI.hud(false); UI.globe(false); UI.show('scr-moon'); $hint(true); renderMoonPanel(); document.body.classList.add('in-moon');
  SFX.setMusic('calm'); platform.gameplayStop();
}
const $hint = (on: boolean) => { const h = document.getElementById('moon-hint'); if (h) h.hidden = !on; };
/** A purchase in a room: its own animation, a burst of sparks and a caption over the room. */
function celebrate(room: RoomId, text: string) {
  if (MB.focus !== room) focusRoom(room);
  MB.cel.get(room)?.();
  const v = MB.views.get(room); if (!v) return;
  _tw.copy(v.look).add(new THREE.Vector3(0, 1.5, 0));   // the middle of the room, where the camera looks
  FX.spark(_tw, FXC.slime, 18, 9, 0.3, 0.7, -6); FX.spark(_tw, FXC.poster, 10, 7, 0.25, 0.6, -6);
  FT.spawn(_tw.clone().add(new THREE.Vector3(0, 1.5, 0)), text, 'good', 1.3, 2.2);
}

// ------------------------------------------------------------------ the rock: shell, cut faces, reactor
function buildShell(root: THREE.Group) {
  const geo = new THREE.SphereGeometry(R, 72, 40, 3 * Q, 6 * Q);
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d'); const rnd = mulberry32(7);
  x.fillStyle = CRUST; x.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 220; i++) { x.fillStyle = `rgba(90,80,140,${0.12 + rnd() * 0.2})`; x.beginPath(); x.ellipse(rnd() * 1024, rnd() * 512, 6 + rnd() * 18, 4 + rnd() * 12, 0, 0, Math.PI * 2); x.fill(); }
  for (let i = 0; i < 45; i++) {
    const cx = rnd() * 1024, cy = 60 + rnd() * 392, r = 10 + rnd() * 34;
    x.fillStyle = 'rgba(80,70,130,0.45)'; x.beginPath(); x.ellipse(cx, cy, r, r * 0.7, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(240,236,255,0.55)'; x.lineWidth = 3; x.beginPath(); x.ellipse(cx - 2, cy - 2, r, r * 0.7, 0, Math.PI * 0.9, Math.PI * 1.9); x.stroke();
  }
  x.strokeStyle = 'rgba(156,255,63,0.55)'; x.lineWidth = 2;   // glowing seams: the moon is a machine
  for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(0, 90 + i * 66); for (let k = 0; k <= 32; k++) x.lineTo(k * 32, 90 + i * 66 + (k % 2 ? 6 : -6)); x.stroke(); }
  const t = track(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace;
  const shell = new THREE.Mesh(track(geo), track(toonMaterial({ map: t })));
  inkify(shell, { px: 3, fade: false }); root.add(shell);
}
/** Outline of a room on its face (u ≥ 0): straight inner wall by the reactor, outer wall following the arc. */
function roomOutline(band: number): [number, number][] {
  const [v0, v1] = MOON.bands[band], pts: [number, number][] = [[CORE, v0], [CORE, v1], [arcU(v1), v1]];
  const t1 = Math.asin(v1 / A), t0 = Math.asin(v0 / A);
  for (let i = 1; i < 14; i++) { const t = t1 + (t0 - t1) * i / 14; pts.push([A * Math.cos(t), A * Math.sin(t)]); }
  pts.push([arcU(v0), v0]); return pts;
}
function buildFaces(root: THREE.Group) {
  for (const side of [1, -1]) {
    const inner = R - MOON.crust, shape = new THREE.Shape(), rim = new THREE.Shape();
    const a0 = side > 0 ? -Math.PI / 2 : Math.PI / 2, a1 = a0 + Math.PI;
    shape.moveTo(Math.cos(a0) * inner, Math.sin(a0) * inner); shape.absarc(0, 0, inner, a0, a1, false); shape.closePath();
    rim.moveTo(Math.cos(a0) * R, Math.sin(a0) * R); rim.absarc(0, 0, R, a0, a1, false); rim.lineTo(Math.cos(a1) * inner, Math.sin(a1) * inner);
    rim.absarc(0, 0, inner, a1, a0, true); rim.closePath();
    for (const id of ROOM_IDS) {
      const r = ROOMS[id]; if (r.band < 0 || r.side !== side) continue;
      const h = new THREE.Path(), pts = roomOutline(r.band).map(([u, v]) => [u * side, v] as [number, number]);
      h.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) h.lineTo(p[0], p[1]); h.closePath(); shape.holes.push(h);
    }
    const k = new Kit(); k.at(0, 0, 0, faceRy(side));
    k.add(new THREE.ShapeGeometry(shape, 48), ROCK, { m: 'std' });
    k.add(new THREE.ShapeGeometry(rim, 64), CRUST, { p: [0, 0, 0.02] });
    // ledges (walkways) between the storeys, with a glowing edge
    for (let b = 0; b < 3; b++) {
      const v = (MOON.bands[b][0] + MOON.bands[b + 1][1]) / 2, len = arcU(v) - CORE + 0.6;
      k.add(box(len, 0.5, 1.6), HULL, { p: [side * (CORE + len / 2), v - 0.35, 0.8], m: 'metal' });
      k.add(box(len, 0.12, 0.12), PAL.slime, { p: [side * (CORE + len / 2), v - 0.05, 1.6], m: 'glow', k: 1.6 });
    }
    // pole caps: vents and hatches on the rock above and below the rooms
    for (const v of [24.6, -24]) for (let i = 0; i < 3; i++) k.add(box(1.4, 0.8, 0.3), DARK, { p: [side * (5 + i * 2.4), v + (v > 0 ? -i * 0.4 : i * 0.4), 0.15] });
    root.add(k.build(g => G.disposables.push(g)));
    buildFaceLife(root, side);
  }
}
/** Crew walking the ledges; an elevator capsule running beside the reactor. */
function buildFaceLife(root: THREE.Group, side: number) {
  const grp = new THREE.Group(); grp.rotation.y = faceRy(side); root.add(grp); MB.life.push(grp);
  for (let b = 0; b < (QUALITY === 'low' ? 0 : 3); b++) {
    const v = (MOON.bands[b][0] + MOON.bands[b + 1][1]) / 2 - 0.1, span = arcU(v) - CORE - 3, ph = b * 1.9 + side;
    for (let j = 0; j < 2; j++) {
      const a = alien(grp, side * (CORE + 2), v, 0.9, 0, 0.62), off = j * 2.6;
      anim((dt, t) => { const s = Math.sin(t * 0.22 + ph + off); a.position.x = side * (CORE + 1.5 + (s * 0.5 + 0.5) * span); a.rotation.y = (Math.cos(t * 0.22 + ph + off) > 0) === (side > 0) ? Math.PI / 2 : -Math.PI / 2; a.position.y = v + Math.abs(Math.sin(t * 8 + ph + off)) * 0.1; });
    }
  }
  const u = side * (CORE - 0.9), k = new Kit();
  k.add(box(1.5, 44, 0.3), DARK, { p: [u, 0, 0.1] }); for (const e of [-0.8, 0.8]) k.add(box(0.14, 44, 0.2), PAL.slime, { p: [u + e, 0, 0.3], m: 'glow', k: 1.6 });
  grp.add(k.build(g => G.disposables.push(g)));
  const cap = put(grp, cachedModel('liftCap', kk => { kk.add(box(1.2, 1.8, 0.8), WHITE, { m: 'metal' }); kk.add(box(0.8, 0.8, 0.1), '#5fe8ff', { p: [0, 0.2, 0.42], m: 'glow', k: 1.4 }); }), u, 0, 0.6), ph = side * 1.7;
  anim((dt, t) => { cap.position.y = Math.sin(t * 0.3 + ph) * 20; });
}
function buildReactor(root: THREE.Group) {
  const k = new Kit(), rr = 1.6;
  k.add(cyl(rr, rr, 44, 16), PAL.violet, { m: 'glow', k: 2.2 });
  for (let y = -20; y <= 20; y += 4) k.add(cyl(rr + 0.5, rr + 0.5, 0.5, 16), HULL, { p: [0, y, 0], m: 'metal' });
  for (const y of [-22, 22]) k.add(cyl(2.8, 2.8, 1.4, 16), HULL, { p: [0, y, 0], m: 'metal' });
  const shaft = k.build(g => G.disposables.push(g)); root.add(shaft); MB.reactor = shaft;
  const core = new THREE.Mesh(track(new THREE.IcosahedronGeometry(2.6, 1)), track(new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.slime).multiplyScalar(2.4), toneMapped: false })));
  core.position.set(0, 0.6, 0); root.add(core);
  const rings: THREE.Object3D[] = [];
  for (let i = 0; i < 3; i++) { const r = cachedModel('reactorRing', kk => kk.add(new THREE.TorusGeometry(3.4, 0.24, 6, 32), PAL.violet, { m: 'glow', k: 2.6 }), false); r.position.copy(core.position); root.add(r); rings.push(r); }
  // energy pulses running up and down the shaft
  const pulses: THREE.Mesh[] = [], pm = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.slime).multiplyScalar(2.2), toneMapped: false })), pg = track(new THREE.TorusGeometry(rr + 0.15, 0.18, 6, 24));
  for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(pg, pm); m.rotation.x = Math.PI / 2; m.userData.noInk = true; root.add(m); pulses.push(m); }
  MB.anchors.set('reactor', new THREE.Vector3(0, 0.6, 3.8));
  MB.views.set('reactor', { pos: new THREE.Vector3(0, 5, 26), look: new THREE.Vector3(0, 0.6, 0) });
  let arcT = 0;
  anim((dt, t) => {
    core.scale.setScalar(1 + Math.sin(t * 3) * 0.12); core.rotation.y += dt; core.rotation.x += dt * 0.6;
    rings.forEach((r, i) => { r.rotation.x = t * (0.8 + i * 0.3) + i; r.rotation.y = t * (0.5 + i * 0.2); });
    pulses.forEach((p, i) => { const y = ((t * 9 + i * 11) % 44) - 22; p.position.set(0, i % 2 ? y : -y, 0); });
    if ((arcT -= dt) <= 0) { arcT = 0.18; const a = Math.random() * Math.PI * 2; FX.line(core.position, _tw.set(Math.cos(a) * 3.4, core.position.y + (Math.random() - 0.5) * 3, Math.sin(a) * 3.4), FXC.violet, 0.5, 0.12); }
  });
}

// ------------------------------------------------------------------ rooms
interface RoomBox { F: number; top: number; h: number; xF: number; xC: number; accent: string; grp: THREE.Group }
/** Interior shell: the room outline extruded into the moon and turned inside out (back wall, ceiling, curved outer wall). */
function interiorGeo(band: number) {
  const sh = new THREE.Shape(roomOutline(band).map(([u, v]) => new THREE.Vector2(u, v)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: D, bevelEnabled: false, curveSegments: 4 }).toNonIndexed(); g.translate(0, 0, -D);
  const p = g.attributes.position.array as Float32Array, n = g.attributes.normal.array as Float32Array;
  for (let i = 0; i < p.length; i += 9) for (let j = 0; j < 3; j++) { let s = p[i + 3 + j]; p[i + 3 + j] = p[i + 6 + j]; p[i + 6 + j] = s; s = n[i + 3 + j]; n[i + 3 + j] = n[i + 6 + j]; n[i + 6 + j] = s; }
  for (let i = 0; i < n.length; i++) n[i] = -n[i];
  return g;
}
function buildRoom(root: THREE.Group, id: RoomId) {
  const def = ROOMS[id], [v0, v1] = MOON.bands[def.band];
  const grp = new THREE.Group(); grp.rotation.y = faceRy(def.side); root.add(grp); MB.groups.set(id, grp);
  const lr = new THREE.Group(); lr.scale.x = def.side; grp.add(lr);   // room space: x runs away from the reactor on both faces
  const shellK = new Kit(); shellK.add(interiorGeo(def.band), def.wall);
  lr.add(shellK.build(g => G.disposables.push(g), false));
  const k = new Kit(), F = v0 + 0.5, xF = arcU(v0 + 1.2) - 0.6, xC = arcU(v1 - 0.6) - 0.6;
  k.add(box(arcU(v0) - CORE, 0.5, D), def.floor, { p: [(CORE + arcU(v0)) / 2, v0 + 0.25, -D / 2] });
  for (let x = CORE + 1.5; x < arcU(v0) - 1; x += 3) k.add(box(1.6, 0.16, 0.16), def.accent, { p: [x, F + 0.08, -0.3], m: 'glow', k: 1.6 });   // floor edge lights
  // glowing frame along the opening + ceiling light strips
  k.add(box(xC - CORE + 0.6, 0.22, 0.22), def.accent, { p: [(CORE + xC + 0.6) / 2, v1 - 0.12, 0.05], m: 'glow', k: 2 });
  k.add(box(0.22, v1 - v0, 0.22), def.accent, { p: [CORE + 0.1, (v0 + v1) / 2, 0.05], m: 'glow', k: 2 });
  for (const z of [-2.5, -6.5]) k.add(box(xC - CORE - 1, 0.18, 0.5), '#fff6e0', { p: [(CORE + xC) / 2, v1 - 0.12, z], m: 'glow', k: 1.2 });
  const b: RoomBox = { F, top: v1, h: v1 - F, xF, xC, accent: def.accent, grp: lr };
  PROPS[id]?.(k, b);
  lr.add(k.build(g => G.disposables.push(g)));
  // tag anchor (on the ceiling edge) and the camera view for this room
  const mid = (CORE + Math.min(xF, xC + 3)) / 2;
  lr.updateMatrixWorld(true);
  MB.anchors.set(id, lr.localToWorld(new THREE.Vector3(mid, v1 - 0.2, 0.4)));
  const look = lr.localToWorld(new THREE.Vector3((CORE + xF) / 2, (v0 + v1) / 2 - 0.5, -D * 0.45));
  MB.views.set(id, { pos: look.clone().addScaledVector(faceN(def.side), 23).add(new THREE.Vector3(0, 3, 0)), look });
}
// ---- prop helpers (room space: x along the room from the reactor, y = height, z = depth into the moon, negative)
const glass = (c = '#8ff4ff', o = 0.22) => track(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false }));
function put(grp: THREE.Object3D, o: THREE.Object3D, x: number, y: number, z: number, s = 1, ry = 0) { o.position.set(x, y, z); o.scale.multiplyScalar(s); o.rotation.y = ry; grp.add(o); return o; }
function alien(grp: THREE.Object3D, x: number, y: number, z: number, ry = 0, s = 0.9) { return put(grp, hasModel('b_alien') ? instance('b_alien').root : makeGrayAlien(), x, y, z, s, ry); }
function human(grp: THREE.Object3D, i: number, x: number, y: number, z: number, ry = 0) {
  const ids = ['mini_male_a', 'mini_female_b', 'mini_male_c', 'mini_female_d', 'mini_male_e', 'mini_female_f', 'mini_male_b', 'mini_female_a'], id = ids[i % ids.length];
  return hasModel(id) ? put(grp, instance(id).root, x, y, z, 0.95, ry) : null;
}
function glow(grp: THREE.Object3D, geo: THREE.BufferGeometry, color: string, k: number, x: number, y: number, z: number) {
  const m = new THREE.Mesh(track(geo), track(new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false }))); m.position.set(x, y, z); m.userData.noInk = true; grp.add(m); return m;
}
/** A screen whose colour bars change: returns nothing, animates itself. */
function screen(grp: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, colors: string[], speed = 2) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 32; const g = c.getContext('2d'), t = track(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), track(new THREE.MeshBasicMaterial({ map: t, toneMapped: false }))); m.position.set(x, y, z); m.userData.noInk = true; grp.add(m);
  let acc = 0, frame = 0;
  const draw = () => { g.fillStyle = '#0f0828'; g.fillRect(0, 0, 64, 32); for (let i = 0; i < 6; i++) { g.fillStyle = colors[(i + frame) % colors.length]; const bh = 6 + ((i * 7 + frame * 5) % 22); g.fillRect(4 + i * 10, 30 - bh, 7, bh); } g.fillStyle = colors[frame % colors.length]; g.fillRect(4, 3, 20 + (frame % 4) * 8, 3); t.needsUpdate = true; };
  draw(); anim(dt => { if ((acc += dt) > 1 / speed) { acc = 0; frame++; draw(); } });
}
/** A two-part robot arm on a base; returns the parts that move and the tip. */
function robotArm(grp: THREE.Object3D, x: number, y: number, z: number, color: string, ry = 0) {
  const base = put(grp, cachedModel('armBase', k => { k.add(cyl(0.9, 1.1, 0.8, 10), '#4a4466', { p: [0, 0.4, 0], m: 'metal' }); k.add(cyl(0.35, 0.35, 2.2, 8), STEEL, { p: [0, 1.9, 0], m: 'metal' }); }), x, y, z, 1, ry);
  const arm = new THREE.Group(); arm.position.set(0, 3, 0); base.add(arm);
  arm.add(cachedModel('armSeg' + color, k => { k.add(box(0.5, 0.5, 3.2), color, { p: [0, 0, 1.4], m: 'metal' }); k.add(sph(0.45, 8, 6), '#4a4466', { p: [0, 0, 0], m: 'metal' }); k.add(cone(0.35, 0.8, 6), '#4a4466', { p: [0, -0.3, 3], r: [Math.PI, 0, 0], m: 'metal' }); }));
  const tip = new THREE.Object3D(); tip.position.set(0, -0.8, 3); arm.add(tip);
  return { base, arm, tip };
}
/** Walk back and forth between two x positions (at depth z), facing the way it goes. */
function pace(o: THREE.Object3D, x0: number, x1: number, y: number, z: number, speed: number, ph = 0) {
  anim((dt, t) => { const s = Math.sin(t * speed + ph); o.position.x = x0 + (s * 0.5 + 0.5) * (x1 - x0); o.rotation.y = Math.cos(t * speed + ph) > 0 ? Math.PI / 2 : -Math.PI / 2; o.position.y = y + Math.abs(Math.sin(t * 8 + ph)) * 0.08; o.position.z = z; });
}
const _tw = new THREE.Vector3(), _tw2 = new THREE.Vector3(), _bm = new THREE.Matrix4();
/** Low graphics: fewer background actors per room (each room keeps its main animation). */
const LOW = () => QUALITY === 'low';

const PROPS: Partial<Record<RoomId, (k: Kit, b: RoomBox) => void>> = {
  bridge(k, b) {
    const g = b.grp, x0 = CORE;
    // the war map: Earth's painted map on the back wall, with blinking target dots
    const mt = track(new THREE.CanvasTexture(earthCanvas())); mt.colorSpace = THREE.SRGBColorSpace;
    const map = new THREE.Mesh(track(new THREE.PlaneGeometry(11, 5.5)), track(new THREE.MeshBasicMaterial({ map: mt, toneMapped: false, color: new THREE.Color(0.85, 0.95, 1.05) }))); map.position.set(x0 + 7, b.F + 4.6, -D + 0.5); map.userData.noInk = true; g.add(map);
    k.add(box(11.8, 6.2, 0.3), DARK, { p: [x0 + 7, b.F + 4.6, -D + 0.12] });
    const dots = [[-3, 1], [-1.2, 1.4], [0.6, 0.9], [2.8, -0.6], [3.6, 1.2], [-2.2, -1.3]].map(([dx, dy]) => glow(g, new THREE.SphereGeometry(0.16, 6, 4), PAL.tomato, 2.5, x0 + 7 + dx, b.F + 4.6 + dy, -D + 0.6));
    // curved crew consoles with typing crew
    for (let i = 0; i < 4; i++) {
      const x = x0 + 3 + i * 3.1, z = -5.4 + Math.abs(i - 1.5) * 0.5;
      if (LOW() && i % 2) { k.add(box(2.4, 1.1, 1.3), '#4a4466', { p: [x, b.F + 0.55, z], m: 'metal' }); continue; }
      k.add(box(2.4, 1.1, 1.3), '#4a4466', { p: [x, b.F + 0.55, z], m: 'metal' }); k.add(box(2, 0.1, 0.9), b.accent, { p: [x, b.F + 1.16, z], r: [-0.35, 0, 0], m: 'glow', k: 1.8 });
      const c = alien(g, x, b.F, z + 1.3, Math.PI, 0.82); anim((dt, t) => { c.rotation.x = Math.sin(t * 9 + i) * 0.04; c.position.y = b.F + Math.abs(Math.sin(t * 7 + i * 2)) * 0.05; });
    }
    // the captain: Zix in a swivel chair, turning between the map and the crew
    k.add(cyl(0.9, 1.1, 0.4, 12), DARK, { p: [x0 + 8, b.F + 0.2, -1.8], m: 'metal' });
    const chair = new THREE.Group(); chair.position.set(x0 + 8, b.F + 0.4, -1.8); g.add(chair);
    chair.add(cachedModel('captainChair', kk => { kk.add(box(1.8, 0.4, 1.6), '#6a3fe0', { p: [0, 0.6, 0], m: 'gloss' }); kk.add(box(1.8, 2, 0.4), '#6a3fe0', { p: [0, 1.6, 0.7], m: 'gloss' }); kk.add(cyl(0.2, 0.2, 0.6, 6), STEEL, { p: [0, 0.2, 0], m: 'metal' }); }));
    put(chair, makeZix(), 0, 0.75, 0, 0.95, Math.PI);
    // hologram table: wireframe Earth with two saucers orbiting it
    k.add(cyl(1.4, 1.6, 1.2, 14), '#4a4466', { p: [x0 + 14.5, b.F + 0.6, -3.5], m: 'metal' }); k.add(cyl(1.3, 1.3, 0.1, 14), b.accent, { p: [x0 + 14.5, b.F + 1.25, -3.5], m: 'glow', k: 1.6 });
    const holo = new THREE.Mesh(track(new THREE.SphereGeometry(1.2, 16, 10)), track(new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.slime).multiplyScalar(1.6), wireframe: true, toneMapped: false }))); holo.position.set(x0 + 14.5, b.F + 3, -3.5); holo.scale.setScalar(1.4); holo.userData.noInk = true; g.add(holo);
    const minis = (LOW() ? [] : [0, 1]).map(() => { const m = miniSaucer(); m.scale.setScalar(0.18); g.add(m); return m; });
    for (let i = 0; i < 3; i++) screen(g, b.xF - 1.2 - i * 2.4, b.F + 2.2 + (i % 2) * 1.4, -D + 0.6, 2, 1.1, ['#9cff3f', '#5fe8ff', '#ff6fb5', '#ffd23f'], 1.5 + i * 0.5);
    glow(g, new THREE.RingGeometry(1.3, 1.6, 24).rotateX(-Math.PI / 2), b.accent, 1.4, x0 + 8, b.F + 0.05, -1.8);
    // radar dish on the ceiling
    const dish = put(g, cachedModel('radarDish', kk => { kk.add(cyl(0.2, 0.2, 1.2, 6), STEEL, { p: [0, -0.6, 0], m: 'metal' }); kk.add(cyl(1.2, 0.2, 0.5, 12), WHITE, { p: [0, -1.4, 0], r: [0.5, 0, 0], m: 'metal' }); }), x0 + 3, b.top - 0.3, -3.5);
    anim((dt, t) => {
      holo.rotation.y += dt * 0.8; minis.forEach((m, i) => { const a = t * (1.2 + i * 0.4) + i * 3; m.position.set(holo.position.x + Math.cos(a) * 1.8, holo.position.y + Math.sin(a * 2) * 0.4, holo.position.z + Math.sin(a) * 1.8); m.rotation.y = -a; });
      chair.rotation.y = Math.sin(t * 0.35) * 0.9; dish.rotation.y += dt * 1.2;
      dots.forEach((d, i) => { d.visible = Math.floor(t * 2 + i * 0.7) % 3 !== 0; d.scale.setScalar(1 + Math.sin(t * 6 + i) * 0.3); });
    });
  },
  research(k, b) {
    const g = b.grp, x0 = CORE;
    // specimen tubes: a cow and a human floating in light
    const tubes: [number, () => THREE.Object3D | null][] = [[x0 + 11, () => FARM_MAKERS.cow()], [x0 + 15.5, () => human(new THREE.Group(), 2, 0, 0, 0)]];
    tubes.forEach(([x, make], i) => {
      k.add(cyl(1.6, 1.7, 0.5, 16), '#4a4466', { p: [x, b.F + 0.25, -4.5], m: 'metal' }); k.add(cyl(1.6, 1.6, 0.4, 16), '#4a4466', { p: [x, b.F + 6.2, -4.5], m: 'metal' });
      glow(g, new THREE.CylinderGeometry(1.5, 1.5, 0.08, 16), '#5fe8ff', 1.6, x, b.F + 0.55, -4.5);
      const tube = new THREE.Mesh(track(new THREE.CylinderGeometry(1.5, 1.5, 5.6, 18, 1, true)), glass('#8ff4ff', 0.2)); tube.position.set(x, b.F + 3.2, -4.5); tube.userData.noInk = true; g.add(tube);
      const s = make(); if (!s) return; s.position.set(0, 0, 0); const holder = put(g, new THREE.Group(), x, b.F + 2.4, -4.5); holder.add(s); s.scale.multiplyScalar(i ? 1 : 0.8);
      anim((dt, t) => { holder.rotation.y += dt * 0.5; holder.position.y = b.F + 2.4 + Math.sin(t * 1.3 + i) * 0.35; holder.rotation.z = Math.sin(t * 0.9 + i) * 0.15; });
    });
    // DNA hologram: two glowing strands turning on a pedestal
    k.add(cyl(0.9, 1.1, 1, 12), '#4a4466', { p: [x0 + 6.5, b.F + 0.5, -2.2], m: 'metal' });
    const dna = new THREE.Group(); dna.position.set(x0 + 6.5, b.F + 1.2, -2.2); g.add(dna);
    const dg = track(new THREE.SphereGeometry(0.14, 6, 4)), dm1 = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.bubblegum).multiplyScalar(2), toneMapped: false })), dm2 = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.mint).multiplyScalar(2), toneMapped: false }));
    for (const [m, s] of [[dm1, 1], [dm2, -1]] as const) {
      const im = new THREE.InstancedMesh(dg, m, 16); im.userData.noInk = true; const mx = new THREE.Matrix4();
      for (let i = 0; i < 16; i++) { const a = i * 0.55; im.setMatrixAt(i, mx.makeTranslation(Math.cos(a) * 0.6 * s, i * 0.22, Math.sin(a) * 0.6 * s)); }
      dna.add(im);
    }
    // desks with live screens, flasks, a scanning robot arm, a scientist walking the lab
    for (const x of [x0 + 2.2, x0 + 5.2]) { k.add(box(2.6, 1, 1.4), WHITE, { p: [x, b.F + 0.5, -D + 1.2], m: 'metal' }); screen(g, x, b.F + 2, -D + 0.6, 2.2, 1.2, ['#5fe8ff', '#9cff3f', '#ff6fb5']); }
    k.add(box(4.2, 1, 1), WHITE, { p: [x0 + 2.6, b.F + 0.5, -1.6], m: 'metal' });
    const fl: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) { k.add(cyl(0.22, 0.34, 0.9, 8), [PAL.bubblegum, PAL.mint, PAL.poster, PAL.slime, PAL.violet][i], { p: [x0 + 1 + i * 0.8, b.F + 1.45, -1.6], m: 'glow', k: 1.8 }); fl.push(glow(g, new THREE.SphereGeometry(0.09, 5, 4), '#ffffff', 1.4, x0 + 1 + i * 0.8, b.F + 2, -1.6)); }
    const arm = robotArm(g, x0 + 9, b.F, -2, '#5fe8ff', 0);
    const sci = alien(g, x0 + 3, b.F, -3.6, 0, 0.85); pace(sci, x0 + 2, x0 + 9.5, b.F, -3.6, 0.35);
    let boost = 0;
    MB.cel.set('research', () => { boost = 1; dna.getWorldPosition(_tw2); _tw2.y += 1.6; FX.spark(_tw2, FXC.bubblegum, 16, 7, 0.25, 0.7, -4); FX.ring(_tw2, 3, 0.5, FXC.violet); });
    anim((dt, t) => {
      boost = Math.max(0, boost - dt * 0.6); dna.rotation.y += dt * (1.2 + boost * 12); dna.scale.setScalar(1 + boost * 0.3); arm.arm.rotation.x = -0.3 + Math.sin(t * 1.3) * 0.35; arm.base.rotation.y = Math.sin(t * 0.7) * 0.9;
      fl.forEach((f, i) => { f.position.y = b.F + 2 + ((t * 0.8 + i * 0.37) % 1) * 1.2; });
    });
  },
  hybrid(k, b) {
    const g = b.grp, x0 = CORE, n = 5, step = (b.xF - x0 - 4) / n, bubbles: { x0: number; y: number; z: number }[] = [];
    const bmat = track(new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.mint).multiplyScalar(1.8), toneMapped: false })), bgeo = track(new THREE.SphereGeometry(0.15, 6, 4));
    for (let i = 0; i < n; i++) {
      const x = x0 + 2 + step * (i + 0.5), z = -D + 2.4;
      k.add(cyl(1.3, 1.4, 0.7, 16), DARK, { p: [x, b.F + 0.35, z], m: 'metal' }); k.add(cyl(1.3, 1.3, 0.6, 16), DARK, { p: [x, b.F + 6.6, z], m: 'metal' });
      k.add(cyl(0.2, 0.2, b.top - b.F - 6.9, 6), '#4a4466', { p: [x, (b.top + b.F + 6.9) / 2, z], m: 'metal' });
      k.add(box(0.8, 0.5, 0.1), b.accent, { p: [x, b.F + 0.4, z + 1.35], m: 'glow', k: 1.8 });
      const liquid = new THREE.Mesh(track(new THREE.CylinderGeometry(1.2, 1.2, 5.6, 18)), glass('#4ff0d0', 0.3)); liquid.position.set(x, b.F + 3.5, z); liquid.userData.noInk = true; g.add(liquid);
      const clone = alien(g, x, b.F + 1.2, z, 0, 0.8), ph = i * 1.6;
      anim((dt, t) => { const grow = ((t * 0.12 + ph / 10) % 1); clone.scale.setScalar(0.35 + grow * 0.55); clone.position.y = b.F + 1.2 + Math.sin(t * 1.1 + i) * 0.15; clone.rotation.y = Math.sin(t * 0.4 + i) * 0.5; });
      for (let j = 0; j < 5; j++) bubbles.push({ x0: x + (j - 2) * 0.35, y: b.F + 1 + j * 1.1, z: z + 0.8 });
    }
    // pipes along the ceiling with glowing flow
    k.add(box(b.xC - x0 - 1, 0.6, 0.6), STEEL, { p: [(x0 + b.xC) / 2, b.top - 1.1, -D + 2.4], m: 'metal' });
    const flow = [0, 1, 2, 3].map(() => glow(g, new THREE.SphereGeometry(0.22, 6, 4), PAL.mint, 2, x0, b.top - 1.1, -D + 2.4 + 0.35));
    // newly made clones walk out of the lab, one after another, towards the elevator
    const walkers = (LOW() ? [0] : [0, 1, 2]).map(() => alien(g, x0 + 2, b.F, -2.2, -Math.PI / 2, 0.85));
    // the operator's desk
    k.add(box(3.2, 1.1, 1.3), WHITE, { p: [b.xF - 2.4, b.F + 0.55, -1.4], m: 'metal' }); screen(g, b.xF - 2.4, b.F + 2, -2.1, 2.4, 1.2, ['#4ff0d0', '#9cff3f', '#a77bff']);
    alien(g, b.xF - 2.4, b.F, -0.3, Math.PI, 0.9);
    const bub = new THREE.InstancedMesh(bgeo, bmat, bubbles.length); bub.userData.noInk = true; bub.frustumCulled = false; g.add(bub);
    const born = alien(g, b.xF - 4, b.F, -2.2, -Math.PI / 2, 0.85); born.visible = false; let bornT = -1;
    const liquids = g.children.filter(o => (o as THREE.Mesh).isMesh && ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity === 0.3) as THREE.Mesh[];
    MB.cel.set('hybrid', () => { bornT = 0; born.visible = true; born.scale.setScalar(0.01); });
    anim((dt, t) => {
      if (bornT >= 0) {   // a new clone pops out of the last vat and walks off towards the elevator
        bornT += dt; const p = Math.min(1, bornT / 4.5); born.scale.setScalar(Math.min(0.85, bornT * 2.5)); born.position.x = b.xF - 4 - p * (b.xF - 4 - CORE - 0.5); born.position.y = b.F + Math.abs(Math.sin(t * 8)) * 0.1;
        liquids.forEach(l => { (l.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.max(0, 0.4 - bornT * 0.4); }); if (p >= 1) { bornT = -1; born.visible = false; }
      }
      bubbles.forEach((m, i) => { m.y += dt * 1.6; if (m.y > b.F + 6) m.y = b.F + 0.9; bub.setMatrixAt(i, _bm.makeTranslation(m.x0 + Math.sin(t * 4 + m.y) * 0.1, m.y, m.z)); }); bub.instanceMatrix.needsUpdate = true;
      flow.forEach((f, i) => { f.position.x = x0 + 0.5 + ((t * 3 + i * 4.5) % (b.xC - x0 - 1)); });
      walkers.forEach((w, i) => { const p = ((t * 0.09 + i / 3) % 1); w.position.x = b.xF - 4 - p * (b.xF - 4 - x0 - 0.5); w.position.y = b.F + Math.abs(Math.sin(t * 8 + i)) * 0.08; w.visible = p < 0.97; });
    });
  },
  cells(k, b) {
    const g = b.grp, x0 = CORE, n = 3, cw = (b.xF - x0 - 1) / n;
    const pal = ['#ff9fb0', '#7fd6ff', '#c6f04a'];
    for (let i = 0; i < n; i++) {
      const xa = x0 + 0.5 + i * cw, xc = xa + cw / 2;
      k.add(box(0.3, b.h, D - 3), '#4a3358', { p: [xa, b.F + b.h / 2, -D / 2 - 1.5] });
      for (let x = xa + 0.4; x < xa + cw; x += 0.75) k.add(cyl(0.08, 0.08, b.h - 0.3, 5), STEEL, { p: [x, b.F + b.h / 2, -3], m: 'metal' });
      k.add(box(cw - 1.4, 0.6, 1.3), pal[i], { p: [xc, b.F + 0.5, -D + 1.5] }); k.add(box(cw - 1.4, 1.1, 0.4), pal[i], { p: [xc, b.F + 1.1, -D + 0.85] });   // couch
      k.add(box(1.4, 0.5, 2.2), '#fff6e0', { p: [xa + 1.2, b.F + 0.25, -D + 3.6] });   // a bed
      k.add(sph(0.18, 6, 4), PAL.poster, { p: [xc, b.top - 0.6, -D + 2], m: 'glow', k: 2 });
      for (let j = 0; j < (LOW() ? 1 : 2); j++) { const hm = human(g, i * 2 + j, xc + (j ? 0.9 : -0.9), b.F + 0.45, -D + 1.6, 0); if (!hm) continue; const ph = i * 2 + j; anim((dt, t) => { hm.rotation.y = Math.sin(t * 0.7 + ph) * 0.45; hm.position.y = b.F + 0.45 + Math.abs(Math.sin(t * 2 + ph)) * 0.08; }); }
    }
    // one guest paces the middle cell and rattles the bars
    const pacer = LOW() ? null : human(g, 6, x0 + 0.5 + cw * 1.5, b.F, -4.2, 0); if (pacer) pace(pacer, x0 + 0.5 + cw + 1, x0 + 0.5 + cw * 2 - 1, b.F, -4, 0.6);
    // the TV, the guard, and the pizza drone doing its rounds
    k.add(box(3, 1.8, 0.3), DARK, { p: [(x0 + b.xF) / 2, b.top - 1.8, -1.6] });
    const tv = new THREE.Mesh(track(new THREE.PlaneGeometry(2.6, 1.4)), track(new THREE.MeshBasicMaterial({ color: '#ff6fb5', toneMapped: false }))); tv.position.set((x0 + b.xF) / 2, b.top - 1.8, -1.4); tv.userData.noInk = true; g.add(tv);
    const guard = alien(g, x0 + 2, b.F, -1.2, 0, 0.95); pace(guard, x0 + 1.5, b.xF - 1.5, b.F, -1.2, 0.25, 1);
    const drone = put(g, miniSaucer(), x0 + 2, b.top - 3, -2.4, 0.7);
    const tray = put(drone, cachedModel('pizzaTray', kk => { kk.add(cyl(0.8, 0.8, 0.1, 12), STEEL, { m: 'metal' }); }), 0, -0.9, 0);
    if (hasModel('pizza')) put(tray, instance('pizza').root, 0, 0.1, 0, 1.6);
    const tvc = ['#ff6fb5', '#9cff3f', '#5fe8ff', '#ffd23f'];
    anim((dt, t) => { (tv.material as THREE.MeshBasicMaterial).color.set(tvc[Math.floor(t * 1.5) % 4]).multiplyScalar(1.5); drone.position.x = x0 + 2 + (Math.sin(t * 0.4) * 0.5 + 0.5) * (b.xF - x0 - 4); drone.rotation.y += dt * 1.5; drone.position.y = b.top - 3 + Math.sin(t * 2.2) * 0.2; });
  },
  shipyard(k, b) {
    const g = b.grp, x0 = CORE, xc = x0 + 8;
    // main bay: a finished saucer rises on the lift while two arms weld it
    k.add(cyl(3.2, 3.6, 0.6, 22), '#4a4466', { p: [xc, b.F + 0.3, -5], m: 'metal' });
    for (let i = 0; i < 12; i++) k.add(box(0.7, 0.12, 0.7), i % 2 ? '#ffd23f' : '#1a1033', { p: [xc - 3.9 + i * 0.7, b.F + 0.06, -1.3] });
    const lift = put(g, cachedModel('liftPad', kk => { kk.add(cyl(2.8, 2.8, 0.3, 22), STEEL, { m: 'metal' }); kk.add(cyl(0.6, 0.6, 3, 8), '#6a6488', { p: [0, -1.5, 0], m: 'metal' }); }), xc, b.F + 0.8, -5);
    const ship = put(g, hasModel('b_saucer') ? instance('b_saucer').root : miniSaucer(), xc, b.F + 2.2, -5, hasModel('b_saucer') ? 1.3 : 1.7);
    const arms = [robotArm(g, xc - 5.6, b.F, -5, '#ffd23f', Math.PI / 2), robotArm(g, xc + 5.6, b.F, -5, '#ffd23f', -Math.PI / 2)];
    // second bay: a saucer frame half built, a third arm welding it
    const bx = b.xF - 4;
    k.add(cyl(2.4, 2.6, 0.5, 18), '#4a4466', { p: [bx, b.F + 0.25, -6.2], m: 'metal' });
    const frame = put(g, cachedModel('saucerFrame', kk => { kk.add(new THREE.TorusGeometry(2.2, 0.16, 6, 28), STEEL, { r: [Math.PI / 2, 0, 0], m: 'metal' }); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; kk.add(box(0.14, 0.14, 2.2), '#6a6488', { p: [Math.cos(a) * 1.1, 0.4, Math.sin(a) * 1.1], r: [0.35 * Math.cos(a), -a, 0], m: 'metal' }); } kk.add(sph(0.9, 10, 6), '#8ff4ff', { p: [0, 0.6, 0], s: [1, 0.6, 1], m: 'gloss' }); }), bx, b.F + 1.6, -6.2);
    const arm3 = robotArm(g, bx - 3.8, b.F, -4, '#ff9a3c', Math.PI / 3);
    // conveyor at the back bringing parts, a crane on a rail, a rotating hazard beacon, workers
    k.add(box(b.xF - x0 - 1.5, 0.6, 1.4), '#2f2a48', { p: [(x0 + b.xF) / 2, b.F + 0.3, -D + 1], m: 'metal' });
    const parts: THREE.Object3D[] = [];
    for (let i = 0; i < (LOW() ? 2 : 5); i++) parts.push(put(g, cachedModel('shipPart' + (i % 2), kk => { if (i % 2) kk.add(cyl(0.8, 0.8, 0.4, 12), WHITE, { m: 'metal' }); else kk.add(box(1.2, 0.6, 1), STEEL, { m: 'metal' }); }), x0 + 1 + i * 4, b.F + 0.9, -D + 1));
    k.add(box(b.xC - x0 - 1, 0.4, 0.4), '#4a4466', { p: [(x0 + b.xC) / 2, b.top - 1.3, -6.5], m: 'metal' });
    const crane = put(g, cachedModel('craneHook', kk => { kk.add(box(1.2, 0.6, 1.2), '#ffd23f', { m: 'metal' }); kk.add(cyl(0.06, 0.06, 2.6, 4), '#1a1033', { p: [0, -1.6, 0] }); kk.add(box(0.8, 0.5, 0.8), WHITE, { p: [0, -3, 0], m: 'metal' }); }), xc, b.top - 1.7, -6.5);
    const beacon = put(g, cachedModel('beacon', kk => { kk.add(cyl(0.3, 0.3, 0.4, 8), '#4a4466', { m: 'metal' }); kk.add(box(0.5, 0.25, 0.12), '#ff9a3c', { p: [0.25, 0.3, 0], m: 'glow', k: 3 }); kk.add(box(0.5, 0.25, 0.12), '#ff9a3c', { p: [-0.25, 0.3, 0], m: 'glow', k: 3 }); }, false), x0 + 1.4, b.top - 0.7, -1);
    const w1 = alien(g, x0 + 2, b.F, -2.4, 0, 0.88); pace(w1, x0 + 1.5, b.xF - 2, b.F, -2.2, 0.28);
    alien(g, bx + 2.6, b.F, -3.4, -0.8, 0.88);
    let sparkT = 0, spark2 = 0, pop = 0;
    MB.cel.set('shipyard', () => { pop = 1; ship.getWorldPosition(_tw2); FX.ring(_tw2, 5, 0.6, FXC.poster); FX.spark(_tw2, FXC.poster, 24, 10, 0.3, 0.8, -8); });
    anim((dt, t) => {
      pop = Math.max(0, pop - dt * 1.4); ship.scale.setScalar((hasModel('b_saucer') ? 1.3 : 1.7) * (1 + Math.sin(pop * Math.PI * 3) * pop * 0.25));
      if (pop > 0.5) ship.rotation.y += dt * 8;
      const up = (Math.sin(t * 0.45) + 1) / 2; lift.position.y = b.F + 0.8 + up * 1.4; ship.position.y = lift.position.y + 1.4; ship.rotation.y += dt * 0.4;
      arms.forEach((a, i) => { a.arm.rotation.x = -0.25 + Math.sin(t * 2.2 + i * 2) * 0.25; a.base.rotation.y = (i ? -1 : 1) * Math.PI / 2 + Math.sin(t * 1.4 + i) * 0.35; });
      arm3.arm.rotation.x = -0.1 + Math.sin(t * 3) * 0.2; arm3.base.rotation.y = Math.PI / 3 + Math.sin(t * 0.9) * 0.4; frame.rotation.y += dt * 0.25;
      for (const p of parts) { p.position.x += dt * 1.8; if (p.position.x > b.xF - 1) p.position.x = x0 + 1; }
      crane.position.x = x0 + 2 + (Math.sin(t * 0.5) * 0.5 + 0.5) * (b.xC - x0 - 4); beacon.rotation.y += dt * 6;
      if ((sparkT -= dt) <= 0) { sparkT = 0.1; arms[Math.floor(t * 3) % 2].tip.getWorldPosition(_tw); FX.spark(_tw, FXC.poster, 5, 5, 0.18, 0.35, -10); }
      if ((spark2 -= dt) <= 0) { spark2 = 0.16; arm3.tip.getWorldPosition(_tw2); FX.spark(_tw2, FXC.fireOrange, 4, 4, 0.16, 0.3, -10); }
    });
  },
  storage(k, b) {
    const g = b.grp, x0 = CORE, cols = [PAL.rHumans, PAL.rBiomass, PAL.rMetal], rnd = mulberry32(3);
    // stacked crates and barrels in the resource colours
    for (let i = 0; i < 6; i++) for (let j = 0; j < 1 + Math.floor(rnd() * 3); j++) {
      const c = cols[i % 3], x = x0 + 6 + i * 2.5, y = b.F + 0.75 + j * 1.55, z = -D + 1.5 + (i % 2) * 1.9;
      if (x > b.xF - 1.5) continue;
      k.add(box(2.2, 1.5, 1.8), c, { p: [x, y, z], r: [0, (rnd() - 0.5) * 0.2, 0] }); k.add(box(2.3, 0.2, 1.9), '#3e3328', { p: [x, y + 0.6, z] });
    }
    for (let i = 0; i < 3; i++) k.add(cyl(0.6, 0.6, 1.4, 10), PAL.rBiomass, { p: [b.xF - 2 - i * 1.3, b.F + 0.7, -2.6], m: 'gloss' });
    // the artifact shelf (Earth snacks the Council loves)
    k.add(box(Math.min(12, b.xC - x0 - 2), 0.3, 1.2), '#7a5a3a', { p: [x0 + 1 + Math.min(12, b.xC - x0 - 2) / 2, b.top - 2.4, -D + 0.9] });
    ARTIFACTS.slice(0, LOW() ? 0 : 6).forEach((a, i) => { if (hasModel(a) && x0 + 2 + i * 2 < b.xC - 1) { const o = put(g, instance(a).root, x0 + 2 + i * 2, b.top - 2.2, -D + 0.9, 1.4); anim(dt => { o.rotation.y += dt * 0.6; }); } });
    // the teleport pad: loot beamed up from Earth materializes here, rides the belt to the stacks
    k.add(cyl(1.6, 1.8, 0.4, 18), '#4a4466', { p: [x0 + 2.4, b.F + 0.2, -3.5], m: 'metal' });
    const padGlow = glow(g, new THREE.CylinderGeometry(1.4, 1.4, 0.06, 18), PAL.slime, 2, x0 + 2.4, b.F + 0.45, -3.5);
    const beam = new THREE.Mesh(track(new THREE.CylinderGeometry(1.3, 1.3, b.h, 18, 1, true)), track(new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.slime).multiplyScalar(0.8), transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }))); beam.position.set(x0 + 2.4, b.F + b.h / 2, -3.5); beam.userData.noInk = true; g.add(beam);
    k.add(box(b.xF - x0 - 6, 0.5, 1.4), '#2f2a48', { p: [(x0 + 4.5 + b.xF - 1.5) / 2, b.F + 0.25, -3.5], m: 'metal' });
    const loot = [0, 1, 2].map(i => put(g, cachedModel('lootCrate' + i, kk => kk.add(box(1.1, 0.9, 1), cols[i], {})), x0 + 2.4, b.F + 0.9, -3.5));
    // a hover-drone carries crates up to the shelf
    const drone = put(g, miniSaucer(), x0 + 6, b.top - 3.4, -5, 0.85);
    const held = new THREE.Group(); held.add(cachedModel('heldCrate', kk => kk.add(box(1.2, 0.9, 1), PAL.rMetal, {}))); held.position.set(0, -1.6, 0); drone.add(held);
    const keeper = alien(g, x0 + 4, b.F, -1.4, 0, 0.9); pace(keeper, x0 + 4, b.xF - 3, b.F, -1.3, 0.3, 2);
    anim((dt, t) => {
      const cyc = (t * 0.25) % 1; beam.visible = cyc < 0.25; padGlow.scale.setScalar(1 + (cyc < 0.25 ? Math.sin(cyc * 40) * 0.1 : 0));
      loot.forEach((c, i) => { const p = ((t * 0.25 + i / 3) % 1); if (p < 0.2) { c.position.x = x0 + 2.4; c.scale.setScalar(Math.max(0.01, p * 5)); c.position.y = b.F + 0.9 + (0.2 - p) * 8; } else { c.scale.setScalar(1); c.position.y = b.F + 0.95; c.position.x = x0 + 2.4 + (p - 0.2) / 0.8 * (b.xF - x0 - 5); } });
      drone.position.x = x0 + 6 + (Math.sin(t * 0.45) * 0.5 + 0.5) * (b.xC - x0 - 8); drone.position.y = b.top - 3.4 + Math.sin(t * 2) * 0.3; drone.rotation.y += dt;
    });
  },
  trophy(k, b) {
    const g = b.grp, x0 = CORE, xs = [x0 + 2.6, x0 + 6.2, x0 + 9.8], tops: THREE.Object3D[] = [];
    const beamMat = track(new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false })), beamGeo = track(new THREE.ConeGeometry(1.8, b.h - 1, 16, 1, true));
    const beams: THREE.Mesh[] = [];
    for (const x of xs) { k.add(cyl(1.2, 1.4, 1, 10), WHITE, { p: [x, b.F + 0.5, -5], m: 'metal' }); k.add(cyl(1.25, 1.25, 0.12, 10), PAL.poster, { p: [x, b.F + 1.02, -5], m: 'glow', k: 1.4 }); const sp = new THREE.Mesh(beamGeo, beamMat); sp.position.set(x, b.F + 1 + (b.h - 1) / 2, -5); sp.userData.noInk = true; g.add(sp); beams.push(sp); }
    tops.push(put(g, cachedModel('trophyTorch', kk => { kk.add(cyl(0.35, 0.45, 2.2, 8), '#78c4a8', { p: [0, 1.1, 0] }); kk.add(cyl(0.6, 0.3, 0.6, 8), '#ffd23f', { p: [0, 2.4, 0], m: 'metal' }); kk.add(sph(0.5, 8, 6), PAL.poster, { p: [0, 3, 0], m: 'glow', k: 2.6 }); }), xs[0], b.F + 1, -5));
    tops.push(put(g, cachedModel('trophyEiffel', kk => { for (const s of [-1, 1]) for (const t of [-1, 1]) kk.add(box(0.2, 3.2, 0.2), '#9a7a5a', { p: [s * 0.45, 1.5, t * 0.45], r: [t * 0.12, 0, -s * 0.12], m: 'metal' }); kk.add(box(1.3, 0.2, 1.3), '#9a7a5a', { p: [0, 1.2, 0], m: 'metal' }); kk.add(cone(0.35, 1.2, 4), '#9a7a5a', { p: [0, 3.5, 0], m: 'metal' }); }), xs[1], b.F + 1, -5));
    tops.push(put(g, cachedModel('trophyPyramid', kk => { kk.add(cone(1.5, 2.2, 4), '#e0c060', { p: [0, 1.1, 0], r: [0, Math.PI / 4, 0] }); kk.add(cone(0.4, 0.6, 4), '#fff6e0', { p: [0, 2.4, 0], r: [0, Math.PI / 4, 0], m: 'gloss' }); }), xs[2], b.F + 1, -5));
    // the golden Zix statue at the far end, banners, and a guided tour
    const statue = put(g, makeZix(), b.xF - 1.8, b.F + 1.2, -6, 1.5); statue.traverse((o: any) => { if (o.isMesh && o.material?.vertexColors) { o.material = o.material.clone(); o.material.color = new THREE.Color('#ffd23f'); } });
    k.add(box(2.4, 1.2, 2.4), WHITE, { p: [b.xF - 1.8, b.F + 0.6, -6], m: 'metal' });
    for (const x of [x0 + 4.4, x0 + 8]) { k.add(box(1.6, 3, 0.1), '#6a3fe0', { p: [x, b.top - 2.4, -D + 0.3] }); k.add(sph(0.35, 8, 6), PAL.slime, { p: [x, b.top - 2.2, -D + 0.4], m: 'glow', k: 1.8 }); }
    const guide = alien(g, x0 + 2, b.F, -2, 0, 0.9), kids = (LOW() ? [] : [0, 1]).map(() => alien(g, x0 + 1, b.F, -2, 0, 0.6));
    anim((dt, t) => {
      tops.forEach(o => { o.rotation.y += dt * 0.5; }); beams.forEach((s, i) => { s.rotation.z = Math.sin(t * 0.8 + i * 2) * 0.12; });
      const s = Math.sin(t * 0.3), dir = Math.cos(t * 0.3) > 0 ? Math.PI / 2 : -Math.PI / 2, gx = x0 + 2 + (s * 0.5 + 0.5) * (b.xF - x0 - 6);
      guide.position.x = gx; guide.rotation.y = dir; kids.forEach((c, i) => { c.position.x = gx - Math.sign(Math.cos(t * 0.3)) * (1.2 + i); c.position.z = -1.6 - i * 0.6; c.rotation.y = dir; c.position.y = b.F + Math.abs(Math.sin(t * 9 + i)) * 0.1; });
    });
  },
  armory(k, b) {
    const g = b.grp, x0 = CORE;
    // weapon racks along the back wall
    for (let i = 0; i < 6; i++) { const x = x0 + 1.4 + i * 1.15; k.add(box(0.3, 3.6, 0.3), '#4a4466', { p: [x, b.F + 1.9, -D + 0.6], m: 'metal' }); k.add(cyl(0.2, 0.2, 2.8, 8), [PAL.tomato, PAL.violet, PAL.slime][i % 3], { p: [x, b.F + 2.2, -D + 1.1], m: 'glow', k: 2 }); }
    // power canisters charging one after another
    const cans: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) { k.add(cyl(0.55, 0.55, 0.3, 10), '#4a4466', { p: [x0 + 1.6 + i * 1.5, b.F + 0.15, -3.6], m: 'metal' }); cans.push(glow(g, new THREE.CylinderGeometry(0.45, 0.45, 1.4, 10), [PAL.slime, PAL.bubblegum, PAL.mint, PAL.poster][i], 1, x0 + 1.6 + i * 1.5, b.F + 1, -3.6)); }
    // the test range: an alien shoots slime bolts at a cardboard tank
    const target = put(g, cachedModel('cardTank', kk => { kk.add(box(2.4, 1.2, 0.15), '#c8a06a', { p: [0, 0.9, 0] }); kk.add(box(1.2, 0.7, 0.15), '#c8a06a', { p: [0.2, 1.8, 0] }); kk.add(box(1.4, 0.2, 0.15), '#c8a06a', { p: [1.3, 1.8, 0] }); kk.add(cyl(0.7, 0.7, 0.16, 12), PAL.tomato, { p: [0, 1, 0.1], r: [Math.PI / 2, 0, 0] }); }), b.xF - 1.4, b.F, -6.8, 1, -Math.PI / 2);
    const shooter = alien(g, x0 + 2, b.F, -5.5, Math.PI / 2, 0.9);
    const wk = makeWalker(); put(g, wk.group, b.xF - 3.6, b.F, -2.4, 0.42, -0.6);
    k.add(cyl(2.2, 2.4, 0.3, 18), '#4a4466', { p: [b.xF - 3.6, b.F + 0.15, -2.4], m: 'metal' });
    anim((dt, t) => { wk.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 1.5 + i * 2.1) * 0.08; }); wk.group.rotation.y = -0.6 + Math.sin(t * 0.4) * 0.3; });
    k.add(box(4, 1.2, 1.4), WHITE, { p: [x0 + 3, b.F + 0.6, -1.2], m: 'metal' });
    const lamps = [0, 1, 2, 3].map(i => glow(g, new THREE.SphereGeometry(0.18, 6, 4), '#ff5a4f', 2, x0 + 1.6 + i * 0.9, b.F + 1.3, -0.5));
    let shotT = 1;
    anim((dt, t) => {
      lamps.forEach((m, i) => { (m.material as THREE.MeshBasicMaterial).color.set(Math.floor(t * 3 + i) % 2 ? '#ff5a4f' : '#ffd23f').multiplyScalar(2); });
      cans.forEach((c, i) => { const on = Math.floor(t * 1.2) % 4 === i; c.scale.y = on ? 1 + Math.sin(t * 20) * 0.08 : 1; (c.material as THREE.MeshBasicMaterial).color.setScalar(1).multiply(new THREE.Color([PAL.slime, PAL.bubblegum, PAL.mint, PAL.poster][i])).multiplyScalar(on ? 2.6 : 0.9); });
      target.rotation.z *= Math.pow(0.02, dt);
      if ((shotT -= dt) <= 0) { shotT = 1.4; shooter.getWorldPosition(_tw); _tw.y += 1.6; target.getWorldPosition(_tw2); _tw2.y += 1; FX.line(_tw, _tw2, FXC.slime, 0.6, 0.15); FX.spark(_tw2, FXC.slime, 8, 6, 0.2, 0.4); target.rotation.z = 0.25; }
    });
  },
};

// ------------------------------------------------------------------ outside: dome, antennas, docking ring, saucers
function buildExterior(root: THREE.Group) {
  const k = new Kit();
  k.add(cyl(5, 6, 1.2, 24), HULL, { p: [0, R - 0.6, -4], m: 'metal' });
  for (const [x, z, h] of [[9, -12, 7], [-11, -9, 5], [14, -20, 4]] as const) { const y = Math.sqrt(Math.max(0, R * R - x * x - z * z)); k.add(cyl(0.25, 0.4, h, 6), STEEL, { p: [x, y + h / 2 - 0.5, z], m: 'metal' }); k.add(sph(0.5, 8, 6), PAL.tomato, { p: [x, y + h - 0.3, z], m: 'glow', k: 3 }); }
  k.add(new THREE.TorusGeometry(R + 3, 0.8, 8, 64, 6 * Q), HULL, { r: [Math.PI / 2, 0, 3 * Q], p: [0, -4, 0], m: 'metal' });
  root.add(k.build(g => G.disposables.push(g)));
  const dome = new THREE.Mesh(track(new THREE.SphereGeometry(4.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), glass()); dome.position.set(0, R, -4); dome.userData.noInk = true; root.add(dome);
  put(root, makeZix(), 0, R, -4, 1.1);
  for (let i = 0; i < (QUALITY === 'low' ? 2 : 5); i++) { const d = miniSaucer(); d.scale.setScalar(1.3); root.add(d); MB.orbit.push({ o: d, a: i * 1.3, r: R + 9 + (i % 3) * 4, y: -10 + i * 5, s: 0.25 + (i % 2) * 0.12 }); }
}

// ------------------------------------------------------------------ tags, camera, per frame
const SHORT: Record<RoomId, string> = { bridge: 'Bridge', research: 'Research', hybrid: 'Hybrid Lab', cells: 'Guests', shipyard: 'Shipyard', storage: 'Vault', trophy: 'Trophies', armory: 'Armory', reactor: 'Reactor' };
function makeLabels() {
  let box = document.getElementById('moon-labels'); if (!box) { box = document.createElement('div'); box.id = 'moon-labels'; document.body.appendChild(box); box.addEventListener('click', onLabelClick); }
  box.innerHTML = ''; MB.labels.clear(); box.hidden = false;
  const bar = document.getElementById('moon-rooms');
  if (bar) { bar.innerHTML = ROOM_IDS.map(id => `<button class="btn small" id="rb-${id}" data-room="${id}">${SHORT[id]}</button>`).join('');
    if (!bar.dataset.wired) { bar.dataset.wired = '1'; bar.addEventListener('click', e => { const t = (e.target as HTMLElement).closest('button') as HTMLButtonElement; if (t?.dataset.room && G.mode === 'moonbase') focusRoom(t.dataset.room as RoomId); }); } }
  for (const id of ROOM_IDS) { const el = document.createElement('button'); el.className = 'moon-label'; el.id = 'ml-' + id; el.dataset.room = id; el.innerHTML = `<b>${ROOMS[id].name}</b>`; el.title = ROOMS[id].job; box.appendChild(el); MB.labels.set(id, el); }
}
/** Outlines only where they can be seen: the room the camera is in (the shell and faces always keep theirs). */
function applyInk() {
  for (const [id, g] of MB.groups) setInk(g, MB.focus === id);
  if (MB.focus === 'reactor') { for (const id of ['hybrid', 'cells'] as RoomId[]) setInk(MB.groups.get(id), true); }
  for (const o of MB.life) setInk(o, false);
}
/** A tap on the moon opens the room under the finger (the reactor shaft too). */
function onPick(e: PointerEvent) {
  if (G.mode !== 'moonbase' || !MB.down || Math.hypot(e.clientX - MB.down.x, e.clientY - MB.down.y) > 8 || document.querySelector('#meta-modal:not([hidden])')) return;
  const ndc = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); MB.ray.setFromCamera(ndc, camera);
  const targets: [RoomId, THREE.Object3D][] = [...MB.groups.entries()]; if (MB.reactor) targets.push(['reactor', MB.reactor]);
  let best: RoomId | null = null, bd = Infinity;
  for (const [id, g] of targets) { const hit = MB.ray.intersectObject(g, true)[0]; if (hit && hit.distance < bd) { bd = hit.distance; best = id; } }
  if (best && best !== MB.focus) focusRoom(best);
}
function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && G.mode === 'moonbase' && MB.focus) focusRoom(null); }
function onLabelClick(e: Event) {
  const t = (e.target as HTMLElement).closest('button') as HTMLButtonElement; if (!t) return;
  if (t.dataset.room && G.mode === 'moonbase') focusRoom(t.dataset.room as RoomId);
}
/** Fly the camera into a room (or back out to the whole moon with null). */
export function focusRoom(id: RoomId | null, instant = false) {
  const v = id ? MB.views.get(id) : MB.home; if (!v) return;
  MB.focus = id; const c = MB.cam; c.dur = 1.1;
  c.from.copy(camera.position); c.lookFrom.copy(c.look); c.to.copy(v.pos); c.lookTo.copy(v.look); c.t = instant ? 1 : 0;
  if (id) {   // leave room for the panel: it sits on the right (landscape) or at the bottom (portrait)
    const dir = _tw2.copy(v.look).sub(v.pos).normalize(), right = new THREE.Vector3().crossVectors(dir, camera.up).normalize(), portrait = camera.aspect < 1;
    const off = portrait ? new THREE.Vector3(0, -10, 0) : right.multiplyScalar(8.5);
    if (portrait) c.to.addScaledVector(dir, -14 / Math.max(0.45, camera.aspect));
    c.to.add(off); c.lookTo.add(off);
  }
  $hint(!id); renderMoonPanel(); applyInk(); if (id) SFX.play('ui');
  const bar = document.getElementById('moon-rooms'); if (bar) { for (const b of bar.querySelectorAll('button')) b.classList.toggle('on', (b as HTMLElement).dataset.room === id); }
  if (instant) { camera.position.copy(v.pos); c.look.copy(v.look); camera.lookAt(c.look); }
}
export function leaveMoonBase() { const b = document.getElementById('moon-labels'); if (b) b.hidden = true; }
/** Called every frame by main.ts: the room tags only exist while the moon base is on screen. */
export function syncMoonUI() { if (G.mode !== 'moonbase') { const b = document.getElementById('moon-labels'); if (b && !b.hidden) { b.hidden = true; document.body.classList.remove('in-moon'); } } }
/** First visit: learn the base room by room (replaces the old mothership tutorial). */
export function startMoonTutorial(done: () => void, skip: () => void) {
  const s = G.save, gift = { humans: 3, biomass: 12, metal: 10 };
  for (const r of ['humans', 'biomass', 'metal'] as const) s.res[r] = Math.max(s.res[r], gift[r]);   // a starter gift so the first purchases are possible
  renderMoonPanel();
  TUT.start('Moon Base', [
    { text: 'Welcome to the <b>Moon Base</b>, Commander! The moon is our ship. Tap the <b>Hybrid Lab</b> to go inside.', highlight: 'ml-hybrid', check: () => MB.focus === 'hybrid' },
    { text: 'Spend the biomass you collected: <b>build a Gray Clone</b> for your army.', highlight: 'btn-build-clone', check: () => s.army.clone >= 1 },
    { text: 'Now visit the <b>Research Lab</b>: tap <b>Research</b> in the row of rooms.', highlight: 'rb-research', check: () => MB.focus === 'research' },
    { text: '<b>Upgrade your tractor beam</b> so it can lift heavier things.', highlight: 'btn-up-beam', check: () => s.up.beam >= 1 },
    { text: 'Good! Head <b>to Earth</b> and choose your next target.', highlight: 'btn-moon-earth', check: () => G.mode === 'globe' },
  ], done, skip);
}
const _p = new THREE.Vector3();
export function updateMoonBase(dt: number) {
  const t = G.time;
  for (const a of MB.anims) a.fn(dt, t);
  for (const s of MB.orbit) { s.a += dt * s.s; s.o.position.set(Math.cos(s.a) * s.r, s.y + Math.sin(s.a * 2) * 2, Math.sin(s.a) * s.r - 6); s.o.rotation.y = -s.a; s.o.rotation.z = 0.15; }
  const c = MB.cam;
  if (c.t < 1) { c.t = Math.min(1, c.t + dt / c.dur); const e = c.t * c.t * (3 - 2 * c.t); camera.position.lerpVectors(c.from, c.to, e); c.look.lerpVectors(c.lookFrom, c.lookTo, e); camera.lookAt(c.look); }
  const W = innerWidth, H = innerHeight;
  for (const [id, el] of MB.labels) {
    const a = MB.anchors.get(id); if (!a) continue;
    const show = !MB.focus; if (el.hidden === show) el.hidden = !show;   // inside a room the room bar takes over
    _p.copy(a).project(camera);
    let x = (_p.x * 0.5 + 0.5) * W, y = (-_p.y * 0.5 + 0.5) * H;
    if (_p.z > 1) { x = W - x; y = H - y; }   // behind the camera: mirror so it still points the right way
    el.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%, -50%)`;
  }
}
