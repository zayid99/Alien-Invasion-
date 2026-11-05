// Shared map pieces: clearing the world, the night sky, and the painted ground texture.
import * as THREE from 'three';
import { G, track } from '../../game/state';
import { scene, renderer, gradientSky, makeStars, LIGHT } from '../../core/engine';
import { FX, BEAM } from '../../gfx/fx';
import { PROJ } from '../combat';
import { removeEnt } from '../entity';
import { UFO } from '../player';
import { MINI } from '../../ui/hud';
import { pick, rand } from '../../core/util';
import { TOON_RAMP, setRimColor } from '../../gfx/toon';
import { PAL } from '../../gfx/palette';

export function clearWorld() {
  for (const e of G.ents) removeEnt(e);
  if (G.world) { G.world.traverse((o: any) => { if (o.isInstancedMesh) o.dispose(); }); scene.remove(G.world); }
  for (const d of G.disposables) d.dispose();
  G.disposables = []; G.ents = []; G.obstacles = []; G.entries = []; G.houses = [];
  G.world = new THREE.Group(); scene.add(G.world);
  PROJ.clear(); FX.clear(); BEAM.hide();
  LIGHT.flash.intensity = 0; LIGHT.ufo.intensity = 0;
  if (UFO) UFO.group.visible = false;
  G.player = null; G.night = null; G.inv = null; G.alert = 0;
}
export type SkyBiome = 'temperate' | 'desert' | 'tropical' | 'cold' | 'city';
/** Mission light rig per biome (§4 "Lights"): hemisphere fill, moon key, toon rim colour. */
const RIG: Record<SkyBiome, { sky: string; ground: string; hemi: number; moon: string; key: number; rim: string }> = {
  temperate: { sky: PAL.hemiSky, ground: PAL.hemiGround, hemi: 1.25, moon: PAL.moonKey, key: 3.0, rim: PAL.rimMission },
  tropical: { sky: PAL.hemiSky, ground: PAL.hemiGround, hemi: 1.25, moon: PAL.moonKey, key: 3.0, rim: PAL.rimMission },
  city: { sky: PAL.hemiSky, ground: PAL.hemiGround, hemi: 1.25, moon: PAL.moonKey, key: 3.0, rim: PAL.rimMission },
  desert: { sky: PAL.hemiSky, ground: PAL.hemiGround, hemi: 1.25, moon: '#ffe6d0', key: 3.2, rim: PAL.rimMission },
  cold: { sky: '#9fb2ff', ground: '#6f7fb8', hemi: 1.0, moon: PAL.moonKey, key: 2.4, rim: PAL.rimSnow },
};

// The cartoon moon: one shared 256 px canvas (cream disc, 3 craters, 6 px ink rim, violet halo at 1.35 r).
let MOON: { geo: THREE.PlaneGeometry; mat: THREE.MeshBasicMaterial } | null = null;
function moonParts() {
  if (MOON) return MOON;
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  const h = S / 2, r = Math.floor(h / 1.35) - 1;
  const disc = (cx: number, cy: number, rr: number, fill: string) => { x.fillStyle = fill; x.beginPath(); x.arc(cx, cy, rr, 0, Math.PI * 2); x.fill(); };
  disc(h, h, r * 1.35, 'rgba(143,125,255,0.3)');                 // halo #8f7dff at 30%
  disc(h, h, r, PAL.cream);
  for (const [dx, dy, k] of [[-0.34, -0.22, 0.22], [0.3, 0.12, 0.16], [-0.06, 0.42, 0.12]]) disc(h + dx * r, h + dy * r, k * r, '#d9d0f0');
  x.strokeStyle = PAL.ink; x.lineWidth = 6; x.beginPath(); x.arc(h, h, r - 3, 0, Math.PI * 2); x.stroke();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  // HDR colour (2.0, 2.0, 1.7), not tone mapped: the disc blooms on the high path.
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(2.0, 2.0, 1.7), transparent: true, depthWrite: false, fog: false, toneMapped: false });
  MOON = { geo: new THREE.PlaneGeometry(120, 120), mat };
  return MOON;
}
/** A camera-facing moon plane (shared geometry / material, so it is not tracked for disposal). */
function makeMoon() {
  const { geo, mat } = moonParts(), moon = new THREE.Mesh(geo, mat);
  moon.position.set(-420, 380, -560); moon.renderOrder = -1;
  moon.onBeforeRender = (_r, _s, cam) => { moon.quaternion.copy(cam.quaternion); moon.updateMatrixWorld(); };
  return moon;
}

/**
 * Night sky for missions and cities: banded gradient sky, sparkle stars, the cartoon moon, FogExp2,
 * and (with opts.biome) the §4 light rig and toon rim colour. Pass the §4 "Sky and fog" row
 * (see SKY in gfx/palette.ts): nightSky(top, horizon, fog, density, { bottom, biome }).
 */
export function nightSky(top: number, horizon: number, fog: number, density: number, opts: { bottom?: number; biome?: SkyBiome } = {}) {
  const sky = gradientSky(top, horizon, opts.bottom ?? 0x120a35, 900); track(sky.geometry, sky.material as THREE.Material); G.world.add(sky);
  const stars = makeStars(1600, 850, 0.02); track(stars.geometry, stars.material as THREE.Material); G.world.add(stars);
  G.world.add(makeMoon());
  scene.fog = new THREE.FogExp2(fog, density); scene.background = new THREE.Color(top);
  const R = RIG[opts.biome ?? 'temperate'];
  LIGHT.hemi.color.set(R.sky); LIGHT.hemi.groundColor.set(R.ground); LIGHT.hemi.intensity = R.hemi;
  LIGHT.moon.color.set(R.moon); LIGHT.moon.intensity = R.key; LIGHT.moon.position.set(-150, 170, -170);
  setRimColor(R.rim);
}
export interface Painter {
  x: CanvasRenderingContext2D; P: (v: number) => number; s: number;
  rect(x0: number, z0: number, x1: number, z1: number, fill: string): void;
  circle(cx: number, cz: number, r: number, fill: string): void;
  blotches(n: number, colors: string[], rMin: number, rMax: number, alpha: number): void;
  field(x0: number, z0: number, x1: number, z1: number, base: string, stripe: string, alongX: boolean): void;
  road(x0: number, z0: number, x1: number, z1: number, w: number, color?: string, line?: string | null): void;
}
/** Paint the map onto a canvas (world x/z → pixels); it becomes the ground texture and the radar background. */
export function groundCanvas(size: number, half: number, paint: (g: Painter) => void) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  const P = (v: number) => (v + half) / (2 * half) * size;
  const g: Painter = {
    x, P, s: size / (2 * half),
    rect(x0, z0, x1, z1, fill) { x.fillStyle = fill; x.fillRect(P(x0), P(z0), P(x1) - P(x0), P(z1) - P(z0)); },
    circle(cx, cz, r, fill) { x.fillStyle = fill; x.beginPath(); x.arc(P(cx), P(cz), r * g.s, 0, Math.PI * 2); x.fill(); },
    blotches(n, colors, rMin, rMax, alpha) { x.globalAlpha = alpha; for (let i = 0; i < n; i++) { x.fillStyle = pick(colors); x.beginPath(); x.arc(rand(0, size), rand(0, size), rand(rMin, rMax), 0, Math.PI * 2); x.fill(); } x.globalAlpha = 1; },
    field(x0, z0, x1, z1, base, stripe, alongX) {
      g.rect(x0, z0, x1, z1, base); x.fillStyle = stripe;
      if (alongX) for (let z = z0 + 1; z < z1; z += 2.2) x.fillRect(P(x0), P(z), P(x1) - P(x0), Math.max(1, g.s * 0.9));
      else for (let xx = x0 + 1; xx < x1; xx += 2.2) x.fillRect(P(xx), P(z0), Math.max(1, g.s * 0.9), P(z1) - P(z0));
    },
    road(x0, z0, x1, z1, w, color = PAL.road, line = PAL.laneDash) {
      const horiz = Math.abs(z1 - z0) < Math.abs(x1 - x0);
      if (horiz) g.rect(x0, z0 - w / 2, x1, z0 + w / 2, color); else g.rect(x0 - w / 2, z0, x0 + w / 2, z1, color);
      if (!line) return;
      x.fillStyle = line;
      if (horiz) for (let xx = x0; xx < x1; xx += 6) x.fillRect(P(xx), P(z0) - 1, g.s * 3, 2.5);
      else for (let zz = z0; zz < z1; zz += 6) x.fillRect(P(x0) - 1, P(zz), 2.5, g.s * 3);
    },
  };
  paint(g);
  return c;
}
export function addGround(cnv: HTMLCanvasElement, half: number, outerColor: number) {
  const tex = new THREE.CanvasTexture(cnv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  // Ground and outer plane: toon ramp, no rim (a rim would band the far ground) and never inked.
  const mat = new THREE.MeshToonMaterial({ map: tex, gradientMap: TOON_RAMP }), geo = new THREE.PlaneGeometry(half * 2, half * 2).rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(geo, mat); ground.userData.noInk = true; G.world.add(ground);   // §4: ground is never inked
  const ogeo = new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2), omat = new THREE.MeshToonMaterial({ color: outerColor, gradientMap: TOON_RAMP });
  const outer = new THREE.Mesh(ogeo, omat); outer.position.y = -0.06; outer.userData.noInk = true; G.world.add(outer);
  track<{ dispose(): void }>(tex, mat, geo, ogeo, omat);
  MINI.bg = cnv; MINI.half = half;
}
