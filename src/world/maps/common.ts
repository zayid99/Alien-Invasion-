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
export function nightSky(top: number, horizon: number, fog: number, density: number) {
  const sky = gradientSky(top, horizon, 0x070a0c, 900); track(sky.geometry, sky.material as THREE.Material); G.world.add(sky);
  const stars = makeStars(1600, 850, 0.02); track(stars.geometry, stars.material as THREE.Material); G.world.add(stars);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(26, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.6), fog: false, toneMapped: false }));
  moon.position.set(-420, 380, -560); track(moon.geometry, moon.material); G.world.add(moon);
  scene.fog = new THREE.FogExp2(fog, density); scene.background = new THREE.Color(top);
  LIGHT.hemi.color.set(0x7d8cff); LIGHT.hemi.groundColor.set(0x16241a); LIGHT.hemi.intensity = 1.15;
  LIGHT.moon.color.set(0xb8c8ff); LIGHT.moon.intensity = 1.5; LIGHT.moon.position.set(-120, 200, -80);
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
    road(x0, z0, x1, z1, w, color = '#34363d', line = '#d9c35a') {
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
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 }), geo = new THREE.PlaneGeometry(half * 2, half * 2).rotateX(-Math.PI / 2);
  G.world.add(new THREE.Mesh(geo, mat));
  const ogeo = new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2), omat = new THREE.MeshStandardMaterial({ color: outerColor, roughness: 1 });
  const outer = new THREE.Mesh(ogeo, omat); outer.position.y = -0.06; G.world.add(outer);
  track<{ dispose(): void }>(tex, mat, geo, ogeo, omat);
  MINI.bg = cnv; MINI.half = half;
}
