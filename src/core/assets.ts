// 3D model pipeline: load the CC0 glTF models, fit them to game size, clone them,
// play animations by meaning ("run", "lifted"...) and batch static scenery.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';

type Family = 'mini' | 'quat' | 'animal' | 'robot' | 'tank' | 'static';
interface ModelDef { file: string; height?: number; length?: number; size?: number; scale?: number; rotY?: number; family?: Family }

const mini = (f: string): ModelDef => ({ file: f, height: 1.9, family: 'mini' });
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
  bush: { file: 'bush', scale: 4 }, bush_large: { file: 'bush_large', scale: 5 }, rock_large: { file: 'rock_large', scale: 4 },
  rock_small: { file: 'rock_small', scale: 4 }, rock_tall: { file: 'rock_tall', scale: 4 }, cactus: { file: 'cactus', scale: 1 },
  stump: { file: 'stump', scale: 3 }, log: { file: 'log', scale: 3 }, flower_red: { file: 'flower_red', scale: 3 },
  pumpkin: { file: 'pumpkin', size: 1.1 }, watermelon: { file: 'watermelon', size: 1.1 }, carrot: { file: 'carrot', size: 0.9 },
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

// Semantic animation names → clip names per model family (first match wins).
const SEM: Record<Family, Record<string, string[]>> = {
  mini: { idle: ['idle'], walk: ['walk'], run: ['sprint'], panic: ['sprint'], runaim: ['sprint'], lifted: ['fall'], stun: ['die'], aim: ['holding-right'], cheer: ['emote-yes'], no: ['emote-no'], wave: ['emote-yes'], punch: ['pick-up'] },
  quat: { idle: ['Idle'], walk: ['Run'], run: ['Run'], panic: ['Run'], lifted: ['Jump_Idle', 'Jump'], stun: ['Death'], aim: ['Idle_Shoot'], runaim: ['Run_Gun'], cheer: ['Yes'], no: ['No'], wave: ['Wave'], hit: ['HitReact'] },
  animal: { idle: ['Idle', 'Idle_2'], walk: ['Walk'], run: ['Gallop'], panic: ['Gallop'], lifted: ['Gallop_Jump', 'Jump_toIdle', 'Jump_ToIdle'], stun: ['Death'], eat: ['Eating'] },
  robot: { idle: ['Idle'], walk: ['Walk', 'Run'], run: ['Run'], aim: ['Shoot_Big', 'Shoot'], stun: ['Death'] },
  tank: { move: ['Tank_Forward'], idle: ['Tank_Forward'] },
  static: {},
};

interface Template { def: ModelDef; root: THREE.Group; clips: THREE.AnimationClip[]; skinned: boolean; parts: { geo: THREE.BufferGeometry; mat: THREE.Material; m: THREE.Matrix4 }[] }
const cache = new Map<string, Template>();
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const BASE = 'assets/models/';

function toLit(m: THREE.Material): THREE.Material {
  if ((m as THREE.MeshBasicMaterial).isMeshBasicMaterial) {
    const b = m as THREE.MeshBasicMaterial;
    return new THREE.MeshStandardMaterial({ color: b.color, map: b.map, transparent: b.transparent, opacity: b.opacity, side: b.side, vertexColors: b.vertexColors, roughness: 0.85, metalness: 0 });
  }
  const s = m as THREE.MeshStandardMaterial; if (s.isMeshStandardMaterial) { s.roughness = Math.max(0.45, s.roughness); s.envMapIntensity = 0.8; }
  return m;
}
async function loadOne(id: string) {
  const def = MODELS[id]; const g = await loader.loadAsync(BASE + def.file + '.glb');
  let skinned = false;
  g.scene.traverse((o: any) => {
    if (o.isMesh) {
      o.material = Array.isArray(o.material) ? o.material.map(toLit) : toLit(o.material);
      if (o.isSkinnedMesh) { skinned = true; o.computeBoundingSphere(); o.boundingSphere.radius *= 1.8; }   // animated: cull off-screen, with a safety margin
    }
  });
  g.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g.scene), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  let s = def.scale ?? 1;
  if (def.height) s = def.height / size.y; else if (def.length) s = def.length / Math.max(size.x, size.z); else if (def.size) s = def.size / Math.max(size.x, size.y, size.z);
  const inner = g.scene; inner.scale.multiplyScalar(s); inner.position.set(-c.x * s, -box.min.y * s, -c.z * s); inner.rotation.y = def.rotY ?? 0;
  const root = new THREE.Group(); root.add(inner); root.updateMatrixWorld(true);
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
export const allModelIds = () => Object.keys(MODELS);

export interface ModelInstance { root: THREE.Group; mixer: THREE.AnimationMixer | null; family: Family; clips: THREE.AnimationClip[]; action: THREE.AnimationAction | null; anim: string }
/** A fresh copy of a model (bones are cloned too, so every person animates on their own). */
export function instance(id: string): ModelInstance {
  const t = cache.get(id);
  if (!t) { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1.8, 0.6).translate(0, 0.9, 0), new THREE.MeshStandardMaterial({ color: 0xff00ff }))); return { root: g, mixer: null, family: 'static', clips: [], action: null, anim: '' }; }
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
    if (!cache.has(id)) return;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(s, s, s));
    (this.items.get(id) || this.items.set(id, []).get(id)).push(m);
  }
  build(): THREE.Group {
    const g = new THREE.Group(), tmp = new THREE.Matrix4();
    for (const [id, mats] of this.items) {
      for (const p of cache.get(id).parts) {
        const im = new THREE.InstancedMesh(p.geo, p.mat, mats.length);
        mats.forEach((m, i) => im.setMatrixAt(i, tmp.multiplyMatrices(m, p.m)));
        im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); g.add(im);
      }
    }
    return g;
  }
}
