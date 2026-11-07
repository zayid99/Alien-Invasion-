// The strategy layer: a real-world 3D Earth with regions, cities and mission sites.
// "Moonlit Toybox" look (docs/ART_STYLE.md §8): a painted toon Earth with a thick ink outline, slime "goo"
// spreading from conquered cities, toy map pins and hovering mini-saucers over the abduction sites.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { feature, mesh } from 'topojson-client';
import countriesTopo from 'world-atlas/countries-110m.json';
import { G, track } from '../game/state';
import { camera, renderer, scene, LIGHT, makeStars, fresnelMaterial, gradientSky } from '../core/engine';
import { REGIONS, CITIES, COUNTRY_REGION, regionById, cityById, TIER_NAMES } from '../data/earth';
import type { City, Region } from '../data/earth';
import { BIOMES } from '../data/biomes';
import { RES } from '../data/balance';
import type { MissionSite } from '../core/save';
import { clearWorld } from '../world/maps/common';
import { regionState, cityState, regionUnlocked, cityLevel, earthPower, armyPower, verdict, occupiedCities, cityTribute } from '../game/campaign';
import { SFX } from '../core/audio';
import { $, UI, ICON } from '../ui/dom';
import { dailyCardHTML, chapterCardHTML } from '../ui/meta';
import { today } from '../game/meta';
import { tickerLines } from '../game/news';
import { TWISTS, FINAL } from '../data/campaign';
import type { Twist } from '../data/campaign';
import { arcDeg, clamp, hashString, latLonToVec3, mulberry32 } from '../core/util';
import { toonMaterial, inkify, setRimColor } from '../gfx/toon';
import { PAL, SKY } from '../gfx/palette';
import { miniSaucer } from '../gfx/models';

const R = 10;
/** Map texture size (equirectangular). */
const W = 2048, H = 1024;
/** Slime HDR (0.9, 2.4, 0.5): occupied pin heads, site rings (blooms on the high path). */
const SLIME_HDR = new THREE.Color(0.9, 2.4, 0.5);
/** Poster HDR: the selected site ring. */
const POSTER_HDR = new THREE.Color(3.2, 2.6, 0.6);

export const globeHooks = { launchSite: (_s: MissionSite) => {}, invade: (_c: City) => {}, mothership: () => {}, ngPlus: () => {} };
type Sel = { type: 'site' | 'city' | 'region'; id: string } | null;

/** One country, pre-pathed once: a Path2D per polygon per needed wrap offset (filled separately, evenodd). */
interface Country { name: string; region: string; paths: Path2D[] }
/** A city pin: its pick proxy plus the spring state that drives its instances. */
interface Pin { city: City; obj: THREE.Object3D; proxy: THREE.Mesh; n: THREE.Vector3; q: THREE.Quaternion; base: number; s: number; v: number; occ: boolean; slot: number }
/** A mission-site marker: slime ring, sonar ping, hovering mini-saucer with a thin beam. */
interface SiteMark { obj: THREE.Group; proxy: THREE.Mesh; site: MissionSite; ring: THREE.Mesh; ping: THREE.Mesh; pingMat: THREE.MeshBasicMaterial; saucer: THREE.Object3D; beam: THREE.Mesh; s: number; v: number; phase: number }

const GL = {
  controls: null as OrbitControls, tex: null as THREE.CanvasTexture, features: null as Country[],
  /** The painted map the Earth wears (base + goo + selection); also returned by earthCanvas(). */
  canvas: null as HTMLCanvasElement,
  /** Ocean, land, hatch and borders: redrawn only when a region's lock / alert changes. */
  base: null as HTMLCanvasElement, baseKey: '',
  /** Scratch layer for the goo puddles (so overlapping puddles share one rim). */
  goo: null as HTMLCanvasElement,
  regionLines: null as Path2D, regionOutline: new Map<string, Path2D>(),
  /** Conquest spread animation: city id → start time (s). knownOcc = occupied cities already shown. */
  spread: new Map<string, number>(), knownOcc: null as Set<string> | null, spreadAcc: 0,
  pins: [] as Pin[], sites: [] as SiteMark[],
  pinMesh: null as { stick: THREE.InstancedMesh; head: THREE.InstancedMesh; goo: THREE.InstancedMesh; glint: THREE.InstancedMesh } | null,
  earth: null as THREE.Mesh, labels: new Map<string, HTMLElement>(), sel: null as Sel, down: { x: 0, y: 0 }, fly: null as { from: THREE.Vector3; to: THREE.Vector3; t: number } | null, idle: 0,
};
/** §2 land colours per biome. */
const LAND: Record<string, string> = { temperate: PAL.land, desert: PAL.landDesert, tropical: PAL.landTropical, cold: PAL.landCold };
const LOCKED_TINT = '#4a4f7a';

function regionOfCountry(name: string, lat: number, lon: number) {
  if (name in COUNTRY_REGION) return COUNTRY_REGION[name];
  let best = REGIONS[0], bd = 1e9; for (const r of REGIONS) { const d = arcDeg(lat, lon, r.lat, r.lon); if (d < bd) { bd = d; best = r; } } return best.id;
}
export function regionAt(lat: number, lon: number) {
  let best: Region = REGIONS[0], bd = 1e9; for (const r of REGIONS) { const d = arcDeg(lat, lon, r.lat, r.lon); if (d < bd) { bd = d; best = r; } } return best;
}

// ---------------------------------------------------------------------------------------------
// Map paths (built once)
// ---------------------------------------------------------------------------------------------

const lonX = (lon: number) => (lon + 180) / 360 * W, latY = (lat: number) => (90 - lat) / 180 * H;
/** Unwrap a ring / line across the antimeridian so it never jumps 360° (returns lon/lat pairs). */
function unwrap(ring: number[][]) {
  let prev = ring[0][0], acc = 0;
  return ring.map((q, i) => { const lon = q[0]; if (i) { if (lon - prev > 180) acc -= 360; else if (prev - lon > 180) acc += 360; } prev = lon; return [lon + acc, q[1]]; });
}
/** Add an unwrapped ring / line to a path at every wrap offset where it is visible. */
function addLine(p: Path2D, line: number[][], close: boolean, offsets = [-360, 0, 360]) {
  for (const off of offsets) {
    line.forEach((q, i) => { const px = lonX(q[0] + off), py = latY(q[1]); if (i) p.lineTo(px, py); else p.moveTo(px, py); });
    if (close) p.closePath();
  }
}
/** Wrap offsets at which an unwrapped ring overlaps the map. */
function offsetsFor(ring: number[][]) {
  let lo = Infinity, hi = -Infinity; for (const q of ring) { lo = Math.min(lo, q[0]); hi = Math.max(hi, q[0]); }
  return [-360, 0, 360].filter(off => hi + off >= -180 && lo + off <= 180);
}
const topo = countriesTopo as any;
/** Geometry object → region id (filled by prepareFeatures, used by the topojson mesh filters). */
const OBJ_REGION = new Map<object, string>();
function prepareFeatures() {
  if (GL.features) return;
  const fc: any = feature(topo, topo.objects.countries), geoms = topo.objects.countries.geometries;
  GL.features = fc.features.map((f: any, i: number) => {
    const polys: number[][][][] = f.geometry ? (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) : [];
    let big = polys[0]?.[0] || [[0, 0]]; for (const p of polys) if (p[0].length > big.length) big = p[0];
    const lon = big.reduce((a: number, q: number[]) => a + q[0], 0) / big.length, lat = big.reduce((a: number, q: number[]) => a + q[1], 0) / big.length;
    const region = regionOfCountry(f.properties.name, lat, lon);
    OBJ_REGION.set(geoms[i], region);
    const paths: Path2D[] = [];
    for (const poly of polys) {
      const rings = poly.map(unwrap);
      for (const off of offsetsFor(rings[0])) { const p = new Path2D(); for (const ring of rings) addLine(p, ring, true, [off]); paths.push(p); }
    }
    return { name: f.properties.name, region, paths };
  });
  // Region boundaries: shared arcs whose two neighbours belong to different regions.
  GL.regionLines = linesPath(mesh(topo, topo.objects.countries, (a: any, b: any) => a !== b && OBJ_REGION.get(a) !== OBJ_REGION.get(b)));
}
function linesPath(ml: { coordinates: number[][][] }) {
  const p = new Path2D(); for (const line of ml.coordinates) { const u = unwrap(line); addLine(p, u, false, offsetsFor(u)); } return p;
}
/** The outline of one region (coast + borders with other regions), cached. */
function regionOutline(id: string) {
  let p = GL.regionOutline.get(id);
  if (!p) {
    p = linesPath(mesh(topo, topo.objects.countries, (a: any, b: any) => (a === b ? OBJ_REGION.get(a) === id : (OBJ_REGION.get(a) === id) !== (OBJ_REGION.get(b) === id))));
    GL.regionOutline.set(id, p);
  }
  return p;
}

// ---------------------------------------------------------------------------------------------
// drawEarth (§8): base layer, goo layer, selection
// ---------------------------------------------------------------------------------------------

function mix(a: string, b: string, t: number) { const c = new THREE.Color(a).lerp(new THREE.Color(b), t); return '#' + c.getHexString(); }
const canvas2d = () => Object.assign(document.createElement('canvas'), { width: W, height: H });
let HATCH: CanvasPattern | null = null;
/** 8 px tile with 2 px diagonal ink stripes at .18 (locked regions). */
function hatch(x: CanvasRenderingContext2D) {
  if (HATCH) return HATCH;
  const t = Object.assign(document.createElement('canvas'), { width: 8, height: 8 }), c = t.getContext('2d');
  c.strokeStyle = 'rgba(26,16,51,0.18)'; c.lineWidth = 2; c.lineCap = 'square';
  for (const o of [-8, 0, 8]) { c.beginPath(); c.moveTo(o, 8); c.lineTo(o + 8, 0); c.stroke(); }
  return (HATCH = x.createPattern(t, 'repeat'));
}
/** Region state that the base layer depends on (lock + alert); the base is only repainted when it changes. */
function baseKey() { return REGIONS.map(r => (regionUnlocked(r) ? Math.round(regionState(r.id).alert / 2) : -1)).join(','); }
function drawBase() {
  const c = GL.base || (GL.base = canvas2d()), x = c.getContext('2d');
  // ocean: pole → equator → pole
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, PAL.oceanPole); g.addColorStop(0.5, PAL.ocean); g.addColorStop(1, PAL.oceanPole);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // 300 seeded wave arcs, drawn before the land
  const rnd = mulberry32(1977); x.strokeStyle = 'rgba(255,255,255,0.08)'; x.lineWidth = 2; x.lineCap = 'round';
  for (let i = 0; i < 300; i++) {
    const cx = rnd() * W, cy = H * 0.06 + rnd() * H * 0.88, r = 5 + rnd() * 8;
    x.beginPath(); x.arc(cx, cy, r, Math.PI * 1.2, Math.PI * 1.8); x.stroke();
    x.beginPath(); x.arc(cx + r * 1.18, cy, r, Math.PI * 1.2, Math.PI * 1.8); x.stroke();
  }
  // grid every 30°
  x.strokeStyle = 'rgba(255,255,255,0.07)'; x.lineWidth = 1;
  for (let lo = -180; lo <= 180; lo += 30) { x.beginPath(); x.moveTo(lonX(lo), 0); x.lineTo(lonX(lo), H); x.stroke(); }
  for (let la = -60; la <= 60; la += 30) { x.beginPath(); x.moveTo(0, latY(la)); x.lineTo(W, latY(la)); x.stroke(); }
  // coast halo under every polygon
  x.lineJoin = 'round'; x.strokeStyle = PAL.coastHalo; x.globalAlpha = 0.4; x.lineWidth = 10;
  for (const f of GL.features) for (const p of f.paths) x.stroke(p);
  x.globalAlpha = 1;
  // land: biome colour, locked = grey-violet + hatch, alert = toward tomato
  const pat = hatch(x);
  for (const f of GL.features) {
    const r = regionById(f.region); let col = f.name === 'Antarctica' ? PAL.landAntarctica : r ? LAND[r.biome] : PAL.land;
    const locked = !!r && !regionUnlocked(r);
    if (locked) col = mix(col, LOCKED_TINT, 0.55);
    else if (r) { const alert = regionState(r.id).alert; if (alert > 0) col = mix(col, PAL.tomato, Math.min(1, alert / 220)); }
    x.fillStyle = col; for (const p of f.paths) x.fill(p, 'evenodd');
    if (locked) { x.fillStyle = pat; for (const p of f.paths) x.fill(p, 'evenodd'); }
  }
  // borders: countries in ink .45 at 1.5 px, then region boundaries at 3 px, ink .8
  x.strokeStyle = 'rgba(26,16,51,0.45)'; x.lineWidth = 1.5;
  for (const f of GL.features) for (const p of f.paths) x.stroke(p);
  x.strokeStyle = 'rgba(26,16,51,0.8)'; x.lineWidth = 3; x.stroke(GL.regionLines);
}
const easeOut = (k: number) => 1 - (1 - k) ** 3;
/**
 * Occupied territory as slime goo: a radial puddle with 7 satellite blobs for a lumpy edge, one shared 3 px
 * #4fbf1a rim around the union of all puddles, and a #eaffd0 highlight dot. Newly fallen cities spread from 0.
 */
function drawGoo(out: CanvasRenderingContext2D, now: number, animate = true) {
  const occ = occupiedCities(); if (!occ.length) return;
  const c = GL.goo || (GL.goo = canvas2d()), x = c.getContext('2d');
  x.clearRect(0, 0, W, H);
  const blobs: { px: number; py: number; rad: number; sat: [number, number, number][] }[] = [];
  for (const city of occ) {
    const st = animate ? GL.spread.get(city.id) : undefined; let k = 1;
    if (st !== undefined) { k = easeOut(clamp((now - st) / 1.2, 0, 1)); if (now - st >= 1.2) GL.spread.delete(city.id); }
    const rad = (2.5 + city.size * 1.1) / 360 * W * k; if (rad < 0.5) continue;
    const rnd = mulberry32(hashString(city.id)), a0 = rnd() * Math.PI * 2, sat: [number, number, number][] = [];
    for (let i = 0; i < 7; i++) { const a = a0 + i / 7 * Math.PI * 2 + (rnd() - 0.5) * 0.5; sat.push([Math.cos(a) * rad * 0.85, Math.sin(a) * rad * 0.85, rad * 0.25 * (0.85 + rnd() * 0.3)]); }
    const px = lonX(city.lon), py = latY(city.lat);
    for (const off of [-W, 0, W]) if (px + off + rad * 1.2 > 0 && px + off - rad * 1.2 < W) blobs.push({ px: px + off, py, rad, sat });
  }
  const shape = (b: typeof blobs[0]) => { x.moveTo(b.px + b.rad, b.py); x.arc(b.px, b.py, b.rad, 0, Math.PI * 2); for (const [dx, dy, r] of b.sat) { x.moveTo(b.px + dx + r, b.py + dy); x.arc(b.px + dx, b.py + dy, r, 0, Math.PI * 2); } };
  // 1. rim: stroke every circle 6 px wide, then cut the insides away so only the outer 3 px of the union stays
  x.strokeStyle = PAL.slimeDeep; x.lineWidth = 6;
  x.beginPath(); for (const b of blobs) shape(b); x.stroke();
  x.globalCompositeOperation = 'destination-out'; x.fillStyle = '#000';
  x.beginPath(); for (const b of blobs) shape(b); x.fill('nonzero');
  x.globalCompositeOperation = 'source-over';
  // 2. puddles: slime .85 in the middle fading out toward the rim
  for (const b of blobs) {
    const rg = x.createRadialGradient(b.px, b.py, 0, b.px, b.py, b.rad * 1.25);
    rg.addColorStop(0, 'rgba(156,255,63,0.85)'); rg.addColorStop(0.6, 'rgba(156,255,63,0.55)'); rg.addColorStop(1, 'rgba(156,255,63,0)');
    x.fillStyle = rg; x.beginPath(); shape(b); x.fill('nonzero');
  }
  // 3. highlight dots
  x.fillStyle = PAL.slimeCore;
  for (const b of blobs) { x.beginPath(); x.arc(b.px - b.rad * 0.35, b.py - b.rad * 0.35, Math.max(1.2, b.rad * 0.14), 0, Math.PI * 2); x.fill(); }
  out.drawImage(c, 0, 0);
}
function selectedRegion() {
  const s = GL.sel; if (!s) return null;
  return s.type === 'region' ? s.id : s.type === 'city' ? cityById(s.id)?.region : G.save.sites.find(x => x.id === s.id)?.region ?? null;
}
/**
 * Paint the Earth map: repaint the base layer if region states changed, then goo and the selected region on top.
 * `clean` (the mothership's Earth) leaves out the selection outline and draws every puddle at full size.
 */
function drawEarth(clean = false) {
  const key = baseKey(); if (!GL.base || key !== GL.baseKey) { drawBase(); GL.baseKey = key; }
  const c = GL.canvas || (GL.canvas = canvas2d()), x = c.getContext('2d');
  x.drawImage(GL.base, 0, 0);
  drawGoo(x, performance.now() / 1000, !clean);
  const sel = clean ? null : selectedRegion();
  if (sel) {   // 9 px ink, then 5 px poster on top
    const p = regionOutline(sel); x.lineJoin = 'round'; x.lineCap = 'round';
    x.strokeStyle = PAL.ink; x.lineWidth = 9; x.stroke(p);
    x.strokeStyle = PAL.poster; x.lineWidth = 5; x.stroke(p);
  }
  if (GL.tex) GL.tex.needsUpdate = true;
}
/** Delay before a fallen city's goo starts to spread (the globe is usually entered behind the closed iris). */
const SPREAD_DELAY = 0.7;
/** Cities that fell since the globe last showed them start their goo spread. */
function syncSpread() {
  const occ = new Set(occupiedCities().map(c => c.id)), now = performance.now() / 1000;
  if (GL.knownOcc) for (const id of occ) if (!GL.knownOcc.has(id)) GL.spread.set(id, now + SPREAD_DELAY);
  GL.knownOcc = occ;
}

// ---------------------------------------------------------------------------------------------
// Background: a ringed cartoon planet (shared with the mothership)
// ---------------------------------------------------------------------------------------------

/** Toon planet #ff8a5a with a poster ring, inked (no fade: it is far away). Geometry / materials tracked. */
export function makeRingPlanet(radius: number) {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(track(new THREE.SphereGeometry(radius, 28, 16)), track(toonMaterial({ color: '#ff8a5a' })));
  // a flattened torus (not a flat ring), so it has thickness for the ink hull
  const ringGeo = track(new THREE.TorusGeometry(radius * 1.65, radius * 0.2, 6, 56).rotateX(Math.PI / 2).scale(1, 0.25, 1));
  const ring = new THREE.Mesh(ringGeo, track(toonMaterial({ color: PAL.poster })));
  g.add(ball, ring); g.rotation.set(0.35, 0, 0.42);
  inkify(g, { fade: false });
  return g;
}

// ---------------------------------------------------------------------------------------------
// City pins (instanced: stick, head, occupied goo head, glint)
// ---------------------------------------------------------------------------------------------

const MAX_PINS = CITIES.length;
// Shared, never disposed (the instanced meshes are recreated per visit; clearWorld disposes their buffers).
let PIN_GEO: { stick: THREE.BufferGeometry; head: THREE.BufferGeometry; goo: THREE.BufferGeometry; glint: THREE.BufferGeometry; proxy: THREE.BufferGeometry } | null = null;
let PIN_MAT: { stick: THREE.Material; head: THREE.Material; goo: THREE.Material; glint: THREE.Material } | null = null;
const HEAD_Y = 0.44;
function pinParts() {
  if (!PIN_GEO) {
    const head = new THREE.SphereGeometry(0.16, 14, 10).translate(0, HEAD_Y, 0);
    // the drip hangs off the side of the head: straight underneath it would be hidden inside the stick cone
    const drip = new THREE.ConeGeometry(0.05, 0.15, 8).rotateX(Math.PI).translate(0.1, HEAD_Y - 0.17, 0);
    PIN_GEO = {
      stick: new THREE.ConeGeometry(0.09, 0.3, 10).rotateX(Math.PI).translate(0, 0.15, 0),   // inverted cone: the tip touches the ground
      head, goo: mergeGeometries([head.clone(), drip]), glint: new THREE.SphereGeometry(0.04, 8, 6),
      proxy: new THREE.SphereGeometry(0.42, 8, 6).translate(0, 0.45, 0),
    };
    PIN_MAT = {
      stick: toonMaterial({ color: PAL.violetHot }),
      head: toonMaterial({ color: 0xffffff }),   // per-instance colour: tomato (invadable) / #8a8fb0 (locked)
      goo: new THREE.MeshBasicMaterial({ color: SLIME_HDR, toneMapped: false }),
      glint: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    };
  }
  return { geo: PIN_GEO, mat: PIN_MAT };
}
function buildPins() {
  const { geo, mat } = pinParts();
  const inst = (g: THREE.BufferGeometry, m: THREE.Material) => { const im = new THREE.InstancedMesh(g, m, MAX_PINS); im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); G.world.add(im); return im; };
  const pm = GL.pinMesh = { stick: inst(geo.stick, mat.stick), head: inst(geo.head, mat.head), goo: inst(geo.goo, mat.goo), glint: inst(geo.glint, mat.glint) };
  for (let i = 0; i < MAX_PINS; i++) pm.head.setColorAt(i, _c.set(PAL.tomato));   // creates instanceColor up front (no recompile later)
  inkify(pm.stick); inkify(pm.head);   // the glow head, drip and glint are never inked
  GL.pins = CITIES.map(city => {
    const g = new THREE.Group(), proxy = new THREE.Mesh(geo.proxy); proxy.visible = false; g.add(proxy);
    const base = 0.75 + city.size * 0.12; g.scale.setScalar(base); placeOnSurface(g, city.lat, city.lon); G.world.add(g);
    return { city, obj: g, proxy, n: latLonToVec3(city.lat, city.lon, 1), q: g.quaternion.clone(), base, s: 1, v: 0, occ: false, slot: 0 };
  });
  colorPins();
}
const _c = new THREE.Color();
const PIN_LOCKED = '#8a8fb0';
/** Sort pins into the toon-head and goo-head instance sets; colour the toon heads (tomato / locked / selected poster). */
function colorPins() {
  const pm = GL.pinMesh; if (!pm) return;
  let h = 0, o = 0;
  for (const p of GL.pins) {
    p.occ = cityState(p.city.id).occupied;
    if (p.occ) p.slot = o++;
    else {
      const sel = GL.sel?.type === 'city' && GL.sel.id === p.city.id;
      p.slot = h++; pm.head.setColorAt(p.slot, _c.set(sel ? PAL.poster : regionUnlocked(regionById(p.city.region)) ? PAL.tomato : PIN_LOCKED));
    }
  }
  pm.head.count = h; pm.goo.count = o;
  if (pm.head.instanceColor) pm.head.instanceColor.needsUpdate = true;
}
const _m = new THREE.Matrix4(), _pos = new THREE.Vector3(), _scl = new THREE.Vector3(), _gp = new THREE.Vector3(), _q0 = new THREE.Quaternion();
const _right = new THREE.Vector3(), _up = new THREE.Vector3(), _back = new THREE.Vector3();
/** Spring the selected pin to 1.35 with overshoot (k 180, damping 12) and bounce it at 1.5 Hz; glints face the camera. */
function updatePins(dt: number, t: number) {
  const pm = GL.pinMesh; if (!pm) return;
  camera.matrixWorld.extractBasis(_right, _up, _back);
  const glint = _gp.copy(_up).sub(_right).multiplyScalar(0.62).addScaledVector(_back, 0.55);   // upper-left, toward the viewer
  for (let i = 0; i < GL.pins.length; i++) {
    const p = GL.pins[i], sel = GL.sel?.type === 'city' && GL.sel.id === p.city.id;
    p.v += ((sel ? 1.35 : 1) - p.s) * 180 * dt - p.v * 12 * dt; p.s += p.v * dt;
    const sc = p.base * p.s, lift = sel ? 0.08 * (0.5 - 0.5 * Math.cos(t * 1.5 * Math.PI * 2)) * p.base : 0;
    _pos.copy(p.n).multiplyScalar(R + lift); _m.compose(_pos, p.q, _scl.set(sc, sc, sc));
    pm.stick.setMatrixAt(i, _m); (p.occ ? pm.goo : pm.head).setMatrixAt(p.slot, _m);
    _pos.addScaledVector(p.n, HEAD_Y * sc).addScaledVector(glint, 0.16 * sc);
    pm.glint.setMatrixAt(i, _m.compose(_pos, _q0, _scl));
  }
  pm.stick.instanceMatrix.needsUpdate = pm.head.instanceMatrix.needsUpdate = pm.goo.instanceMatrix.needsUpdate = pm.glint.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------------------------------------
// Mission sites
// ---------------------------------------------------------------------------------------------

let SITE_PARTS: { ring: THREE.BufferGeometry; beam: THREE.BufferGeometry; proxy: THREE.BufferGeometry; ringMat: THREE.MeshBasicMaterial; ringSel: THREE.MeshBasicMaterial; beamMat: THREE.MeshBasicMaterial } | null = null;
function siteParts() {
  return SITE_PARTS ??= {
    ring: new THREE.TorusGeometry(0.32, 0.06, 6, 28).rotateX(Math.PI / 2),
    beam: new THREE.CylinderGeometry(0.025, 0.12, 0.5, 12, 1, true).translate(0, 0.25, 0),
    proxy: new THREE.SphereGeometry(0.5, 8, 6),
    ringMat: new THREE.MeshBasicMaterial({ color: SLIME_HDR, toneMapped: false }),
    ringSel: new THREE.MeshBasicMaterial({ color: POSTER_HDR, toneMapped: false }),
    beamMat: new THREE.MeshBasicMaterial({ color: SLIME_HDR.clone().multiplyScalar(0.6), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
  };
}
function buildSites() {
  for (const s of GL.sites) { G.world.remove(s.obj); s.pingMat.dispose(); }
  const P = siteParts();
  GL.sites = G.save.sites.slice(0, 6).map((site, i) => {
    const g = new THREE.Group(), proxy = new THREE.Mesh(P.proxy); proxy.visible = false;
    const ring = new THREE.Mesh(P.ring, P.ringMat);
    // sonar ping: a second ring that grows 1 → 1.6 while fading out, on a 1.4 s loop
    const pingMat = new THREE.MeshBasicMaterial({ color: SLIME_HDR, transparent: true, depthWrite: false, toneMapped: false }), ping = new THREE.Mesh(P.ring, pingMat);
    const saucer = miniSaucer(); saucer.scale.setScalar(0.11); saucer.position.y = 0.55;   // inked by the Kit
    const beam = new THREE.Mesh(P.beam, P.beamMat); beam.renderOrder = 2;
    g.add(ring, ping, beam, saucer, proxy); placeOnSurface(g, site.lat, site.lon, 0.02); G.world.add(g);
    return { obj: g, proxy, site, ring, ping, pingMat, saucer, beam, s: 1, v: 0, phase: i * 0.37 };
  });
}
function updateSites(dt: number, t: number) {
  for (const s of GL.sites) {
    const sel = GL.sel?.type === 'site' && GL.sel.id === s.site.id;
    const ph = ((t + s.phase) % 1.4) / 1.4; s.ping.scale.setScalar(1 + 0.6 * ph); s.pingMat.opacity = 1 - ph;
    s.ring.material = sel ? siteParts().ringSel : siteParts().ringMat;
    s.v += ((sel ? 1.3 : 1) - s.s) * 180 * dt - s.v * 12 * dt; s.s += s.v * dt;
    s.saucer.scale.setScalar(0.11 * s.s);
    s.saucer.position.y = 0.55 + Math.sin((t + s.phase) * Math.PI * 4) * 0.05;   // bob ±0.05 at 2 Hz
    s.saucer.rotation.y += dt * 2;
    s.beam.scale.y = Math.max(0.1, (s.saucer.position.y - 0.06 * s.s) / 0.5);
  }
}

// ---------------------------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------------------------

function placeOnSurface(obj: THREE.Object3D, lat: number, lon: number, lift = 0) {
  const n = latLonToVec3(lat, lon, 1); obj.position.copy(n).multiplyScalar(R + lift); obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
}
export function enterGlobe() {
  clearWorld(); prepareFeatures(); GL.pinMesh = null;
  // §4 globe row: banded sky, 1800 stars, globe light rig, space rim colour
  const S = SKY.space;
  scene.fog = null; scene.background = new THREE.Color(S.bottom);
  const sky = gradientSky(S.top, S.horizon, S.bottom, 700); sky.renderOrder = -10; track(sky.geometry, sky.material as THREE.Material); G.world.add(sky);
  LIGHT.hemi.color.set(0x9aa8ff); LIGHT.hemi.groundColor.set(0x1a1040); LIGHT.hemi.intensity = 0.8;
  LIGHT.moon.color.set(0xfff1dc); LIGHT.moon.intensity = 3.0; LIGHT.moon.position.set(60, 40, 80);
  setRimColor(PAL.rimSpace);
  const stars = makeStars(1800, 400, -1); track(stars.geometry, stars.material as THREE.Material); G.world.add(stars);
  const planet = makeRingPlanet(9); planet.position.set(-140, 60, -220); G.world.add(planet);
  // Earth: toon map (4 hard day/night bands), ink 3.5 px without fade, stepped cartoon atmosphere
  syncSpread(); drawEarth();
  GL.tex = track(new THREE.CanvasTexture(GL.canvas)); GL.tex.colorSpace = THREE.SRGBColorSpace; GL.tex.anisotropy = 8;
  GL.earth = new THREE.Mesh(track(new THREE.SphereGeometry(R, 128, 64)), track(toonMaterial({ map: GL.tex })));
  inkify(GL.earth, { px: 3.5, fade: false }); G.world.add(GL.earth);
  const atmo = new THREE.Mesh(track(new THREE.SphereGeometry(R * 1.05, 64, 32)), track(fresnelMaterial(0x6fe0ff, 2.6, 0.9, 2, 0.2))); G.world.add(atmo);
  buildPins(); buildSites();
  if (!GL.controls) {
    GL.controls = new OrbitControls(camera, renderer.domElement);
    Object.assign(GL.controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, minDistance: 15, maxDistance: 48, rotateSpeed: 0.55, zoomSpeed: 0.7 });
    renderer.domElement.addEventListener('pointerdown', e => { GL.down = { x: e.clientX, y: e.clientY }; GL.idle = 0; GL.fly = null; });
    renderer.domElement.addEventListener('pointerup', e => { if (G.mode === 'globe' && Math.hypot(e.clientX - GL.down.x, e.clientY - GL.down.y) < 7) pick(e.clientX, e.clientY); });
    $('g-panel').addEventListener('click', onPanelClick);
  }
  GL.controls.enabled = true; GL.controls.target.set(0, 0, 0);
  const focus = GL.sel?.type === 'city' ? cityById(GL.sel.id) : { lat: 36, lon: -96 };
  camera.position.copy(latLonToVec3(focus.lat, focus.lon, 30)); camera.lookAt(0, 0, 0);
  makeLabels(); UI.globe(true); renderPanel(); renderTop(); renderNews();
}
export function leaveGlobe() { if (GL.controls) GL.controls.enabled = false; UI.globe(false); for (const el of GL.labels.values()) el.style.opacity = '0'; }
function makeLabels() {
  const box = $('g-labels'); if (GL.labels.size) return;
  for (const c of CITIES) { const el = document.createElement('div'); el.className = 'g-label'; el.textContent = c.name; box.appendChild(el); GL.labels.set(c.id, el); }
}
function flyTo(lat: number, lon: number) { GL.fly = { from: camera.position.clone(), to: latLonToVec3(lat, lon, clamp(camera.position.length(), 22, 34)), t: 0 }; }
function pick(cx: number, cy: number) {
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const earthHit = ray.intersectObject(GL.earth)[0], limit = earthHit ? earthHit.distance + 0.4 : 1e9;   // nearest hit = the front face
  const siteHit = ray.intersectObjects(GL.sites.map(s => s.proxy))[0], pinHit = ray.intersectObjects(GL.pins.map(p => p.proxy))[0];
  if (siteHit && siteHit.distance < limit) { select({ type: 'site', id: GL.sites.find(s => s.proxy === siteHit.object).site.id }); return; }
  if (pinHit && pinHit.distance < limit) { select({ type: 'city', id: GL.pins.find(p => p.proxy === pinHit.object).city.id }); return; }
  if (earthHit) { const p = earthHit.point.clone().normalize(), lat = Math.asin(p.y) * 180 / Math.PI, lon = Math.atan2(-p.z, p.x) * 180 / Math.PI; select({ type: 'region', id: regionAt(lat, lon).id }); return; }
  select(null);
}
export function select(s: Sel, fly = false) {
  GL.sel = s; SFX.play('ui'); drawEarth(); colorPins(); renderPanel();
  if (fly && s) { const o = s.type === 'site' ? G.save.sites.find(x => x.id === s.id) : s.type === 'city' ? cityById(s.id) : regionById(s.id); if (o) flyTo(o.lat, o.lon); }
}

// ---------------------------------------------------------------------------------------------
// DOM: top bar and side panel (§7 "Globe side panel", contract C7)
// ---------------------------------------------------------------------------------------------

const walletSeen = new Map<string, number>();
/** Resource chips (§7): built once per wallet, numbers in fixed-width .num slots, a pop + "+N" on gains. */
export function renderWallet(id: string) {
  const box = $(id); if (!box) return;
  if (box.dataset.chips !== '1') {
    box.innerHTML = RES.map(r => `<span class="chip ${r}" title="${r}">${ICON(r)}<span class="num"></span></span>`).join(''); box.dataset.chips = '1';
  }
  for (const r of RES) {
    const chip = box.querySelector(`.chip.${r}`) as HTMLElement, num = chip?.querySelector('.num') as HTMLElement; if (!num) continue;
    const v = Math.floor(G.save.res[r]), n = String(v), k = id + r, old = walletSeen.get(k);
    if (num.textContent !== n) { num.textContent = n; num.style.setProperty('--n', String(Math.max(2, n.length))); }
    if (old !== undefined && v > old) UI.popChip(chip, v - old);
    walletSeen.set(k, v);
  }
}
function renderTop() {
  const s = G.save;
  UI.set('g-day', 'text', `Day ${s.day} · ${TIER_NAMES[s.tierUnlocked]} unlocked`);
  const aw = s.awareness.toFixed(0);
  UI.set('g-aware', 'html', `<span>Aware</span><div class="bar"><i style="width:${aw}%"></i></div><b class="val num" style="--n:4">${aw}%</b>`);
  const occ = occupiedCities().length;
  UI.set('g-conq', 'html', `<span>Cities</span><div class="bar"><i style="width:${(occ / CITIES.length * 100).toFixed(1)}%"></i></div><b class="val num" style="--n:5">${occ}/${CITIES.length}</b>`);
  renderWallet('g-wallet');
}
/** Inline SVG glyphs for the row badges: saucer (abduction site), pin (invadable city), flag (occupied). */
const svg = (d: string) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${d}</svg>`;
const GLYPH = {
  abduct: svg('<path d="M7.5 10.5a4.5 4.5 0 0 1 9 0z"/><path d="M12 11.2c6 0 10.5 1.7 10.5 3.6S18 18.6 12 18.6 1.5 16.8 1.5 14.8 6 11.2 12 11.2z"/>'),
  invade: svg('<path fill-rule="evenodd" d="M12 1.8a7.2 7.2 0 0 0-7.2 7.2c0 5.2 7.2 13.2 7.2 13.2s7.2-8 7.2-13.2A7.2 7.2 0 0 0 12 1.8zm0 4.4a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6z"/>'),
  occ: svg('<path d="M5 2.5h2.2v19H5z"/><path d="M8 3.5c3.5-1.6 6 1.6 11 0v9c-5 1.6-7.5-1.6-11 0z"/>'),
};
const badge = (k: keyof typeof GLYPH) => `<span class="badge ${k}">${GLYPH[k]}</span>`;
const siteRow = (s: MissionSite) => `<button class="g-site${s.daily ? ' daily' : ''}" data-site="${s.id}">${badge('abduct')}<span><b>${s.name}</b><small>${regionById(s.region).name} · ${BIOMES[regionById(s.region).biome].name} · threat ${s.level}</small></span>${s.daily ? '<span class="tag twist" title="Daily challenge">Today</span>' : s.twist ? `<span class="tag twist" title="${TWISTS[s.twist].blurb}">★</span>` : `<span class="tag dur" title="Days left">${s.expires - G.save.day + 1}d</span>`}</button>`;
const twistGoal = (t: Twist) => t.goal.kind === 'alert' ? 'End the night with alert 1 or lower' : `Abduct ${t.goal.n} ${t.goal.label}`;
const bonusTxt = (c: Record<string, number>) => Object.entries(c).filter(([, v]) => v).map(([k, v]) => `+${v} ${k}`).join(', ');
function cityRow(c: City) {
  const L = cityLevel(c), them = earthPower(L), v = verdict(armyPower(), them);
  return `<button class="g-site" data-city="${c.id}">${badge('invade')}<span><b>${c.name}</b><small>${c.country} · defense ${L}</small></span><span class="tag def" title="Earth power · ${v.text}">${them}</span></button>`;
}
const resBar = (v: number) => `<span class="resbar" title="Resistance ${Math.round(v)}%"><i style="width:${Math.round(v)}%"></i></span>`;
const occRow = (c: City) => { const st = cityState(c.id); return `<button class="g-site" data-city="${c.id}">${badge('occ')}<span><b>${c.name}</b><small>Conquered · resistance ${resBar(st.res || 0)}</small></span>${st.revolt ? '<span class="tag hot">Revolt</span>' : '<span></span>'}</button>`; };
export function renderPanel() {
  const s = G.save, sel = GL.sel; let h = '';
  if (!sel) {
    const targets = CITIES.filter(c => regionUnlocked(regionById(c.region)) && !cityState(c.id).occupied).sort((a, b) => cityLevel(a) - cityLevel(b)).slice(0, 4);
    h = `<div><div class="eyebrow">Day ${s.day}</div><h3>Choose a target</h3><p class="sub">Slime rings with a saucer are abduction sites. Red pins are cities you can invade.</p></div>
      ${chapterCardHTML()}
      ${dailyCardHTML()}
      <div class="g-list">${s.sites.map(siteRow).join('') || '<p class="sub">No sites right now.</p>'}</div>
      ${s.challenge?.date === today() ? `<p class="sub">Daily challenge done: <span class="stars s${s.challenge.stars}" style="font-size:15px">${'★'.repeat(s.challenge.stars)}${'☆'.repeat(3 - s.challenge.stars)}</span> score ${s.challenge.score}. A new one tomorrow!</p>` : ''}
      <h3 class="reach">Cities in reach</h3><div class="g-list">${targets.map(cityRow).join('')}</div>`;
  } else if (sel.type === 'site') {
    const site = s.sites.find(x => x.id === sel.id); if (!site) { GL.sel = null; return renderPanel(); }
    const r = regionById(site.region), B = BIOMES[r.biome];
    const T = site.twist ? TWISTS[site.twist] : null;
    h = `<div><div class="eyebrow">${site.daily ? 'Daily challenge' : 'Abduction site'} · ${r.name}</div><h3>${site.name}</h3><p class="sub">${T ? T.blurb : `${B.name} at night. Farms, a small town and an army base nearby.`}</p></div>
      ${T ? `<div class="twist-card"><b>Goal:</b> ${twistGoal(T)}<br><b>Bonus:</b> ${bonusTxt(T.bonus as Record<string, number>)}${site.daily ? '<br><small>One try today. Your score and stars are kept as today\'s best.</small>' : ''}</div>` : ''}
      <dl class="kv"><dt>Threat level</dt><dd>${site.level}</dd><dt>Regional alert</dt><dd>${Math.round(regionState(r.id).alert)}%</dd><dt>Animals here</dt><dd>${[...new Set(B.farm)].join(', ')}</dd>${site.daily ? '' : `<dt>Site expires</dt><dd>${site.expires - s.day + 1} day(s)</dd>`}<dt>Best night score</dt><dd>${s.best.nightScore}</dd></dl>
      <div class="row"><button class="btn" data-act="back">Back</button><button class="btn slime" data-act="launch" id="btn-launch-site">Launch night</button></div>`;
  } else if (sel.type === 'city') {
    const c = cityById(sel.id), st = cityState(c.id), r = regionById(c.region), open = regionUnlocked(r), L = cityLevel(c), us = armyPower(), them = earthPower(L), v = verdict(us, them);
    h = `<div><div class="eyebrow">${c.country} · ${r.name}</div><h3>${c.name}</h3>
      <p class="sub">${st.occupied ? `Under Gray Empire control since day ${st.since}. Pays tribute every day.` : open ? 'Defended by Earth\'s army: shield pylons, an HQ, tanks and soldiers.' : `Locked. Unlocks with ${TIER_NAMES[r.tier]}.`}</p></div>
      ${st.occupied ? `<p>${st.revolt ? '<span class="tag hot">Revolt! No tribute</span>' : '<span class="tag ok">Conquered</span>'}</p>
        <dl class="kv"><dt>Resistance</dt><dd>${Math.round(st.res || 0)}% ${resBar(st.res || 0)}</dd><dt>Garrison</dt><dd>${st.garrison || 0} units</dd><dt>Tribute today</dt><dd>${(() => { const t = cityTribute(c); return RES.filter(r => t[r]).map(r => `${t[r]} ${r}`).join(', ') || 'none'; })()}</dd></dl>
        <p class="sub">${st.revolt ? `Run an abduction night in ${r.name} to restore order.` : `Resistance grows every day. A night in ${r.name} calms it.`}</p>` : `<dl class="kv"><dt>City size</dt><dd>${'★'.repeat(c.size)}</dd><dt>Defense level</dt><dd>${L}</dd><dt>Earth power</dt><dd>${them}</dd><dt>Your army</dt><dd>${us}</dd>${st.attempts ? `<dt>Failed attempts</dt><dd>${st.attempts}</dd>` : ''}</dl>
      <p><span class="tag ${v.cls}">${v.text}</span></p>`}
      <div class="row"><button class="btn" data-act="back">Back</button>${!st.occupied && open ? `<button class="btn" data-act="ms">Moon Base</button><button class="btn primary" data-act="invade" id="btn-invade-city">Invade</button>` : ''}</div>`;
  } else {
    const r = regionById(sel.id), open = regionUnlocked(r), cities = CITIES.filter(c => c.region === r.id), sites = s.sites.filter(x => x.region === r.id);
    h = `<div><div class="eyebrow">${r.continent}</div><h3>${r.name}</h3><p class="sub">${BIOMES[r.biome].name} · ${open ? `regional alert ${Math.round(regionState(r.id).alert)}%` : `locked until ${TIER_NAMES[r.tier]} unlocks`}</p></div>
      ${sites.length ? `<div class="g-list">${sites.map(siteRow).join('')}</div>` : ''}
      <div class="g-list">${cities.map(c => (cityState(c.id).occupied ? occRow(c) : cityRow(c))).join('')}</div>
      <div class="row"><button class="btn" data-act="back">Back</button></div>`;
  }
  $('g-panel').innerHTML = h;
}
function onPanelClick(e: Event) {
  const t = (e.target as HTMLElement).closest('button') as HTMLButtonElement; if (!t) return;
  if (t.dataset.site) select({ type: 'site', id: t.dataset.site }, true);
  else if (t.dataset.city) select({ type: 'city', id: t.dataset.city }, true);
  else if (t.dataset.act === 'back') select(null);
  else if (t.dataset.act === 'ms') globeHooks.mothership();
  else if (t.dataset.act === 'launch') { const site = G.save.sites.find(x => x.id === GL.sel?.id); if (site) globeHooks.launchSite(site); }
  else if (t.dataset.act === 'invade') { const c = cityById(GL.sel?.id); if (c) globeHooks.invade(c); }
  else if (t.dataset.act === 'final') globeHooks.invade(FINAL.city as City);
  else if (t.dataset.act === 'ngplus') globeHooks.ngPlus();
}

// ---------------------------------------------------------------------------------------------
// Per frame
// ---------------------------------------------------------------------------------------------

const _n = new THREE.Vector3(), _p = new THREE.Vector3();
export function updateGlobe(dt: number, t: number) {
  dt = Math.min(dt, 1 / 30);   // keeps the pin / saucer springs stable after a hitch
  if (GL.fly) { GL.fly.t = Math.min(1, GL.fly.t + dt * 1.6); const k = 1 - (1 - GL.fly.t) ** 3; camera.position.copy(GL.fly.from).lerp(GL.fly.to, k).setLength(GL.fly.from.length() + (GL.fly.to.length() - GL.fly.from.length()) * k); if (GL.fly.t >= 1) GL.fly = null; }
  GL.idle += dt; GL.controls.autoRotate = GL.idle > 12 && !GL.sel; GL.controls.autoRotateSpeed = 0.25; GL.controls.update();
  // A fallen city's goo is still spreading: redraw at ~30 Hz (every redraw re-uploads the 2048×1024 map texture).
  if (GL.spread.size && (GL.spreadAcc += dt) >= 1 / 30) { GL.spreadAcc = 0; drawEarth(); }
  updatePins(dt, t); updateSites(dt, t);
  const W = innerWidth, H = innerHeight, camDir = _p.copy(camera.position).normalize(), far = camera.position.length() > 30;
  for (const c of CITIES) {
    const el = GL.labels.get(c.id); latLonToVec3(c.lat, c.lon, 1, _n);
    const facing = _n.dot(camDir), sel = GL.sel?.id === c.id, show = facing > 0.35 && (!far || c.size >= 4 || sel);
    if (!show) { if (el.style.opacity !== '0') el.style.opacity = '0'; continue; }
    _n.multiplyScalar(R + 0.9).project(camera);
    el.style.opacity = String(Math.min(1, (facing - 0.35) * 4)); el.className = 'g-label' + (cityState(c.id).occupied ? ' occ' : '') + (sel ? ' sel' : '');
    el.style.transform = `translate(${((_n.x * 0.5 + 0.5) * W).toFixed(0)}px, ${((-_n.y * 0.5 + 0.5) * H).toFixed(0)}px) translate(-50%, -100%)`;
  }
}
export function refreshGlobe() { syncSpread(); colorPins(); buildSites(); drawEarth(); renderPanel(); renderTop(); renderNews(); }
/** The Earth News ticker: recent headlines joined with stars; scroll speed scales with the text length. */
function renderNews() {
  const el = $('g-news-text'); if (!el) return;
  const text = tickerLines().join('   ★   ');
  if (el.textContent !== text) { el.textContent = text; el.style.setProperty('--news-dur', `${Math.max(25, text.length * 0.18)}s`); }
}
export function hideLabels() { for (const el of GL.labels.values()) el.style.opacity = '0'; }
/** The painted world map (also used for the Earth seen from the mothership). */
export function earthCanvas() { prepareFeatures(); drawEarth(true); return GL.canvas; }
export const globeSelection = () => GL.sel;
