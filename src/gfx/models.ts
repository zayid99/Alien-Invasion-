// Models made in code: the saucer, gray aliens, farm animals and farm/town buildings
// ("Moonlit Toybox", docs/ART_STYLE.md §5). Kit parts are toon shaded and inked automatically
// (kit.ts); the few meshes built here outside the Kit are toon materials inked with inkify().
// Colours are candy (saturated, mid value) and the toon ramp does the darkening. Earth stays matte
// (std); the Gray Empire uses gloss / metal with the hard specular glint and the rim.
import * as THREE from 'three';
import { Kit, cachedModel, box, cyl, sph, cone, ico, lathe, unitPrism, unitPyramid } from './kit';
import { fresnelMaterial } from '../core/engine';
import { chance, pick, rand, reducedMotion } from '../core/util';
import { PAL } from './palette';
import { skinById } from '../data/skins';
import type { Skin } from '../data/skins';
import { toonMaterial, inkify } from './toon';

/** §5 model colours that are not in the shared §2 palette. */
const C = {
  bulbs: [PAL.slime, PAL.bubblegum, PAL.poster, PAL.earthCyan],   // saucer running lights (chase order)
  armour: '#7a3cff',                                              // clone armour (metal)
  cow: '#fff8ee', spot: '#2a1f3f', snout: '#ff9fb0', horn: '#ffe6b0',
  wool: '#f5f0ff', pig: '#ff9fbf', pigSnout: '#ff7fa6',
  hen: '#fffaf0', comb: '#ff3b3b', beak: '#ffb020',
  hay: '#f0c64a', hayDark: '#d9a83a',
  barnDoor: '#b8302a',
  silo: '#c8d0e8', siloHoop: '#8a90b8',
  tank: '#9fd0ff', towerLegs: '#6a6f9a',
  barracks: '#7fa04a', barracksRoof: '#4f6a2c',
  mothership: '#b8bce0',
};

export type Footprint = { minX: number; maxX: number; minZ: number; maxZ: number };
export function footprint(x: number, z: number, ry: number, w: number, d: number): Footprint {
  const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)), hx = (w * c + d * s) / 2, hz = (w * s + d * c) / 2;
  return { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz };
}

// Shared scratch objects (model building is synchronous, so they are never in use twice at once).
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3(), _s = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(0, 0, 1);

/**
 * Time that stays constant for one render call of one renderer. An inked mesh is drawn twice per
 * frame (toon pass + ink hull), so per-frame animation in onBeforeRender must give both draws the same pose.
 */
const _ft = { r: null as THREE.WebGLRenderer | null, f: -1, t: 0 };
function frameTime(r: THREE.WebGLRenderer) {
  const f = r.info.render.frame;
  if (r !== _ft.r || f !== _ft.f) { _ft.r = r; _ft.f = f; _ft.t = performance.now() / 1000; }
  return _ft.t;
}

// ---------- gray aliens (§5: Zix, clones, portrait) ----------
const HEAD_PROFILE: [number, number][] = [[0.01, -0.62], [0.15, -0.58], [0.29, -0.42], [0.41, -0.12], [0.53, 0.2], [0.59, 0.5], [0.53, 0.78], [0.34, 0.95], [0.01, 1.0]];
/**
 * A gray alien head at height y, scale s (head units). Big almond eyes (#0b0620 gloss, ×1.12) each with
 * two white glow catchlights: they are what makes Zix likeable rather than creepy, so they are not optional.
 * A small smile replaces the old slit mouth. No antenna, helmet or extra eyes (§5, §10).
 */
export function addGrayHead(k: Kit, y: number, s = 1, skin: string = PAL.alienSkin) {
  k.add(lathe(HEAD_PROFILE, 14), skin, { p: [0, y, 0], s });
  for (const side of [-1, 1]) {
    const ex = 0.215 * side * s, ey = y + 0.2 * s, ez = 0.43 * s, rx = 0, ry = 0.42 * side, rz = -0.62 * side;
    const sx = 1.15 * 1.12 * s, sy = 1.5 * 1.12 * s, sz = 0.5 * 1.12 * s;
    k.add(sph(0.2, 12, 8), PAL.alienEye, { p: [ex, ey, ez], r: [rx, ry, rz], s: [sx, sy, sz], m: 'gloss' });
    // Catchlights: points on the eye ellipsoid in its own space (local +y runs along the slanted long
    // axis toward the upper-outer corner), lifted a little along the eye's forward axis so they sit on top.
    _m.compose(_v.set(ex, ey, ez), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    const fwd = _w.copy(FWD).applyQuaternion(_q);
    for (const [lx, ly, r] of [[0.1, 0.55, 0.05], [-0.15, -0.5, 0.025]]) {
      const p = _u.set(lx * side, ly, 0); p.z = Math.sqrt(Math.max(0, 1 - p.lengthSq()));
      p.multiplyScalar(0.2).applyMatrix4(_m).addScaledVector(fwd, r * s * 0.35);
      k.add(sph(r, 6, 5), '#ffffff', { p: [p.x, p.y, p.z], s, m: 'glow', k: 1.2 });
    }
  }
  // Smile: a half torus turned upside down (∪), tilted to follow the receding chin.
  k.add(new THREE.TorusGeometry(0.06, 0.012, 4, 8, Math.PI), PAL.alienMouth, { p: [0, y - 0.36 * s, 0.318 * s], r: [0.38, 0, Math.PI], s });
}
/** Gray body: skin limbs, violet clone armour with a slime trim stripe, a blaster with a slime tip. */
export function addGrayBody(k: Kit, o: { skin?: string; armour?: string; head?: number } = {}) {
  const skin = o.skin ?? PAL.alienSkin, armour = o.armour ?? C.armour, hs = o.head ?? 0.72;
  for (const sx of [-1, 1]) k.add(cyl(0.075, 0.06, 0.72), skin, { p: [0.12 * sx, 0.36, 0] });
  k.add(cyl(0.19, 0.13, 0.58, 8), skin, { p: [0, 1.0, 0] });
  k.add(cyl(0.21, 0.17, 0.32, 8), armour, { p: [0, 1.1, 0], m: 'metal' });
  k.add(cyl(0.19, 0.186, 0.05, 8), PAL.slime, { p: [0, 1.0, 0], m: 'glow', k: 1.6 });   // trim stripe
  k.add(cyl(0.05, 0.04, 0.62), skin, { p: [-0.27, 0.97, 0], r: [0, 0, 0.18] });
  k.add(cyl(0.05, 0.04, 0.62), skin, { p: [0.26, 1.0, 0.2], r: [-1.25, 0, -0.08] });
  k.add(box(0.09, 0.11, 0.38), PAL.grape700, { p: [0.27, 0.93, 0.52], m: 'metal' });
  k.add(sph(0.055, 6, 5), PAL.slime, { p: [0.27, 0.93, 0.73], m: 'glow', k: 2.8 });   // blaster tip
  k.add(cyl(0.05, 0.065, 0.2), skin, { p: [0, 1.36, 0] });
  addGrayHead(k, 1.34 + 0.62 * hs, hs, skin);   // chin always sits on the neck, whatever the head scale
}
/** A gray clone soldier (head scale 0.72). */
export const makeGrayAlien = () => cachedModel('grayAlien', k => addGrayBody(k, { head: 0.72 }));
/** Commander Zix himself (head scale 0.75): briefing and radio portrait. */
export const makeZix = () => cachedModel('zix', k => addGrayBody(k, { head: 0.75 }));

// ---------- the player's flying saucer ----------
const DOME_R = 2.3, DOME_Y = 0.88;
let ufoShared: { dome: THREE.MeshToonMaterial; glint: THREE.MeshBasicMaterial; bobble: THREE.MeshBasicMaterial; slime: THREE.Color } | null = null;
/**
 * The saucer (§5): two-tone gloss hull (#d9def0 top, #4b3a8f underside), violet metal rim, panels and
 * collar, 14 candy running lights (radius 0.3; player.ts / title.ts run the 8 Hz chase), slime emitter,
 * a toon glass dome with a camera-facing glint, Zix's head (0.75) as pilot, and an antenna with a slime bobble.
 *
 * `antenna` (C8) is a child of the spinning `body` (so it follows the body squash), pivoting at the dome top,
 * Euler order 'YXZ': rotation.x/z lean it in the body frame; setting rotation.y = -body.rotation.y instead
 * makes x/z lean in the saucer's non-spinning frame. The bobble (a glow sphere centred on its own origin,
 * the antenna's only MeshBasic child) brightens and dims at 1.5 Hz by itself.
 */
/** The saucer's hull, rim, panels and pilot in a skin's colours (data/skins.ts); cached per skin. */
function ufoHull(skin: Skin) {
  const g = cachedModel('ufo:' + skin.id, k => {
    k.add(lathe([[5.3, -0.02], [5.25, 0.17], [4.3, 0.55], [2.6, 0.93], [0.01, 1.0]], 30), skin.hull, { m: 'gloss' });
    k.add(lathe([[0.01, -1.25], [1.6, -1.18], [3.2, -0.85], [4.6, -0.36], [5.3, -0.02]], 30), skin.under, { m: 'metal' });
    k.add(new THREE.TorusGeometry(5.08, 0.26, 8, 44), skin.rim, { r: [Math.PI / 2, 0, 0], m: 'metal' });   // covers the hull seam
    k.add(cyl(1.75, 1.3, 0.28, 22), skin.collar, { p: [0, -1.32, 0], m: 'metal' });                       // emitter housing
    k.add(new THREE.TorusGeometry(2.75, 0.09, 6, 30), skin.collar, { p: [0, 0.82, 0], r: [Math.PI / 2, 0, 0], m: 'metal' });   // dome collar
    // six raised panels lying on the hull slope
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; k.add(box(0.5, 0.16, 1.2), skin.panel, { p: [Math.cos(a) * 3.6, 0.76, Math.sin(a) * 3.6], r: [0, -a, -0.22], m: 'metal' }); }
    // pattern skins: flat patches on the hull slope (cow spots, pepperoni, camo)
    if (skin.spots) for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.4, r = i % 2 ? 4.4 : 3.0, y = i % 2 ? 0.45 : 0.82;
      k.add(sph(0.62, 10, 6), skin.spots, { p: [Math.cos(a) * r, y, Math.sin(a) * r], r: [0, -a, -0.26], s: [1.1, 0.12, 0.8] }); }
    k.add(cyl(0.45, 0.6, 0.5, 10), skin.collar, { p: [0, 1.15, 0], m: 'metal' });   // pilot seat
    addGrayHead(k, 1.92, 0.75);
  });
  g.name = 'hull'; return g;
}
/** Swap a built saucer's skin in place (the hull is the body's 'hull' child). */
export function setUfoSkin(ufo: { body: THREE.Group }, id: string) {
  const old = ufo.body.getObjectByName('hull'); if (old?.userData.skin === id) return;
  const hull = ufoHull(skinById(id)); hull.userData.skin = id;
  if (old) ufo.body.remove(old);
  ufo.body.add(hull);
}
export function makeUFO() {
  const group = new THREE.Group(), body = new THREE.Group(); group.add(body);
  const S = (ufoShared ??= {
    dome: toonMaterial({ color: PAL.domeGlass, transparent: true, opacity: 0.32, depthWrite: false }),
    // transparent (opacity 1) only so the glint sorts into the transparent list, where renderOrder 4 draws it
    // after the dome (renderOrder 2); as an opaque part it would be drawn first and tinted by the glass.
    glint: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.4, 1.4), toneMapped: false, transparent: true }),
    bobble: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    slime: new THREE.Color(PAL.slime),
  });
  const hull = ufoHull(skinById('classic')); hull.userData.skin = 'classic'; body.add(hull);
  // Glass dome: transparent toon, never inked, drawn after the opaque pilot.
  const dome = new THREE.Mesh(new THREE.SphereGeometry(DOME_R, 26, 12, 0, Math.PI * 2, 0, Math.PI / 2), S.dome);
  dome.position.y = DOME_Y; dome.renderOrder = 2; body.add(dome);
  // Glass glint: a white arc + dot at the upper-left of the dome as seen by the camera (a billboard pivot at
  // the dome centre, re-oriented right before each draw). Arc 0.4π just inside the glass; the dot inside the arc.
  const glint = new THREE.Group(); glint.position.y = DOME_Y; body.add(glint);
  const orient = (_r: THREE.WebGLRenderer, _sc: THREE.Scene, cam: THREE.Camera) => {
    glint.parent.matrixWorld.decompose(_v, _q, _s);
    _q2.setFromRotationMatrix(_m.extractRotation(cam.matrixWorld));
    glint.quaternion.copy(_q.invert().multiply(_q2)); glint.updateMatrixWorld(true);
  };
  const arc = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.07, 4, 14, Math.PI * 0.4), S.glint);
  arc.rotation.z = Math.PI * 0.55; arc.renderOrder = 4; arc.onBeforeRender = orient; glint.add(arc);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), S.glint);
  dot.position.set(Math.cos(Math.PI * 0.78) * 1.62, Math.sin(Math.PI * 0.78) * 1.62, 0); dot.renderOrder = 4; dot.onBeforeRender = orient; glint.add(dot);
  // Antenna: a 0.05 × 1.1 stalk with a 0.22 slime bobble pulsing at 1.5 Hz (k 2.2–3.2, alien glow).
  const antenna = new THREE.Group(); antenna.position.y = DOME_Y + DOME_R; antenna.rotation.order = 'YXZ'; body.add(antenna);
  antenna.add(cachedModel('ufoAntenna', k => k.add(cyl(0.05, 0.05, 1.1, 6), PAL.saucerUnder, { p: [0, 0.55, 0], m: 'gloss' })));
  const bobble = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), S.bobble); bobble.position.y = 1.26; antenna.add(bobble);
  // Brightness pulse only (k 2.2 → 3.2); the size pulse and spring lag are driven by player.ts.
  // Under reduced motion it holds a steady k 2.7, like player.ts holds the bobble's size.
  if (reducedMotion) S.bobble.color.copy(S.slime).multiplyScalar(2.7);
  else bobble.onBeforeRender = r => { S.bobble.color.copy(S.slime).multiplyScalar(2.7 + 0.5 * Math.sin(frameTime(r) * 1.5 * Math.PI * 2)); };
  // Slime emitter disc under the hull (HDR, blooms).
  const emitterMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 2.4, 0.5), toneMapped: false });
  const emitter = new THREE.Mesh(new THREE.CircleGeometry(1.45, 26).rotateX(Math.PI / 2), emitterMat); emitter.position.y = -1.47; body.add(emitter);
  // 14 running-light bulbs on the rim, one material each so the chase can recolour them (glow k 3).
  const lights: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [], lgeo = new THREE.SphereGeometry(0.3, 10, 7);
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2, m = new THREE.Mesh(lgeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(C.bulbs[i % 4]).multiplyScalar(3), toneMapped: false }));
    m.position.set(Math.cos(a) * 5.38, 0.05, Math.sin(a) * 5.38); body.add(m); lights.push(m);
  }
  // Player shield: violet fresnel, power 2.0, rim quantised into 3 cartoon bands (§6).
  const shield = new THREE.Mesh(new THREE.SphereGeometry(6.6, 28, 14), fresnelMaterial(0xa77bff, 2.0, 0, 3, 0.15));
  shield.scale.set(1, 0.55, 1); group.add(shield);
  return { group, body, lights, emitterMat, shield: shield as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>, antenna: antenna as THREE.Object3D };
}
/** Small saucer (attack saucer unit, mothership drones, globe site markers) in the saucer colours. */
export const miniSaucer = () => cachedModel('miniufo', k => {
  k.add(lathe([[2.0, 0.05], [1.5, 0.3], [0.7, 0.55], [0.01, 0.6]], 18), PAL.saucerHull, { m: 'gloss' });
  k.add(lathe([[0.01, -0.5], [0.9, -0.42], [1.8, -0.1], [2.0, 0.05]], 18), PAL.saucerUnder, { m: 'metal' });
  k.add(new THREE.TorusGeometry(1.95, 0.13, 6, 24), PAL.saucerRim, { p: [0, 0.05, 0], r: [Math.PI / 2, 0, 0], m: 'metal' });
  k.add(sph(0.6, 10, 6), PAL.domeGlass, { p: [0, 0.5, 0], s: [1, 0.7, 1], m: 'gloss' });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.add(sph(0.13, 6, 5), C.bulbs[i % 4], { p: [Math.cos(a) * 2.06, 0.05, Math.sin(a) * 2.06], m: 'glow', k: 3 }); }
  k.add(cyl(0.5, 0.5, 0.06, 12), PAL.slime, { p: [0, -0.52, 0], m: 'glow', k: 2.4 });
});
/** Mega Walker: a saucer body on three legs, in Empire colours (no orange on alien things). */
export function makeWalker() {
  const group = new THREE.Group();
  const body = cachedModel('walkerBody', k => {
    k.add(lathe([[3.3, 0.2], [2.6, 1.0], [1.2, 1.6], [0.01, 1.7]], 20), PAL.saucerHull, { m: 'gloss' });
    k.add(lathe([[0.01, -1.4], [2.2, -1.2], [3.2, -0.4], [3.3, 0.2]], 20), PAL.saucerUnder, { m: 'metal' });
    k.add(sph(0.8, 12, 8), PAL.slime, { p: [0, -0.2, 3.0], m: 'glow', k: 3 });
    k.add(new THREE.TorusGeometry(3.28, 0.13, 5, 26), PAL.violet, { p: [0, 0.2, 0], r: [Math.PI / 2, 0, 0], m: 'glow', k: 2.6 });
    k.add(sph(1.3, 12, 8), PAL.domeGlass, { p: [0, 1.4, 0], s: [1, 0.6, 1], m: 'gloss' });
  });
  body.position.y = 9; group.add(body);
  const legs: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2 + Math.PI, leg = new THREE.Group(); leg.position.set(Math.sin(a) * 2.2, 8.6, Math.cos(a) * 2.2); leg.rotation.y = a;
    const inner = cachedModel('walkerLeg', k => {
      k.add(cyl(0.26, 0.18, 10.2, 6), PAL.saucerUnder, { p: [0, -5.0, 0], m: 'metal' });
      k.add(sph(0.5, 8, 6), PAL.slime, { m: 'glow', k: 2.2 });
      k.add(cone(0.7, 0.9, 6), PAL.saucerCollar, { p: [0, -10.1, 0], r: [Math.PI, 0, 0], m: 'metal' });
    });
    inner.rotation.x = -0.33; leg.add(inner); group.add(leg); legs.push(leg);
  }
  return { group, legs };
}

// ---------- farm animals (the CC0 packs have none, so they are made here; all face +z) ----------
/**
 * A googly eye (§5): white std sphere of radius r, a flattened #1a1033 pupil (0.45 r) pushed 0.01 past
 * the surface, and a white glow glint (0.3 r) on the pupil's upper-left as seen by whoever the eye looks at.
 * (dx, dy, dz) is the direction the eye looks in.
 */
function googlyEye(k: Kit, x: number, y: number, z: number, r: number, dx: number, dy: number, dz: number) {
  const d = _v.set(dx, dy, dz).normalize();
  k.add(sph(r, 10, 8), '#ffffff', { p: [x, y, z] });
  _e.setFromQuaternion(_q.setFromUnitVectors(FWD, d));
  const pd = r * 0.9 + 0.01;
  k.add(sph(r * 0.45, 8, 6), PAL.ink, { p: [x + d.x * pd, y + d.y * pd, z + d.z * pd], r: [_e.x, _e.y, _e.z], s: [1, 1, 0.45] });
  const left = _w.crossVectors(d, UP).normalize(), up = _u.crossVectors(left, d);   // the viewer's left / up
  const g = left.multiplyScalar(0.3).addScaledVector(up, 0.3).add(d).normalize(), gd = r + 0.012;
  k.add(sph(r * 0.3, 6, 5), '#ffffff', { p: [x + g.x * gd, y + g.y * gd, z + g.z * gd], m: 'glow', k: 1.2 });
}
export const makeCow = () => cachedModel('cow', k => {
  k.add(box(1.1, 1.0, 2.1), C.cow, { p: [0, 1.2, 0] });
  // spots: 0.04-thick plates on the flanks and the back
  for (const [x, y, z, w, h] of [[0.56, 1.3, 0.3, 0.6, 0.5], [-0.56, 1.1, -0.4, 0.7, 0.45], [0.56, 1.0, -0.6, 0.4, 0.35], [0, 1.71, -0.2, 0.6, 0.5]])
    k.add(box(x ? 0.04 : w, x ? h : 0.04, x ? w : 0.7), C.spot, { p: [x, y, z] });
  k.add(box(0.62, 0.6, 0.62), C.cow, { p: [0, 1.55, 1.25] });
  k.add(box(0.62, 0.36, 0.24), C.snout, { p: [0, 1.38, 1.6] });   // big pink snout, full head width
  for (const sx of [-1, 1]) {
    k.add(sph(0.045, 6, 5), C.spot, { p: [0.14 * sx, 1.42, 1.72], s: [1, 1.3, 0.5] });   // nostril
    k.add(cone(0.06, 0.25, 5), C.horn, { p: [0.24 * sx, 1.92, 1.2], r: [0, 0, -0.5 * sx] });
    k.add(box(0.22, 0.1, 0.12), C.spot, { p: [0.4 * sx, 1.72, 1.15] });
    for (const z of [-0.75, 0.75]) {
      k.add(box(0.22, 0.75, 0.22), C.cow, { p: [0.36 * sx, 0.38, z] });
      k.add(box(0.24, 0.16, 0.24), C.spot, { p: [0.36 * sx, 0.08, z] });   // hoof
    }
  }
  k.add(box(0.36, 0.16, 0.3), C.snout, { p: [0, 0.66, -0.45] });   // udder
  k.add(box(0.06, 0.7, 0.06), C.spot, { p: [0, 1.25, -1.08], r: [0.25, 0, 0] });
  googlyEye(k, -0.16, 1.72, 1.53, 0.16, 0.12, 0.1, 1); googlyEye(k, 0.16, 1.72, 1.53, 0.16, 0.05, -0.12, 1);
});
export const makeSheep = () => cachedModel('sheep', k => {
  // cloud wool: one big puff plus three smaller ones along the back
  k.add(ico(0.75, 1), C.wool, { p: [0, 1.0, 0], s: [1, 0.85, 1.25] });
  for (const [x, y, z] of [[0.05, 1.42, -0.55], [-0.28, 1.5, 0.0], [0.28, 1.45, 0.32]]) k.add(ico(0.45, 1), C.wool, { p: [x, y, z], s: [1, 0.85, 1] });
  k.add(box(0.42, 0.46, 0.5), C.spot, { p: [0, 1.18, 0.88] });
  for (const sx of [-1, 1]) { k.add(box(0.22, 0.1, 0.12), C.spot, { p: [0.27 * sx, 1.3, 0.82] }); for (const z of [-0.45, 0.45]) k.add(box(0.14, 0.6, 0.14), C.spot, { p: [0.3 * sx, 0.3, z] }); }
  googlyEye(k, -0.11, 1.28, 1.09, 0.11, 0.1, 0.08, 1); googlyEye(k, 0.11, 1.28, 1.09, 0.11, -0.06, -0.1, 1);
});
/** The pig's curly tail: a 1.5-turn helix tube. */
function curlyTail() {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 10; i++) { const u = i / 10, a = u * Math.PI * 3; pts.push(new THREE.Vector3(Math.cos(a) * 0.07, Math.sin(a) * 0.07, -0.02 - u * 0.16)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 18, 0.03, 5, false);
}
export const makePig = () => cachedModel('pig', k => {
  k.add(box(0.9, 0.8, 1.45), C.pig, { p: [0, 0.8, 0] });
  k.add(box(0.72, 0.66, 0.5), C.pig, { p: [0, 0.92, 0.9] });
  k.add(cyl(0.18, 0.18, 0.14, 10), C.pigSnout, { p: [0, 0.86, 1.2], r: [Math.PI / 2, 0, 0] });
  for (const sx of [-1, 1]) {
    k.add(sph(0.04, 6, 5), C.spot, { p: [0.07 * sx, 0.86, 1.27], s: [1, 1.3, 0.5] });   // nostril
    k.add(box(0.2, 0.2, 0.06), C.pigSnout, { p: [0.24 * sx, 1.3, 0.8], r: [0.5, 0, 0] });
    for (const z of [-0.45, 0.45]) k.add(box(0.2, 0.42, 0.2), C.pigSnout, { p: [0.28 * sx, 0.21, z] });
  }
  k.add(curlyTail(), C.pigSnout, { p: [0, 1.0, -0.72] });
  googlyEye(k, -0.18, 1.14, 1.13, 0.12, 0.1, 0.08, 1); googlyEye(k, 0.18, 1.14, 1.13, 0.12, -0.04, -0.1, 1);
});
export const makeChicken = () => cachedModel('chicken', k => {
  k.add(sph(0.32, 8, 6), C.hen, { p: [0, 0.48, 0], s: [0.9, 0.9, 1.1] });
  k.add(sph(0.22, 8, 6), C.hen, { p: [0, 0.84, 0.22] });
  k.add(box(0.06, 0.16, 0.2), C.comb, { p: [0, 1.08, 0.2] });
  k.add(cone(0.06, 0.16, 4), C.beak, { p: [0, 0.82, 0.5], r: [Math.PI / 2, 0, 0] });
  k.add(sph(0.04, 6, 5), C.comb, { p: [0, 0.72, 0.42], s: [1, 1.4, 1] });   // wattle
  for (const sx of [-1, 1]) {
    k.add(box(0.04, 0.28, 0.04), C.beak, { p: [0.1 * sx, 0.14, 0] });
    googlyEye(k, 0.121 * sx, 0.906, 0.392, 0.07, 0.35 * sx, 0.1, 1);
  }
});
export const makeHaybale = () => cachedModel('haybale', k => {
  k.add(cyl(0.85, 0.85, 1.3, 12), C.hay, { p: [0, 0.85, 0], r: [0, 0, Math.PI / 2] });
  k.add(cyl(0.6, 0.6, 1.32, 12), C.hayDark, { p: [0, 0.85, 0], r: [0, 0, Math.PI / 2] });
});
export const FARM_MAKERS: Record<string, () => THREE.Group> = { cow: makeCow, sheep: makeSheep, pig: makePig, chicken: makeChicken };

// ---------- farm + town buildings (added straight into a world Kit) ----------
// Note: these run inside seeded() map builders, so the number and order of chance/rand/pick calls must
// stay as they are, or every seeded town would be laid out differently.

/**
 * A window on a wall: an ink frame box (1.15 × 1.2 × 0.06) behind the glass, both sunk 0.01 into the wall
 * so no back face (or its ink hull) lies on the wall plane. (sx, sz) is on the wall surface, (nx, nz) its
 * outward normal. Lit glass #ffcf5c at k 1.3 (never blooms), unlit #3a3f6e.
 */
function addWindow(k: Kit, sx: number, y: number, sz: number, nx: number, nz: number, on: boolean, gw = 0.9, gh = 0.95) {
  const ry = nx ? Math.PI / 2 : 0;
  k.add(box(gw + 0.25, gh + 0.25, 0.06), PAL.ink, { p: [sx + nx * 0.02, y, sz + nz * 0.02], r: [0, ry, 0] });
  k.add(box(gw, gh, 0.08), on ? PAL.windowLit : PAL.windowDark, { p: [sx + nx * 0.035, y, sz + nz * 0.035], r: [0, ry, 0], m: on ? 'glow' : 'std', k: on ? 1.3 : 1 });
}
function windowsAround(k: Kit, w: number, d: number, y: number, lit = 0.6) {
  for (const sx of [-1, 1]) {
    addWindow(k, sx * w * 0.27, y, d / 2, 0, 1, chance(lit)); addWindow(k, sx * w * 0.27, y, -d / 2, 0, -1, chance(lit));
    addWindow(k, w / 2, y, sx * d * 0.22, 1, 0, chance(lit)); addWindow(k, -w / 2, y, sx * d * 0.22, -1, 0, chance(lit));
  }
}
/** A house: pastel walls, candy roof (overhang 1.2), framed windows, a brown door with a yellow knob, chimney. */
export function addHouse(k: Kit, x: number, z: number, ry: number, walls: string[], roofs: string[], o: { w?: number; d?: number; lit?: number } = {}) {
  const w = o.w || rand(6, 8), d = o.d || rand(5.5, 7), h = rand(3.2, 4);
  k.at(x, 0, z, ry);
  k.add(box(w, h, d), pick(walls), { p: [0, h / 2, 0] });
  k.add(unitPyramid(), pick(roofs), { p: [0, h, 0], s: [w * 1.2, rand(2, 2.8), d * 1.2] });
  k.add(box(1.1, 2.0, 0.12), PAL.door, { p: [0, 1.0, d / 2 + 0.05] });
  k.add(sph(0.12, 8, 6), PAL.poster, { p: [0.32, 1.0, d / 2 + 0.15] });                        // door knob
  k.add(box(0.15, 0.15, 0.06), PAL.windowLit, { p: [0, 2.3, d / 2 + 0.03], m: 'glow', k: 1.3 });  // porch lamp
  k.add(box(0.8, 1.6, 0.8), PAL.chimney, { p: [w * 0.28, h + 1.4, -d * 0.2] });
  windowsAround(k, w, d, h * 0.55, o.lit ?? 0.65);
  return footprint(x, z, ry, w, d);
}
/** Red barn with cream trim and a plum roof; the loft window sits on the roof gable. */
export function addBarn(k: Kit, x: number, z: number, ry: number) {
  const w = 10, d = 14, h = 6, gable = d * 1.04 / 2; k.at(x, 0, z, ry);
  k.add(box(w, h, d), PAL.barn, { p: [0, h / 2, 0] });
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.add(box(0.3, h, 0.3), PAL.barnTrim, { p: [cx * w / 2, h / 2, cz * d / 2] });   // corner trim
  k.add(unitPrism(), PAL.barnRoof, { p: [0, h, 0], s: [w * 1.12, 4, d * 1.04] });
  k.add(box(4.2, 4.6, 0.15), C.barnDoor, { p: [0, 2.3, d / 2 + 0.06] });
  for (const r of [0.83, -0.83]) k.add(box(0.25, 6.1, 0.1), PAL.barnTrim, { p: [0, 2.3, d / 2 + 0.16], r: [0, 0, r] });
  k.add(box(4.6, 0.25, 0.12), PAL.barnTrim, { p: [0, 4.65, d / 2 + 0.16] });
  addWindow(k, 0, 7.4, gable, 0, 1, true, 1.4, 1.2);
  return footprint(x, z, ry, w, d);
}
/** Gloss silo with lavender steel hoops and cap. */
export function addSilo(k: Kit, x: number, z: number) {
  k.at(x, 0, z, 0);
  k.add(cyl(2.2, 2.2, 11, 14), C.silo, { p: [0, 5.5, 0], m: 'gloss' });
  k.add(sph(2.25, 14, 7), C.siloHoop, { p: [0, 11, 0], s: [1, 0.75, 1], m: 'gloss' });
  for (let i = 1; i < 5; i++) k.add(new THREE.TorusGeometry(2.24, 0.09, 4, 20), C.siloHoop, { p: [0, i * 2.2, 0], r: [Math.PI / 2, 0, 0], m: 'metal' });
  return { minX: x - 2.4, maxX: x + 2.4, minZ: z - 2.4, maxZ: z + 2.4 };
}
/** Water tower: sky-blue tank, blue cone roof, lavender legs and catwalk, a tomato beacon (k 3, may bloom). */
export function addWaterTower(k: Kit, x: number, z: number) {
  k.at(x, 0, z, 0);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.add(cyl(0.18, 0.25, 12, 6), C.towerLegs, { p: [sx * 2.2, 6, sz * 2.2], r: [sz * 0.08, 0, -sx * 0.08] });
  k.add(new THREE.TorusGeometry(3.75, 0.1, 4, 24), C.towerLegs, { p: [0, 11.9, 0], r: [Math.PI / 2, 0, 0] });   // catwalk rail
  k.add(cyl(3.6, 3.6, 4.5, 16), C.tank, { p: [0, 14, 0] });
  k.add(cone(3.9, 1.8, 16), PAL.roofs[1], { p: [0, 17.1, 0] });
  k.add(sph(0.3, 6, 5), PAL.tomato, { p: [0, 18.2, 0], m: 'glow', k: 3 });
  return { minX: x - 2.6, maxX: x + 2.6, minZ: z - 2.6, maxZ: z + 2.6 };
}
/**
 * Earth lamp heads (#fff0b0). §2 says "street lamps k 1.3, so they do not bloom", but #fff0b0 × 1.3 has a linear
 * luminance of ~1.13, over the 0.95 bloom threshold (§4). The bloom rule wins: k 1.05 (luminance ~0.91) keeps
 * them under it, still inside "k ≤ 1.3".
 */
const LAMP_K = 1.05;
/** Street light: plum pole and arm, a cream head at 1.25× under a little cap (Earth lamps never bloom). */
export function addStreetLight(k: Kit, x: number, z: number, ry: number) {
  k.at(x, 0, z, ry);
  k.add(cyl(0.1, 0.14, 6, 6), PAL.streetPole, { p: [0, 3, 0] });
  k.add(box(0.12, 0.12, 1.6), PAL.streetPole, { p: [0, 6, 0.75] });
  k.add(box(0.75, 0.12, 1.0), PAL.streetPole, { p: [0, 6.06, 1.45] });
  k.add(box(0.625, 0.2, 0.875), PAL.streetHead, { p: [0, 5.9, 1.45], m: 'glow', k: LAMP_K });
}
export function addFence(k: Kit, x1: number, z1: number, x2: number, z2: number, color: string = PAL.fence) {
  const len = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.round(len / 4)), ry = Math.atan2(x2 - x1, z2 - z1);
  for (let i = 0; i <= n; i++) { const t = i / n; k.at(x1 + (x2 - x1) * t, 0, z1 + (z2 - z1) * t, ry); k.add(box(0.2, 1.3, 0.2), color, { p: [0, 0.65, 0] }); }
  k.at((x1 + x2) / 2, 0, (z1 + z2) / 2, ry);
  k.add(box(0.08, 0.14, len), color, { p: [0, 0.95, 0] }); k.add(box(0.08, 0.14, len), color, { p: [0, 0.5, 0] });
}
/** Toy-army barracks: green walls, dark green roof, framed windows down both long sides. */
export function addBarracks(k: Kit, x: number, z: number, ry: number) {
  const w = 8, d = 20, h = 3.6; k.at(x, 0, z, ry);
  k.add(box(w, h, d), C.barracks, { p: [0, h / 2, 0] });
  k.add(unitPrism(), C.barracksRoof, { p: [0, h, 0], s: [w * 1.1, 2, d * 1.02] });
  for (let i = -3; i <= 3; i++) for (const sx of [-1, 1]) addWindow(k, sx * w / 2, 2, i * 2.6, sx, 0, chance(0.6), 1.2, 0.8);
  return footprint(x, z, ry, w, d);
}
/** Army-base floodlight: plum pole, cream lamp (LAMP_K: Earth lamps never bloom). */
export function addFloodlight(k: Kit, x: number, z: number, ry: number) {
  k.at(x, 0, z, ry);
  k.add(cyl(0.12, 0.18, 8, 6), PAL.streetPole, { p: [0, 4, 0] });
  k.add(box(1.8, 1.0, 0.3), PAL.streetPole, { p: [0, 8.2, 0.05], r: [0.4, 0, 0] });
  k.add(box(1.6, 0.8, 0.3), PAL.streetHead, { p: [0, 8.2, 0.2], r: [0.4, 0, 0], m: 'glow', k: LAMP_K });
}

// ---------- white flag (surrender) ----------
let flagShared: { geo: THREE.BufferGeometry; mat: THREE.MeshBasicMaterial } | null = null;
/**
 * White flag (§5): cloth #ffffff glow k 1.1 on a #b07a4a pole, both inked. The cloth flutters on its own
 * (rotation.y = sin(t·4·2π)·0.25, a per-flag phase so a surrendering squad does not wave in lockstep).
 */
export function whiteFlag() {
  const g = cachedModel('whiteflagPole', k => { k.add(box(0.06, 1.5, 0.06), PAL.fence, { p: [0, 0.75, 0] }); k.add(sph(0.06, 6, 5), PAL.fence, { p: [0, 1.52, 0] }); });
  const F = (flagShared ??= { geo: new THREE.BoxGeometry(0.03, 0.55, 0.75).translate(0, 0, 0.4), mat: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 1.1, 1.1), toneMapped: false }) });
  const cloth = new THREE.Mesh(F.geo, F.mat); cloth.position.y = 1.25; g.add(cloth);
  inkify(cloth, { basic: true });   // the cloth is a glow part, but §5 wants it outlined
  if (!reducedMotion) {
    const phase = cloth.id * 1.7;
    cloth.onBeforeRender = r => { cloth.rotation.y = Math.sin(frameTime(r) * 4 * Math.PI * 2 + phase) * 0.25; cloth.updateMatrixWorld(); };
  }
  return g;
}

// ---------- the mothership (seen from orbit) ----------
/** Gloss lavender hull, violet torus, plum pods, slime / violet-hot window slits, candy orbit bulbs. Ink 2.5 px, no fade. */
export const makeMothership = () => cachedModel('mothership', k => {
  k.add(lathe([[0.01, -6], [10, -5.2], [22, -3], [34, -0.7], [36.5, 0], [34, 1.5], [20, 4.2], [8, 7], [0.01, 8]], 56), C.mothership, { m: 'gloss' });
  k.add(new THREE.TorusGeometry(41, 1.5, 8, 72), PAL.saucerCollar, { r: [Math.PI / 2, 0, 0], m: 'metal' });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.add(box(1.8, 1.1, 6), PAL.saucerUnder, { p: [Math.cos(a) * 38.5, 0, Math.sin(a) * 38.5], r: [0, Math.PI / 2 - a, 0], m: 'metal' }); }
  for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2; k.add(box(1.4, 0.55, 0.2), i % 2 ? PAL.violetHot : PAL.slime, { p: [Math.cos(a) * 34.9, 0.55, Math.sin(a) * 34.9], r: [0, Math.PI / 2 - a, 0], m: 'glow', k: 3 }); }
  const orbit = [PAL.slime, PAL.poster, PAL.bubblegum];
  for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; k.add(sph(0.55, 6, 5), orbit[i % 3], { p: [Math.cos(a) * 42.6, 0, Math.sin(a) * 42.6], m: 'glow', k: 3 }); }
  k.add(cyl(3, 5.5, 8, 14), PAL.saucerCollar, { p: [0, 11, 0], m: 'metal' });
  k.add(sph(3.4, 18, 10), PAL.violetHot, { p: [0, 15.6, 0], s: [1, 0.6, 1], m: 'glow', k: 1.6 });
  k.add(cyl(9, 9, 0.3, 36), PAL.slime, { p: [0, -6.1, 0], m: 'glow', k: 2.4 });
}, { px: 2.5, fade: false });
