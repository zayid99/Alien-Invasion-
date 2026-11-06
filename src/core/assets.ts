// 3D model pipeline: load the CC0 glTF models, fit them to game size, clone them,
// play animations by meaning ("run", "lifted"...) and batch static scenery.
// Every material is converted to the shared toon look on load (docs/ART_STYLE.md §4-5): toon ramp +
// rim, candy recolours, saturated texture atlases, and an ink outline on every opaque mesh.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { QUALITY } from './engine';
import { TOON_RAMP, applyToon, inkify, toonMaterial } from '../gfx/toon';
import { PAL } from '../gfx/palette';
import { Kit } from '../gfx/kit';

type Family = 'mini' | 'quat' | 'animal' | 'robot' | 'tank' | 'static';
/** ink:false = never outlined (tiny props, §4 "ink:false MODELS flag"). */
interface ModelDef { file: string; height?: number; length?: number; size?: number; scale?: number; rotY?: number; family?: Family; ink?: boolean }

// Mini characters are drawn 10% bigger than before (§5); their hitboxes live in the entity code and are unchanged.
const mini = (f: string): ModelDef => ({ file: f, height: 1.9 * 1.1, family: 'mini' });
export const MODELS: Record<string, ModelDef> = {
  // people
  mini_male_a: mini('mini_male_a'), mini_male_b: mini('mini_male_b'), mini_male_c: mini('mini_male_c'),
  mini_male_d: mini('mini_male_d'), mini_male_e: mini('mini_male_e'), mini_male_f: mini('mini_male_f'),
  mini_female_a: mini('mini_female_a'), mini_female_b: mini('mini_female_b'), mini_female_c: mini('mini_female_c'),
  mini_female_d: mini('mini_female_d'), mini_female_e: mini('mini_female_e'), mini_female_f: mini('mini_female_f'),
  soldier: { file: 'soldier', height: 2.1, family: 'quat' },
  // vehicles (length along z)
  sedan: { file: 'sedan', length: 4.4 }, suv: { file: 'suv', length: 4.6 }, taxi: { file: 'taxi', length: 4.5 },
  police_car: { file: 'police_car', length: 4.8 }, van: { file: 'van', length: 4.7 }, ambulance: { file: 'ambulance', length: 5.4 },
  firetruck: { file: 'firetruck', length: 6.4 }, delivery_van: { file: 'delivery_van', length: 5.4 }, truck: { file: 'truck', length: 4.9 },
  garbage_truck: { file: 'garbage_truck', length: 6.2 }, tractor: { file: 'tractor', length: 3.8 }, hatchback_sports: { file: 'hatchback_sports', length: 4.4 },
  tank: { file: 'tank', length: 6.4, family: 'tank' }, tank_heavy: { file: 'tank_heavy', length: 7.2, family: 'tank' },
  // buildings
  building_a: { file: 'building_a', scale: 8 }, building_b: { file: 'building_b', scale: 8 }, building_c: { file: 'building_c', scale: 8 },
  building_d: { file: 'building_d', scale: 8 }, building_e: { file: 'building_e', scale: 8 }, building_f: { file: 'building_f', scale: 8 },
  building_g: { file: 'building_g', scale: 8 }, building_h: { file: 'building_h', scale: 8 },
  skyscraper_a: { file: 'skyscraper_a', scale: 6.5 }, skyscraper_b: { file: 'skyscraper_b', scale: 6.5 }, skyscraper_c: { file: 'skyscraper_c', scale: 6.5 },
  hangar: { file: 'hangar', scale: 7 },
  // nature (scaled per biome when placed)
  tree_oak: { file: 'tree_oak', scale: 1 }, tree_pine: { file: 'tree_pine', scale: 1 }, tree_pine_tall: { file: 'tree_pine_tall', scale: 1 },
  tree_palm: { file: 'tree_palm', scale: 1 }, tree_autumn: { file: 'tree_autumn', scale: 1 }, tree_fat: { file: 'tree_fat', scale: 1 },
  // snow-biome pines: same meshes, leaves tinted #2e6b5a (§5)
  tree_pine_snow: { file: 'tree_pine', scale: 1 }, tree_pine_tall_snow: { file: 'tree_pine_tall', scale: 1 },
  bush: { file: 'bush', scale: 4 }, bush_large: { file: 'bush_large', scale: 5 }, rock_large: { file: 'rock_large', scale: 4 },
  rock_small: { file: 'rock_small', scale: 4, ink: false }, rock_tall: { file: 'rock_tall', scale: 4 }, cactus: { file: 'cactus', scale: 1 },
  stump: { file: 'stump', scale: 3 }, log: { file: 'log', scale: 3 }, flower_red: { file: 'flower_red', scale: 3, ink: false },
  pumpkin: { file: 'pumpkin', size: 1.1 }, watermelon: { file: 'watermelon', size: 1.1 }, carrot: { file: 'carrot', size: 0.9, ink: false },
  // animals
  deer: { file: 'deer', length: 2.4, family: 'animal' }, fox: { file: 'fox', length: 1.7, family: 'animal' },
  shiba: { file: 'shiba', length: 1.4, family: 'animal' }, cat: { file: 'cat', length: 1.0, family: 'animal' },
  // machines
  mech: { file: 'mech', height: 6.5, family: 'robot' }, mech_heavy: { file: 'mech_heavy', height: 7.5, family: 'robot' },
  turret: { file: 'turret', height: 3.4 }, satellite_dish: { file: 'satellite_dish', height: 8 },
  // Earth artifacts (collectibles)
  pizza: { file: 'pizza', size: 1.3 }, burger: { file: 'burger', size: 1.1 }, donut: { file: 'donut', size: 1.1 }, hot_dog: { file: 'hot_dog', size: 1.3 },
  sushi: { file: 'sushi', size: 1.1 }, taco: { file: 'taco', size: 1.2 }, ice_cream: { file: 'ice_cream', size: 1.2 }, cake: { file: 'cake', size: 1.2 },
};
export const CIVILIAN_MODELS = ['mini_male_a', 'mini_male_b', 'mini_male_d', 'mini_male_f', 'mini_female_a', 'mini_female_b', 'mini_female_c', 'mini_female_d', 'mini_female_f'];
export const SCIENTIST_MODELS = ['mini_male_e', 'mini_female_e'];
export const COP_MODEL = 'mini_male_c';
export const CAR_MODELS = ['sedan', 'suv', 'taxi', 'van', 'truck', 'hatchback_sports', 'delivery_van', 'sedan', 'suv'];
export const ARTIFACTS = ['pizza', 'burger', 'donut', 'hot_dog', 'sushi', 'taco', 'ice_cream', 'cake'];

/** Static props that lose their outline on the low-quality path (§4), decided when a StaticBatch is built. */
const LOW_NO_INK = new Set(['bush', 'stump']);

// Semantic animation names → clip names per model family (first match wins).
const SEM: Record<Family, Record<string, string[]>> = {
  mini: { idle: ['idle'], walk: ['walk'], run: ['sprint'], panic: ['sprint'], runaim: ['sprint'], lifted: ['fall'], stun: ['die'], aim: ['holding-right'], cheer: ['emote-yes'], no: ['emote-no'], wave: ['emote-yes'], punch: ['pick-up'] },
  quat: { idle: ['Idle'], walk: ['Run'], run: ['Run'], panic: ['Run'], lifted: ['Jump_Idle', 'Jump'], stun: ['Death'], aim: ['Idle_Shoot'], runaim: ['Run_Gun'], cheer: ['Yes'], no: ['No'], wave: ['Wave'], hit: ['HitReact'] },
  animal: { idle: ['Idle', 'Idle_2'], walk: ['Walk'], run: ['Gallop'], panic: ['Gallop'], lifted: ['Gallop_Jump', 'Jump_toIdle', 'Jump_ToIdle'], stun: ['Death'], eat: ['Eating'] },
  robot: { idle: ['Idle'], walk: ['Walk', 'Run'], run: ['Run'], aim: ['Shoot_Big', 'Shoot'], stun: ['Death'] },
  tank: { move: ['Tank_Forward'], idle: ['Tank_Forward'] },
  static: {},
};

interface Template { def: ModelDef; root: THREE.Group; clips: THREE.AnimationClip[]; skinned: boolean; parts: { geo: THREE.BufferGeometry; mat: THREE.Material | THREE.Material[]; m: THREE.Matrix4 }[] }
const cache = new Map<string, Template>();
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const BASE = 'assets/models/';

// ---------------------------------------------------------------------------------------------
// Toon conversion (§4 "glTF", §5 "Kenney" / "Quaternius")
// ---------------------------------------------------------------------------------------------

/**
 * Candy recolours, keyed by `modelId:materialName`, or `modelId:nodeName/materialName` for one part
 * (the nearest named ancestor of the mesh). Material names were read from the GLB JSON chunks:
 *   soldier  Black Character_Main Grey Wood DarkGrey Grey2 Red DarkWood LightGrey Skin Pants (helmet = Character_Main on node Head)
 *   tank(_heavy)  Main Main_Light Main_Dark Main_Details (also the track meshes) Wheels
 *   deer  Main_Light Main Main_Dark Hooves Eye_*   fox  Main Main_Light Grey Black   shiba  Main Main_Light Black Eyes_*
 * The textured Quaternius models (cat, mech, mech_heavy) use ATLAS_TINT instead.
 */
const RECOLOR: Record<string, string> = {
  'soldier:Character_Main': PAL.toyArmy, 'soldier:Pants': PAL.toyArmy, 'soldier:Head/Character_Main': PAL.toyArmyHelmet,
  'tank:Main': PAL.tankBody, 'tank:Main_Light': '#8cbf55', 'tank:Main_Dark': '#5e8a34', 'tank:Main_Details': PAL.tankTracks, 'tank:Wheels': PAL.tankTracks,
  'tank_heavy:Main': PAL.tankBody, 'tank_heavy:Main_Light': '#8cbf55', 'tank_heavy:Main_Dark': '#5e8a34', 'tank_heavy:Main_Details': PAL.tankTracks, 'tank_heavy:Wheels': PAL.tankTracks,
  'deer:Main': '#c98a4a', 'deer:Main_Light': '#ecc590', 'deer:Main_Dark': '#8f5a30',
  'fox:Main': '#ff8a3a', 'fox:Main_Light': PAL.cream,
  'shiba:Main': '#ffb060', 'shiba:Main_Light': PAL.cream,
};
/** Textured Quaternius models: atlas recoloured by luminance toward one tint (+ an optional tomato visor swatch). */
const ATLAS_TINT: Record<string, { tint: string; visor?: string }> = {
  cat: { tint: '#8a8fa8' },
  mech: { tint: '#a8b0c8', visor: PAL.tomato }, mech_heavy: { tint: '#a8b0c8', visor: PAL.tomato },
};
/** Leaf tint per tree model (leaf materials are named leafs*): colours are pulled 70% toward it. */
const TREE_TINT: Record<string, string> = {
  tree_oak: PAL.treeLeaf, tree_fat: PAL.treeLeaf, tree_palm: PAL.treeLeaf, tree_pine: PAL.treeLeaf, tree_pine_tall: PAL.treeLeaf,
  tree_autumn: PAL.treeAutumn, tree_pine_snow: PAL.treeSnowPine, tree_pine_tall_snow: PAL.treeSnowPine,
};

// Texture atlases are redrawn once through a canvas; results are cached per (operation, source image).
const IMG_CACHE = new Map<string, WeakMap<object, HTMLCanvasElement>>();
const PROCESSED = new WeakSet<object>();
function redrawTexture(tex: THREE.Texture, op: string, fn: (px: Uint8ClampedArray) => void) {
  const img = tex.image as (CanvasImageSource & { width: number; height: number }) | null;
  if (!img || !img.width || !img.height || PROCESSED.has(img)) return;
  let cache = IMG_CACHE.get(op); if (!cache) IMG_CACHE.set(op, (cache = new WeakMap()));
  let c = cache.get(img);
  if (!c) {
    try {
      c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height); fn(d.data); x.putImageData(d, 0, 0);
    } catch (e) { console.warn('atlas redraw failed', e); return; }
    cache.set(img, c); PROCESSED.add(c);
  }
  tex.image = c; tex.needsUpdate = true;   // the Source may be shared: every texture using it gets the new image
}
/** Saturation ×s with the CSS saturate() matrix (sRGB bytes). */
function saturate(s: number) {
  return (p: Uint8ClampedArray) => {
    for (let i = 0; i < p.length; i += 4) {
      const r = p[i], g = p[i + 1], b = p[i + 2];
      p[i] = (0.213 + 0.787 * s) * r + (0.715 - 0.715 * s) * g + (0.072 - 0.072 * s) * b;
      p[i + 1] = (0.213 - 0.213 * s) * r + (0.715 + 0.285 * s) * g + (0.072 - 0.072 * s) * b;
      p[i + 2] = (0.213 - 0.213 * s) * r + (0.715 - 0.715 * s) * g + (0.072 + 0.928 * s) * b;
    }
  };
}
/**
 * Recolour an atlas toward `tint` by luminance (a pixel as bright as the tint becomes the tint).
 * With `visor`, the most vivid small swatch (≤ 6 px, HSV sat×value > 0.5) becomes that colour instead:
 * the "visor" fallback for atlases whose parts cannot be matched by material name.
 */
function tintAtlas(tint: string, visor?: string) {
  const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const T = hex(tint), V = visor ? hex(visor) : null, lt = (0.2126 * T[0] + 0.7152 * T[1] + 0.0722 * T[2]) || 1;
  return (p: Uint8ClampedArray) => {
    let pick = -1;
    if (V) {
      const count = new Map<number, number>();
      for (let i = 0; i < p.length; i += 4) { const k = (p[i] << 16) | (p[i + 1] << 8) | p[i + 2]; count.set(k, (count.get(k) || 0) + 1); }
      let best = 0.5;
      for (const [k, n] of count) {
        if (n > 6) continue;
        const r = k >> 16, g = (k >> 8) & 255, b = k & 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        const score = mx ? ((mx - mn) / mx) * (mx / 255) : 0;
        if (score > best) { best = score; pick = k; }
      }
    }
    for (let i = 0; i < p.length; i += 4) {
      if (pick >= 0 && ((p[i] << 16) | (p[i + 1] << 8) | p[i + 2]) === pick) { p[i] = V[0]; p[i + 1] = V[1]; p[i + 2] = V[2]; continue; }
      const k = (0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2]) / lt;
      p[i] = T[0] * k; p[i + 1] = T[1] * k; p[i + 2] = T[2] * k;
    }
  };
}

const _hsl = { h: 0, s: 0, l: 0 };
type AnyMat = THREE.Material & { color?: THREE.Color; map?: THREE.Texture | null; emissive?: THREE.Color; emissiveMap?: THREE.Texture | null; vertexColors?: boolean };
/** Convert one glTF material (Standard or unlit Basic) to a toon material in the shared 'toon-std' program. */
function toToon(m: AnyMat, id: string, part: string | null): THREE.MeshToonMaterial {
  const t = new THREE.MeshToonMaterial({
    map: m.map ?? null, color: m.color ? m.color.clone() : 0xffffff, vertexColors: !!m.vertexColors,
    transparent: m.transparent, opacity: m.opacity, side: m.side, alphaTest: m.alphaTest,
    emissive: m.emissive ? m.emissive.clone() : 0x000000, emissiveMap: m.emissiveMap ?? null, gradientMap: TOON_RAMP,
  });
  t.name = m.name;
  const recolor = (part && RECOLOR[`${id}:${part}/${m.name}`]) || RECOLOR[`${id}:${m.name}`];
  const atlas = ATLAS_TINT[id];
  if (recolor) t.color.set(recolor);
  else if (t.map) {
    if (atlas) redrawTexture(t.map, `tint:${atlas.tint}:${atlas.visor || ''}`, tintAtlas(atlas.tint, atlas.visor));
    else redrawTexture(t.map, 'sat1.2', saturate(1.2));   // Kenney colormap: saturation ×1.2, once per image
  } else {
    // Untextured: candy HSL boost (in sRGB terms), then tree leaves pulled toward their tint.
    t.color.getHSL(_hsl, THREE.SRGBColorSpace);
    t.color.setHSL(_hsl.h, Math.min(1, _hsl.s * 1.25), Math.min(0.85, _hsl.l + 0.04), THREE.SRGBColorSpace);
    if (TREE_TINT[id] && /^leafs/i.test(m.name)) t.color.lerp(new THREE.Color(TREE_TINT[id]), 0.7);
  }
  return applyToon(t, 'std');
}
/**
 * glTF node/mesh name of the nearest named ancestor of a mesh, for per-part recolours. GLTFLoader
 * makes names unique ('Head', 'Head_1', ...), so the numeric suffix is stripped.
 */
function partName(o: THREE.Object3D, stop: THREE.Object3D) {
  for (let p: THREE.Object3D | null = o; p && p !== stop; p = p.parent) { const n = p.userData.name || p.name; if (n) return String(n).replace(/_\d+$/, ''); }
  return null;
}
/** A flat cream 5-point star decal (tanks, §5), built with the Kit so it is toon shaded; decals are not inked. */
function starDecal(r: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5, k = i % 2 ? r * 0.42 : r; i ? s.lineTo(Math.cos(a) * k, Math.sin(a) * k) : s.moveTo(Math.cos(a) * k, Math.sin(a) * k); }
  const k = new Kit(); k.add(new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2), PAL.cream);
  const g = k.build(undefined, false); g.name = 'star_decal'; return g;
}

// Some hosts can't serve .glb files; a page can set window.__assetMode = 'b64' to load base64 copies (*.glb.txt) instead.
const B64 = (window as any).__assetMode === 'b64';
async function fetchModel(file: string) {
  if (!B64) return loader.loadAsync(BASE + file + '.glb');
  const r = await fetch(BASE + file + '.glb.txt'); if (!r.ok) throw new Error('missing ' + file);
  const bin = Uint8Array.from(atob((await r.text()).trim()), ch => ch.charCodeAt(0));
  return loader.parseAsync(bin.buffer, BASE);
}
async function loadOne(id: string) {
  const def = MODELS[id]; const g = await fetchModel(def.file);
  let skinned = false;
  const converted = new Map<string, THREE.MeshToonMaterial>();   // glTF materials are shared between meshes: convert each once
  const conv = (m: THREE.Material, part: string | null) => {
    const key = m.uuid + '|' + ((part && RECOLOR[`${id}:${part}/${m.name}`]) ? part : '');
    let t = converted.get(key); if (!t) converted.set(key, (t = toToon(m as AnyMat, id, part)));
    return t;
  };
  g.scene.traverse((o: any) => {
    if (o.isMesh) {
      const part = partName(o, g.scene);
      o.material = Array.isArray(o.material) ? o.material.map((m: THREE.Material) => conv(m, part)) : conv(o.material, part);
      if (o.isSkinnedMesh) { skinned = true; o.computeBoundingSphere(); o.boundingSphere.radius *= 1.8; }   // animated: cull off-screen, with a safety margin
      // Low path: skip the wheel outlines of cars (they sit under the inked body), to save draw calls.
      if (QUALITY === 'low' && /^wheel/i.test(o.name)) o.userData.noInk = true;
    }
  });
  if (def.ink !== false) inkify(g.scene);   // ink hull + 'onormal' once per glTF geometry, shared by every copy
  g.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g.scene), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  let s = def.scale ?? 1;
  if (def.height) s = def.height / size.y; else if (def.length) s = def.length / Math.max(size.x, size.z); else if (def.size) s = def.size / Math.max(size.x, size.y, size.z);
  const inner = g.scene; inner.scale.multiplyScalar(s); inner.position.set(-c.x * s, -box.min.y * s, -c.z * s); inner.rotation.y = def.rotY ?? 0;
  const root = new THREE.Group(); root.add(inner); root.updateMatrixWorld(true);
  if (def.family === 'tank') {
    // Cream star on top of the turret, parented to the turret node so it turns with it.
    const turret = root.getObjectByName('Tank_Turret');
    const tb = turret ? new THREE.Box3().setFromObject(turret) : null;
    if (turret && !tb.isEmpty()) {   // (an empty box would put the star at -Infinity)
      const tc = tb.getCenter(new THREE.Vector3()), ts = tb.getSize(new THREE.Vector3());
      const star = starDecal(Math.min(ts.x, ts.z) * 0.2); star.position.set(tc.x, tb.max.y + 0.02, tc.z);
      root.add(star); root.updateMatrixWorld(true); turret.attach(star);
    }
  }
  const parts: Template['parts'] = [];
  if (!skinned) root.traverse((o: any) => { if (o.isMesh) parts.push({ geo: o.geometry, mat: o.material, m: o.matrixWorld.clone() }); });
  cache.set(id, { def, root, clips: g.animations, skinned, parts });
}
/** Load models (6 at a time). Missing files are reported but never stop the game. */
export async function preload(ids: string[], onProgress?: (done: number, total: number) => void) {
  const todo = ids.filter(id => !cache.has(id) && MODELS[id]); let done = 0, i = 0;
  const worker = async () => { while (i < todo.length) { const id = todo[i++]; try { await loadOne(id); } catch (e) { console.warn('model failed', id, e); } done++; onProgress?.(done, todo.length); } };
  await Promise.all(Array.from({ length: 6 }, worker));
}
export const hasModel = (id: string) => cache.has(id);
/**
 * What the title scene and the training night use (measured): loaded before play starts. Everything else loads in
 * the background while the player is in training, and every screen transition waits for it (UI.beforeSwap).
 */
export const FIRST_NIGHT = ['building_a', 'building_c', 'building_d', 'hangar', 'satellite_dish', 'tree_fat', 'tree_oak', 'tree_autumn', 'tree_pine',
  'flower_red', 'rock_small', 'bush', 'stump', 'mini_male_a', 'mini_male_b', 'mini_male_c', 'mini_male_d', 'mini_male_e', 'mini_male_f',
  'mini_female_a', 'mini_female_b', 'mini_female_c', 'mini_female_d', 'mini_female_e', 'mini_female_f', 'fox', 'deer', 'shiba', 'cat',
  'watermelon', 'pumpkin', 'van', 'suv', 'truck', 'taxi', 'sedan', 'tractor', 'delivery_van', 'hatchback_sports'];
export const allModelIds = () => Object.keys(MODELS);

export interface ModelInstance { root: THREE.Group; mixer: THREE.AnimationMixer | null; family: Family; clips: THREE.AnimationClip[]; action: THREE.AnimationAction | null; anim: string }
/** A fresh copy of a model (bones are cloned too, so every person animates on their own). Copies share the template's toon + ink materials. */
/** Every model id a scene asked for (used to work out what the first night needs). */
export const USED = new Set<string>();
export function instance(id: string): ModelInstance {
  USED.add(id); const t = cache.get(id);
  if (!t) { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1.8, 0.6).translate(0, 0.9, 0), toonMaterial({ color: 0xff00ff }))); inkify(g); return { root: g, mixer: null, family: 'static', clips: [], action: null, anim: '' }; }
  const root = (t.skinned ? skeletonClone(t.root) : t.root.clone(true)) as THREE.Group;
  return { root, mixer: t.clips.length ? new THREE.AnimationMixer(root) : null, family: t.def.family || 'static', clips: t.clips, action: null, anim: '' };
}
function findClip(inst: ModelInstance, sem: string) {
  const names = SEM[inst.family]?.[sem] || [sem];
  for (const n of names) { const c = inst.clips.find(k => (k.name.split('|').pop() || '').toLowerCase() === n.toLowerCase()); if (c) return c; }
  return null;
}
/** Play an animation by meaning, cross-fading from the current one. */
export function play(inst: ModelInstance, sem: string, o: { fade?: number; once?: boolean; speed?: number } = {}) {
  if (!inst.mixer) return;
  if (inst.anim === sem && inst.action) { if (o.speed) inst.action.timeScale = o.speed; return; }
  const clip = findClip(inst, sem); if (!clip) return;
  const a = inst.mixer.clipAction(clip);
  a.reset(); a.enabled = true; a.timeScale = o.speed ?? 1;
  a.setLoop(o.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = !!o.once;
  if (inst.action && inst.action !== a) { a.crossFadeFrom(inst.action, o.fade ?? 0.2, false); }
  a.play(); inst.action = a; inst.anim = sem;
}

/** Many copies of static models (trees, rocks, buildings) drawn as InstancedMesh: one draw call per model part. */
export class StaticBatch {
  private items = new Map<string, THREE.Matrix4[]>();
  add(id: string, x: number, y: number, z: number, ry = 0, s = 1) {
    USED.add(id); if (!cache.has(id)) return;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(s, s, s));
    (this.items.get(id) || this.items.set(id, []).get(id)).push(m);
  }
  /** One InstancedMesh per model part; inked parts keep their [toon, ink] material (+1 draw each). */
  build(): THREE.Group {
    const g = new THREE.Group(), tmp = new THREE.Matrix4();
    for (const [id, mats] of this.items) {
      const noInk = QUALITY === 'low' && LOW_NO_INK.has(id);
      for (const p of cache.get(id).parts) {
        const im = new THREE.InstancedMesh(p.geo, noInk && Array.isArray(p.mat) ? p.mat[0] : p.mat, mats.length);
        mats.forEach((m, i) => im.setMatrixAt(i, tmp.multiplyMatrices(m, p.m)));
        im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); g.add(im);
      }
    }
    return g;
  }
}
